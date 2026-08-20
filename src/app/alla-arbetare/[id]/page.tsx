import { notFound } from "next/navigation";
import { deleteWorker } from "@/app/ny-arbetare/actions";
import { ArbetareForm } from "@/components/ArbetareForm";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { Screen } from "@/components/Screen";
import { getWorker } from "@/lib/queries";
import { TRASH_RETENTION_DAYS } from "@/lib/trash";

export const dynamic = "force-dynamic";

export default async function RedigeraArbetarePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const worker = await getWorker(id);

  if (!worker) notFound();

  return (
    <Screen
      tone="amber"
      eyebrow="Redigera Arbetare"
      // Namnet som rubrik, inte "Redigera Arbetare": man kom hit fran en lista
      // med tjugo rader och behover forst se vilken av dem man oppnade. Vad
      // sidan gor star i ogonbrynet ovanfor.
      title={worker.name}
      back={{ href: "/alla-arbetare", label: "Alla Arbetare" }}
    >
      {/* Samma formular som nar arbetaren lades till — bara knappen langst ner
          byter ord, eftersom det har ar en redigering och inte en ny arbetare. */}
      <ArbetareForm worker={worker} submitLabel="Spara Detaljer" />

      {/* Utanfor formularet ovan: ett formular inuti ett annat ar ogiltig HTML,
          och borttagningen ar dessutom sin egen handling. */}
      <div className="mt-4 border-t border-night-line pt-5">
        <ConfirmDeleteButton
          action={deleteWorker}
          id={worker.id}
          label="Ta Bort Arbetare"
          title={`Ta bort ${worker.name}?`}
          description={`Arbetaren flyttas till Papperskorgen med alla sina uppgifter, och passen som loggats pa hen forsvinner samtidigt ur projectens summor. Du har ${TRASH_RETENTION_DAYS} dagar pa dig att hamta tillbaka hen darifran — darefter raderas allt permanent.`}
          confirmLabel="Ja, ta bort arbetaren"
          pendingLabel="Tar bort…"
        />
      </div>
    </Screen>
  );
}
