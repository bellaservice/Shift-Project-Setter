"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { optionalString, requiredString } from "@/lib/formData";
import { internalPath } from "@/lib/searchParams";
import { removeProfilePicture, uploadProfilePicture } from "@/lib/storage";

/**
 * Creates a worker, or updates the one whose id the form carries — the same
 * shape as saveProject, so Ny Arbetare and Redigera Arbetare can share one form.
 */
export async function saveWorker(formData: FormData) {
  const id = optionalString(formData.get("id"));
  const name = requiredString(formData.get("name"), "Namn");
  const email = optionalString(formData.get("email"));
  const phone = optionalString(formData.get("phone"));
  const address = optionalString(formData.get("address"));
  const personal_number = optionalString(formData.get("personal_number"));
  const account_number = optionalString(formData.get("account_number"));
  const emergency_contact_name = optionalString(formData.get("emergency_contact_name"));
  const emergency_contact_phone = optionalString(formData.get("emergency_contact_phone"));
  const emergency_contact_email = optionalString(formData.get("emergency_contact_email"));

  // Narmst anhorig ar valfritt, men ett namn utan kontaktvag (och en kontaktvag
  // utan namn) ar inte anvandbart och sparas darfor inte.
  if (!emergency_contact_name && (emergency_contact_phone || emergency_contact_email)) {
    throw new Error("Namn pa narmst anhorig kravs");
  }
  if (emergency_contact_name && !emergency_contact_phone && !emergency_contact_email) {
    throw new Error("Telefonnummer eller e-post till narmst anhorig kravs");
  }

  const fields = {
    name,
    email,
    phone,
    address,
    personal_number,
    account_number,
    emergency_contact_name,
    emergency_contact_phone,
    emergency_contact_email,
  };

  // Set when this call created a row: the page that sent us here needs the id
  // to tick the brand-new worker on arrival.
  let createdId: string | null = null;

  if (id) {
    // Read the current photo first: an empty file input means "keep the one you
    // have", so profile_picture_url is only written when a new file arrived.
    const { data: existing, error: readError } = await supabaseAdmin
      .from("workers")
      .select("profile_picture_url")
      .eq("id", id)
      .maybeSingle();
    if (readError) {
      throw new Error(`Kunde inte lasa arbetaren: ${readError.message}`);
    }
    if (!existing) throw new Error("Arbetaren finns inte langre");

    const uploadedUrl = await uploadProfilePicture(formData.get("profile_picture"));

    // `deleted_at: null` is the "eller redigerad" half of Papperskorgen: saving
    // an edit to a worker that sits in the bin takes them back out of it. On a
    // worker who was never thrown away it writes back the null already there.
    const { error } = await supabaseAdmin
      .from("workers")
      .update({
        ...fields,
        deleted_at: null,
        ...(uploadedUrl ? { profile_picture_url: uploadedUrl } : {}),
      })
      .eq("id", id);
    if (error) {
      throw new Error(`Kunde inte uppdatera arbetare: ${error.message}`);
    }

    // Only after the row points at the new file — an early delete would leave a
    // broken image behind if the update then failed.
    if (uploadedUrl) await removeProfilePicture(existing.profile_picture_url);
  } else {
    const profile_picture_url = await uploadProfilePicture(
      formData.get("profile_picture")
    );

    const { data, error } = await supabaseAdmin
      .from("workers")
      .insert({ ...fields, profile_picture_url })
      .select("id")
      .single();
    if (error || !data) {
      throw new Error(`Kunde inte spara arbetare: ${error?.message}`);
    }
    createdId = data.id;
  }

  revalidatePath("/");
  revalidatePath("/alla-arbetare");
  revalidatePath("/papperskorg");
  if (id) {
    revalidatePath(`/alla-arbetare/${id}`);
    revalidatePath(`/papperskorg/arbetare/${id}`);
  }

  // Kom man hit mitt i ett annat arende ("+ Lagg Till" i Logga Project) hor man
  // hemma dar igen, med den nya arbetaren utpekad sa att sidan kan bocka i
  // henne. Sidan listar arbetarna och maste las om for att kanna till henne.
  const next = internalPath(optionalString(formData.get("next")));
  if (next) {
    revalidatePath(next);
    redirect(createdId ? `${next}?ny=${encodeURIComponent(createdId)}` : next);
  }

  // Annars: en redigering kom fran listan och hor hemma dar igen; en ny
  // arbetare utan avsandare lamnar tillbaka till Hem.
  redirect(id ? "/alla-arbetare" : "/");
}

/**
 * Throws a worker in Papperskorgen.
 *
 * Nothing is deleted and nothing cascades: the row keeps every field it had,
 * and the passes logged on this person stay in the table, merely hidden from
 * the totals (see the `!inner` filters in lib/queries.ts). That is what lets a
 * restore give back exactly what was thrown away, hours included. Three weeks
 * later kit.purge_expired_trash() does the real delete, and the cascades in
 * supabase/schema.sql finally take the passes with it.
 *
 * The profile picture deliberately stays in Storage until then — deleting it
 * now would restore a worker with a broken image.
 */
export async function deleteWorker(formData: FormData) {
  const id = requiredString(formData.get("id"), "Arbetare");

  const { error } = await supabaseAdmin
    .from("workers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    // Already in the bin: leave the original timestamp alone rather than
    // silently restarting the three weeks on a double submit.
    .is("deleted_at", null);
  if (error) {
    throw new Error(`Kunde inte ta bort arbetare: ${error.message}`);
  }

  revalidatePath("/");
  revalidatePath("/alla-arbetare");
  revalidatePath("/alla-project");
  revalidatePath("/papperskorg");
  redirect("/alla-arbetare");
}
