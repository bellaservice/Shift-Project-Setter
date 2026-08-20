
import { supabase } from "@/lib/supabase/browser";
import { requiredString } from "@/lib/formData";
import { removeProfilePicture } from "@/lib/storage";

/**
 * The two ways out of Papperskorgen: back to the app, or gone now instead of in
 * three weeks.
 *
 * Every statement here carries `deleted_at is not null` as well as the id.
 * Server Actions are reachable by a plain POST, not only through the screen
 * that renders them, and without that predicate this file would be a way to
 * hard-delete a live worker or project — the one thing the papperskorg exists
 * to make impossible.
 */

function revalidateTrash(): void {
}

/** Takes a worker back out of the bin, with everything they had. */
export async function restoreWorker(formData: FormData) {
  const id = requiredString(formData.get("id"), "Arbetare");

  const { error } = await supabase
    .from("workers")
    .update({ deleted_at: null })
    .eq("id", id)
    .not("deleted_at", "is", null);
  if (error) {
    throw new Error(`Kunde inte aterstalla arbetaren: ${error.message}`);
  }

  revalidateTrash();
  // Back to the roster rather than to the bin: seeing the row in the list is
  // the clearest possible confirmation that the restore worked.
  return "/alla-arbetare";
}

/** Takes a project back out of the bin, with its services, workers and passes. */
export async function restoreProject(formData: FormData) {
  const id = requiredString(formData.get("id"), "Project");

  const { error } = await supabase
    .from("projects")
    .update({ deleted_at: null })
    .eq("id", id)
    .not("deleted_at", "is", null);
  if (error) {
    throw new Error(`Kunde inte aterstalla projectet: ${error.message}`);
  }

  revalidateTrash();
  return "/alla-project";
}

/**
 * Empties one worker out of the bin ahead of the deadline.
 *
 * This is the delete the three weeks were protecting against, so here the
 * cascades in supabase/schema.sql finally do run: the passes logged on this
 * person go with them, and the project totals they fed lose those hours for
 * good.
 */
export async function purgeWorker(formData: FormData) {
  const id = requiredString(formData.get("id"), "Arbetare");

  // Read the photo first — after the row is gone there is nothing left
  // pointing at the file, and it would sit in the bucket forever.
  const { data: existing, error: readError } = await supabase
    .from("workers")
    .select("profile_picture_url")
    .eq("id", id)
    .not("deleted_at", "is", null)
    .maybeSingle();
  if (readError) {
    throw new Error(`Kunde inte lasa arbetaren: ${readError.message}`);
  }
  if (!existing) throw new Error("Arbetaren finns inte i papperskorgen");

  const { error } = await supabase
    .from("workers")
    .delete()
    .eq("id", id)
    .not("deleted_at", "is", null);
  if (error) {
    throw new Error(`Kunde inte radera arbetare: ${error.message}`);
  }

  await removeProfilePicture(existing.profile_picture_url);

  revalidateTrash();
  return "/papperskorg";
}

/** Empties one project out of the bin ahead of the deadline. */
export async function purgeProject(formData: FormData) {
  const id = requiredString(formData.get("id"), "Project");

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .not("deleted_at", "is", null);
  if (error) {
    throw new Error(`Kunde inte radera project: ${error.message}`);
  }

  revalidateTrash();
  return "/papperskorg";
}
