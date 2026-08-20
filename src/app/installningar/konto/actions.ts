"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requiredString } from "@/lib/formData";
import { createLogin, deleteLogin, setLoginBlocked } from "@/lib/accounts";
import type { KontoStatus } from "@/lib/types";

/** Samma tre som accounts_status_check i migrationen slapper igenom. */
const STATUSAR: KontoStatus[] = ["aktiv", "pausad", "avstangd"];

/** Kortare an sa ar det inte ett losenord, det ar en gissning. */
const MIN_LANGD = 8;

function revalidateKonton(): void {
  revalidatePath("/installningar/konto");
  revalidatePath("/installningar/konto/nytt");
}

/**
 * Tillverkar ett konto at en arbetare.
 *
 * E-posten kommer INTE fran formularet. Den lases ur arbetarens egen rad har pa
 * servern, och det ar hela skillnaden mot att skriva in en adress for hand: den
 * som far kontot ar den arbetaren, och adressen man loggar in med ar den som
 * star i hennes profil. En adress i formularet vore en fjarde plats dar samma
 * adress kan sta fel.
 *
 * Ordningen ar auth forst, kopplingen sedan. Gar kopplingen fel raderas
 * inloggningen igen — en auth-anvandare utan kontorad ar en inloggning appen
 * inte kan visa, inte kan ta bort och inte vet vem den ar.
 */
export async function skapaKonto(formData: FormData) {
  const workerId = requiredString(formData.get("worker_id"), "Arbetare");
  const losenord = requiredString(formData.get("losenord"), "Losenord");
  const upprepa = requiredString(formData.get("upprepa"), "Upprepa losenord");

  if (losenord.length < MIN_LANGD) {
    throw new Error(`Losenordet behover minst ${MIN_LANGD} tecken`);
  }
  if (losenord !== upprepa) {
    throw new Error("De tva losenorden ar inte lika");
  }

  const { data: worker, error: workerError } = await supabaseAdmin
    .from("workers")
    .select("id, email")
    .eq("id", workerId)
    // En arbetare i Papperskorgen far inte fa ett konto: raden ar pa vag att
    // gallras, och kontot skulle da ha raderats tre veckor efter att det
    // skapades.
    .is("deleted_at", null)
    .maybeSingle();

  if (workerError) {
    throw new Error(`Kunde inte lasa arbetaren: ${workerError.message}`);
  }
  if (!worker) throw new Error("Arbetaren finns inte langre");

  const epost = String(worker.email ?? "").trim();
  if (!epost) {
    throw new Error(
      "Arbetaren saknar e-post. Fyll i den i Redigera Arbetare forst — det ar den man loggar in med."
    );
  }

  const authId = await createLogin(epost, losenord);

  const { error } = await supabaseAdmin
    .from("accounts")
    .insert({ id: authId, worker_id: workerId, status: "aktiv" });

  if (error) {
    await deleteLogin(authId).catch(() => {
      // Misslyckas aven stadningen ar det inget appen kan gora at saken har.
      // Felet nedan ar det som nar anvandaren, och auth-anvandaren far ryckas
      // for hand i Supabase.
    });
    throw new Error(`Kunde inte skapa kontot: ${error.message}`);
  }

  revalidateKonton();
  redirect("/installningar/konto");
}

/**
 * Tar bort ett konto.
 *
 * Arbetaren ror sig inte ur flacken — det ar inloggningen som forsvinner, inte
 * personen, och hennes pass och timmar ar kvar precis som de var. Det finns
 * ingen papperskorg for konton: en inloggning som ligger och vantar pa att
 * gallras ar en inloggning som fortfarande fungerar.
 */
export async function taBortKonto(formData: FormData) {
  const id = requiredString(formData.get("id"), "Konto");

  await deleteLogin(id);

  revalidateKonton();
}

/** Aktiv, pausad eller avstangd. De tva senare sparrar inloggningen. */
export async function andraKontoStatus(formData: FormData) {
  const id = requiredString(formData.get("id"), "Konto");
  const status = requiredString(formData.get("status"), "Status") as KontoStatus;

  // Server Actions nas med en vanlig POST och inte bara genom skarmen som
  // ritar dem, sa vardet kontrolleras har och inte bara i dropdownen.
  if (!STATUSAR.includes(status)) throw new Error("Okand status");

  // Sparren forst: gar den igenom men uppdateringen inte, star raden kvar som
  // "aktiv" pa en inloggning som inte slapper in — irriterande, men ofarligt.
  // Andra hallet vore en rad som pastar "avstangd" om nagon som kommer in.
  await setLoginBlocked(id, status !== "aktiv");

  const { error } = await supabaseAdmin
    .from("accounts")
    .update({ status })
    .eq("id", id);
  if (error) {
    throw new Error(`Kunde inte andra kontots status: ${error.message}`);
  }

  revalidateKonton();
}
