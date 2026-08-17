"use client";

import Link from "next/link";
import { Field } from "@/components/Field";
import { ServiceRows } from "@/components/ServiceRows";
import type { ProjectWithDetails, Worker } from "@/lib/types";
import { saveProject } from "./actions";

export function LoggaProjectForm({
  project,
  workers,
}: {
  project?: ProjectWithDetails;
  workers: Worker[];
}) {
  const assignedIds = new Set(project?.workerIds ?? []);

  return (
    <form action={saveProject} className="flex flex-col gap-4">
      {project && <input type="hidden" name="id" value={project.id} />}

      <Field label="Adress" name="address" required defaultValue={project?.address} />
      <Field label="Namn" name="client_name" defaultValue={project?.client_name ?? ""} />
      <Field
        label="Telefon Nummer"
        name="client_phone"
        type="tel"
        defaultValue={project?.client_phone ?? ""}
      />

      <ServiceRows initial={project?.services} />

      <Field
        label="Beskrivning"
        name="description"
        textarea
        defaultValue={project?.description ?? ""}
      />

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="block text-sm font-medium text-slate-700">Arbetare</span>
          <Link
            href="/ny-arbetare"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            + Lagg Till
          </Link>
        </div>
        {workers.length === 0 ? (
          <p className="text-sm text-slate-500">Inga arbetare registrerade an.</p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {workers.map((w) => (
              <label
                key={w.id}
                className="flex items-center gap-2 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="worker_id"
                  value={w.id}
                  defaultChecked={assignedIds.has(w.id)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                {w.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <button
        type="submit"
        className="mt-2 w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white"
      >
        Logga Project
      </button>
    </form>
  );
}
