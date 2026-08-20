import { notFound } from "next/navigation";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { RecentShiftsList } from "@/components/RecentShiftsList";
import { Screen, SectionHeading } from "@/components/Screen";
import { projectLabel } from "@/lib/format";
import { getProjectWithDetails, getRecentShiftsForProject, getWorkers } from "@/lib/queries";
import { firstParam } from "@/lib/searchParams";
import { TRASH_RETENTION_DAYS } from "@/lib/trash";
import { deleteProject } from "../actions";
import { LoggaProjectForm } from "../LoggaProjectForm";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /** `?ny=<id>`: arbetaren som just skapades via "+ Lagg Till" i formularet. */
  searchParams: Promise<{ ny?: string | string[] }>;
}) {
  const [{ id }, { ny }] = await Promise.all([params, searchParams]);
  const [project, workers, recentShifts] = await Promise.all([
    getProjectWithDetails(id),
    getWorkers(),
    getRecentShiftsForProject(id),
  ]);

  if (!project) notFound();

  return (
    <Screen
      tone="amber"
      eyebrow="Redigera Project"
      // Rubriken ar projectets namn och inte "Redigera Project": man kommer hit
      // fran en lista med tolv rader, och det forsta man behover se ar VILKEN
      // av dem man oppnade. Vad sidan gor star i ogonbrynet ovanfor.
      title={projectLabel(project)}
      back={{ href: "/alla-project", label: "Alla Project" }}
    >
      {/* Samma formular som nar projectet skapades — bara knappen langst ner
          byter ord, eftersom det har ar en redigering och inte en ny loggning. */}
      <LoggaProjectForm
        project={project}
        workers={workers}
        submitLabel="Spara Detaljer"
        newWorkerId={firstParam(ny)}
      />

      <section className="mt-2">
        <SectionHeading>Senaste Pass</SectionHeading>
        <RecentShiftsList shifts={recentShifts} />
      </section>

      {/* Utanfor formularet ovan: ett formular inuti ett annat ar ogiltig HTML,
          och borttagningen ar dessutom sin egen handling. Hairlinen ar det som
          skiljer "spara" fran "radera" — de far inte se ut som tva knappar i
          samma grupp. */}
      <div className="mt-4 border-t border-night-line pt-5">
        <ConfirmDeleteButton
          action={deleteProject}
          id={project.id}
          label="Ta Bort Project"
          title={`Ta bort ${projectLabel(project)}?`}
          description={`Projectet flyttas till Papperskorgen med sina tjanster, kopplade arbetare och alla pass som loggats pa det, och timmarna forsvinner samtidigt ur totalerna pa Hem. Du har ${TRASH_RETENTION_DAYS} dagar pa dig att hamta tillbaka det darifran — darefter raderas allt permanent.`}
          confirmLabel="Ja, ta bort projectet"
          pendingLabel="Tar bort…"
        />
      </div>
    </Screen>
  );
}
