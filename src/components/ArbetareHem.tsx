"use client";

import { ButtonLink } from "@/components/Button";
import { Panel, PanelList } from "@/components/Panel";
import { EmptyState, GroupLabel, SectionHeading } from "@/components/Screen";
import { StatCard, StatRow } from "@/components/StatCard";
import { formatHoursSv, formatMonthNameSv, formatWeekdayDateSv } from "@/lib/format";
import type { ArbetareHem as Data } from "@/lib/types";

/**
 * Hem, sett av en arbetare.
 *
 * Skarmen var fram till nu densamma for alla: foretagets totala timmar, antalet
 * aktiva project, och tva knappar for att logga project och timmar. En arbetare
 * har ingen nytta av nagot av det, och far dessutom inte rora halva det —
 * knapparna hade lett till skarmar som avvisar hen.
 *
 * Det har ar samma fraga som Hem alltid stallt, "vad ar pa gang just nu", fast
 * om arbetarens egen dag. Ordningen ar det viktigaste forst och det ovriga
 * darunder: pagar ett pass ar utstamplingen det enda som betyder nagot, och da
 * ska den ligga overst med sin egen knapp.
 */
export function ArbetareHem({ data }: { data: Data }) {
  return (
    <>
      {/* Det pagaende passet, om det finns ett. Egen panel med accentram: det
          ar dagens enda obesvarade fraga, och den ska inte behova letas upp. */}
      {data.pagaende && (
        <section>
          <GroupLabel>Pagar nu</GroupLabel>
          <div className="rounded-2xl border border-night-accent/35 bg-night-accent/10 px-4 py-4">
            <p className="truncate text-[15px] font-bold text-white">
              {data.pagaende.projectName}
            </p>
            <p className="mt-0.5 text-xs text-white/70">
              Instamplad{" "}
              <span className="font-bold tabular-nums text-night-accent">
                {new Date(data.pagaende.clockIn as string).toLocaleTimeString(
                  "sv-SE",
                  { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Stockholm" }
                )}
              </span>
            </p>
            <ButtonLink href="/stampla" size="lg" className="mt-3 w-full">
              Stampla Ut
            </ButtonLink>
          </div>
        </section>
      )}

      <StatRow label="Din manad">
        <StatCard
          label={"Bekraftade\nTimmar"}
          value={`${formatHoursSv(data.timmarDennaManad)}h`}
          subtitle={formatMonthNameSv(data.monthStart)}
        />
        <StatCard label={"Bekraftade\nPass"} value={data.passDennaManad} />
        <StatCard
          label={"Att\nStampla"}
          value={data.attStampla.length + (data.pagaende ? 1 : 0)}
          href="/stampla"
          action
        />
      </StatRow>

      <section>
        <SectionHeading>Att Stampla</SectionHeading>

        {data.attStampla.length === 0 ? (
          <EmptyState
            title={
              data.pagaende
                ? "Inga fler pass att pabörja."
                : "Inga pass att stampla pa just nu."
            }
            hint="Har visas dina pass for idag och igar. Saknas ett du ska ga — sag till din arbetsledare."
            action={
              <ButtonLink href="/stampla" size="md">
                Stampla
              </ButtonLink>
            }
          />
        ) : (
          <Panel>
            <PanelList>
              {data.attStampla.map((p) => (
                <div key={p.id} className="px-4 py-3.5">
                  <p className="truncate text-[15px] font-bold text-white">
                    {p.projectName}
                  </p>
                  <p className="mt-0.5 text-xs text-white/60">
                    {formatWeekdayDateSv(p.shiftDate)} · Inte pabörjat
                  </p>
                </div>
              ))}
            </PanelList>
          </Panel>
        )}
      </section>

      {/* En enda vag vidare. Arbetarens app ar stamplingen; allt annat pa Hem
          vore en avstickare. */}
      {data.attStampla.length > 0 && (
        <ButtonLink href="/stampla" size="lg" glow className="w-full">
          Stampla In
        </ButtonLink>
      )}
    </>
  );
}
