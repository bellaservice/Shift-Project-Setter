"use client";

import { useState } from "react";
import { SelectWithNew } from "@/components/SelectWithNew";
import type { Worker } from "@/lib/types";

function nextKey(rows: number[]): number {
  return rows.length > 0 ? Math.max(...rows) + 1 : 0;
}

export function WorkerRows({ workers }: { workers: Worker[] }) {
  const [rows, setRows] = useState<number[]>([0]);

  const options = workers.map((w) => ({ value: w.id, label: w.name }));

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">Arbetare</span>
      {rows.map((key) => (
        <SelectWithNew
          key={key}
          name="worker_id"
          options={options}
          newLabel="Ny Arbetare"
          newHref="/ny-arbetare"
          placeholder="Valj arbetare"
          required
        />
      ))}
      <button
        type="button"
        onClick={() => setRows((r) => [...r, nextKey(r)])}
        className="text-sm font-medium text-blue-600 hover:text-blue-700"
      >
        + Lagg Till
      </button>
    </div>
  );
}
