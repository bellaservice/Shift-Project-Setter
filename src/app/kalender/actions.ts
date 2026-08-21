
import { supabase } from "@/lib/supabase/browser";
import { optionalString, requiredString } from "@/lib/formData";
import { ARENDE_FARGER } from "@/lib/arendeFarger";
import type { ArendeSynlighet } from "@/lib/types";

/** De tre synligheterna, som `arenden_synlighet_check` stavar dem. */
const SYNLIGHETER: ArendeSynlighet[] = ["alla", "egen", "valda"];

/**
 * Kalenderns skrivningar: ett rattat pass, och ett arende som skapas, andras
 * eller raderas.
 *
 * Passet och arendet delar dagens och tidernas hantering men ar i ovrigt tva
 * olika saker -- se migration 20260821120000_arenden.sql for varfor de inte ar
 * samma tabell.
 */

/**
 * Tidshjulet skickar 'HH:MM'. Normaliseras till 'HH:MM:SS' for Postgres `time`,
 * eller null nar faltet lamnats tomt. Bada tabellerna halier paret ihop med ett
 * constraint (shifts_pass_times_paired, arenden_times_paired), sa halva svaret
 * avvisas har -- ett fel pa svenska ar begripligare an ett constraint-fel.
 */
function optionalTime(
  value: FormDataEntryValue | null,
  fieldLabel: string
): string | null {
  const raw = optionalString(value);
  if (raw === null) return null;

  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(raw);
  if (!match) throw new Error(`${fieldLabel} maste vara en tid, t.ex. 07:00`);
  return `${match[1]}:${match[2]}:${match[3] ?? "00"}`;
}

/** Bada tiderna, eller ingen. */
function timePair(
  formData: FormData,
  startField: string,
  endField: string
): { start_time: string | null; end_time: string | null } {
  const start_time = optionalTime(formData.get(startField), "Starttid");
  const end_time = optionalTime(formData.get(endField), "Sluttid");
  if ((start_time === null) !== (end_time === null)) {
    throw new Error("Fyll i bade start och slut, eller lamna bada tomma");
  }
  return { start_time, end_time };
}

/** <DateSelect> skickar tre falt. Ihopsatta till 'YYYY-MM-DD'. */
function dateFromForm(formData: FormData, fieldLabel: string): string {
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const day = Number(formData.get("day"));
  if (!year || !month || !day) throw new Error(`${fieldLabel} kravs`);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Tillbaka till kalendern, oppnad pa den dag raden nu ligger pa. Andrade man
 *  dagen ar det den NYA dagen man ska till -- det ar dit raden flyttade. */
function calendarPath(date: string): string {
  return `/kalender?datum=${date}`;
}

/**
 * Ett rattat pass.
 *
 * Fyra falt gar att andra: dagen, projectet, tiderna och timmarna. Arbetaren gor
 * det inte, och det ar inte en forbiseelse -- ett pass som byter arbetare ar
 * inte ett rattat pass, det ar ett borttaget och ett nytt, och de tva timmarna
 * skulle flytta mellan tva personers loner utan att nagot i appen sagt det.
 * Skarmen visar darfor arbetaren men erbjuder inte ett falt for henne.
 */
export async function saveShift(formData: FormData) {
  const id = requiredString(formData.get("id"), "Pass");

  const hours = Number(formData.get("hours"));
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error("Pass Timmar maste vara ett tal storre an 0");
  }

  const shift_date = dateFromForm(formData, "Pass Datum");
  const project_id = requiredString(formData.get("project_id"), "Project");
  const { start_time, end_time } = timePair(formData, "start_time", "end_time");

  const { error } = await supabase
    .from("shifts")
    .update({ shift_date, project_id, hours, start_time, end_time })
    .eq("id", id);
  if (error) throw new Error(`Kunde inte spara passet: ${error.message}`);

  return calendarPath(shift_date);
}

/**
 * Ett arende, nytt eller andrat.
 *
 * Ett dolt `id` ar hela skillnaden mellan de tva: finns det ar raden en andring,
 * annars ar den ny. Samma formular bada gangerna, av samma skal som Logga
 * Project anvander sitt for bade nytt och sparat -- falten ar desamma, och tva
 * kopior av dem ar tva stallen att glomma ett falt pa.
 *
 * `skapad_av` skickas INTE med. Den sätts av kit.arenden_set_skapad_av() i
 * databasen och klientens varde slangs -- se migrationen. Ett falt som avgor
 * vem som far se raden far inte fyllas i av den som skickar den.
 */
export async function saveArende(formData: FormData) {
  const titel = requiredString(formData.get("titel"), "Titel");
  const arende_date = dateFromForm(formData, "Datum");
  // Tidsfaltet ligger bakom en kryssruta i formularet. Ar den av renderas inte
  // hjulen alls, sa falten saknas i formData och arendet blir en heldag.
  const { start_time, end_time } = timePair(formData, "start_time", "end_time");

  const farg = requiredString(formData.get("farg"), "Farg");
  if (!ARENDE_FARGER.some((f) => f.value === farg)) {
    throw new Error(`Okand farg: ${farg}`);
  }

  const synlighet = requiredString(formData.get("synlighet"), "Synlighet");
  if (!SYNLIGHETER.includes(synlighet as ArendeSynlighet)) {
    throw new Error(`Okand synlighet: ${synlighet}`);
  }

  const row = {
    titel,
    anteckning: optionalString(formData.get("anteckning")),
    arende_date,
    start_time,
    end_time,
    plats: optionalString(formData.get("plats")),
    farg,
    synlighet,
  };

  const id = optionalString(formData.get("id"));

  // `select("id")` pa insert: den nya radens id behovs for tittarraderna, och
  // utan det maste den lasas tillbaka i en andra fraga.
  const { data, error } = id
    ? await supabase.from("arenden").update(row).eq("id", id).select("id").maybeSingle()
    : await supabase.from("arenden").insert(row).select("id").maybeSingle();

  if (error) throw new Error(`Kunde inte spara arendet: ${error.message}`);

  // Noll rader tillbaka pa en UPDATE betyder att RLS inte slappte fram raden:
  // arendet finns, men inte for den som frager. Ett tyst "sparat" pa en
  // andring som inte hande ar det varsta av bada varldarna.
  const arendeId = (data as { id: string } | null)?.id;
  if (!arendeId) {
    throw new Error("Arendet gick inte att spara -- det kan ha raderats.");
  }

  await saveTittare(arendeId, synlighet as ArendeSynlighet, formData);

  return calendarPath(arende_date);
}

/**
 * Vilka konton ett 'valda'-arende visas for.
 *
 * Skrivs om fran grunden: bort med allt som star pa arendet, in med det som ar
 * ikryssat. En diff hade varit farre rader over natet och ett stalle till dar
 * en bortglomd rad kan bli kvar och fortsatta ge nagon insyn.
 *
 * Ar synligheten nagot annat an 'valda' tommas listan. Ett arende som gatt fran
 * 'valda' till 'egen' ska inte bara sluta visa raderna -- de ska vara borta, sa
 * att en atergang till 'valda' bjuder in de man valjer da och inte de man valde
 * for tre veckor sedan.
 *
 * Bada skrivningarna vaktas av kit.arende_agare() i databasen, sa den som inte
 * skapade arendet far ett fel har snarare an en tyst andring.
 */
async function saveTittare(
  arendeId: string,
  synlighet: ArendeSynlighet,
  formData: FormData
) {
  const kontoIds =
    synlighet === "valda"
      ? [
          ...new Set(
            formData
              .getAll("konto_id")
              .map((v) => String(v))
              .filter((v) => v.length > 0)
          ),
        ]
      : [];

  const { error: deleteError } = await supabase
    .from("arende_tittare")
    .delete()
    .eq("arende_id", arendeId);
  if (deleteError) {
    throw new Error(`Kunde inte spara arendets konton: ${deleteError.message}`);
  }

  if (kontoIds.length === 0) return;

  const { error } = await supabase
    .from("arende_tittare")
    .insert(kontoIds.map((konto_id) => ({ arende_id: arendeId, konto_id })));
  if (error) {
    throw new Error(`Kunde inte spara arendets konton: ${error.message}`);
  }
}

/**
 * Ett raderat arende. Pa riktigt raderat, inte flyttat till Papperskorgen: se
 * resonemanget i migration 20260821120000_arenden.sql. Bekraftelsedialogen i
 * <ConfirmDeleteButton> ar det som gor det forsvarligt.
 */
export async function deleteArende(formData: FormData) {
  const id = requiredString(formData.get("id"), "Arende");

  const { error } = await supabase.from("arenden").delete().eq("id", id);
  if (error) throw new Error(`Kunde inte radera arendet: ${error.message}`);

  return "/kalender";
}
