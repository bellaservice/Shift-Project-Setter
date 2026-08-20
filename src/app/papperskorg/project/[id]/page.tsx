import { notFound } from "next/navigation";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { Screen } from "@/components/Screen";
import { TrashNotice } from "@/components/TrashNotice";
import { LoggaProjectForm } from "@/app/logga-project/LoggaProjectForm";
import { projectLabel } from "@/lib/format";
import { getTrashedProject, getWorkers } from "@/lib/queries";
import { purgeProject, restoreProject } from "../../actions";

export const dynamic = "force-dynamic";

/**
 * Ett borttaget project, med de uppgifter det hade nar det togs bort — namn,
 * bestallare, tjanster och de arbetare som var kopplade.
 *
 * Passen syns inte har, men de finns kvar: de ar bara dolda ur listorna och
 * summorna sa lange projectet ligger i korgen, och foljer med tillbaka vid en
 * aterstallning.
 */
export default async function PapperskorgProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, workers] = await Promise.all([getTrashedProject(id), getWorkers()]);

  // Inte i papperskorgen: antingen aldrig borttaget, eller redan gallrat.
  if (!project || !project.deleted_at) notFound();

  return (
    <Screen
      tone="ember"
      eyebrow="I Papperskorgen"
      title={projectLabel(project)}
      back={{ href: "/papperskorg", label: "Papperskorg" }}
      lead={
        <TrashNotice
          id={project.id}
          deletedAt={project.deleted_at}
          restoreAction={restoreProject}
          restoreLabel="Återställ Project"
        />
      }
    >
      <LoggaProjectForm
        project={project}
        workers={workers}
        submitLabel="Spara & Återställ"
      />

      <div className="mt-4 border-t border-night-line pt-5">
        <ConfirmDeleteButton
          action={purgeProject}
          id={project.id}
          label="Radera Permanent Nu"
          title={`Radera ${projectLabel(project)} permanent?`}
          description="Projectet raderas ur databasen direkt i stallet for nar fristen gar ut, tillsammans med sina tjanster, kopplade arbetare och alla pass som loggats pa det. Timmarna forsvinner darmed ocksa fran totalerna pa Hem. Det gar inte att angra."
          confirmLabel="Ja, radera permanent"
        />
      </div>
    </Screen>
  );
}
