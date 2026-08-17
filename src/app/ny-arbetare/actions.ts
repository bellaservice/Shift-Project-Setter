"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { optionalString, requiredString } from "@/lib/formData";

export async function createWorker(formData: FormData) {
  const name = requiredString(formData.get("name"), "Namn");
  const email = optionalString(formData.get("email"));
  const phone = optionalString(formData.get("phone"));
  const address = optionalString(formData.get("address"));
  const personal_number = optionalString(formData.get("personal_number"));
  const account_number = optionalString(formData.get("account_number"));
  const emergency_contact = optionalString(formData.get("emergency_contact"));

  let profile_picture_url: string | null = null;
  const file = formData.get("profile_picture");
  if (file instanceof File && file.size > 0) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${randomUUID()}.${ext}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("profile-pictures")
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      throw new Error(`Kunde inte ladda upp profilbild: ${uploadError.message}`);
    }
    const { data } = supabaseAdmin.storage.from("profile-pictures").getPublicUrl(path);
    profile_picture_url = data.publicUrl;
  }

  const { error } = await supabaseAdmin.from("workers").insert({
    name,
    email,
    phone,
    address,
    personal_number,
    account_number,
    emergency_contact,
    profile_picture_url,
  });

  if (error) {
    throw new Error(`Kunde inte spara arbetare: ${error.message}`);
  }

  revalidatePath("/");
  redirect("/");
}
