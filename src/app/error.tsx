"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonClass } from "@/components/Button";
import { Warning } from "@/components/Icons";
import { actionErrorMessage } from "@/lib/useNavigatingAction";

/**
 * Sista utposten: det som fangar ett fel ingen annan fangat.
 *
 * Utan den har filen har appen ingen error boundary alls, och det ar inte en
 * teoretisk lucka — det ar exakt vad man sag pa skarmen. React behandlar ett
 * kastat fel var som helst i tradet som ett renderingsfel; finns det ingen
 * boundary ovanfor rivs hela tradet ner och Next malar sin egen tomma sida
 * ("This page couldn't load", vit, med en Reload-knapp). For den som star vid
 * skarmen betyder den sidan ingenting: den sager inte vad som gick fel, inte
 * om nagot sparades, och den ser inte ens ut som appen.
 *
 * Har star meddelandet i klartext i stallet, pa appens egen svarta yta, med
 * `reset()` — som gor om renderingen utan att ladda om sidan — och en vag hem.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Meddelandet ar produktionsminifierat i konsolen, men digest:en gar att
  // matcha mot bygget. Loggas har eftersom boundaryn ar det enda stallet som
  // ser felet innan det ar borta.
  useEffect(() => {
    console.error("App error boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col justify-center gap-5">
      <div className="glass flex flex-col gap-3 rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <Warning className="h-5 w-5 shrink-0 text-night-danger" />
          <h1 className="text-lg font-extrabold tracking-tight">
            Något gick fel
          </h1>
        </div>

        <p className="text-[13px] leading-relaxed text-white/70">
          {actionErrorMessage(error)}
        </p>

        {error.digest && (
          <p className="text-[11px] text-white/35">Referens: {error.digest}</p>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        <Button type="button" onClick={reset} className="w-full">
          Försök igen
        </Button>
        <Link href="/" className={buttonClass("secondary", "lg", "w-full")}>
          Till Hem
        </Link>
      </div>
    </div>
  );
}
