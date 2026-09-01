
import { supabase } from "@/lib/supabase/browser";
import { optionalString, requiredString } from "@/lib/formData";

/**
 * 'HH:MM' (eller 'HH:MM:SS') normaliserat till 'HH:MM:SS' for Postgres `time`,
 * eller null nar faltet lamnats tomt. formData ar inte formularet -- den kan
 * innehalla vad som helst, oavsett vad tidshjulet lat anvandaren valja.
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

/**
 * Skriver in de Pass Tider enkaten fragade efter.
 *
 * Bara tiderna. Timmarna ror den har atgarden inte langre: de ar redan satta i
 * Logga Timmar, de ar det som betalas, och sedan lagesskenan togs bort ur
 * <PassFields> behover de inte stamma med spannet -- en obetald rast ar precis
 * skillnaden mellan de tva. Att skriva om dem har vore att andra en lonesumma
 * for att en dokumentcell sag tom ut.
 *
 * Ett obesvarat kort hoppas over i stallet for att avvisas. Tider som ingen
 * minns ska ga att lamna tomma; cellen blir da tom i dokumentet, vilket ar
 * exakt vad den var innan fragan stalldes. Ett HALVT svar avvisas daremot --
 * shifts_pass_times_paired tar antingen bada klockslagen eller inget, och ett
 * fel har ar begripligare an ett constraint-fel fran databasen.
 */
async function savePassCorrections(formData: FormData) {
  const count = Number(formData.get("pass_count") ?? 0);
  if (!Number.isInteger(count) || count <= 0) return;

  for (let i = 0; i < count; i++) {
    const ids = requiredString(formData.get(`pass_ids_${i}`), "Pass")
      .split(",")
      .filter((id) => id.length > 0);
    if (ids.length === 0) continue;

    const start_time = optionalTime(formData.get(`pass_start_${i}`), "Pass start");
    const end_time = optionalTime(formData.get(`pass_end_${i}`), "Pass slut");

    if (start_time === null && end_time === null) continue;
    if (start_time === null || end_time === null) {
      throw new Error(
        "Fyll i bade Pass start och Pass slut, eller lamna bada tomma"
      );
    }

    // Alla arbetare pa passet loggades med samma tider, och far dem darfor
    // tillsammans -- annars skulle en av raderna sta kvar med en tom cell i
    // samma dagtabell.
    const { error } = await supabase
      .from("shifts")
      .update({ start_time, end_time })
      .in("id", ids);
    if (error) throw new Error(`Kunde inte spara passet: ${error.message}`);
  }
}

/**
 * Saves whatever the pre-generation survey collected, then sends the user on to
 * the document.
 *
 * Only non-empty answers are written. The survey only ever renders the fields
 * that are already missing, so a blank answer means "I do not have this" — and
 * writing it back as null would be a no-op at best and, if the survey were ever
 * shown for a field that does have a value, silent data loss at worst.
 */
export async function saveArbetsdagbokDetaljer(formData: FormData) {
  const projectId = requiredString(formData.get("project_id"), "Project");

  const patch: Record<string, string> = {};
  for (const field of [
    "name",
    "client_name",
    "client_address",
    "client_org_number",
  ] as const) {
    const value = optionalString(formData.get(field));
    if (value) patch[field] = value;
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase
      .from("projects")
      .update(patch)
      .eq("id", projectId);
    if (error) {
      throw new Error(`Kunde inte spara projectuppgifter: ${error.message}`);
    }
  }

  // Priset lamnas medvetet tomt: arbetsdagboken skriver ut tjanstens namn, och
  // en summa som ingen bett om hor inte hemma i ett arbetsintyg.
  const service_name = optionalString(formData.get("service_name"));
  if (service_name) {
    const { error } = await supabase
      .from("project_services")
      .insert({ project_id: projectId, service_name, price: null });
    if (error) {
      throw new Error(`Kunde inte spara tjansten: ${error.message}`);
    }
  }

  await savePassCorrections(formData);


  return `/arbetsdagbok?id=${projectId}&fortsatt=1`;
}
