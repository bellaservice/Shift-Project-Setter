"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PanelSkeleton, Query } from "@/components/Query";
import { Screen } from "@/components/Screen";
import { getWorkers } from "@/lib/queries";
import { useQuery } from "@/lib/useQuery";
import { LoggaProjectForm } from "./LoggaProjectForm";

/**
 * Logga Project — den tomma blanketten. Redigering av ett befintligt project
 * ligger pa /logga-project/redigera.
 *
 * Sidans innehall ar brutet ut i <NyttProjectForm> av ett skal som inte syns
 * har: den laser `?ny=` med useSearchParams, och under `output: "export"` maste
 * allt som gor det ligga i en <Suspense>-grans. Skalet ar att query-strangen
 * inte finns nar sidan byggs — den ar en egenskap hos besoket, inte hos filen —
 * sa Next maste kunna rendera ramen utan den och fylla i resten i webblasaren.
 * <Screen> star darfor utanfor gransen och blir statisk HTML; bara formularet
 * innanfor vantar.
 */
export default function LoggaProjectPage() {
  return (
    <Screen
      tone="amber"
      eyebrow="Project"
      title="Logga Project"
      back={{ href: "/", label: "Hem" }}
    >
      <Suspense fallback={<PanelSkeleton />}>
        <NyttProjectForm />
      </Suspense>
    </Screen>
  );
}

function NyttProjectForm() {
  /** `?ny=<id>`: arbetaren som just skapades via "+ Lägg Till" i formuläret. */
  const newWorkerId = useSearchParams().get("ny") ?? undefined;
  const workers = useQuery(() => getWorkers(), []);

  return (
    <Query state={workers}>
      {(data) => <LoggaProjectForm workers={data} newWorkerId={newWorkerId} />}
    </Query>
  );
}
