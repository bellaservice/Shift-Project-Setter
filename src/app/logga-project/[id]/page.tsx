import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { RecentShiftsList } from "@/components/RecentShiftsList";
import { getProjectWithDetails, getRecentShiftsForProject, getWorkers } from "@/lib/queries";
import { LoggaProjectForm } from "../LoggaProjectForm";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, workers, recentShifts] = await Promise.all([
    getProjectWithDetails(id),
    getWorkers(),
    getRecentShiftsForProject(id),
  ]);

  if (!project) notFound();

  return (
    <div className="flex flex-col gap-4">
      <BackButton />
      <h1 className="text-xl font-semibold">Logga Project</h1>
      <LoggaProjectForm project={project} workers={workers} />

      <div>
        <h2 className="mb-2 text-sm font-medium text-slate-500">Senaste Pass</h2>
        <RecentShiftsList shifts={recentShifts} />
      </div>
    </div>
  );
}
