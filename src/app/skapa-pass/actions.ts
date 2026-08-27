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

/** Datumfaltet skickar tre tal. Samma form som logShifts lasar dem i. */
function shiftDate(formData: FormData): string {
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const day = Number(formData.get("day"));
  if (!year || !month || !day) throw new Error("Pass Datum kravs");
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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

export async function skapaPass(formData: FormData): Promise<string> {
  const datum = shiftDate(formData);
  const projectId = requiredString(formData.get("project_id"), "Project");

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
    .select("worker_id, workers!inner(name)")
    .eq("project_id", projectId)
    .eq("shift_date", datum)
    .neq("status", "confirmed")
    .in("worker_id", workerIds);

  if (kollError) {
    throw new Error(`Kunde inte kontrollera befintliga pass: ${kollError.message}`, {
      cause: kollError,
    });
  }

  if ((befintliga ?? []).length > 0) {
    const namn = (befintliga ?? [])
      .map((rad) => {
        const w = rad.workers as unknown as { name: string } | null;
        return w?.name ?? "Okand arbetare";
      })
      .sort((a, b) => a.localeCompare(b, "sv"));
    throw new Error(
      namn.length === 1
        ? `${namn[0]} har redan ett pass pa det har projectet den dagen.`
        : `Dessa har redan pass pa det har projectet den dagen: ${namn.join(", ")}.`
    );
  }

  const { error } = await supabase.from("shifts").insert(
    workerIds.map((worker_id) => ({
      project_id: projectId,
      worker_id,
      shift_date: datum,
      // Schemalagt, inte pabörjat: ingen stampling, inga timmar.
      status: "open",
      hours: null,
      start_time,
      end_time,
    }))
  );

  if (error) {
    throw new Error(`Kunde inte skapa passen: ${error.message}`, { cause: error });
  }

  // Tillbaka till skarmen som visar vad som nu ligger ute.
  return "/skapa-pass?skapat=1";
}
