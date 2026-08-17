"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { optionalString, requiredString } from "@/lib/formData";

export async function saveProject(formData: FormData) {
  const id = optionalString(formData.get("id"));
  const address = requiredString(formData.get("address"), "Adress");
  const client_name = optionalString(formData.get("client_name"));
  const client_phone = optionalString(formData.get("client_phone"));
  const description = optionalString(formData.get("description"));

  const serviceNames = formData.getAll("service_name").map((v) => String(v).trim());
  const prices = formData.getAll("price").map((v) => String(v).trim());
  const services = serviceNames
    .map((service_name, i) => ({
      service_name,
      price: prices[i] && prices[i].length > 0 ? Number(prices[i]) : null,
    }))
    .filter((s) => s.service_name.length > 0);

  const workerIds = [...new Set(formData.getAll("worker_id").map((v) => String(v)))];

  let projectId = id;

  if (projectId) {
    const { error } = await supabaseAdmin
      .from("projects")
      .update({ address, client_name, client_phone, description })
      .eq("id", projectId);
    if (error) throw new Error(`Kunde inte uppdatera project: ${error.message}`);

    const [{ error: delServicesError }, { error: delWorkersError }] = await Promise.all([
      supabaseAdmin.from("project_services").delete().eq("project_id", projectId),
      supabaseAdmin.from("project_workers").delete().eq("project_id", projectId),
    ]);
    if (delServicesError) throw new Error(delServicesError.message);
    if (delWorkersError) throw new Error(delWorkersError.message);
  } else {
    const { data, error } = await supabaseAdmin
      .from("projects")
      .insert({ address, client_name, client_phone, description })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Kunde inte skapa project: ${error?.message}`);
    projectId = data.id;
  }

  if (services.length > 0) {
    const { error } = await supabaseAdmin
      .from("project_services")
      .insert(services.map((s) => ({ ...s, project_id: projectId })));
    if (error) throw new Error(`Kunde inte spara tjanster: ${error.message}`);
  }

  if (workerIds.length > 0) {
    const { error } = await supabaseAdmin
      .from("project_workers")
      .insert(workerIds.map((worker_id) => ({ project_id: projectId, worker_id })));
    if (error) throw new Error(`Kunde inte spara arbetare: ${error.message}`);
  }

  revalidatePath("/");
  revalidatePath(`/logga-project/${projectId}`);
  redirect("/");
}
