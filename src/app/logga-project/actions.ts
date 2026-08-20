"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { optionalString, requiredString } from "@/lib/formData";
import { getTrashedWorkerIds } from "@/lib/queries";

/**
 * "" -> null. Otherwise a real calendar date YYYY-MM-DD in the 20xx century.
 *
 * The form only offers a two-digit year behind a fixed "20", so this mirrors
 * that on the server: a hand-built post cannot start a project in 4035 either.
 * Stricter than the projects_start_date_sane check constraint (which also
 * allows 2100-01-01), so the constraint stays the outer backstop.
 */
function optionalStartDate(value: FormDataEntryValue | null): string | null {
  const raw = optionalString(value);
  if (!raw) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) throw new Error("Ogiltigt datum");

  const [, y, m, d] = match.map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (
    parsed.getUTCFullYear() !== y ||
    parsed.getUTCMonth() !== m - 1 ||
    parsed.getUTCDate() !== d
  ) {
    throw new Error("Ogiltigt datum");
  }

  if (raw < "2000-01-01" || raw > "2099-12-31") {
    throw new Error("Startdatum måste ligga mellan 2000 och 2099");
  }

  return raw;
}

export async function saveProject(formData: FormData) {
  const id = optionalString(formData.get("id"));
  const name = requiredString(formData.get("name"), "Project Namn");
  const address = requiredString(formData.get("address"), "Project Adress");
  const client_name = optionalString(formData.get("client_name"));
  const client_phone = optionalString(formData.get("client_phone"));
  // Bestallarens egna uppgifter. Formularet visar dem forst nar det finns en
  // bestallare, sa utan namn kommer de inte ens med i posten -- las anda med
  // optionalString, sa ett tomt falt blir null i stallet for "".
  const client_address = optionalString(formData.get("client_address"));
  const client_org_number = optionalString(formData.get("client_org_number"));
  const description = optionalString(formData.get("description"));
  const start_date = optionalStartDate(formData.get("start_date"));

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
      .update({
        name,
        address,
        client_name,
        client_phone,
        client_address,
        client_org_number,
        description,
        start_date,
        // The "eller redigerat" half of Papperskorgen: saving an edit to a
        // project that sits in the bin takes it back out. On a live project
        // this writes back the null that was already there.
        deleted_at: null,
      })
      .eq("id", projectId);
    if (error) throw new Error(`Kunde inte uppdatera project: ${error.message}`);

    // Tjanster och kopplingar skrivs om fran formularet. Kryssrutorna listar
    // bara levande arbetare, sa en arbetare som ligger i papperskorgen finns
    // inte i posten -- raderas hens koppling har forsvinner den tyst, och en
    // aterstallning skulle ge tillbaka nagon som inte langre star pa jobbet hen
    // stod pa. Darfor ror omskrivningen bara de kopplingar formularet faktiskt
    // kunde ha visat.
    const trashedWorkerIds = await getTrashedWorkerIds();
    let workerDelete = supabaseAdmin
      .from("project_workers")
      .delete()
      .eq("project_id", projectId);
    if (trashedWorkerIds.length > 0) {
      workerDelete = workerDelete.not(
        "worker_id",
        "in",
        `(${trashedWorkerIds.join(",")})`
      );
    }

    const [{ error: delServicesError }, { error: delWorkersError }] = await Promise.all([
      supabaseAdmin.from("project_services").delete().eq("project_id", projectId),
      workerDelete,
    ]);
    if (delServicesError) throw new Error(delServicesError.message);
    if (delWorkersError) throw new Error(delWorkersError.message);
  } else {
    const { data, error } = await supabaseAdmin
      .from("projects")
      // status / activated_at / deactivated_at are NOT sent: they are derived by
      // the BEFORE INSERT trigger kit.projects_set_activation_defaults, which sets
      // activated_at from start_date (Europe/Stockholm midnight) or else created_at.
      .insert({
        name,
        address,
        client_name,
        client_phone,
        client_address,
        client_org_number,
        description,
        start_date,
      })
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
  revalidatePath("/alla-project");
  revalidatePath("/papperskorg");
  revalidatePath(`/logga-project/${projectId}`);
  revalidatePath(`/papperskorg/project/${projectId}`);
  // Arbetsdagboken laser bestallaruppgifterna och tjansterna som just andrades.
  revalidatePath(`/alla-project/${projectId}/arbetsdagbok`);
  redirect("/");
}

/**
 * Throws a project in Papperskorgen.
 *
 * Nothing is deleted and nothing cascades: the services, the worker
 * assignments and every pass logged against the project stay exactly where
 * they are, merely hidden from the lists and the totals (see the `!inner`
 * filters in lib/queries.ts). A restore therefore gives back the whole project,
 * hours included. Three weeks later kit.purge_expired_trash() does the real
 * delete and the cascades in supabase/schema.sql take the children with it.
 *
 * `status` is left untouched. The nightly auto-deactivation skips rows in the
 * bin (migration 20260819160000), so a project cannot quietly change state
 * while it waits — what comes back is what went in.
 */
export async function deleteProject(formData: FormData) {
  const id = requiredString(formData.get("id"), "Project");

  const { error } = await supabaseAdmin
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    // Already in the bin: keep the original timestamp rather than silently
    // restarting the three weeks on a double submit.
    .is("deleted_at", null);
  if (error) {
    throw new Error(`Kunde inte ta bort project: ${error.message}`);
  }

  revalidatePath("/");
  revalidatePath("/alla-project");
  revalidatePath("/alla-arbetare");
  revalidatePath("/papperskorg");
  redirect("/alla-project");
}
