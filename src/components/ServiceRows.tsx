"use client";

import { useState } from "react";

type ServiceRow = { key: number; service_name: string; price: string };

function nextKey(rows: { key: number }[]): number {
  return rows.length > 0 ? Math.max(...rows.map((r) => r.key)) + 1 : 0;
}

export function ServiceRows({
  initial,
}: {
  initial?: { service_name: string; price: number | null }[];
}) {
  const [rows, setRows] = useState<ServiceRow[]>(() => {
    const base = initial && initial.length > 0 ? initial : [{ service_name: "", price: null }];
    return base.map((s, i) => ({
      key: i,
      service_name: s.service_name,
      price: s.price != null ? String(s.price) : "",
    }));
  });

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-slate-700">Tjanster / Pris</span>
      {rows.map((row) => (
        <div key={row.key} className="flex gap-2">
          <input
            name="service_name"
            defaultValue={row.service_name}
            placeholder="Tjanst"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="price"
            type="number"
            step="0.01"
            defaultValue={row.price}
            placeholder="Pris"
            className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))}
              aria-label="Ta bort rad"
              className="px-2 text-sm text-slate-400 hover:text-red-500"
            >
              &times;
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setRows((r) => [...r, { key: nextKey(r), service_name: "", price: "" }])
        }
        className="text-sm font-medium text-blue-600 hover:text-blue-700"
      >
        + Lagg Till
      </button>
    </div>
  );
}
