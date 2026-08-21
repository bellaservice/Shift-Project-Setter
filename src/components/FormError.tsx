"use client";

import { Warning } from "@/components/Icons";

/**
 * Det som gick fel nar man tryckte pa knappen, sagt pa skarmen.
 *
 * Den sitter direkt ovanfor knappen och ingen annanstans: det ar dar blicken
 * ar i det ogonblick sparandet misslyckas, och en rad langst upp pa en sida
 * man har scrollat ner i ar en rad ingen ser.
 *
 * `role="alert"` gor att en skarmlasare sager den utan att man behover leta.
 * Rendera inget alls nar det inte finns nagot fel — en tom rod ruta som star
 * och vantar pa ett fel far formularet att se trasigt ut innan det ar det.
 */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-night-danger/40 bg-night-danger/10 px-3.5 py-3"
    >
      <Warning className="mt-0.5 h-4 w-4 shrink-0 text-night-danger" />
      <p className="text-[13px] leading-relaxed text-night-danger">{message}</p>
    </div>
  );
}
