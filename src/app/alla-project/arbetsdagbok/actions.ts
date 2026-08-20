
import { supabase } from "@/lib/supabase/browser";
import { optionalString, requiredString } from "@/lib/formData";
import { passSpanHours } from "@/lib/format";

/**
 * 'HH:MM' (eller 'HH:MM:SS') normaliserat till 'HH:MM:SS' for Postgres `time`.
 * formData ar inte formularet -- den kan innehalla vad som helst, oavsett vad
 * tidshjulet lat anvandaren valja.
 */
function requiredTime(value: FormDataEntryValue | null, fieldLabel: string): string {
  const raw = requiredString(value, fieldLabel);
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(raw);
  if (!match) throw new Error(`${fieldLabel} maste vara en tid, t.ex. 07:00`);
  return `${match[1]}:${match[2]}:${match[3] ?? "00"}`;
}

/**
 * Skriver tillbaka de pass enkaten lat anvandaren ratta, sa att dagtabellens
 * tva kolumner sager samma sak.
 *
 * Kravet ar detsamma som kortet visar: spannet mellan Pass Tider MASTE vara de
 * Pass Timmar som star bredvid. Knappen ar avstangd tills det stammer, sa ett
 * fel har betyder att formData kom nagon annanstans ifran an formularet.
 */
async function savePassCorrections(formData: FormData) {
  const count = Number(formData.get("pass_count") ?? 0);
  if (!Number.isInteger(count) || count <= 0) return;

  for (let i = 0; i < count; i++) {
    const ids = requiredString(formData.get(`pass_ids_${i}`), "Pass")
      .split(",")
      .filter((id) => id.length > 0);
    if (ids.length === 0) continue;

    const hours = Number(formData.get(`pass_hours_${i}`));
    if (!Number.isFinite(hours) || hours <= 0) {
      throw new Error("Pass Timmar maste vara ett tal storre an 0");
    }

    const start_time = requiredTime(formData.get(`pass_start_${i}`), "Pass start");
    const end_time = requiredTime(formData.get(`pass_end_${i}`), "Pass slut");

    const span = passSpanHours(start_time, end_time);
    if (span === null || Math.abs(span - hours) > 0.01) {
      throw new Error(
        `Pass Tider ${start_time.slice(0, 5)}-${end_time.slice(0, 5)} ar inte ${hours} timmar`
      );
    }

    // Alla arbetare pa passet loggades med samma tider och samma timmar, och
    // rattas darfor tillsammans -- annars skulle en av raderna sta kvar med det
    // gamla spannet i samma dagtabell.
    const { error } = await supabase
      .from("shifts")
      .update({ hours, start_time, end_time })
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


  return `/alla-project/arbetsdagbok?id=${projectId}&fortsatt=1`;
}
