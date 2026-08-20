/**
 * Papperskorgen — the shared arithmetic behind "raderas om N dagar".
 *
 * No `server-only` here: the list and the detail screens both render these
 * strings on the server, but the numbers are plain data and nothing in this
 * file touches the database.
 */

/**
 * How long the papperskorg keeps what was thrown away.
 *
 * MUST match `interval '3 weeks'` in
 * supabase/migrations/20260819160000_papperskorg.sql — the sweep in Postgres is
 * what actually deletes, and this constant only decides what the screen
 * promises. If the two drift, the app lies about a deadline it does not own.
 */
export const TRASH_RETENTION_DAYS = 21;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The instant the sweep becomes free to delete this row for good. */
export function purgeDeadline(deletedAt: string): Date {
  return new Date(new Date(deletedAt).getTime() + TRASH_RETENTION_DAYS * MS_PER_DAY);
}

/**
 * Whole days left, rounded up and never negative.
 *
 * Rounded up so a row with eleven hours left reads "1 dag" and not "0 dagar":
 * the sweep has not run yet, the row is still restorable, and a zero would say
 * otherwise. 0 therefore means exactly one thing — the deadline has passed and
 * the next sweep takes it.
 */
export function daysUntilPurge(deletedAt: string, now: Date = new Date()): number {
  const left = purgeDeadline(deletedAt).getTime() - now.getTime();
  return left <= 0 ? 0 : Math.ceil(left / MS_PER_DAY);
}

const DEADLINE_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm",
  day: "numeric",
  month: "long",
});

/** "Raderas om 14 dagar (2 september)", or the past-due wording. */
export function formatPurgeNotice(deletedAt: string, now: Date = new Date()): string {
  const days = daysUntilPurge(deletedAt, now);
  const date = DEADLINE_FORMATTER.format(purgeDeadline(deletedAt));

  if (days === 0) return "Raderas permanent inom kort";
  if (days === 1) return `Raderas permanent om 1 dag (${date})`;
  return `Raderas permanent om ${days} dagar (${date})`;
}
