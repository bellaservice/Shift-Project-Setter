import { RecentShiftsList } from "@/components/RecentShiftsList";
import { Screen, SectionHeading } from "@/components/Screen";
import { getProjects, getRecentShiftsForProject, getWorkers } from "@/lib/queries";
import { LoggaTimmarForm } from "./LoggaTimmarForm";

export const dynamic = "force-dynamic";

export default async function LoggaTimmarPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: selectedProjectId } = await searchParams;

  const [projects, workers, recentShifts] = await Promise.all([
    getProjects(),
    getWorkers(),
    selectedProjectId ? getRecentShiftsForProject(selectedProjectId) : Promise.resolve([]),
  ]);

  return (
    <Screen
      tone="amber"
      eyebrow="Tidrapport"
      title="Logga Timmar"
      back={{ href: "/", label: "Hem" }}
    >
      <LoggaTimmarForm
        projects={projects}
        workers={workers}
        selectedProjectId={selectedProjectId ?? ""}
      />

      {/* Historiken dyker upp forst nar ett project ar valt, och da direkt
          under formularet: den ar facit pa det man just har skrivit in — "log
          jag redan det har passet?" — och inte en egen avdelning pa sidan. */}
      {selectedProjectId && (
        <section className="mt-2">
          <SectionHeading>Senaste Pass</SectionHeading>
          <RecentShiftsList shifts={recentShifts} />
        </section>
      )}
    </Screen>
  );
}
