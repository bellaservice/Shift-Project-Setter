"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import { PanelSkeleton, Query } from "@/components/Query";
import { EmptyState, Screen } from "@/components/Screen";
import { formatWeekdayDateSv } from "@/lib/format";
import { getProjects, getShiftDetail } from "@/lib/queries";
import { useQuery } from "@/lib/useQuery";
import { RedigeraPassForm } from "./RedigeraPassForm";

/**
 * Redigera Pass — ett loggat pass, öppnat från en dag i Kalendern.
 *
 * `?pass=` och inte `?id=`: skärmen ligger under /kalender, där `?id=` redan är
 * ett ärende (se /kalender/arende). Två olika sorters rad under samma gren ska
 * inte dela parameternamn — då blir en felkopierad länk en tyst 404 i stället
 * för en läsbar.
 *
 * Vägen tillbaka går till kalendern och inte till passets dag, eftersom dagen
 * kan ha ändrats av det man just gjorde. `saveShift` svarar med den NYA dagen;
 * pilen uppe till vänster är för den som ångrat sig och därför ska tillbaka till
 * den man kom ifrån.
 */
export default function RedigeraPassPage() {
  return (
    <Suspense fallback={<Laddar />}>
      <PassSkarm />
    </Suspense>
  );
}

function Laddar() {
  return (
    <Screen
      tone="amber"
      eyebrow="Kalender"
      title="Redigera Pass"
      back={{ href: "/kalender", label: "Kalender" }}
    >
      <PanelSkeleton />
    </Screen>
  );
}

function PassSkarm() {
  const id = useSearchParams().get("pass") ?? "";

  const bundle = useQuery(async () => {
    if (!id) return null;
    const [shift, projects] = await Promise.all([
      getShiftDetail(id),
      getProjects(),
    ]);
    return shift === null ? null : { shift, projects };
  }, [id]);

  return (
    <Screen
      tone="amber"
      eyebrow={
        bundle.data
          ? `Kalender · ${formatWeekdayDateSv(bundle.data.shift.shiftDate)}`
          : "Kalender"
      }
      title="Redigera Pass"
      back={{
        href: bundle.data
          ? `/kalender?datum=${bundle.data.shift.shiftDate}`
          : "/kalender",
        label: "Kalender",
      }}
    >
      <Query state={bundle}>
        {(loaded) =>
          loaded === null ? (
            <EmptyState
              title="Passet finns inte."
              hint="Det kan ha tagits bort, eller så ligger projectet eller arbetaren i Papperskorgen."
              action={
                <ButtonLink href="/kalender" size="md">
                  Kalender
                </ButtonLink>
              }
            />
          ) : (
            <RedigeraPassForm shift={loaded.shift} projects={loaded.projects} />
          )
        }
      </Query>
    </Screen>
  );
}
