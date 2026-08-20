"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/Button";
import { Trash, Warning } from "@/components/Icons";

/**
 * Radering i tva steg: knappen oppnar en panel som sager exakt vad som
 * forsvinner, och forst knappen i panelen skickar formularet.
 *
 * Anvands bade for "Ta Bort", som flyttar raden till Papperskorgen, och for
 * "Radera Permanent Nu" darinne, som ar den oaterkalleliga varianten. Vilken av
 * dem det ar star i `description` — komponenten pastar ingenting sjalv om vad
 * som hander, just for att de tva inte betyder samma sak.
 *
 * Knappen pa sidan ar rod text pa glas, inte en rod platta. En rod platta ar
 * lika tung som accentknappen langst ner i formularet, och da har sidan tva
 * huvudhandlingar — varav den ena raderar. Plattan sparas till knappen inne i
 * panelen, dar radering faktiskt ar det man kommit for att gora.
 */
export function ConfirmDeleteButton({
  action,
  id,
  label,
  title,
  description,
  confirmLabel,
  pendingLabel = "Raderar…",
}: {
  /** Server action som tar emot ett formular med faltet `id`. */
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  /** Texten pa knappen som star pa sidan. */
  label: string;
  /** Rubriken i bekraftelsepanelen. */
  title: string;
  /** Vad som gar forlorat, i klartext. */
  description: string;
  /** Texten pa den knapp som faktiskt utfor handlingen. */
  confirmLabel: string;
  /** Vad knappen sager medan den arbetar. "Tar bort…" nar raden gar till
   *  Papperskorgen, "Raderar…" nar den faktiskt forsvinner. */
  pendingLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <Button
        type="button"
        variant="danger"
        onClick={() => setOpen(true)}
        className="w-full"
      >
        <Trash className="h-4 w-4" />
        {label}
      </Button>

      {open && (
        /* Klick pa det dimmade lagret stanger. Panelen stoppar sin egen klick,
           annars skulle varje tryck inuti den raknas som ett tryck utanfor.
           Samma svarta dimmer som menyerna hogst upp anvander: allt som lagger
           sig over sidan i den har appen gor det pa samma satt. */
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 pb-6 backdrop-blur-sm sm:items-center"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="glass-overlay w-full max-w-sm rounded-3xl p-5"
          >
            {/* Ikonen i en rod skiva overst: panelen ska ga att kanna igen som
                en varning innan rubriken ar last, och rott ensamt racker inte
                for den som inte skiljer rott fran gratt. */}
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-night-danger/15 text-night-danger">
              <Warning className="h-5 w-5" />
            </div>

            <h2 className="text-lg font-extrabold leading-tight tracking-tight text-white">
              {title}
            </h2>
            <p className="mb-5 mt-2 text-xs leading-relaxed text-white/70">
              {description}
            </p>

            <form action={action} className="flex flex-col gap-2">
              <input type="hidden" name="id" value={id} />
              <ConfirmSubmit label={confirmLabel} pendingLabel={pendingLabel} />
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
                className="w-full"
              >
                Avbryt
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/** Egen komponent: useFormStatus laser statusen fran formularet ovanfor sig, sa
 *  den maste sitta inuti det. Halls den avstangd medan raderingen pagar kan tva
 *  snabba tryck inte bli tva anrop. */
function ConfirmSubmit({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="dangerSolid"
      disabled={pending}
      className="w-full"
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}
