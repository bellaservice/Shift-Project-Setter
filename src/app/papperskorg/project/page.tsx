"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { PanelSkeleton, Query } from "@/components/Query";
import { EmptyState, Screen } from "@/components/Screen";
import { TrashNotice } from "@/components/TrashNotice";
import { LoggaProjectForm } from "@/app/logga-project/LoggaProjectForm";
import { projectLabel } from "@/lib/format";
import { getTrashedProject, getWorkers } from "@/lib/queries";
import { useQuery } from "@/lib/useQuery";
import { useNavigatingAction } from "@/lib/useNavigatingAction";
import { purgeProject, restoreProject } from "../actions";

/**
 * Ett borttaget project, med de uppgifter det hade nar det togs bort — namn,
 * bestallare, tjanster och de arbetare som var kopplade.
 *
 * Passen syns inte har, men de finns kvar: de ar bara dolda ur listorna och
 * summorna sa lange projectet ligger i korgen, och foljer med tillbaka vid en
 * aterstallning.
 *
 * Lag pa /papperskorg/project/[id]; id:t ar numera `?id=`, se noteringen i
 * /alla-arbetare/redigera.
 */
export default function PapperskorgProjectPage() {
  return (
    <Suspense fallback={<Laddar />}>
      <PapperskorgProject />
    </Suspense>
  );
}

function Laddar() {
  return (
    <Screen
      tone="ember"
      eyebrow="I Papperskorgen"
      title="Project"
      back={{ href: "/papperskorg", label: "Papperskorg" }}
    >
      <PanelSkeleton />
    </Screen>
  );
}

function PapperskorgProject() {
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";

  const bundle = useQuery(async () => {
    if (!id) return null;
    const [project, workers] = await Promise.all([
      getTrashedProject(id),
      getWorkers(),
    ]);
    // Inte i papperskorgen: antingen aldrig borttaget, eller redan gallrat.
    if (!project || !project.deleted_at) return null;
    return { project, workers };
  }, [id]);

  // restoreProject svarar med vagen tillbaka till listan i stallet for att
  // navigera sjalv — se useNavigatingAction.
  const { submit: onRestore, error: restoreError } = useNavigatingAction(restoreProject);

  async function onPurge(formData: FormData) {
    await purgeProject(formData);
    router.push("/papperskorg");
  }

  return (
    <Screen
      tone="ember"
      eyebrow="I Papperskorgen"
      title={bundle.data ? projectLabel(bundle.data.project) : "Project"}
      back={{ href: "/papperskorg", label: "Papperskorg" }}
      lead={
        bundle.data && (
          <TrashNotice
            id={bundle.data.project.id}
            deletedAt={bundle.data.project.deleted_at!}
            restoreAction={onRestore}
            restoreError={restoreError}
            restoreLabel="Återställ Project"
          />
        )
      }
    >
      <Query state={bundle}>
        {(data) =>
          data === null ? (
            <EmptyState
              title="Finns inte i Papperskorgen."
              hint="Raden kan redan ha gallrats, eller aldrig ha tagits bort."
              action={
                <ButtonLink href="/papperskorg" size="md">
                  Papperskorg
                </ButtonLink>
              }
            />
          ) : (
            <>
              <LoggaProjectForm
                project={data.project}
                workers={data.workers}
                submitLabel="Spara & Återställ"
              />

              <div className="mt-4 border-t border-night-line pt-5">
                <ConfirmDeleteButton
                  action={onPurge}
                  id={data.project.id}
                  label="Radera Permanent Nu"
                  title={`Radera ${projectLabel(data.project)} permanent?`}
                  description="Projectet raderas ur databasen direkt i stället för när fristen går ut, tillsammans med sina tjänster, kopplade arbetare och alla pass som loggats på det. Timmarna försvinner därmed också från totalerna på Hem. Det går inte att ångra."
                  confirmLabel="Ja, radera permanent"
                />
              </div>
            </>
          )
        }
      </Query>
    </Screen>
  );
}
