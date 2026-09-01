"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "@/components/Icons";
import { PanelList, RowLink, RowMeta, RowStatus } from "@/components/Panel";
import { EmptyState, GroupLabel } from "@/components/Screen";
import { formatHoursSv, formatMonthYearSv, projectLabel } from "@/lib/format";
import type { ProjectListItem, ProjectMonthGroup } from "@/lib/types";

/**
 * "Alla Project": every project ever logged, under a heading for the month it
 * started in. Tapping a row floats the two actions over a dimmed page — the
 * list stays where it was, and tapping the dim closes it again.
 *
 * A row is a <button> rather than a link because it opens a choice, not a page —
 * but it is the app's one row shape either way (<RowLink>), so a project in the
 * archive looks like a project on Hem and like a worker in Alla Arbetare.
 *
 * An active project glows in the brand's amber. It is the one place where the
 * accent marks a state rather than an action, and it is the right colour for it
 * precisely because it is the colour the whole app is already tuned to: a
 * separate green would have been a second signal system running alongside the
 * first, with nothing else in the product speaking it.
 */
export function ProjectMonthList({ groups }: { groups: ProjectMonthGroup[] }) {
  const [open, setOpen] = useState<ProjectListItem | null>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (groups.length === 0) {
    return (
      <EmptyState
        title="Inga project loggade än."
        hint="Lägg upp det första med Logga Project."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <section key={group.monthStart}>
          <GroupLabel>{formatMonthYearSv(group.monthStart)}</GroupLabel>

          {/* Exakt samma rad som Hem, Alla Arbetare och Papperskorgen ritar —
              <RowLink> — men som knapp i stallet for lank, eftersom den oppnar
              ett val och inte en sida. Raden hade tidigare sin egen uppsattning
              klasser, och drev darfor sakta ifran de andra listorna: annan
              hojd, annan hogerkolumn, ingen chevron.

              `bleed` pa listan: glodet runt en aktiv rad far inte klippas av
              panelens egen overflow, sa raderna rundar sina egna horn i
              stallet. */}
          <PanelList bleed>
            {group.projects.map((p) => {
              const active = p.status === "active";
              return (
                <RowLink
                  key={p.id}
                  onClick={() => setOpen(p)}
                  rounded
                  highlight={active}
                  title={projectLabel(p)}
                  subtitle={p.address}
                  note={
                    <RowStatus on={active}>
                      {active ? "Aktiv" : "Inaktiv"}
                    </RowStatus>
                  }
                  meta={
                    <RowMeta
                      value={`${formatHoursSv(p.totalHours)}h`}
                      label="Timmar"
                    />
                  }
                />
              );
            })}
          </PanelList>
        </section>
      ))}

      {open && (
        /* Allt utom knapparna är dimmer, så klicket stängs på hela lagret. Ett
           tryck på en knapp bubblar hit också, men Link:en har redan startat
           navigeringen när det gör det — panelen hinner bara försvinna först.
           Projectnamnet står numera överst i panelen, men aria-label bär det
           också: rubriken är en <p>, inte panelens tillgängliga namn. */
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Val för ${projectLabel(open)}`}
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 pb-6 backdrop-blur-sm sm:items-center"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="glass-overlay w-full max-w-sm rounded-3xl p-4"
          >
            {/* Vilket project man valde. Panelen svavade tidigare namnlos over
                listan, sa tva rader ner i ett arkiv var det inte langre sakert
                vilken rad man traffade. */}
            <div className="mb-3 px-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                Project
              </p>
              <p className="mt-1 truncate text-lg font-extrabold tracking-tight text-white">
                {projectLabel(open)}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {/* Generera ar det man kommer till Alla Project for att gora, sa
                  den bar accentplattan; Redigera ar den tystare av de tva. */}
              <PanelAction
                href={`/arbetsdagbok?id=${open.id}`}
                label="Generera Arbetsdagbok"
                hint="PDF med försättsblad och dagtabeller"
                primary
              />
              <PanelAction
                href={`/logga-project/redigera?id=${open.id}`}
                label="Redigera Project"
                hint="Beställare, tjänster och arbetare"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** En rad i valpanelen. Full bredd och 64px hog i stallet for tva rutor bredvid
 *  varandra: staplade rader far plats med en forklarande underrad, och en
 *  handling som skapar ett dokument fortjanar att sta med ord snarare an att
 *  radbrytas mitt i en 100px-bred ruta. */
function PanelAction({
  href,
  label,
  hint,
  primary,
}: {
  href: string;
  label: string;
  hint: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-[64px] items-center gap-3 rounded-2xl px-4 py-3 transition-colors duration-200 ease-out motion-reduce:transition-none ${
        primary
          ? "bg-night-accent text-black active:bg-[#e5a41f]"
          : "glass-flat text-white active:bg-white/15"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-extrabold tracking-tight">
          {label}
        </span>
        <span
          className={`block truncate text-xs ${
            primary ? "text-black/65" : "text-white/55"
          }`}
        >
          {hint}
        </span>
      </span>
      <ChevronRight
        className={`h-4 w-4 shrink-0 ${primary ? "text-black/50" : "text-white/40"}`}
      />
    </Link>
  );
}
