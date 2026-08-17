import Link from "next/link";
import { StatCard } from "@/components/StatCard";
import { getHomeStats, getOngoingProjects } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [stats, ongoingProjects] = await Promise.all([
    getHomeStats(),
    getOngoingProjects(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Shift Setting System</h1>
        <Link
          href="/ny-arbetare"
          aria-label="Lagg Till Arbetare"
          title="Lagg Till Arbetare"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-lg text-white"
        >
          +
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Loggade Timmar" value={stats.totalHoursLogged} />
        <StatCard label="Aktiva Project" value={stats.activeProjectCount} />
        <StatCard label="Totalt Arbetare" value={stats.totalWorkerCount} />
      </div>

      <div className="flex gap-3">
        <Link
          href="/logga-project"
          className="flex-1 rounded-lg bg-slate-900 px-4 py-3 text-center text-sm font-medium text-white"
        >
          + Logga Project
        </Link>
        <Link
          href="/logga-timmar"
          className="flex-1 rounded-lg bg-slate-900 px-4 py-3 text-center text-sm font-medium text-white"
        >
          + Logga Timmar
        </Link>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-slate-500">
          Pagaende Project
        </h2>
        {ongoingProjects.length === 0 ? (
          <p className="text-sm text-slate-500">Inga pagaende project an.</p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {ongoingProjects.map((p) => (
              <Link
                key={p.id}
                href={`/logga-project/${p.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.address}</div>
                  <div className="truncate text-xs text-slate-500">
                    {p.serviceNames.length > 0
                      ? p.serviceNames.join(", ")
                      : "Inga tjanster"}
                  </div>
                </div>
                <div className="shrink-0 font-medium">{p.totalHours} tim</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
