"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import { ManadsVal } from "@/components/ManadsVal";
import { PanelSkeleton, Query } from "@/components/Query";
import { EmptyState, Screen } from "@/components/Screen";
import { getProjects, getWorkers } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@/lib/useQuery";
import { SkapaPassForm } from "./SkapaPassForm";

/**
 * Skapa Pass — arbetsledaren lagger ut pass i forvag (spec Fas 1, minimal).
 *
 * Tva steg bakom en adress:
 *
 *   1. KALENDERN. Manaden i helskarm. Man malar med fingret over dagarna man
 *      behover folk pa, och drar over en vald dag igen for att angra den.
 *      Bockknappen uppe till hoger gar vidare — den ar slack tills minst en dag
 *      ar vald, sa steg tva aldrig kan oppnas utan nagot att fylla i.
 *   2. DETALJERNA. Project, tider och arbetare, en gang, for alla valda dagar.
 *
 * ⚠️ Minimal med flit. Det finns ingen headcount ("antal personer som behovs"),
 * ingen prioriterad lista och ingen automatisk tillsattning — arbetsledaren
 * pekar ut arbetarna sjalv. De tva forsta kraver kolumner som inte finns i
 * databasen an. Se avsnitt 8.6 i shift-system-spec.md.
 */
export default function SkapaPassPage() {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <SkapaPassContent />
    </Suspense>
  );
}

function SkapaPassContent() {
  const params = useSearchParams();
  const { roll, rollLoading } = useAuth();
  const skapat = Number(params.get("skapat") ?? "0");

  const [valda, setValda] = useState<Set<string>>(new Set());
  const [steg, setSteg] = useState<"kalender" | "detaljer">("kalender");

  const data = useQuery(async () => {
    const [projects, workers] = await Promise.all([getProjects(), getWorkers()]);
    return { projects, workers };
  }, []);

  // Samma hallning som /bekrafta: lanken ar borta ur arbetarens meny, men
  // adressen gar att skriva. Databasen avvisar en INSERT fran en arbetare
  // (shifts_insert_arbetsledare), sa det har ar artighet och inte sparren.
  if (!rollLoading && roll !== "arbetsledare") {
    return (
      <Screen tone="amber" eyebrow="Schemalaggning" title="Skapa Pass" back={{ href: "/", label: "Hem" }}>
        <EmptyState
          title="Den har skarmen ar arbetsledarens."
          hint="Det ar arbetsledaren som lagger ut pass. Dina egna pass stamplar du in och ut pa under Stampla."
          action={
            <ButtonLink href="/stampla" size="md">
              Stampla
            </ButtonLink>
          }
        />
      </Screen>
    );
  }

  const dagar = [...valda].sort();

  // ---- Steg 1: kalendern ----
  if (steg === "kalender") {
    return (
      <Screen
        tone="amber"
        eyebrow="Schemalaggning"
        title="Valj Dagar"
        back={{ href: "/", label: "Hem" }}
        /* Bockknappen som `lead`: den hor till skarmen och inte till rutnatet,
           och ska sta stilla overst medan man malar sig genom manaderna. */
        lead={
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-white/70">
              {dagar.length === 0
                ? "Dra over dagarna du behover folk pa."
                : `${dagar.length} ${dagar.length === 1 ? "dag" : "dagar"} valda`}
            </p>
            <button
              type="button"
              disabled={dagar.length === 0}
              onClick={() => setSteg("detaljer")}
              aria-label="Vidare till passets detaljer"
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl font-bold transition-colors duration-200 ease-out motion-reduce:transition-none ${
                dagar.length === 0
                  ? "bg-white/10 text-white/30"
                  : "bg-night-accent text-black shadow-[0_0_24px_rgba(255,185,46,0.45)] active:bg-[#e5a41f]"
              }`}
            >
              ✓
            </button>
          </div>
        }
      >
        {skapat > 0 && (
          <div className="rounded-2xl border border-night-accent/35 bg-night-accent/10 px-4 py-3">
            <p className="text-sm font-semibold text-night-accent">
              {skapat === 1 ? "Passet ar skapat." : `${skapat} pass ar skapade.`}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/70">
              De ligger nu hos arbetarna under Stampla. Nar de stamplat ut dyker
              de upp i Bekrafta Pass.
            </p>
          </div>
        )}

        <div className="glass rounded-2xl p-3">
          <ManadsVal valda={valda} onValda={setValda} />
        </div>
      </Screen>
    );
  }

  // ---- Steg 2: detaljerna ----
  return (
    <Screen
      tone="amber"
      eyebrow="Schemalaggning"
      title="Passets Detaljer"
      back={{ href: "/", label: "Hem" }}
    >
      <Query state={data}>
        {({ projects, workers }) => (
          <SkapaPassForm
            projects={projects}
            workers={workers}
            dagar={dagar}
            onTillbaka={() => setSteg("kalender")}
          />
        )}
      </Query>
    </Screen>
  );
}
