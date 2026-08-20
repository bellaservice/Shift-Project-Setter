"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { PanelSkeleton, Query } from "@/components/Query";
import { RecentShiftsList } from "@/components/RecentShiftsList";
import { EmptyState, Screen, SectionHeading } from "@/components/Screen";
import { projectLabel } from "@/lib/format";
import {
  getProjectWithDetails,
  getRecentShiftsForProject,
  getWorkers,
} from "@/lib/queries";
import { TRASH_RETENTION_DAYS } from "@/lib/trash";
import { useQuery } from "@/lib/useQuery";
import { deleteProject } from "../actions";
import { LoggaProjectForm } from "../LoggaProjectForm";

/**
 * Redigera Project.
 *
 * Lag pa /logga-project/[id]. Se noteringen i /alla-arbetare/redigera: id:t ar
 * numera `?id=`, eftersom ett statiskt bygge inte kan kanna till projectens
 * id:n vid byggtillfallet.
 */
export default function RedigeraProjectPage() {
  return (
    <Suspense fallback={<Laddar />}>
      <RedigeraProject />
    </Suspense>
  );
}

function Laddar() {
  return (
    <Screen
      tone="amber"
      eyebrow="Redigera Project"
      title="Project"
      back={{ href: "/alla-project", label: "Alla Project" }}
    >
      <PanelSkeleton />
    </Screen>
  );
}

function RedigeraProject() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  /** `?ny=<id>`: arbetaren som just skapades via "+ Lagg Till" i formularet. */
  const newWorkerId = params.get("ny") ?? undefined;

  const bundle = useQuery(async () => {
    if (!id) return null;
    const [project, workers, recentShifts] = await Promise.all([
      getProjectWithDetails(id),
      getWorkers(),
      getRecentShiftsForProject(id),
    ]);
    return project === null ? null : { project, workers, recentShifts };
  }, [id]);

  async function onDelete(formData: FormData) {
    await deleteProject(formData);
    router.push("/alla-project");
  }

  return (
    <Screen
      tone="amber"
      eyebrow="Redigera Project"
      // Rubriken ar projectets namn och inte "Redigera Project": man kommer hit
      // fran en lista med tolv rader, och det forsta man behover se ar VILKEN
      // av dem man oppnade. Vad sidan gor star i ogonbrynet ovanfor.
      title={bundle.data ? projectLabel(bundle.data.project) : "Project"}
      back={{ href: "/alla-project", label: "Alla Project" }}
    >
      <Query state={bundle}>
        {(data) =>
          data === null ? (
            <EmptyState
              title="Projectet finns inte."
              hint="Det kan ha tagits bort. Kolla i Papperskorgen om det ska tillbaka."
              action={
                <ButtonLink href="/alla-project" size="md">
                  Alla Project
                </ButtonLink>
              }
            />
          ) : (
            <>
              {/* Samma formular som nar projectet skapades — bara knappen langst
                  ner byter ord, eftersom det har ar en redigering och inte en ny
                  loggning. */}
              <LoggaProjectForm
                project={data.project}
                workers={data.workers}
                submitLabel="Spara Detaljer"
                newWorkerId={newWorkerId}
              />

              <section className="mt-2">
                <SectionHeading>Senaste Pass</SectionHeading>
                <RecentShiftsList shifts={data.recentShifts} />
              </section>

              {/* Utanfor formularet ovan: ett formular inuti ett annat ar ogiltig
                  HTML, och borttagningen ar dessutom sin egen handling. Hairlinen
                  ar det som skiljer "spara" fran "radera" — de far inte se ut som
                  tva knappar i samma grupp. */}
              <div className="mt-4 border-t border-night-line pt-5">
                <ConfirmDeleteButton
                  action={onDelete}
                  id={data.project.id}
                  label="Ta Bort Project"
                  title={`Ta bort ${projectLabel(data.project)}?`}
                  description={`Projectet flyttas till Papperskorgen med sina tjänster, kopplade arbetare och alla pass som loggats på det, och timmarna försvinner samtidigt ur totalerna på Hem. Du har ${TRASH_RETENTION_DAYS} dagar på dig att hämta tillbaka det därifrån — därefter raderas allt permanent.`}
                  confirmLabel="Ja, ta bort projectet"
                  pendingLabel="Tar bort…"
                />
              </div>
            </>
          )
        }
      </Query>
    </Screen>
  );
}
