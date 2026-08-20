import type { KontoStatus } from "@/lib/types";

/**
 * Kontoskarmarnas egna smadelar — det som hor till webblasaren och inte till
 * databasen.
 *
 * Sjalva kontona ligger i public.accounts och lases med `getKonton()`; det som
 * skrivs gar genom Server Actions i installningar/konto/actions.ts. Har finns
 * bara etiketterna dropdownen visar och de tva raderna som lamnas over till den
 * som ska fa kontot.
 *
 * LOSENORD SPARAS INTE. Ett losenord skickas till Supabase Auth nar kontot
 * skapas och finns darefter bara som en hash dar. Det som star i formularets
 * ruta ar den enda kopian appen nagonsin ser, och den forsvinner nar sidan
 * lamnas — darfor ligger kopieringsknappen FORE knappen som skapar.
 */

/** Statusarna i den ordning de betyder nagot: full atkomst, tillfalligt stopp,
 *  permanent stopp. Etiketterna ar det som syns, varderna det som sparas. */
export const KONTO_STATUS: Array<{ value: KontoStatus; label: string }> = [
  { value: "aktiv", label: "Aktiv" },
  { value: "pausad", label: "Pausad" },
  { value: "avstangd", label: "Avstängd" },
];

/**
 * Raderna som kopieras till urklipp och klistras in i ett meddelande till den
 * som ska fa kontot. Formatet ar bestamt av mottagaren, inte av appen — tva
 * rader, etikett och varde, ingenting daromkring.
 */
export function inloggningsText(epost: string, losenord: string) {
  return `E-post: ${epost}\nLösenord: ${losenord}`;
}

/**
 * Skriv till urklipp, pa bada satten som finns.
 *
 * `navigator.clipboard` ar det ratta, och det ar ocksa det som inte finns nar
 * appen kors over vanlig http — en intern app pa en adress i kontorsnatet ar
 * inte en "secure context", och da ar hela API:et borta, inte bara nekat.
 * `execCommand` ar utdomt men fungerar dar, och en knapp som inte kopierar ar
 * varre an en rad foraldrad kod.
 *
 * Returnerar om det gick. Gick det inte visar formularet raderna i klartext i
 * stallet — ett kvitto som sager "kopierat" nar ingenting kopierats ar det enda
 * riktigt daliga utfallet.
 */
export async function skrivTillUrklipp(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Nekad eller ofokuserad flik. Gamla vagen far forsoka.
  }

  try {
    const ruta = document.createElement("textarea");
    ruta.value = text;
    ruta.setAttribute("readonly", "");
    // Utanfor synhall men inuti sidan: ett falt med `display:none` gar inte att
    // markera, och utan markering kopierar `execCommand` ingenting.
    ruta.style.position = "fixed";
    ruta.style.top = "0";
    ruta.style.opacity = "0";
    ruta.style.pointerEvents = "none";
    document.body.append(ruta);
    ruta.select();
    const gick = document.execCommand("copy");
    ruta.remove();
    return gick;
  } catch {
    return false;
  }
}
