"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import { PanelSkeleton, Query } from "@/components/Query";
import { EmptyState, Screen } from "@/components/Screen";
import { formatWeekdayDateSv, parseIsoDate } from "@/lib/format";
import { getArende, getKonton } from "@/lib/queries";
import { useQuery } from "@/lib/useQuery";
import { ArendeForm } from "./ArendeForm";

/**
 * Tillverka Ärende, och Redigera Ärende — samma skärm.
 *
 * `?id=` öppnar ett sparat ärende, `?datum=` öppnar ett nytt på den dag man
 * tryckte på i kalendern. Varken eller ger ett nytt ärende med dagens datum,
 * vilket är vad man vill om man kom hit på något annat sätt.
 */
export default function ArendePage() {
  return (
    <Suspense fallback={<Laddar />}>
      <ArendeSkarm />
    </Suspense>
  );
}

function Laddar() {
  return (
    <Screen
      tone="amber"
      eyebrow="Kalender"
      title="Tillverka Ärende"
      back={{ href: "/kalender", label: "Kalender" }}
    >
      <PanelSkeleton />
    </Screen>
  );
}

function ArendeSkarm() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const defaultDate = parseIsoDate(params.get("datum")) ?? undefined;

  const bundle = useQuery(async () => {
    const [arende, konton] = await Promise.all([
      id ? getArende(id) : Promise.resolve(null),
      getKonton(),
    ]);
    // Ett id som inte finns är inte "ett nytt ärende" — det är en trasig länk,
    // och skärmen ska säga det i stället för att tyst erbjuda ett tomt formulär
    // som skapar en andra rad. Ett ärende man inte får se svarar likadant, och
    // det är avsiktligt — se `getArende`.
    return { saknas: id !== "" && arende === null, arende, konton };
  }, [id]);

  const arende = bundle.data?.arende ?? null;

  return (
    <Screen
      tone="amber"
      eyebrow={
        arende
          ? `Kalender · ${formatWeekdayDateSv(arende.arende_date)}`
          : defaultDate
            ? `Kalender · ${formatWeekdayDateSv(defaultDate)}`
            : "Kalender"
      }
      title={id ? "Redigera Ärende" : "Tillverka Ärende"}
      back={{
        href: arende
          ? `/kalender?datum=${arende.arende_date}`
          : defaultDate
            ? `/kalender?datum=${defaultDate}`
            : "/kalender",
        label: "Kalender",
      }}
    >
      <Query state={bundle}>
        {(loaded) =>
          loaded.saknas ? (
            <EmptyState
              title="Ärendet finns inte."
              hint="Det kan ha raderats — ärenden hamnar inte i Papperskorgen — eller så är det inte delat med dig."
              action={
                <ButtonLink href="/kalender" size="md">
                  Kalender
                </ButtonLink>
              }
            />
          ) : (
            <ArendeForm
              // Formulärets fält är okontrollerade och tar bara upp nya
              // defaultValue om de monteras om. Nyckeln ser till att de gör det
              // när skärmen går från ett ärende till ett annat.
              key={loaded.arende?.id ?? "nytt"}
              arende={loaded.arende ?? undefined}
              konton={loaded.konton}
              defaultDate={defaultDate}
            />
          )
        }
      </Query>
    </Screen>
  );
}
