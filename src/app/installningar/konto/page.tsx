import { KontoList } from "@/components/KontoList";
import { Screen } from "@/components/Screen";

export const metadata = { title: "Konto — Bella Service" };

/**
 * Vilka som ska kunna logga in, och vad de har for status.
 *
 * Skarmen ar byggd fore inloggningen sjalv och sager det rakt ut i stallet for
 * att se ut som ett register den inte ar an — se lib/konton.ts for vad som
 * ligger var. Allt annat pa sidan ar riktigt: raderna, statusen, raderingen och
 * formularet bakom knappen ar de som blir kvar nar kontona far en databas.
 *
 * `steel` som resten av rummet bakom kugghjulet. Den enda skarmen harifran som
 * byter ton ar den som SKAPAR nagot — se Tillverka Konto.
 */
export default function KontoPage() {
  return (
    <Screen
      tone="steel"
      eyebrow="Appen"
      title="Konto"
      back={{ href: "/installningar", label: "Inställningar" }}
    >
      <p className="-mt-1 px-1 text-xs leading-relaxed text-white/65">
        Kontona som ska kunna logga in i appen. Inloggningen är inte påkopplad
        än — tills den är det ligger listan i den här webbläsaren, och lösenord
        sparas aldrig i appen.
      </p>

      <KontoList />
    </Screen>
  );
}
