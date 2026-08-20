"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { deleteWorker } from "@/app/ny-arbetare/actions";
import { ArbetareForm } from "@/components/ArbetareForm";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { PanelSkeleton, Query } from "@/components/Query";
import { EmptyState, Screen } from "@/components/Screen";
import { ButtonLink } from "@/components/Button";
import { getWorker } from "@/lib/queries";
import { TRASH_RETENTION_DAYS } from "@/lib/trash";
import { useQuery } from "@/lib/useQuery";

/**
 * Redigera Arbetare.
 *
 * Lag pa /alla-arbetare/[id] sa lange appen hade en server. Ett statiskt bygge
 * kan inte ha den vagen: Next maste kunna skriva ut varje sida till en fil vid
 * bygget, och for ett dynamiskt segment betyder det att alla id:n maste vara
 * kanda da — via generateStaticParams. Arbetarna finns i en databas som andras
 * efter bygget, sa listan gar inte att skriva. Id:t flyttade darfor till
 * `?id=`, som ar en egenskap hos besoket och inte hos filen, och sidan ar
 * darmed EN fil som fungerar for alla arbetare.
 */
export default function RedigeraArbetarePage() {
  return (
    <Suspense fallback={<Laddar />}>
      <RedigeraArbetare />
    </Suspense>
  );
}

function Laddar() {
  return (
    <Screen
      tone="amber"
      eyebrow="Redigera Arbetare"
      title="Arbetare"
      back={{ href: "/alla-arbetare", label: "Alla Arbetare" }}
    >
      <PanelSkeleton />
    </Screen>
  );
}

function RedigeraArbetare() {
  const router = useRouter();
  const id = useSearchParams().get("id") ?? "";
  const worker = useQuery(
    () => (id ? getWorker(id) : Promise.resolve(null)),
    [id]
  );

  // Borttagningen navigerar sjalv. Pa servern avslutades `deleteWorker` med
  // redirect(); i en formularhandlare gar det inte -- redirect() far bara koras
  // under rendering -- sa vagen tillbaka till rostern ligger har istallet.
  async function onDelete(formData: FormData) {
    await deleteWorker(formData);
    router.push("/alla-arbetare");
  }

  return (
    <Screen
      tone="amber"
      eyebrow="Redigera Arbetare"
      // Namnet som rubrik, inte "Redigera Arbetare": man kom hit fran en lista
      // med tjugo rader och behover forst se vilken av dem man oppnade. Vad
      // sidan gor star i ogonbrynet ovanfor.
      title={worker.data?.name ?? "Arbetare"}
      back={{ href: "/alla-arbetare", label: "Alla Arbetare" }}
    >
      <Query state={worker}>
        {(data) =>
          data === null ? (
            <EmptyState
              title="Arbetaren finns inte."
              hint="Hen kan ha tagits bort. Kolla i Papperskorgen om hen ska tillbaka."
              action={
                <ButtonLink href="/alla-arbetare" size="md">
                  Alla Arbetare
                </ButtonLink>
              }
            />
          ) : (
            <>
              {/* Samma formular som nar arbetaren lades till — bara knappen langst
                  ner byter ord, eftersom det har ar en redigering och inte en ny
                  arbetare. */}
              <ArbetareForm worker={data} submitLabel="Spara Detaljer" />

              {/* Utanfor formularet ovan: ett formular inuti ett annat ar ogiltig
                  HTML, och borttagningen ar dessutom sin egen handling. */}
              <div className="mt-4 border-t border-night-line pt-5">
                <ConfirmDeleteButton
                  action={onDelete}
                  id={data.id}
                  label="Ta Bort Arbetare"
                  title={`Ta bort ${data.name}?`}
                  description={`Arbetaren flyttas till Papperskorgen med alla sina uppgifter, och passen som loggats på hen försvinner samtidigt ur projectens summor. Du har ${TRASH_RETENTION_DAYS} dagar på dig att hämta tillbaka hen därifrån — därefter raderas allt permanent.`}
                  confirmLabel="Ja, ta bort arbetaren"
                  pendingLabel="Tar bort…"
                />
              </div>
            </>
          )
        }
      </Query>
    </Screen>
  );
}
