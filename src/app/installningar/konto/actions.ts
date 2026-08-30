import { supabase } from "@/lib/supabase/browser";
import type { Roll } from "@/lib/types";

/**
 * Kontoskarmens skrivningar.
 *
 * Ett konto ar det enda stallet i appen dar befogenheter delas ut, sa varje
 * skrivning har ar en privilegieandring. Tva vakter star bakom dem, och ingen
 * av dem sitter i den har filen:
 *
 *   accounts_update_arbetsledare      Bara en arbetsledare far skriva alls.
 *   kit.accounts_behall_en_arbetsledare
 *                                     Den sista aktiva arbetsledaren gar inte
 *                                     att degradera, pausa, stanga av eller
 *                                     radera. Utan den kan foretaget lasa ut
 *                                     sig ur sitt eget system med ett tryck.
 *
 * Det har ar alltsa inte valideringen — det ar formulerandet av fragan, och
 * oversattningen av databasens svar till svenska.
 */

const ROLLER: Roll[] = ["admin", "arbetsledare", "arbetare"];

function kontoId(value: FormDataEntryValue | null): string {
  const raw = String(value ?? "").trim();
  if (raw === "") throw new Error("Kontot saknar id");
  return raw;
}

function roll(value: FormDataEntryValue | null): Roll {
  const raw = String(value ?? "").trim();
  const traff = ROLLER.find((r) => r === raw);
  if (!traff) throw new Error("Okand roll");
  return traff;
}

/**
 * Byter roll pa ett konto.
 *
 * `.neq("role", nyRoll)` ar inte en optimering: utan den skulle ett tryck pa
 * den roll kontot redan har skriva en rad utan att andra nagot, och skarmen
 * hade rapporterat en lyckad andring som inte var en andring. Traffar noll
 * rader betyder det att nagon annan hann fore — och da ska listan las om, inte
 * skrivas over.
 */
export async function satsRoll(formData: FormData): Promise<void> {
  const id = kontoId(formData.get("konto_id"));
  const nyRoll = roll(formData.get("roll"));

  const { data, error } = await supabase
    .from("accounts")
    .update({ role: nyRoll })
    .eq("id", id)
    .neq("role", nyRoll)
    .select("id");

  if (error) {
    // restrict_violation ar sista-arbetsledaren-vakten. Dess meddelande ar
    // redan skrivet for en manniska att lasa, sa det skickas vidare som det ar
    // i stallet for att packas in i "Kunde inte ...".
    if (error.code === "23001" || /minst en aktiv arbetsledare/.test(error.message)) {
      throw new Error(error.message);
    }
    throw new Error(`Kunde inte byta roll: ${error.message}`, { cause: error });
  }

  if ((data ?? []).length === 0) {
    /**
     * Noll rader betyder tva helt olika saker, och att blanda ihop dem kostade
     * en riktig anvandare en kvart:
     *
     *   a) Raden matchade inte — kontot hade redan rollen, eller nagon annan
     *      hann fore. Ofarligt, ladda om.
     *   b) RLS slappte inte fram skrivningen. Da traffar UPDATE noll rader UTAN
     *      att fela, precis som i (a) — men orsaken ar att den inloggade inte
     *      langre ar arbetsledare. Det hander framfor allt efter att nagon
     *      degraderat sitt EGET konto: darefter far hen inte satta tillbaka
     *      rollen heller, och "kontot kan redan ha den rollen" var da ett rent
     *      vilseledande besked.
     *
     * En extra lasning skiljer dem at. Star raden kvar pa sin gamla roll var
     * det (b).
     */
    const { data: rad } = await supabase
      .from("accounts")
      .select("role")
      .eq("id", id)
      .maybeSingle();

    if (rad && rad.role !== nyRoll) {
      throw new Error(
        "Du har inte behorighet att andra roller. Det beror oftast pa att ditt eget konto inte langre ar arbetsledare — ladda om sidan, och be en kollega satta tillbaka rollen om den ar borta."
      );
    }

    throw new Error(
      "Rollen andrades inte. Kontot kan redan ha den rollen, eller ha andrats av nagon annan — ladda om sidan."
    );
  }
}
