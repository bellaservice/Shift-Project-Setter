import { ActionRow } from "@/components/Panel";
import { Screen } from "@/components/Screen";
import { KontoLista } from "./KontoLista";

export const metadata = { title: "Konto — Bella Service" };

/**
 * Vilka som kan logga in, och vad de har for status.
 *
 * Ett konto ar en arbetares inloggning: raden visar hennes namn, hennes bild
 * och den e-post som star i hennes profil, for det ar den man loggar in med.
 * Se supabase/migrations/20260820120000_konton.sql for kopplingen.
 *
 * `steel` som resten av rummet bakom kugghjulet. Den enda skarmen harifran som
 * byter ton ar den som SKAPAR nagot -- se Tillverka Konto.
 *
 * Att tillverka ett konto gar genom en Edge-funktion och inte harifran: en
 * anvandare i Supabase Auth skapas med service role-nyckeln, och den kan inte
 * finnas i en webblasare. Funktionen kor hos Supabase och haller nyckeln dar.
 * Se supabase/functions/tillverka-konto/index.ts.
 *
 * Sidan ar fortfarande en serverkomponent, och det ar avsiktligt: den hamtar
 * ingenting sjalv, sa den kan skrivas ut till en fil vid bygget, och da far den
 * behalla sin `metadata`. Lasningen ligger i <KontoLista>.
 */
export default function KontoPage() {
  return (
    <Screen
      tone="steel"
      eyebrow="Appen"
      title="Konto"
      back={{ href: "/installningar", label: "Inställningar" }}
      lead={<ActionRow href="/installningar/konto/nytt" label="Tillverka Konto" />}
    >
      <KontoLista />
    </Screen>
  );
}
