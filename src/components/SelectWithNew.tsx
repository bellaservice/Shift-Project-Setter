"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Option = { value: string; label: string };

const NEW_SENTINEL = "__new__";

export function SelectWithNew({
  name,
  options,
  newLabel,
  newHref,
  defaultValue,
  required,
  placeholder,
}: {
  name: string;
  options: Option[];
  newLabel: string;
  newHref: string;
  defaultValue?: string;
  required?: boolean;
  placeholder: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue ?? "");

  return (
    <select
      name={name}
      required={required}
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        if (next === NEW_SENTINEL) {
          router.push(newHref);
          return;
        }
        setValue(next);
      }}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      <option value={NEW_SENTINEL}>+ {newLabel}</option>
    </select>
  );
}
