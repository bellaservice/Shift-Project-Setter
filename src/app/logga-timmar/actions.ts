"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requiredString } from "@/lib/formData";

/**
 * <input type="time"> skickar 'HH:MM' (eller 'HH:MM:SS' om steg-attributet
 * satts). Normaliseras till 'HH:MM:SS' for Postgres `time`, och avvisas om det
 * ar nagot annat -- formData ar inte formularet, den kan innehalla vad som
 * helst.
 */
function requiredTime(value: FormDataEntryValue | null, fieldLabel: string): string {
  const raw = requiredString(value, fieldLabel);
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(raw);
  if (!match) throw new Error(`${fieldLabel} maste vara en tid, t.ex. 07:00`);
  return `${match[1]}:${match[2]}:${match[3] ?? "00"}`;
}

export async function logShifts(formData: FormData) {
  const hours = Number(formData.get("hours"));
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error("Pass Timmar maste vara ett tal storre an 0");
  }

  // "Pass Tider" i Arbetsdagboken. Bada kravs -- shifts_pass_times_paired
  // avvisar ett halvifyllt spann anda, och ett fel har ar begripligare an ett
  // constraint-fel fran databasen.
  const start_time = requiredTime(formData.get("start_time"), "Pass start");
  const end_time = requiredTime(formData.get("end_time"), "Pass slut");

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
      start_time,
      end_time,
    }))
  );
  if (error) throw new Error(`Kunde inte spara pass: ${error.message}`);

  revalidatePath("/");
  revalidatePath("/alla-project");
  revalidatePath("/alla-arbetare");
  revalidatePath(`/logga-project/${projectId}`);
  revalidatePath("/logga-timmar");
  // Nya pass ar nya rader i arbetsdagbokens dagtabeller.
  revalidatePath(`/alla-project/${projectId}/arbetsdagbok`);
  redirect("/");
}
