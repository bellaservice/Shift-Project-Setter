"use client";

import { ActionRow } from "@/components/Panel";
import { useAuth } from "@/lib/auth";
import { farLeda } from "@/lib/roller";
import { MittKonto } from "./MittKonto";

/**
 * Toppen av Konto-skarmen: ditt eget konto, och — for den som far dela ut
 * konton — vagen att tillverka ett till.
 *
 * Knappen stod tidigare ovillkorligt i sidans `lead`, alltsa aven for en
 * arbetare. Den ledde till ett formular som RLS anda avvisar, sa den lovade
 * nagot appen inte tanker halla. En knapp som alltid misslyckas ar samre an
 * ingen knapp.
 *
 * Kortet star kvar for alla. Det ar ditt eget konto, och det ar hela skalet
 * till att en arbetare har nagot pa den har skarmen overhuvudtaget.
 */
export function KontoLead() {
  const { roll, rollLoading } = useAuth();

  return (
    <>
      <MittKonto />
      {!rollLoading && farLeda(roll) && (
        <ActionRow href="/installningar/konto/nytt" label="Tillverka Konto" />
      )}
    </>
  );
}
