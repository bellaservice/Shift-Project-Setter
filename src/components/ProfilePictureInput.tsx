"use client";

import { useState } from "react";

export function ProfilePictureInput() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center gap-2">
      <label
        htmlFor="profile_picture"
        className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-slate-300 bg-slate-100 text-xs text-slate-400"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Profilbild forhandsvisning"
            className="h-full w-full object-cover"
          />
        ) : (
          "Foto"
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
          setPreviewUrl(file ? URL.createObjectURL(file) : null);
        }}
      />
    </div>
  );
}
