import { BackButton } from "@/components/BackButton";
import { getWorkers } from "@/lib/queries";
import { LoggaProjectForm } from "./LoggaProjectForm";

export const dynamic = "force-dynamic";

export default async function LoggaProjectPage() {
  const workers = await getWorkers();

  return (
    <div className="flex flex-col gap-4">
      <BackButton />
      <h1 className="text-xl font-semibold">Logga Project</h1>
      <LoggaProjectForm workers={workers} />
    </div>
  );
}
