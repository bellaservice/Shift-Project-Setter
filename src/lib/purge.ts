import { supabase } from "@/lib/supabase/browser";
import { drainStoragePurgeQueue } from "@/lib/storage";

/**
 * Empties whatever in the papperskorg has passed its three weeks, then deletes
 * the files that left behind.
 *
 * The deadline is enforced twice on purpose, and the two are not redundant:
 *
 * - The pg_cron job (migration 20260819160000) is the guarantee. It runs
 *   nightly whether or not anyone opens the app, so "three weeks" is three
 *   weeks even if the tool goes unused for a month. Postgres cannot reach
 *   Storage, so it can only take the rows.
 * - This, called when Papperskorgen is opened, is what makes the screen honest.
 *   It closes the gap between the deadline and the next 02:45, and it is the
 *   only party that can finish the job in Storage.
 *
 * Both call the same idempotent function behind the same advisory lock, so a
 * visit that collides with the nightly run is a no-op rather than a double
 * delete.
 */
export async function purgeExpiredTrash(): Promise<void> {
  const { error } = await supabase.rpc("purge_expired_trash");
  if (error) {
    throw new Error(`Kunde inte tomma papperskorgen: ${error.message}`, {
      cause: error,
    });
  }

  await drainStoragePurgeQueue();
}
