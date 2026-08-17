"use client";

import { DateSelect } from "@/components/DateSelect";
import { Field } from "@/components/Field";
import { WorkerRows } from "@/components/WorkerRows";
import type { Project, Worker } from "@/lib/types";
import { logShifts } from "./actions";
import { LoggaTimmarProjectSelect } from "./LoggaTimmarProjectSelect";

export function LoggaTimmarForm({
  projects,
  workers,
  selectedProjectId,
}: {
  projects: Project[];
  workers: Worker[];
  selectedProjectId: string;
}) {
  return (
    <form action={logShifts} className="flex flex-col gap-4">
      <Field label="Pass Timmar" name="hours" type="number" required placeholder="t.ex. 8" />

      <DateSelect />

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Project</span>
        <LoggaTimmarProjectSelect
          value={selectedProjectId}
          options={projects.map((p) => ({ value: p.id, label: p.address }))}
        />
      </div>

      <WorkerRows workers={workers} />

      <button
        type="submit"
        className="mt-2 w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white"
      >
        Logga Timmar
      </button>
    </form>
  );
}
