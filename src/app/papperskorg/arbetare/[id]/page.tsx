import { notFound } from "next/navigation";
import { ArbetareForm } from "@/components/ArbetareForm";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { Screen } from "@/components/Screen";
import { TrashNotice } from "@/components/TrashNotice";
import { getTrashedWorker } from "@/lib/queries";
import { purgeWorker, restoreWorker } from "../../actions";

export const dynamic = "force-dynamic";

/**
 * En borttagen arbetare, med de uppgifter hen hade nar hen togs bort.
 *
 * Samma formular som Redigera Arbetare, av samma skal som den sidan ateranvander
 * det: raden ar oford, sa det finns inget att visa upp utom precis det den
 * innehaller. Sparar man en andring har satter saveWorker deleted_at till null
 * och arbetaren ar tillbaka.
 */
export default async function PapperskorgArbetarePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const worker = await getTrashedWorker(id);

  // Inte i papperskorgen: antingen aldrig borttagen, eller redan gallrad. Bada
  // ar "finns inte har".
  if (!worker || !worker.deleted_at) notFound();

  return (
    <Screen
      // Samma ljus som listan man kom ifran: man har inte lamnat Papperskorgen
      // bara for att man oppnat en rad i den.
      tone="ember"
      eyebrow="I Papperskorgen"
      title={worker.name}
      back={{ href: "/papperskorg", label: "Papperskorg" }}
      // Aterstallningen ligger over formularet, eftersom det ar det vanliga
      // arendet: man kommer hit for att fa tillbaka nagon, inte for att
      // redigera hen.
      lead={
        <TrashNotice
          id={worker.id}
          deletedAt={worker.deleted_at}
          restoreAction={restoreWorker}
          restoreLabel="Återställ Arbetare"
        />
      }
    >
      <ArbetareForm worker={worker} submitLabel="Spara & Återställ" />

      <div className="mt-4 border-t border-night-line pt-5">
        <ConfirmDeleteButton
          action={purgeWorker}
          id={worker.id}
          label="Radera Permanent Nu"
          title={`Radera ${worker.name} permanent?`}
          description="Arbetaren raderas ur databasen direkt i stallet for nar fristen gar ut, tillsammans med alla pass som loggats pa hen och med profilbilden. Timmarna forsvinner darmed ocksa fran projectens summor. Det gar inte att angra."
          confirmLabel="Ja, radera permanent"
        />
      </div>
    </Screen>
  );
}
