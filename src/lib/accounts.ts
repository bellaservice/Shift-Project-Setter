import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Inloggningens halva av ett konto — allt som ror auth.users.
 *
 * Kopplingen och statusen ligger i public.accounts och skots med vanliga
 * queries; det HAR gar bara genom Supabases admin-API, for auth.users ar inte
 * en tabell appen far skriva i sjalv. Servern och ingen annan: `supabaseAdmin`
 * bar service role-nyckeln, och den far aldrig na en webblasare.
 *
 * Se supabase/migrations/20260820120000_konton.sql for hur de tva halvorna
 * hanger ihop.
 */

/**
 * Spärren som pausad och avstangd betyder i Auth.
 *
 * Auth kanner bara "bannad till och med" — den vet inget om appens tre
 * statusar. Hundra ar ar "tills nagon slar av det igen", och det ar precis vad
 * bade en paus och en avstangning ar: det som skiljer dem at ar avsikten, och
 * den star i accounts.status.
 */
const BAN_FOREVER = "876000h";

/**
 * Skapar inloggningen och ger tillbaka dess id.
 *
 * `email_confirm: true` for att kontot tillverkas AT nagon: adressen ar redan
 * kand, uppgifterna lamnas over for hand, och ett bekraftelsemejl som maste
 * klickas skulle bara vara ett extra satt for det att inte bli av.
 */
export async function createLogin(
  epost: string,
  losenord: string
): Promise<string> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: epost,
    password: losenord,
    email_confirm: true,
  });

  if (error || !data.user) {
    // Den vanligaste orsaken ar att adressen redan ar en inloggning — t.ex. en
    // arbetare som haft ett konto som raderats fel vag.
    throw new Error(
      `Kunde inte skapa inloggningen: ${error?.message ?? "okant fel"}`
    );
  }

  return data.user.id;
}

/**
 * Raderar inloggningen. Kontoraden foljer med via kaskaden fran auth.users.
 *
 * Det ar avsiktligt den har vagen och inte tvartom: en delete pa accounts drar
 * med sig auth-raden genom triggern i migrationen, men bara Auth kan stada upp
 * sessioner och identiteter, sa det ar Auth som ska fa fragan.
 */
export async function deleteLogin(id: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) {
    throw new Error(`Kunde inte ta bort inloggningen: ${error.message}`);
  }
}

/** Sparrar eller slapper in igen. `pausad` och `avstangd` sparrar bada. */
export async function setLoginBlocked(
  id: string,
  blocked: boolean
): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
    ban_duration: blocked ? BAN_FOREVER : "none",
  });
  if (error) {
    throw new Error(`Kunde inte andra kontots status: ${error.message}`);
  }
}

/**
 * Flyttar inloggningen med nar arbetarens e-post andras.
 *
 * Adressen bor i workers.email och ingen annanstans (se migrationen), sa en
 * andring i Redigera Arbetare ar en andring av inloggningen. Utan det har
 * anropet skulle skarmen visa den nya adressen medan den gamla fortfarande var
 * den man kom in med.
 *
 * Tyst no-op nar arbetaren inte har nagot konto, vilket ar de flesta.
 */
export async function syncLoginEmail(
  workerId: string,
  epost: string | null
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("accounts")
    .select("id")
    .eq("worker_id", workerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Kunde inte lasa kontot: ${error.message}`);
  }
  if (!data) return;

  // En arbetare med konto MASTE ha en e-post — det ar den man loggar in med,
  // och en tom adress vore ett konto ingen kommer in i. Fältet tomdes alltsa
  // av misstag, och det stoppas har i stallet for att tyst tas emot.
  if (!epost) {
    throw new Error(
      "Arbetaren har ett konto och maste darfor ha en e-postadress"
    );
  }

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
    data.id,
    { email: epost, email_confirm: true }
  );
  if (authError) {
    throw new Error(`Kunde inte flytta inloggningen: ${authError.message}`);
  }
}
