import { NyttKontoForm } from "@/components/NyttKontoForm";
import { Screen } from "@/components/Screen";

export const metadata = { title: "Tillverka Konto — Bella Service" };

/**
 * `amber` och inte `steel`: tonen foljer vad man gor, inte vilken meny man kom
 * ifran. Det har ar en skarm dar nagot skapas — samma sort som Logga Project
 * och Ny Arbetare — och den ska kannas som dem.
 */
export default function NyttKontoPage() {
  return (
    <Screen
      tone="amber"
      eyebrow="Konto"
      title="Tillverka Konto"
      back={{ href: "/installningar/konto", label: "Konto" }}
    >
      <NyttKontoForm />
    </Screen>
  );
}
