import type { Roll } from "@/lib/types";

/**
 * Vad de tre rollerna far gora, pa ETT stalle.
 *
 * Innan adminen fanns stod `roll === "arbetsledare"` utskrivet pa atta stallen i
 * appen. Med tva roller var det bara upprepning; med tre ar det en fälla, for
 * varenda ett av dem betyder numera fel sak — en admin ar inte arbetsledare, sa
 * varje sadan jamforelse hade last ute den roll som ska kunna mest.
 *
 * ⚠️ `farLeda` MASTE svara samma sak som kit.ar_arbetsledare() i databasen, som
 * sedan 20260830090000 ar sann for bade arbetsledare och admin. Gar de tva isar
 * far man den varsta sortens fel: en skarm full av knappar som ser tillatna ut
 * och avvisas av RLS nar de trycks, eller — varre — en knapp som goms for nagon
 * som faktiskt hade fatt trycka pa den.
 *
 * Rollen i webblasaren ar fortfarande KOSMETIK. Grinden ar i databasen; det har
 * avgor bara vad som ritas.
 */

/** Rollerna i fallande ordning av vad de far gora. */
export const ROLLER: Roll[] = ["admin", "arbetsledare", "arbetare"];

export const ROLL_ETIKETT: Record<Roll, string> = {
  admin: "Admin",
  arbetsledare: "Arbetsledare",
  arbetare: "Arbetare",
};

/** Etiketten for en roll, eller "Ingen roll" for ett konto som saknar den. */
export function rollEtikett(roll: Roll | null): string {
  return roll === null ? "Ingen roll" : ROLL_ETIKETT[roll];
}

/**
 * Far den har rollen leda arbetet — lagga ut pass, bekrafta dem, redigera
 * project och konton?
 *
 * Null svarar nej. En inloggning som fallit ur kontotabellen ska fa mindre, inte
 * mer; det ar samma regel som auth.tsx foljer nar den tolkar ett okant rollvarde.
 */
export function farLeda(roll: Roll | null): boolean {
  return roll === "arbetsledare" || roll === "admin";
}

/**
 * Ar rollen enbart adminens?
 *
 * Skilt fran `farLeda` for det fatal som inte ar arbetsledarens: att styra vilka
 * project som finns och att skriva ut en Arbetsdagbok for en period. Speglar
 * kit.ar_admin().
 */
export function arAdmin(roll: Roll | null): boolean {
  return roll === "admin";
}
