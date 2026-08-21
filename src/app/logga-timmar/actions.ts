
import { supabase } from "@/lib/supabase/browser";
import { optionalString, requiredString } from "@/lib/formData";

/**
 * Tidshjulet skickar 'HH:MM'. Normaliseras till 'HH:MM:SS' for Postgres `time`,
 * och avvisas om det ar nagot annat -- formData ar inte formularet, den kan
 * innehalla vad som helst.
 *
 * Null nar faltet ar tomt: Pass Tider ar frivilliga sedan lagesskenan togs bort
 * ur <PassFields>, sa ett tomt falt ar ett svar och inte ett fel.
 */
function optionalTime(
  value: FormDataEntryValue | null,
  fieldLabel: string
): string | null {
  const raw = optionalString(value);
  if (raw === null) return null;

  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(raw);
  if (!match) throw new Error(`${fieldLabel} maste vara en tid, t.ex. 07:00`);
  return `${match[1]}:${match[2]}:${match[3] ?? "00"}`;
}

/**
 * Vart anvandaren ska efter sparandet.
 *
 * Bara en egen sokvag slapps igenom. Faltet kommer fran formularet, men formData
 * gor det inte nodvandigtvis, och `router.push` foljer villigt en absolut URL
 * till en annan sajt. En strang som borjar med '//' ar ocksa en sadan -- den ar
 * protokollrelativ -- och maste darfor stoppas separat.
 */
function safeReturnPath(value: FormDataEntryValue | null): string | null {
  const raw = optionalString(value);
  if (raw === null) return null;
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
}

export async function logShifts(formData: FormData) {
  // Passets langd, och det enda som MASTE sta i det har formularet for att raden
  // ska bli ett pass. Det ar den har siffran som hamnar i shifts.hours och som
  // varje timsumma i appen bygger pa.
  const hours = Number(formData.get("hours"));
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error("Pass Timmar maste vara ett tal storre an 0");
  }

  // "Pass Tider" i Arbetsdagboken. Frivilliga -- men antingen bada eller ingen:
  // shifts_pass_times_paired avvisar ett halvifyllt spann anda, och ett fel har
  // ar begripligare an ett constraint-fel fran databasen.
  const start_time = optionalTime(formData.get("start_time"), "Pass start");
  const end_time = optionalTime(formData.get("end_time"), "Pass slut");
  if ((start_time === null) !== (end_time === null)) {
    throw new Error(
      "Fyll i bade Pass start och Pass slut, eller lamna bada tomma"
    );
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

  const { error } = await supabase.from("shifts").insert(
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

  // Nya pass ar nya rader i arbetsdagbokens dagtabeller -- och nya timmar i den
  // kalenderruta man kom ifran, om man kom darifran.
  return safeReturnPath(formData.get("retur")) ?? "/";
}
