"use client";

import { useRouter } from "next/navigation";
import { Dropdown, type DropdownItem } from "@/components/Dropdown";

/**
 * En dropdown ur en lista som anvandaren sjalv fyller pa: sista raden i panelen
 * leder till sidan dar man lagger till ett nytt alternativ.
 *
 * Vardet bars av den som anvander faltet, inte av faltet sjalvt -- en rad kan
 * behova visa nagot bredvid sitt val, och da maste valet synas utanfor.
 */
export function SelectWithNew({
  name,
  options,
  newLabel,
  newHref,
  value,
  onChange,
  required,
  placeholder,
  emptyMessage,
}: {
  name: string;
  options: DropdownItem[];
  newLabel: string;
  newHref: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder: string;
  emptyMessage?: string;
}) {
  const router = useRouter();

  return (
    <Dropdown
      name={name}
      required={required}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      emptyMessage={emptyMessage}
      action={{ label: newLabel, onSelect: () => router.push(newHref) }}
    />
  );
}
