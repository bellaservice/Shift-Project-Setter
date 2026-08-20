"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import { ArbetareForm } from "@/components/ArbetareForm";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { PanelSkeleton, Query } from "@/components/Query";
import { EmptyState, Screen } from "@/components/Screen";
import { TrashNotice } from "@/components/TrashNotice";
import { getTrashedWorker } from "@/lib/queries";
import { useQuery } from "@/lib/useQuery";
import { useNavigatingAction } from "@/lib/useNavigatingAction";
import { purgeWorker, restoreWorker } from "../actions";

/**
 * En borttagen arbetare, med de uppgifter hen hade nar hen togs bort.
 *
 * Samma formular som Redigera Arbetare, av samma skal som den sidan ateranvander
 * det: raden ar oford, sa det finns inget att visa upp utom precis det den
 * innehaller. Sparar man en andring har satter saveWorker deleted_at till null
 * och arbetaren ar tillbaka.
 *
 * Lag pa /papperskorg/arbetare/[id]; id:t ar numera `?id=`, se noteringen i
 * /alla-arbetare/redigera.
 */
export default function PapperskorgArbetarePage() {
  return (
    <Suspense fallback={<Laddar />}>
      <PapperskorgArbetare />
    </Suspense>
  );
}

function Laddar() {
  return (
    <Screen
      tone="ember"
      eyebrow="I Papperskorgen"
      title="Arbetare"
      back={{ href: "/papperskorg", label: "Papperskorg" }}
    >
      <PanelSkeleton />
    </Screen>
  );
}

function PapperskorgArbetare() {
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";

  const worker = useQuery(async () => {
    if (!id) return null;
    const found = await getTrashedWorker(id);
    // Inte i papperskorgen: antingen aldrig borttagen, eller redan gallrad.
    // Bada ar "finns inte har".
    return found && found.deleted_at ? found : null;
  }, [id]);

  // restoreWorker svarar med vagen tillbaka till listan i stallet for att
  // navigera sjalv — se useNavigatingAction.
  const onRestore = useNavigatingAction(restoreWorker);

  async function onPurge(formData: FormData) {
    await purgeWorker(formData);
    router.push("/papperskorg");
  }

  return (
    <Screen
      // Samma ljus som listan man kom ifran: man har inte lamnat Papperskorgen
      // bara for att man oppnat en rad i den.
      tone="ember"
      eyebrow="I Papperskorgen"
      title={worker.data?.name ?? "Arbetare"}
      back={{ href: "/papperskorg", label: "Papperskorg" }}
      // Aterstallningen ligger over formularet, eftersom det ar det vanliga
      // arendet: man kommer hit for att fa tillbaka nagon, inte for att
      // redigera hen.
      lead={
        worker.data && (
          <TrashNotice
            id={worker.data.id}
            deletedAt={worker.data.deleted_at!}
            restoreAction={onRestore}
            restoreLabel="Återställ Arbetare"
          />
        )
      }
    >
      <Query state={worker}>
        {(data) =>
          data === null ? (
            <EmptyState
              title="Finns inte i Papperskorgen."
              hint="Raden kan redan ha gallrats, eller aldrig ha tagits bort."
              action={
                <ButtonLink href="/papperskorg" size="md">
                  Papperskorg
                </ButtonLink>
              }
            />
          ) : (
            <>
              <ArbetareForm worker={data} submitLabel="Spara & Återställ" />

              <div className="mt-4 border-t border-night-line pt-5">
                <ConfirmDeleteButton
                  action={onPurge}
                  id={data.id}
                  label="Radera Permanent Nu"
                  title={`Radera ${data.name} permanent?`}
                  description="Arbetaren raderas ur databasen direkt i stället för när fristen går ut, tillsammans med alla pass som loggats på hen och med profilbilden. Timmarna försvinner därmed också från projectens summor. Det går inte att ångra."
                  confirmLabel="Ja, radera permanent"
                />
              </div>
            </>
          )
        }
      </Query>
    </Screen>
  );
}
