import { supabase } from "@/lib/supabase/browser";

/**
 * What is left of the account module after the move to GitHub Pages.
 *
 * Everything here used to go through `supabaseAdmin.auth.admin.*` —
 * createUser, deleteUser, updateUserById, ban_duration. That API answers only
 * to the service role key, which by design cannot exist in a browser: shipping
 * it would hand every visitor a key that bypasses RLS on every table. A static
 * site has no server to keep it on, so those four calls are gone and the
 * features built on them with it:
 *
 *   - Tillverka Konto (create a login)
 *   - Ta Bort Konto (delete a login)
 *   - Aktiv / pausad / avstangd (ban and unban a login)
 *   - moving a login's email when a worker's email is edited
 *
 * Konto is a read-only screen now; it still lists who can log in and what
 * status they hold, because `public.accounts` is an ordinary table that RLS
 * lets a signed-in user read. Issuing and revoking logins happens in the
 * Supabase dashboard, or through a Supabase Edge Function if it should come
 * back into the app — a function runs on Supabase's servers and can hold the
 * service role key, which is the one place left that can.
 *
 * See supabase/migrations/20260820120000_konton.sql for how the two halves of
 * an account hang together.
 */

/**
 * Whether this worker has a login, and therefore whether her email address is
 * also a credential.
 *
 * Reads `public.accounts` only — no auth admin call, so it works with the anon
 * key plus a session.
 */
export async function hasLogin(workerId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("accounts")
    .select("id")
    .eq("worker_id", workerId)
    .maybeSingle();

  if (error) throw new Error(`Kunde inte lasa kontot: ${error.message}`);
  return data !== null;
}

/**
 * Guards a worker's email edit against the login it may also be.
 *
 * The old version moved the auth email to match. This one cannot, so it refuses
 * the edit instead. That is the deliberate choice between two bad outcomes: a
 * silent success would leave the worker logging in with her old address while
 * every screen showed the new one, and the first person to notice would be
 * someone locked out of her own account.
 *
 * Clearing the address outright is refused for the same reason it always was —
 * an account whose email is blank is an account nobody can get into.
 */
export async function assertLoginEmailUnchanged(
  workerId: string,
  currentEmail: string | null,
  nextEmail: string | null
): Promise<void> {
  if (!(await hasLogin(workerId))) return;

  if (!nextEmail) {
    throw new Error(
      "Arbetaren har ett konto och maste darfor ha en e-postadress"
    );
  }

  if ((currentEmail ?? "").trim().toLowerCase() !== nextEmail.trim().toLowerCase()) {
    throw new Error(
      "Arbetaren har ett konto, och e-posten ar ocksa hennes inloggning. " +
        "Den kan inte andras harifran — byt adressen i Supabase (Authentication > Users) forst."
    );
  }
}
