"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requiredString } from "@/lib/formData";

export async function logShifts(formData: FormData) {
  const hours = Number(formData.get("hours"));
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error("Pass Timmar maste vara ett tal storre an 0");
  }

  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const day = Number(formData.get("day"));
  if (!year || !month || !day) throw new Error("Pass Datum kravs");
  const shiftDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const projectId = requiredString(formData.get("project_id"), "Project");

  const workerIds = [
    ...new Set(
      formData
        .getAll("worker_id")
        .map((v) => String(v))
        .filter((v) => v.length > 0)
    ),
  ];
  if (workerIds.length === 0) throw new Error("Valj minst en arbetare");

  const { error } = await supabaseAdmin.from("shifts").insert(
    workerIds.map((worker_id) => ({
      project_id: projectId,
      worker_id,
      shift_date: shiftDate,
      hours,
    }))
  );
  if (error) throw new Error(`Kunde inte spara pass: ${error.message}`);

  revalidatePath("/");
  revalidatePath(`/logga-project/${projectId}`);
  revalidatePath("/logga-timmar");
  redirect("/");
}
