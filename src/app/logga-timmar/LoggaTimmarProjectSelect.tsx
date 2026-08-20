"use client";

import { useRouter } from "next/navigation";
import { Dropdown } from "@/components/Dropdown";

/**
 * Valt project ligger i adressen och inte i state: sidan hamtar "Senaste Pass"
 * for projectet pa servern, sa ett val maste ga vagen om URL:en.
 */
export function LoggaTimmarProjectSelect({
  options,
  value,
}: {
  options: { value: string; label: string }[];
  value: string;
}) {
  const router = useRouter();

  return (
    <Dropdown
      name="project_id"
      required
      value={value}
      onChange={(next) =>
        router.replace(next ? `/logga-timmar?project=${next}` : "/logga-timmar")
      }
      options={options}
      placeholder="Valj project"
      action={{ label: "Nytt Project", onSelect: () => router.push("/logga-project") }}
      emptyMessage="Inga project ännu."
    />
  );
}
