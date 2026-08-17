import type { RecentShiftRow } from "@/lib/types";
import { formatDate } from "@/lib/formatDate";

export function RecentShiftsList({ shifts }: { shifts: RecentShiftRow[] }) {
  if (shifts.length === 0) {
    return <p className="text-sm text-slate-500">Inga pass loggade an.</p>;
  }

  const groups = new Map<string, RecentShiftRow[]>();
  for (const s of shifts) {
    const list = groups.get(s.shift_date) ?? [];
    list.push(s);
    groups.set(s.shift_date, list);
  }

  return (
    <div className="space-y-3">
      {[...groups.entries()].map(([date, rows]) => (
        <div key={date}>
          <div className="text-xs font-medium text-slate-500">{formatDate(date)}</div>
          <div className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <span>{r.workerName}</span>
                <span className="text-slate-500">{formatDate(r.shift_date)}</span>
                <span className="font-medium">{r.hours} tim</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
