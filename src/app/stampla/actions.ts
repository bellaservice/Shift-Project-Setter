import { supabase } from "@/lib/supabase/browser";

/**
 * Stamplingens skrivningar.
 *
 * Klockslaget kommer fran DATABASEN och inte fran telefonen. Strangen `"now"` ar
 * Postgres egen speciallitteral: den castas till transaktionens tidpunkt pa
 * serversidan, alltsa samma varde som `now()`. Verifierat mot databasen.
 *
 * Skalet ar bevisvardet. En telefon vars klocka gar tio minuter fel skulle
 * annars skriva tio minuter fel in i det som ska vara underlaget for arbetad
 * tid, och ingen skulle marka det. Databasens klocka ar en enda, och den ar
 * samma for alla.
 *
 * Ingen av de har funktionerna kollar VEMS pass det ar. Det gors av
 * shifts_update_egen_stampling, som bara slapper igenom rader dar
 * worker_id = kit.min_arbetare_id(). Ett forsok pa nagon annans pass traffar
 * noll rader, och det ar precis vad "arbetaren kan inte stampla pa ett pass hen
 * inte tilldelats" betyder i praktiken (spec 8.4).
 */

function shiftId(value: FormDataEntryValue | null): string {
  const raw = String(value ?? "").trim();
  if (raw === "") throw new Error("Passet saknar id");
  return raw;
}

/**
 * Stampla in: satter clock_in_time pa ett pass som annu inte pabörjats.
 *
 * `.is("clock_in_time", null)` ar inte en artighet utan vakten mot dubbel
 * instampling: tva tryck pa knappen, eller samma pass oppet i tva flikar, far
 * inte flytta starttiden framat. Andra traffen matchar noll rader och far ett
 * besked i stallet.
 *
 * Triggern kit.shifts_preserve_clock_originals() fangar samtidigt
 * clock_in_original, sa arbetarens egen stampling finns bevarad aven om
 * arbetsledaren senare justerar tiden.
 */
export async function stamplaIn(formData: FormData): Promise<void> {
  const id = shiftId(formData.get("shift_id"));

  const { data, error } = await supabase
    .from("shifts")
    .update({ clock_in_time: "now" })
    .eq("id", id)
    .eq("status", "open")
    .is("clock_in_time", null)
    .select("id");

  if (error) {
    throw new Error(`Kunde inte stampla in: ${error.message}`, { cause: error });
  }
  if ((data ?? []).length === 0) {
    throw new Error(
      "Passet gick inte att stampla in pa. Det kan redan vara pabörjat — ladda om sidan."
    );
  }
}

/**
 * Stampla ut: satter clock_out_time och for passet fran 'open' till 'closed'.
 *
 * Bada kolumnerna i SAMMA update, och det ar ett krav och inte en optimering:
 * kit.shifts_guard_leader_columns() slapper igenom en statusandring fran en
 * arbetare enbart nar den foljs av passets forsta utstampling. Skickas de var
 * for sig avvisas statusdelen med "Bara en arbetsledare far andra ett passets
 * status". Se migration 20260826130000_utstampling.sql.
 *
 * `calculated_hours` skrivs INTE har. Den harleds ur ett spann vars ena ande
 * just nu bara finns i databasen (`now()`), sa appen kan inte rakna ut den utan
 * att gissa. Arbetsledaren far den serverad i bekraftelsekon, som raknar den ur
 * de faktiska klockslagen.
 */
export async function stamplaUt(formData: FormData): Promise<void> {
  const id = shiftId(formData.get("shift_id"));

  const { data, error } = await supabase
    .from("shifts")
    .update({ clock_out_time: "now", status: "closed" })
    .eq("id", id)
    .eq("status", "open")
    .not("clock_in_time", "is", null)
    .is("clock_out_time", null)
    .select("id");

  if (error) {
    throw new Error(`Kunde inte stampla ut: ${error.message}`, { cause: error });
  }
  if ((data ?? []).length === 0) {
    throw new Error(
      "Passet gick inte att stampla ut pa. Det kan redan vara avslutat — ladda om sidan."
    );
  }
}
