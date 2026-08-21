import { Button } from "@/components/Button";
import { FormError } from "@/components/FormError";
import { Restore } from "@/components/Icons";
import { formatPurgeNotice } from "@/lib/trash";

/**
 * Toppen av en detaljvy i Papperskorgen: knappen som hamtar upp raden igen,
 * och en rad med deadlinen.
 *
 * Aterstallningen ligger overst och formularet under, eftersom det ar det
 * vanliga arendet — man kommer hit for att fa tillbaka nagot, inte for att
 * redigera det. Ett eget <form>, inte en knapp inuti det stora: ett formular i
 * ett annat ar ogiltig HTML, och de tva gor dessutom olika saker.
 *
 * Aterstall ar sidans accentknapp och far darfor den fyllda gula plattan — det
 * ar det enda stallet i appen dar en huvudhandling INTE ligger langst ner, och
 * plattan ar det som sager att den ar en huvudhandling anda.
 *
 * Ingen ruta runt det hela: sidan sager redan att man ar i Papperskorgen, och
 * en stor varningsbox tryckte ner sjalva knappen under falsen.
 */
export function TrashNotice({
  id,
  deletedAt,
  restoreAction,
  restoreError,
  restoreLabel,
}: {
  id: string;
  /** Nar raden slangdes — starten pa dess tre veckor. */
  deletedAt: string;
  /** Server action som tar emot ett formular med faltet `id`. */
  restoreAction: (formData: FormData) => void | Promise<void>;
  /** Vad som gick fel i aterstallningen, om nagot gjorde det. */
  restoreError?: string | null;
  restoreLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <form action={restoreAction}>
        <input type="hidden" name="id" value={id} />
        <Button type="submit" className="w-full">
          <Restore className="h-4.5 w-4.5" />
          {restoreLabel}
        </Button>
      </form>

      <FormError message={restoreError ?? null} />

      {/* Fristen i accentfarg: den ar sidans enda tickande uppgift, och pa svart
          forsvinner en gra rad text under en gul knapp. */}
      <p className="text-center text-xs font-semibold text-night-accent">
        {formatPurgeNotice(deletedAt)}
      </p>
    </div>
  );
}
