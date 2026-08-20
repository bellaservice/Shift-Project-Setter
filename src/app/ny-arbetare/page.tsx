"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArbetareForm } from "@/components/ArbetareForm";
import { Screen } from "@/components/Screen";
import { internalPath } from "@/lib/searchParams";

/**
 * Ny Arbetare.
 *
 * `?next=` lastes tidigare ur `searchParams`, som sidan fick av servern. Ett
 * statiskt bygge har ingen server att fa den av: Next skriver ut sidan till en
 * fil vid bygget, och en fil kan inte kanna till fragestrangen i en adress som
 * inte finns an. Att lasa den dar ar darfor inte bara olampligt utan ett
 * byggfel -- `dynamic = "error"`, som exporten satter, avbryter direkt.
 *
 * Vardet ar oforandrat; det ar bara hamtat i webblasaren i stallet.
 * `useSearchParams()` maste ligga under en <Suspense>, eftersom Next annars
 * inte kan skriva ut nagot alls for sidan innan fragestrangen ar kand.
 */
export default function NyArbetarePage() {
  return (
    <Suspense fallback={<Laddar />}>
      <NyArbetare />
    </Suspense>
  );
}

/** Ramen utan formularet, sa att skarmen har sin titel och sin pil direkt. */
function Laddar() {
  return (
    <Screen
      tone="amber"
      eyebrow="Arbetare"
      title="Ny Arbetare"
      back={{ href: "/", label: "Hem" }}
    />
  );
}

function NyArbetare() {
  /** `?next=<vag>`: sidan som skickade hit, t.ex. ett halvifyllt Logga Project. */
  const back = internalPath(useSearchParams().get("next"));

  return (
    <Screen
      // Amber: nagot skapas har. Samma ljus som Logga Project och Logga Timmar,
      // eftersom de tre ar samma sorts arende sett fran anvandarens sida.
      tone="amber"
      eyebrow="Arbetare"
      title="Ny Arbetare"
      // Kom man hit mitt i ett annat arende leder pilen tillbaka dit, inte
      // hem -- formularet man lamnade star kvar som det var.
      back={{ href: back ?? "/", label: back ? "Tillbaka" : "Hem" }}
    >
      <ArbetareForm next={back} />
    </Screen>
  );
}
