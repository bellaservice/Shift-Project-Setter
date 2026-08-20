import { supabase } from "@/lib/supabase/browser";

export const PICTURE_BUCKET = "profile-pictures";

/**
 * The object path inside `profile-pictures` that a stored public URL points at,
 * or null when the URL is not one of ours. Only used to clean up a file after a
 * replacement or a permanent deletion — Storage does not cascade with the row,
 * so without this every replaced photo would stay in the bucket forever.
 */
export function storagePathFromPublicUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${PICTURE_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;

  const path = url.slice(at + marker.length).split("?")[0];
  return path.length > 0 ? decodeURIComponent(path) : null;
}

/** Uploads the picked file and returns its public URL, or null when none was picked. */
export async function uploadProfilePicture(
  file: FormDataEntryValue | null
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(PICTURE_BUCKET)
    .upload(path, file, { contentType: file.type });
  if (error) {
    throw new Error(`Kunde inte ladda upp profilbild: ${error.message}`);
  }

  const { data } = supabase.storage.from(PICTURE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Best-effort cleanup of an orphaned photo. Deliberately not fatal: the row is
 * already saved or gone by the time this runs, and failing the whole action
 * over a leftover file would tell the user their edit did not go through when
 * it did.
 */
export async function removeProfilePicture(url: string | null): Promise<void> {
  const path = storagePathFromPublicUrl(url);
  if (!path) return;
  await supabase.storage.from(PICTURE_BUCKET).remove([path]);
}

/**
 * Deletes the files that the trash sweep orphaned, and clears the queue rows it
 * managed to delete.
 *
 * The sweep runs in Postgres — as a pg_cron job at night, with no application
 * around — and Postgres cannot talk to Storage. It therefore parks the picture
 * URL of every purged worker in `storage_purge_queue`, and this drains it. A
 * queue row is only removed once its file is gone, so a failed Storage call
 * just means the next visit tries again rather than leaving a photo of a person
 * in a public bucket after the row was said to be permanently deleted.
 */
export async function drainStoragePurgeQueue(): Promise<void> {
  const { data: queued, error } = await supabase
    .from("storage_purge_queue")
    .select("id, public_url")
    // A bounded bite: the queue only ever grows by one row per purged worker,
    // and anything left over is picked up the next time it is drained.
    .limit(100);
  if (error || !queued || queued.length === 0) return;

  const removable = queued
    .map((row) => ({ id: row.id, path: storagePathFromPublicUrl(row.public_url) }))
    .filter((row): row is { id: string; path: string } => row.path !== null);

  // A URL we cannot parse points at something outside our bucket, so there is
  // nothing to delete and nothing to retry — drop the row rather than have it
  // block the queue forever.
  const unparseable = queued
    .filter((row) => storagePathFromPublicUrl(row.public_url) === null)
    .map((row) => row.id);

  const deletable = [...unparseable];

  if (removable.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(PICTURE_BUCKET)
      .remove(removable.map((row) => row.path));
    if (!removeError) deletable.push(...removable.map((row) => row.id));
  }

  if (deletable.length > 0) {
    await supabase.from("storage_purge_queue").delete().in("id", deletable);
  }
}
