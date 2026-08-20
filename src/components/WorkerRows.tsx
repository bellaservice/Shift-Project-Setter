"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Plus } from "@/components/Icons";
import { SelectWithNew } from "@/components/SelectWithNew";
import type { Worker } from "@/lib/types";

type Row = { key: number; workerId: string };

function nextKey(rows: Row[]): number {
  return rows.length > 0 ? Math.max(...rows.map((r) => r.key)) + 1 : 0;
}

/**
 * Arbetarna som passet loggas pa, en rad per person.
 *
 * `hoursLabel` ar timmarna som varje vald arbetare far -- alla pa passet far
 * samma siffra, och den star bredvid raden sa att den syns dar den landar i
 * stallet for bara i faltet langst upp. Null i Pass Tider-laget, dar timmarna
 * redan raknas ut och visas under spannet.
 */
export function WorkerRows({
  workers,
  hoursLabel,
}: {
  workers: Worker[];
  hoursLabel: string | null;
}) {
  const [rows, setRows] = useState<Row[]>([{ key: 0, workerId: "" }]);

  const options = workers.map((w) => ({ value: w.id, label: w.name }));

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SelectWithNew
              name="worker_id"
              options={options}
              newLabel="Ny Arbetare"
              newHref="/ny-arbetare"
              placeholder="Välj arbetare"
              emptyMessage="Inga arbetare ännu."
              required
              value={row.workerId}
              onChange={(workerId) =>
                setRows((r) =>
                  r.map((item) => (item.key === row.key ? { ...item, workerId } : item))
                )
              }
            />
          </div>
          {/* Timmarna som en accentbricka bredvid namnet: den ar ett kvitto pa
              vad raden kommer att spara, inte ett falt man fyller i, sa den bar
              accentfargen men inte den fyllda plattan. */}
          {hoursLabel !== null && row.workerId !== "" && (
            <span className="flex h-12 shrink-0 items-center rounded-xl border border-night-accent/30 bg-night-accent/10 px-3 text-sm font-bold tabular-nums text-night-accent">
              {hoursLabel} h
            </span>
          )}
        </div>
      ))}

      <Button
        type="button"
        variant="ghost"
        onClick={() => setRows((r) => [...r, { key: nextKey(r), workerId: "" }])}
      >
        <Plus className="h-3.5 w-3.5" />
        Lägg Till
      </Button>
    </div>
  );
}
