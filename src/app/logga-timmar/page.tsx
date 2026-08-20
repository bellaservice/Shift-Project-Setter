"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PanelSkeleton, Query } from "@/components/Query";
import { RecentShiftsList } from "@/components/RecentShiftsList";
import { Screen, SectionHeading } from "@/components/Screen";
import { getProjects, getRecentShiftsForProject, getWorkers } from "@/lib/queries";
import { useQuery } from "@/lib/useQuery";
import { LoggaTimmarForm } from "./LoggaTimmarForm";

/**
 * Logga Timmar.
 *
 * `?project=` valjer vilket project passet hor till, och den parametern kommer
 * fran adressfaltet snarare an fran filen — darav <Suspense>-gransen. Se
 * noteringen i /logga-project/page.tsx; ramen ar statisk, innehallet vantar.
 */
export default function LoggaTimmarPage() {
  return (
    <Screen
      tone="amber"
      eyebrow="Tidrapport"
      title="Logga Timmar"
      back={{ href: "/", label: "Hem" }}
    >
      <Suspense fallback={<PanelSkeleton />}>
        <TimmarContent />
      </Suspense>
    </Screen>
  );
}

function TimmarContent() {
  const selectedProjectId = useSearchParams().get("project") ?? "";

  // Ett anrop, inte tre hooks. Historiken beror pa vilket project som ar valt,
  // sa den maste las om nar valet andras — och `selectedProjectId` i beroende-
  // listan ar precis det. Projecten och arbetarna las om pa kopet, vilket ar
  // billigare an att halla tva laddningstillstand isar pa samma skarm.
  const data = useQuery(async () => {
    const [projects, workers, recentShifts] = await Promise.all([
      getProjects(),
      getWorkers(),
      selectedProjectId
        ? getRecentShiftsForProject(selectedProjectId)
        : Promise.resolve([]),
    ]);
    return { projects, workers, recentShifts };
  }, [selectedProjectId]);

  return (
    <Query state={data}>
      {({ projects, workers, recentShifts }) => (
        <>
          <LoggaTimmarForm
            projects={projects}
            workers={workers}
            selectedProjectId={selectedProjectId}
          />

          {/* Historiken dyker upp forst nar ett project ar valt, och da direkt
              under formularet: den ar facit pa det man just har skrivit in — "log
              jag redan det har passet?" — och inte en egen avdelning pa sidan. */}
          {selectedProjectId && (
            <section className="mt-2">
              <SectionHeading>Senaste Pass</SectionHeading>
              <RecentShiftsList shifts={recentShifts} />
            </section>
          )}
        </>
      )}
    </Query>
  );
}
