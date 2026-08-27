import { supabase } from "@/lib/supabase/browser";

/**
 * Bekraftelsekons skrivningar.
 *
 * Bara EN skrivning per pass, och det ar med flit. Arbetsledaren kan justera
 * klockslagen och satta timmarna i samma vandning, och allt gar in i ett enda
 * UPDATE nar hen trycker Bekrafta. Skalen ar tva:
 *
 *   Ett tryck pa plus ar inte ett beslut. Skulle varje klick skriva till
 *   databasen skulle en rad som justerats fram och tillbaka lamna ett spar av
 *   angerbara mellansteg -- och `clock_edited_at` skulle stamplas av ett klick
 *   som sedan togs tillbaka.
 *
 *   Bekraftelsen ar slutgiltig (spec avsnitt 6). Da ska ocksa ogonblicket da
 *   den blir det vara ett enda, och inte den sista i en rad smaskrivningar som
 *   kan avbrytas halvvags av ett tappat natverk.
 *
 * Triggern kit.shifts_preserve_clock_originals() gor resten sjalv: originalen
 * bevaras, och clock_edited_at/clock_edited_by satts om ett klockslag faktiskt
 * avviker fran sitt forsta varde. Ingenting har behover -- eller far -- rora
 * de kolumnerna.
 */

/** Vad `id` maste vara for att en rad ska ga att adressera alls. */
function shiftId(value: FormDataEntryValue | null): string {
  const raw = String(value ?? "").trim();
  if (raw === "") throw new Error("Passet saknar id");
  return raw;
}

/**
 * Timmarna arbetsledaren bekraftar.
 *
 * Kravs, och kravet ar inte bara ett formularkrav: shifts_confirmed_has_hours
 * avvisar ett bekraftat pass utan timtal i databasen. Meddelandet har finns for
 * att ett constraint-fel pa engelska inte hjalper nagon som fyller i en blankett.
 *
 * Noll ar tillatet och betyder nagot: ett pass som bekraftas till 0 ar en
 * arbetare som inte kom. Det ar darfor kolumnen inte far vara null i stallet --
 * "kom inte" och "vet inte an" ar tva olika besked.
 */
function confirmedHours(value: FormDataEntryValue | null): number {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (raw === "") throw new Error("Fyll i timmarna innan du bekraftar passet");

  const hours = Number(raw);
  if (!Number.isFinite(hours)) throw new Error("Timmarna maste vara ett tal");
  if (hours < 0) throw new Error("Timmarna kan inte vara negativa");
  // Ett dygn ar 24 timmar, och ett pass som pastar sig vara langre ar en
  // felskrivning som annars gar rakt in i lonen.
  if (hours > 24) throw new Error("Ett pass kan inte vara langre an 24 timmar");

  return hours;
}

/**
 * Ett klockslag fran skarmen, som ISO-strang eller tomt.
 *
 * Tomt betyder "ror inte" och inte "nollstall": skarmen skickar bara tillbaka
 * de tider den faktiskt visar, och ett pass som loggats utan stampling har
 * inga.
 */
function optionalInstant(
  value: FormDataEntryValue | null,
  fieldLabel: string
): string | null {
  const raw = String(value ?? "").trim();
  if (raw === "") return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldLabel} ar inte en giltig tidpunkt`);
  }
  return parsed.toISOString();
}

/**
 * Bekraftar ett pass: satter timmarna, eventuellt justerade klockslag, och
 * later status bli 'confirmed'.
 *
 * Efter det har gar raden inte att andra fran nagon skarm i appen -- den lamnar
 * kon och tas med i varje timsumma och i Arbetsdagboken.
 */
export async function confirmShift(formData: FormData): Promise<void> {
  const id = shiftId(formData.get("shift_id"));
  const hours = confirmedHours(formData.get("hours"));
  const clockIn = optionalInstant(formData.get("clock_in_time"), "Instamplingen");
  const clockOut = optionalInstant(formData.get("clock_out_time"), "Utstamplingen");

  if (clockIn !== null && clockOut !== null && clockIn > clockOut) {
    throw new Error("Utstamplingen kan inte vara fore instamplingen");
  }
  if (clockIn === null && clockOut !== null) {
    throw new Error("Ett pass kan inte stamplas ut utan att ha stamplats in");
  }

  const patch: Record<string, unknown> = { hours, status: "confirmed" };
  // Bara tider som faktiskt finns skickas med. Att skriva null over en
  // befintlig stampling vore en radering, och radering ar inte vad Bekrafta
  // gor.
  if (clockIn !== null) patch.clock_in_time = clockIn;
  if (clockOut !== null) patch.clock_out_time = clockOut;
  // calculated_hours raknas INTE har. Den harleds av
  // kit.shifts_derive_calculated_hours() vid varje skrivning, sa ett varde
  // harifran hade i basta fall varit samma siffra en gang till och i samsta
  // fall en avvikande — raknad ur de tva klockslag skarmen rakade skicka med,
  // i stallet for ur de tva som faktiskt star i raden.
  // Se migration 20260827090000_harled_calculated_hours.sql.

  // `.eq("status", ...)` och inte bara id: tva arbetsledare som har samma ko
  // uppe ska inte kunna bekrafta samma pass tva ganger, och den andra ska fa
  // veta det i stallet for att tyst skriva over den forstas siffra.
  const { data, error } = await supabase
    .from("shifts")
    .update(patch)
    .eq("id", id)
    .neq("status", "confirmed")
    .select("id");

  if (error) {
    throw new Error(`Kunde inte bekrafta passet: ${error.message}`, {
      cause: error,
    });
  }
  if ((data ?? []).length === 0) {
    throw new Error(
      "Passet ar redan bekraftat. Ladda om sidan for att se den aktuella kon."
    );
  }
}

/**
 * "Kom inte" -- X-kontrollen i raden.
 *
 * Bekraftar passet till noll timmar i stallet for att radera raden. Att ta bort
 * den hade sett prydligare ut i kon och varit fel: passet var schemalagt, och
 * att arbetaren uteblev ar en uppgift om dagen som Arbetsdagboken och Priolistan
 * bada har anledning att kanna till. En raderad rad sager i stallet att passet
 * aldrig fanns.
 */
export async function markNoShow(formData: FormData): Promise<void> {
  const id = shiftId(formData.get("shift_id"));

  const { data, error } = await supabase
    .from("shifts")
    .update({ hours: 0, status: "confirmed" })
    .eq("id", id)
    .neq("status", "confirmed")
    .select("id");

  if (error) {
    throw new Error(`Kunde inte markera passet: ${error.message}`, {
      cause: error,
    });
  }
  if ((data ?? []).length === 0) {
    throw new Error(
      "Passet ar redan bekraftat. Ladda om sidan for att se den aktuella kon."
    );
  }
}
