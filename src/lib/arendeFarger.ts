/**
 * Färgerna ett ärende kan bära i kalendern.
 *
 * Sluggar och inte hex-koder i databasen: appen har två teman, och vilken kulör
 * en slug faktiskt ritas i är ett utseendebeslut som hör hemma här bland de
 * andra utseendebesluten — inte i en rad som skrevs en gång i mars. Ett fritt
 * färgväljarfält var också uteslutet av ett enklare skäl: det låter användaren
 * välja svart på svart.
 *
 * Sex färger, och tre av dem är tokens appen redan har (accenten, danger, ok).
 * Fler än så är inte en palett utan en färgväljare, och på en 56px kalenderruta
 * går ändå bara ett fåtal att skilja åt i ögonvrån.
 *
 * VIKTIGT: listan speglas av `arenden_farg_check` i migration
 * 20260821120000_arenden.sql. Läggs en färg till här måste constraintet med —
 * webbläsaren skriver direkt till PostgREST, så databasen är den som avgör
 * vilka värden som finns.
 */
export type ArendeFarg = {
  /** Det som ligger i arenden.farg. */
  value: string;
  /** Namnet i färgväljaren, och det som läses upp. */
  label: string;
  /** Kulören. Används som prick, kant och platta — aldrig som textfärg mot en
   *  bakgrund, så ingen av dem behöver bära ett kontrastkrav på egen hand. */
  hex: string;
};

export const ARENDE_FARGER: ArendeFarg[] = [
  { value: "amber", label: "Gul", hex: "#ffb92e" },
  { value: "blue", label: "Blå", hex: "#60a5fa" },
  { value: "green", label: "Grön", hex: "#34d399" },
  { value: "red", label: "Röd", hex: "#f87171" },
  { value: "purple", label: "Lila", hex: "#c084fc" },
  { value: "pink", label: "Rosa", hex: "#f472b6" },
];

/** Standardfärgen — samma som kolumnens default i databasen. */
export const ARENDE_FARG_DEFAULT = "amber";

/**
 * Kulören för en slug, med accenten som reserv.
 *
 * Reserven är inte teoretisk trots constraintet: en rad kan ha skrivits av en
 * nyare version av appen med en färg den här bunten inte känner till, och en
 * prick i fel färg är oändligt mycket bättre än en tom `background: undefined`.
 */
export function arendeFargHex(value: string | null | undefined): string {
  return (
    ARENDE_FARGER.find((f) => f.value === value)?.hex ?? ARENDE_FARGER[0].hex
  );
}
