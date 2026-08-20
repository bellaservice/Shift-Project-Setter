"use client";

import { useState } from "react";

export function ProfilePictureInput({
  /** Redan sparad profilbild. Visas som utgangslage nar en arbetare redigeras,
   *  sa rutan aldrig ser tom ut for nagon som faktiskt har ett foto. */
  currentUrl,
  /**
   * Den valda filen, at den som inte skickar in ett formular.
   *
   * Arbetarformularet postar rutan som `profile_picture` i sin FormData och
   * behover ingenting harifran. Kontoformularet har ingen server att posta till
   * an (se lib/konton.ts) och maste skala ner bilden sjalv, sa den far filen
   * direkt. `null` betyder att valet avbrots.
   */
  onPick,
}: {
  currentUrl?: string | null;
  onPick?: (file: File | null) => void;
} = {}) {
  const saved = currentUrl ?? null;
  const [previewUrl, setPreviewUrl] = useState<string | null>(saved);

  return (
    <div className="flex flex-col items-center gap-2.5 py-1">
      <label
        htmlFor="profile_picture"
        /* 96px och inte 80: det ar det enda stallet i formularet dar man ser
           personen i stallet for att lasa om hen, och den tomma rutan ar
           dessutom sin egen knapp — 80px lag precis pa granslinjen for en
           trafftyta, 96 gor den till en sjalvklar sadan.

           Ringen ar accentfargad forst nar det finns en bild att rama in. En
           tom ruta far den streckade kanten i stallet: den sager "har saknas
           nagot", vilket en heldragen ram inte gor. */
        className={`relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full transition-colors duration-200 ease-out motion-reduce:transition-none ${
          previewUrl
            ? "ring-2 ring-night-accent/60"
            : "glass-field border-dashed active:bg-white/10"
        }`}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Profilbild förhandsvisning"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex flex-col items-center gap-1 text-white/50">
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            <span className="text-[10px] font-semibold">Foto</span>
          </span>
        )}
      </label>

      <input
        id="profile_picture"
        name="profile_picture"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Avbryter man filvaljaren ar det den sparade bilden som ska tillbaka,
          // inte en tom ruta: tomt falt betyder "behall den du har".
          setPreviewUrl(file ? URL.createObjectURL(file) : saved);
          onPick?.(file ?? null);
        }}
      />

      <span className="text-[11px] font-medium text-white/55">
        {saved ? "Tryck för att byta bild" : "Tryck för att välja bild"}
      </span>
    </div>
  );
}
