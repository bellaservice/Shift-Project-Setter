import { Screen } from "@/components/Screen";
import { getWorkers } from "@/lib/queries";
import { firstParam } from "@/lib/searchParams";
import { LoggaProjectForm } from "./LoggaProjectForm";

export const dynamic = "force-dynamic";

export default async function LoggaProjectPage({
  searchParams,
}: {
  /** `?ny=<id>`: arbetaren som just skapades via "+ Lägg Till" i formuläret. */
  searchParams: Promise<{ ny?: string | string[] }>;
}) {
  const [workers, params] = await Promise.all([getWorkers(), searchParams]);

  return (
    <Screen
      tone="amber"
      eyebrow="Project"
      title="Logga Project"
      back={{ href: "/", label: "Hem" }}
    >
      <LoggaProjectForm workers={workers} newWorkerId={firstParam(params.ny)} />
    </Screen>
  );
}
