"use client";

import { useState } from "react";
import { FieldHint, FieldLabel } from "@/components/Field";
import { Clock } from "@/components/Icons";
import { TimeRangeSelect } from "@/components/TimeWheelSelect";
import { formatHoursSv, formatWeekdayDateSv, pad, passSpanHours } from "@/lib/format";
import type { PassProblem } from "@/lib/types";

/** Klockslaget `hours` timmar efter `start`, som 'HH:MM'. Vänder vid midnatt —
 *  ett nattpass slutar dagen efter, och det är samma spann ändå. */
function addHours(start: string, hours: number): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(start);
  if (!match || !Number.isFinite(hours)) return null;

  const [, h, m] = match.map(Number);
  const minutes = ((Math.round(h * 60 + m + hours * 60) % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** ["Anna", "Björn", "Carl"] -> "Anna, Björn och Carl". Frågan nämner den eller
 *  de som gick passet vid namn, och ett pass loggas ofta på flera samtidigt. */
function joinNames(names: string[]): string {
  if (names.length === 0) return "arbetaren";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} och ${names[names.length - 1]}`;
}

type PassRow = {
  start: string;
  end: string;
};

/**
 * Håller svaren. Ligger i en hook för att räkningen ska nå knappen längst ner i
 * enkäten, på samma sätt som <PassFields> når arbetarraderna i Logga Timmar.
 */
export function usePassProblemRows(problems: PassProblem[]) {
  const [rows, setRows] = useState<PassRow[]>(() =>
    problems.map(() => ({ start: "", end: "" }))
  );

  function patch(index: number, part: Partial<PassRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...part } : row)));
  }

  function setStart(index: number, start: string) {
    const row = rows[index];
    // Passet har bara sina timmar att gå på, så slutet föreslås ur dem: väljer
    // man 07:30 på ett åttatimmarspass står det 15:30 innan man hunnit fram
    // till andra hjulet. Ett slut som redan står kvar rörs inte.
    const suggested = row.end === "" ? addHours(start, problems[index].hours) : null;
    patch(index, suggested ? { start, end: suggested } : { start });
  }

  const state = rows.map((row) => ({
    row,
    span: passSpanHours(row.start, row.end),
    /** Frågan är besvarad — båda klockslagen står där. */
    answered: row.start !== "" && row.end !== "",
    /** Ett klockslag utan sitt andra. shifts_pass_times_paired avvisar det, så
     *  det är det enda som faktiskt måste spärra vägen ut. */
    halfFilled: (row.start !== "") !== (row.end !== ""),
  }));

  return {
    state,
    setStart,
    setEnd: (index: number, end: string) => patch(index, { end }),
    /** Hur många kort som har ett klockslag men inte det andra. */
    halvifyllda: state.filter((s) => s.halfFilled).length,
    /** Hur många frågor som ännu inte fått ett svar. Spärrar ingenting — ett
     *  pass vars tider ingen minns ska gå att lämna tomt — men knappen längst
     *  ner tänds inte förrän de är noll. */
    obesvarade: state.filter((s) => !s.answered).length,
  };
}

/**
 * Ett kort per pass som saknar Pass Tider, ställt som en fråga i klartext:
 * "Vilken tid började och slutade Anna den 21 augusti på Storgatan projectet?"
 *
 * Så formulerad därför att det ÄR en fråga, till en människa som var där eller
 * som vet vem som var det. Kortet stod tidigare med två kolumner och en etikett
 * över var — "Pass Timmar" och "Pass Tider" — och lät användaren lista ut vad
 * den skulle göra med dem. Ett dokument som saknar en uppgift kan lika gärna be
 * om den med ord.
 *
 * Kortet ber om EN sak: de två klockslagen. Passets timmar står med som
 * sammanhang men går inte att ändra här — de är redan besvarade, de är det som
 * betalas, och sedan Logga Timmar skrevs om behöver de inte längre stämma med
 * spannet. Skiljer sig de två åt är det en obetald rast, och det är inget att
 * rätta.
 *
 * Kortet bär EN färg, accentens gula: den lyser så länge frågan är obesvarad och
 * slocknar när den fått sitt svar. Ingen grön kvittens — ett grönt kort är ett
 * andra färgspråk mitt i en skärm som redan har ett, och det säger dessutom fel
 * sak. Det som lyser upp när allt är ifyllt är den gula knappen längst ner, för
 * det är det enda som är kvar att göra.
 */
export function PassTiderRows({
  problems,
  projectName,
  state,
  setStart,
  setEnd,
}: {
  problems: PassProblem[];
  /** Projectets namn, som frågan nämner det. */
  projectName: string;
} & Pick<ReturnType<typeof usePassProblemRows>, "state" | "setStart" | "setEnd">) {
  return (
    <>
      {problems.map((problem, i) => {
        const { row, span, answered, halfFilled } = state[i];

        return (
          <div
            key={problem.shiftIds.join(",")}
            className={`glass rounded-2xl p-4 transition-colors duration-300 ease-out motion-reduce:transition-none ${
              answered ? "" : "!border-night-accent/45"
            }`}
          >
            <input
              type="hidden"
              name={`pass_ids_${i}`}
              value={problem.shiftIds.join(",")}
            />

            {/* Frågan, med klockan i en skiva bredvid: korten ovanför i enkäten
                bär sitt nummer i samma skiva, och de här hör till samma räcka
                frågor även om de inte är numrerade. */}
            <div className="mb-3 flex items-start gap-3">
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-night-accent text-black"
              >
                <Clock className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold leading-snug text-white">
                  Vilken tid började och slutade {joinNames(problem.workers)} den{" "}
                  {formatWeekdayDateSv(problem.date)} på {projectName} projectet?
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-white/60">
                  Passet är loggat som {formatHoursSv(problem.hours)} h. Timmarna
                  ändras inte här — det är bara Pass Tider som saknas i
                  dokumentet.
                </p>
              </div>
            </div>

            <div>
              <FieldLabel>Pass Tider</FieldLabel>
              <TimeRangeSelect
                start={{
                  name: `pass_start_${i}`,
                  label: "Pass start",
                  value: row.start,
                  fallback: "07:00",
                  onChange: (value) => setStart(i, value),
                }}
                end={{
                  name: `pass_end_${i}`,
                  label: "Pass slut",
                  value: row.end,
                  fallback: "16:00",
                  onChange: (value) => setEnd(i, value),
                }}
              />

              {halfFilled ? (
                <FieldHint tone="warn">
                  Välj båda klockslagen — ett halvt spann går inte att skriva ut.
                </FieldHint>
              ) : span !== null && Math.abs(span - problem.hours) > 0.01 ? (
                /* Spannet är inte timmarna. Ett konstaterande och inte en
                   invändning: så ser ett pass med obetald rast ut, och båda
                   talen skrivs ut precis som de står. */
                <FieldHint>
                  Spannet blir {formatHoursSv(span)} h mot{" "}
                  {formatHoursSv(problem.hours)} h loggade. Båda skrivs ut —
                  mellanskillnaden är obetald rast.
                </FieldHint>
              ) : (
                <FieldHint>
                  Lämna tomt om ingen minns tiderna, så står cellen tom i
                  dokumentet.
                </FieldHint>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
