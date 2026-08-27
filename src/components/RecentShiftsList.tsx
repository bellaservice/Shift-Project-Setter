import { GroupLabel } from "@/components/Screen";
import { formatDate } from "@/lib/formatDate";
import { formatPassTimmar } from "@/lib/format";
import type { RecentShiftRow } from "@/lib/types";

/**
 * De senast loggade passen pa ett project, grupperade per dag.
 *
 * Datumet stod tidigare bade som rubrik och en gang till pa varje rad. Med en
 * rubrik per dag ar raden fri att saga det den faktiskt tillfor: vem som
 * arbetade, och hur lange.
 */
export function RecentShiftsList({ shifts }: { shifts: RecentShiftRow[] }) {
  if (shifts.length === 0) {
    return <p className="px-1 text-sm text-white/55">Inga pass loggade än.</p>;
  }

  const groups = new Map<string, RecentShiftRow[]>();
  for (const s of shifts) {
    const list = groups.get(s.shift_date) ?? [];
    list.push(s);
    groups.set(s.shift_date, list);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...groups.entries()].map(([date, rows]) => (
        <div key={date}>
          <GroupLabel>{formatDate(date)}</GroupLabel>
          <div className="glass divide-y divide-night-line overflow-hidden rounded-2xl">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="min-w-0 truncate text-sm font-semibold text-white">
                  {r.workerName}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-night-accent">
                  {formatPassTimmar(r.hours)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
