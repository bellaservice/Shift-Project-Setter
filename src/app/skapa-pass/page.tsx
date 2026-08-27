"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import { PanelSkeleton, Query } from "@/components/Query";
import { EmptyState, Screen } from "@/components/Screen";
import { parseIsoDate } from "@/lib/format";
import { getProjects, getWorkers } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@/lib/useQuery";
import { SkapaPassForm } from "./SkapaPassForm";

/**
 * Skapa Pass — arbetsledaren lagger ut pass i forvag (spec Fas 1, minimal).
 *
 * Skarmen som gor stamplingen anvandbar: utan den finns det ingenting for
 * arbetaren att stampla in pa, eftersom Logga Timmar bara skriver fardiga,
 * bekraftade rader.
 *
 * ⚠️ Minimal med flit. Ingen headcount, ingen automatisk tillsattning, inga
 * forval, ingen Priolista -- arbetsledaren pekar ut arbetarna sjalv. Se
 * avsnitt 8.6 i shift-system-spec.md for vad som medvetet inte ar med och
 * varfor det inte gick att bygga har.
 */
export default function SkapaPassPage() {
  return (
    <Screen
      tone="amber"
      eyebrow="Schemalaggning"
      title="Skapa Pass"
      back={{ href: "/", label: "Hem" }}
    >
      <Suspense fallback={<PanelSkeleton />}>
        <SkapaPassContent />
      </Suspense>
    </Screen>
  );
}

function SkapaPassContent() {
  const params = useSearchParams();
  const { roll, rollLoading } = useAuth();
  const selectedProjectId = params.get("project") ?? "";
  const defaultDate = parseIsoDate(params.get("datum")) ?? undefined;
  const skapat = params.get("skapat") === "1";

  const data = useQuery(async () => {
    const [projects, workers] = await Promise.all([getProjects(), getWorkers()]);
    return { projects, workers };
  }, []);

  // Samma hallning som /bekrafta: lanken ar borta ur arbetarens meny, men
  // adressen gar att skriva. Databasen avvisar en INSERT fran en arbetare
  // (shifts_insert_arbetsledare), sa det har ar artighet och inte sparren.
  if (!rollLoading && roll !== "arbetsledare") {
    return (
      <EmptyState
        title="Den har skarmen ar arbetsledarens."
        hint="Det ar arbetsledaren som lagger ut pass. Dina egna pass stamplar du in och ut pa under Stampla."
        action={
          <ButtonLink href="/stampla" size="md">
            Stampla
          </ButtonLink>
        }
      />
    );
  }

  return (
    <>
      {skapat && (
        /* Kvittot. Formularet star kvar ifyllt-tomt under det, sa nasta dag
           gar att lagga ut direkt -- schemalaggning gors sallan en gang. */
        <div className="mb-3.5 rounded-2xl border border-night-accent/35 bg-night-accent/10 px-4 py-3">
          <p className="text-sm font-semibold text-night-accent">
            Passen ar skapade.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-white/70">
            De ligger nu hos arbetarna under Stampla. Nar de stamplat ut dyker
            de upp i Bekrafta Pass.
          </p>
        </div>
      )}

      <Query state={data}>
        {({ projects, workers }) => (
          <SkapaPassForm
            projects={projects}
            workers={workers}
            selectedProjectId={selectedProjectId}
            defaultDate={defaultDate}
          />
        )}
      </Query>
    </>
  );
}
