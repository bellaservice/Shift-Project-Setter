"use client";

import { Button } from "@/components/Button";
import { Download } from "@/components/Icons";

/**
 * Hands the finished Arbetsdagbok to the browser's own print dialog, where
 * "Spara som PDF" is the first destination in the list.
 *
 * It used to fetch `/alla-project/[id]/arbetsdagbok/pdf`, where a route handler
 * started headless Chrome, rendered this very page, and sent the bytes back as
 * an attachment. A static export has no route handlers and no Chrome to start,
 * so that whole path is gone — but note what it was *doing*: printing this page
 * to PDF. The print stylesheet it relied on is still here, still on this page,
 * and still the thing that decides what the paper looks like. So the document
 * is produced by exactly the same rules as before; the only thing that changed
 * is which browser runs them. It was the server's; now it is the reader's.
 *
 * Two consequences worth stating plainly, because the button no longer hides
 * them: the user picks the destination themselves, and the filename comes from
 * the browser rather than from `slugify(projectName)`. Both are the price of
 * not running a server, and neither changes a pixel of the document.
 *
 * There is no busy state and nothing to await. `window.print()` blocks on the
 * dialog and the page is already rendered — the second or two of "Skapar PDF…"
 * was a browser booting on the server, and there is no browser to boot.
 */
export function DownloadPdfButton({
  disabled,
  onPrinted,
}: {
  disabled?: boolean;
  /**
   * Kors nar utskriftsdialogen stangts -- ALLTSA AVEN NAR DEN AVBROTS.
   *
   * Webblasaren berattar inte om en PDF faktiskt sparades; `afterprint` fyrar
   * likadant om man tryckte Spara som om man tryckte Avbryt. Den som lyssnar
   * har far darfor inte behandla det som "dokumentet ar skapat" utan bara som
   * "dialogen har varit uppe" -- se arbetsdagbokens ramkvittens, som fragar
   * anvandaren i stallet for att gissa.
   */
  onPrinted?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        onClick={() => {
          window.print();
          onPrinted?.();
        }}
        disabled={disabled}
        className="w-full"
      >
        <Download className="h-5 w-5" />
        Spara som PDF
      </Button>
    </div>
  );
}
