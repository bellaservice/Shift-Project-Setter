import { supabase } from "@/lib/supabase/browser";
import type { Roll } from "@/lib/types";

/**
 * Ber Edge-funktionen tillverka en inloggning.
 *
 * Allt annat i appen skriver rakt i PostgREST med den inloggades JWT. Det har
 * anropet kan inte gora det: en anvandare i Supabase Auth skapas genom
 * `auth.admin.createUser`, som bara svarar pa service role-nyckeln, och den
 * nyckeln gar forbi RLS pa varje tabell. En webblasare far aldrig se den. Se
 * supabase/functions/tillverka-konto/index.ts.
 *
 * `functions.invoke` skickar sessionens token i Authorization av sig sjalvt, sa
 * funktionen kan avgora vem som fragar utan att appen behover skicka nagot om
 * det. Det ar ocksa hela vakten pa andra sidan: ar man inte inloggad far man
 * 401 dar, precis som man far tomma listor har.
 */
export async function tillverkaKonto(input: {
  /** Arbetaren kontot ska tillhora, eller null for ett konto utan arbetare. */
  workerId: string | null;
  email: string;
  password: string;
  /** Rollen kontot ska fodas med. */
  roll: Roll;
}): Promise<{ id: string; email: string }> {
  const { data, error } = await supabase.functions.invoke("tillverka-konto", {
    body: input,
  });

  // Tva sorters fel, och de kommer olika vagar. `error` ar transporten och
  // statuskoder — funktionen svarade inte, eller svarade 4xx/5xx. Kroppen kan
  // anda innehalla ett svenskt meddelande vi helst visar i stallet for
  // "Edge Function returned a non-2xx status code", sa den lases forst.
  const iKroppen =
    data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
      ? (data as { error: string }).error
      : null;

  if (iKroppen) throw new Error(iKroppen);

  if (error) {
    // supabase-js lagger det riktiga svaret i `context` pa ett FunctionsHttpError.
    const svar = (error as { context?: Response }).context;
    if (svar && typeof svar.json === "function") {
      try {
        const kropp = await svar.json();
        if (kropp?.error) throw new Error(String(kropp.error));
      } catch (e) {
        if (e instanceof Error && e.message && !/JSON/i.test(e.message)) throw e;
      }
    }
    throw new Error(
      error.message === "Failed to send a request to the Edge Function"
        ? "Nadde inte funktionen som tillverkar konton. Ar den driftsatt?"
        : error.message
    );
  }

  if (!data?.id) throw new Error("Kontot skapades men svaret gick inte att lasa.");

  /**
   * Rollen sätts en gång till, härifrån.
   *
   * Funktionen ovan tar emot `roll` — men den version som är driftsatt gör det
   * inte nödvändigtvis, och en Edge-funktion kan bara driftsättas med Supabase
   * CLI. Skulle den gamla versionen svara får kontot kolumnens standardvärde
   * 'arbetare', och en nyskapad admin vore tyst degraderad utan att någonting
   * såg fel ut.
   *
   * Skrivningen går genom PostgREST med den inloggades egen token, alltså samma
   * väg som rollväxeln i kontolistan, och avvisas av accounts_update_arbetsledare
   * om den som skapar inte får dela ut roller. Är rollen redan rätt skriver den
   * samma värde en gång till, vilket är gratis.
   *
   * Bara för de två högre rollerna: 'arbetare' är kolumnens standard och behöver
   * ingen andra skrivning.
   */
  if (input.roll !== "arbetare") {
    const { error: rollFel } = await supabase
      .from("accounts")
      .update({ role: input.roll })
      .eq("id", data.id);

    if (rollFel) {
      // Kontot FINNS. Det måste stå i felet — annars försöker användaren igen
      // och möts av "det finns redan en inloggning på den adressen".
      throw new Error(
        `Kontot skapades, men rollen kunde inte sättas till ${input.roll}: ` +
          `${rollFel.message}. Kontot finns och är arbetare — ändra rollen i listan.`
      );
    }
  }

  return data as { id: string; email: string };
}
