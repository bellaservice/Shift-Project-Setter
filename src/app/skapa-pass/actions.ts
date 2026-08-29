import { supabase } from "@/lib/supabase/browser";
import { optionalString, requiredString } from "@/lib/formData";

/**
 * Schemalaggningen: arbetsledaren lagger ut pass i FORVAG.
 *
 * Skillnaden mot Logga Timmar, som ar lattast att blanda ihop:
 *
 *   Logga Timmar   Arbetet ar redan gjort. Raden fods med `hours` ifyllt och
 *                  status 'confirmed'. Den nar aldrig bekraftelsekon.
 *   Skapa Pass     Arbetet ska hanta. Raden fods med `hours` NULL och status
 *                  'open' utan klockslag -- alltsa "schemalagt, inte pabörjat"
 *                  (spec 8.4c). Arbetaren stamplar in pa den, och
 *                  arbetsledaren satter timmarna nar passet ar over.
 *
 * `hours` far alltsa INTE sattas har. Ett schemalagt pass har inga arbetade
 * timmar an, och en nolla hade betytt "arbetaren var har och jobbade inte".
 *
 * ⚠️ Det har ar INTE spec Fas 1 i sin helhet. Det finns ingen headcount, ingen
 * automatisk tillsattning, inga forval och ingen Priolista -- arbetsledaren
 * pekar ut arbetarna sjalv. Se avsnitt 8.6 i shift-system-spec.md.
 */

/**
 * Dagarna som malats i kalendern, som 'YYYY-MM-DD'.
 *
 * Flera, inte en: hela poangen med kalendersteget ar att fylla i EN gang och
 * lagga ut passet pa alla valda dagar. Set:et tar hand om en dag som rakat
 * skickas tva ganger.
 *
 * Formatet kollas har och inte bara i kalendern, eftersom formData ar
 * webblasarens och inte vart — ett falt gar att andra innan det skickas.
 */
function shiftDates(formData: FormData): string[] {
  const datum = [
    ...new Set(
      formData
        .getAll("datum")
        .map((v) => String(v).trim())
        .filter((v) => v !== "")
    ),
  ].sort();

  if (datum.length === 0) throw new Error("Valj minst en dag i kalendern");

  for (const d of datum) {
    if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d)) {
      throw new Error(`"${d}" ar inte ett giltigt datum`);
    }
  }
  return datum;
}

/**
 * Planerade "Pass Tider". Frivilliga, men antingen bada eller ingen:
 * shifts_pass_times_paired avvisar ett halvifyllt spann anda, och ett fel pa
 * svenska ar begripligare an ett constraint-fel.
 *
 * OBS att de har ar PLANERADE tider och inte stamplingar. De sager nar passet
 * ska borja och sluta, och de skrivs ut som "Pass Tider" i Arbetsdagboken.
 * Vad som faktiskt hande hamnar i clock_in_time/clock_out_time.
 */
function plannedTime(
  value: FormDataEntryValue | null,
  fieldLabel: string
): string | null {
  const raw = optionalString(value);
  if (raw === null) return null;

  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(raw);
  if (!match) throw new Error(`${fieldLabel} maste vara en tid, t.ex. 07:00`);
  return `${match[1]}:${match[2]}:${match[3] ?? "00"}`;
}

/**
 * Passets PLANERADE timmar — det som ska betalas, inte spannet.
 *
 * Frivilligt. Lamnas det tomt fods passet med `hours` null, precis som forr,
 * och arbetsledaren satter siffran vid bekraftelsen.
 *
 * ⚠️ Vardet skrivs i `shifts.hours`, samma kolumn som bekraftelsen sedan
 * skriver i. Det ar avsiktligt: `hours` ar "vad passet ar vart i timmar", och
 * `status` sager om siffran ar planerad eller slutgiltig. Priset ar att varje
 * SUMMA over hours maste filtrera pa status = 'confirmed', annars raknas
 * planerad tid som arbetad. Alla summor i queries.ts gor det.
 */
function plannedHours(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (raw === "") return null;

  const timmar = Number(raw);
  if (!Number.isFinite(timmar)) throw new Error("Timmarna maste vara ett tal");
  if (timmar < 0) throw new Error("Timmarna kan inte vara negativa");
  if (timmar > 24) throw new Error("Ett pass kan inte vara langre an 24 timmar");
  return timmar;
}

export async function skapaPass(formData: FormData): Promise<string> {
  const dagar = shiftDates(formData);
  const projectId = requiredString(formData.get("project_id"), "Project");
  const timmar = plannedHours(formData.get("timmar"));

  const start_time = plannedTime(formData.get("start_time"), "Pass start");
  const end_time = plannedTime(formData.get("end_time"), "Pass slut");
  if ((start_time === null) !== (end_time === null)) {
    throw new Error("Fyll i bade Pass start och Pass slut, eller lamna bada tomma");
  }

  // Set: samma arbetare vald pa tva rader ska bli ett pass, inte tva.
  const workerIds = [
    ...new Set(
      formData
        .getAll("worker_id")
        .map((v) => String(v))
        .filter((v) => v.length > 0)
    ),
  ];
  if (workerIds.length === 0) throw new Error("Valj minst en arbetare");

  /**
   * Dubbletthindret.
   *
   * Ingen unik nyckel i databasen forbjuder tva pass pa samma arbetare, project
   * och dag -- och det ska den inte heller, for delade dagar ar en riktig sak.
   * Men att lagga ut samma pass tva ganger ar nastan alltid ett dubbeltryck
   * eller ett andra forsok efter att natet hackat, och da ska arbetaren inte
   * mota tva identiska rader att stampla in pa.
   *
   * Bara OBEKRAFTADE pass raknas som dubbletter: ett redan bekraftat pass
   * samma dag ar historik, och historik hindrar ingen fran att jobba igen.
   */
  const { data: befintliga, error: kollError } = await supabase
    .from("shifts")
    .select("shift_date, workers!inner(name)")
    .eq("project_id", projectId)
    .in("shift_date", dagar)
    .neq("status", "confirmed")
    .in("worker_id", workerIds);

  if (kollError) {
    throw new Error(`Kunde inte kontrollera befintliga pass: ${kollError.message}`, {
      cause: kollError,
    });
  }

  if ((befintliga ?? []).length > 0) {
    // Namnet OCH dagen, nu nar det kan vara flera dagar pa en gang: "Anna har
    // redan ett pass" sager inte vilken av de sju dagarna som ar upptagen.
    const krockar = [
      ...new Set(
        (befintliga ?? []).map((rad) => {
          const w = rad.workers as unknown as { name: string } | null;
          return `${w?.name ?? "Okand arbetare"} ${rad.shift_date}`;
        })
      ),
    ].sort((a, b) => a.localeCompare(b, "sv"));

    throw new Error(
      krockar.length === 1
        ? `${krockar[0]} — det passet finns redan.`
        : `Dessa pass finns redan: ${krockar.join(", ")}.`
    );
  }

  // En rad per arbetare och dag. Ett pass pa fem dagar med tre arbetare blir
  // femton rader, eftersom en rad i shifts ar en persons arbete en dag.
  const rader = dagar.flatMap((shift_date) =>
    workerIds.map((worker_id) => ({
      project_id: projectId,
      worker_id,
      shift_date,
      // Schemalagt, inte pabörjat: ingen stampling.
      status: "open",
      // Det planerade timtalet, eller null nar arbetsledaren lamnat det oppet.
      // Siffran blir slutgiltig forst vid bekraftelsen — fram till dess sager
      // `status` att den ar en plan.
      hours: timmar,
      start_time,
      end_time,
    }))
  );

  const { error } = await supabase.from("shifts").insert(rader);

  if (error) {
    throw new Error(`Kunde inte skapa passen: ${error.message}`, { cause: error });
  }

  return `/skapa-pass?skapat=${rader.length}`;
}
