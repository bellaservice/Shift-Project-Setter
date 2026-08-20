"use client";

import { NyttKontoForm } from "@/components/NyttKontoForm";
import { Query } from "@/components/Query";
import { Screen } from "@/components/Screen";
import { getKontoKandidater } from "@/lib/queries";
import { useQuery } from "@/lib/useQuery";

/**
 * Tillverka Konto.
 *
 * `amber` och inte `steel` som resten av rummet bakom kugghjulet: det har ar
 * den enda skarmen harifran som SKAPAR nagot, och den ska sta under samma gula
 * lampa som Logga Project och Ny Arbetare gor.
 *
 * Kandidaterna hamtas har och inte i formularet, sa att formularet slipper veta
 * att det finns en databas. Det ar ocksa det som gor <Query> meningsfull: listan
 * ar det enda pa skarmen som kan sakna svar, och allt annat kan ritas fardigt.
 */
export default function NyttKontoPage() {
  const kandidater = useQuery(() => getKontoKandidater(), []);

  return (
    <Screen
      tone="amber"
      eyebrow="Konto"
      title="Tillverka Konto"
      back={{ href: "/installningar/konto", label: "Konto" }}
    >
      <Query state={kandidater}>
        {(data) => <NyttKontoForm kandidater={data} />}
      </Query>
    </Screen>
  );
}
