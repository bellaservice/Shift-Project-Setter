import { BackButton } from "@/components/BackButton";
import { RecentShiftsList } from "@/components/RecentShiftsList";
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
    <div className="flex flex-col gap-4">
      <BackButton />
      <h1 className="text-xl font-semibold">Logga Timmar</h1>
      <LoggaTimmarForm
        projects={projects}
        workers={workers}
        selectedProjectId={selectedProjectId ?? ""}
      />

      {selectedProjectId && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-slate-500">Senaste Pass</h2>
          <RecentShiftsList shifts={recentShifts} />
        </div>
      )}
    </div>
  );
}
