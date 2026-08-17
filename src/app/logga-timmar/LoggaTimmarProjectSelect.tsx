"use client";

import { useRouter } from "next/navigation";

const NEW_SENTINEL = "__new__";

export function LoggaTimmarProjectSelect({
  options,
  value,
}: {
  options: { value: string; label: string }[];
  value: string;
}) {
  const router = useRouter();

  return (
    <select
      name="project_id"
      required
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        if (next === NEW_SENTINEL) {
          router.push("/logga-project");
          return;
        }
        router.replace(next ? `/logga-timmar?project=${next}` : "/logga-timmar");
      }}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
    >
      <option value="" disabled>
        Valj project
      </option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      <option value={NEW_SENTINEL}>+ Nytt Project</option>
    </select>
  );
}
