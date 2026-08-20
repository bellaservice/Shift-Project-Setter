"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Download, Warning } from "@/components/Icons";

/**
 * Downloads the finished PDF the way any file on the web downloads — no print
 * dialog, no printer picker. The server renders it with headless Chrome and
 * sends it back as an attachment.
 *
 * Fetched rather than linked so the button can say it is working: generating
 * takes a second or two while a browser starts, and a plain <a> would sit there
 * looking dead. It also lets a failure (no Chrome on the machine) surface as a
 * readable line instead of a blank error page.
 */
export function DownloadPdfButton({
  projectId,
  disabled,
}: {
  projectId: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/alla-project/${projectId}/arbetsdagbok/pdf`
      );
      if (!response.ok) {
        setError(await response.text());
        return;
      }

      // The filename the server chose lives in Content-Disposition; reuse it so
      // the saved file is not called after the route.
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const blob = await response.blob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = match?.[1] ?? "Arbetsdagbok.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoking immediately can cancel the download in some browsers; one turn
      // of the event loop is enough for it to have started.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Kunde inte hämta PDF:en. Är servern igång?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        onClick={download}
        disabled={busy || disabled}
        className="w-full"
      >
        {/* Ikonen byts mot en snurra medan Chrome startar: knappen ar
            avstangd i flera sekunder, och en avstangd knapp utan rorelse i
            ser trasig ut snarare an upptagen. */}
        {busy ? (
          <span
            aria-hidden
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-black/25 border-t-black motion-reduce:animate-none"
          />
        ) : (
          <Download className="h-5 w-5" />
        )}
        {busy ? "Skapar PDF…" : "Ladda ner Arbetsdagbok"}
      </Button>

      {/* `role="alert"`: felet dyker upp efter ett tryck, och den som inte ser
          skarmen far annars ingenting alls tillbaka. */}
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-night-danger/40 bg-night-danger/10 p-3.5 text-xs leading-relaxed text-night-danger"
        >
          <Warning className="mt-px h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
