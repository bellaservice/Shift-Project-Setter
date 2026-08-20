"use client";

import { useState } from "react";
import { FIELD_BOX, FieldHint, FieldLabel } from "@/components/Field";
import { Check, Warning } from "@/components/Icons";
import { TimeRangeSelect } from "@/components/TimeWheelSelect";
import { formatHoursSv, pad, passSpanHours } from "@/lib/format";
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

type PassRow = {
  start: string;
  end: string;
  hours: string;
};

/**
 * Håller de rättade passen. Ligger i en hook för att `unresolved` ska nå
 * knappen längst ner i enkäten, på samma sätt som <PassFields> når
 * arbetarraderna i Logga Timmar.
 */
export function usePassProblemRows(problems: PassProblem[]) {
  const [rows, setRows] = useState<PassRow[]>(() =>
    problems.map((p) => ({
      start: p.startTime ?? "",
      end: p.endTime ?? "",
      hours: String(p.hours),
    }))
  );

  function patch(index: number, part: Partial<PassRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...part } : row)));
  }

  function setStart(index: number, start: string) {
    const row = rows[index];
    // Ett pass som saknar tider har bara timmarna att gå på, så slutet föreslås
    // ur dem: väljer man 07:30 på ett åttatimmarspass står det 15:30 innan man
    // hunnit fram till andra hjulet. Ett slut som redan står kvar rörs inte.
    const suggested = row.end === "" ? addHours(start, Number(row.hours)) : null;
    patch(index, suggested ? { start, end: suggested } : { start });
  }

  const state = rows.map((row) => {
    const hours = Number(row.hours);
    const span = passSpanHours(row.start, row.end);
    const hoursOk = row.hours.trim() !== "" && Number.isFinite(hours) && hours > 0;
    return {
      row,
      span,
      hours,
      hoursOk,
      /** Kolumnerna säger samma sak — det är det här enkäten är till för. */
      agrees: hoursOk && span !== null && Math.abs(span - hours) <= 0.01,
    };
  });

  return {
    state,
    setStart,
    setEnd: (index: number, end: string) => patch(index, { end }),
    setHours: (index: number, hours: string) => patch(index, { hours }),
    /** Hur många pass som inte går ihop. */
    unresolved: state.filter((s) => !s.agrees).length,
  };
}

/**
 * Ett kort per pass som inte går ihop, med samma två kolumner som dagtabellen
 * skriver ut: Pass Timmar och Pass Tider. Båda går att ändra — vilken av dem
 * som är fel vet bara den som var där — och kortet kvitterar först när spannet
 * mellan tiderna ÄR timmarna bredvid.
 *
 * Kortet har EN farg, och det ar accentens gula: den lyser sa lange raden ar
 * obesvarad och slocknar nar den gar ihop. Ingen gron kvittens. Ett gront kort
 * ar ett andra fargsprak att lasa mitt i en skarm som redan har ett, och det
 * sager dessutom fel sak — att raden ar klar ar inte en handling, det ar bara
 * att den slutat vanta. Det som lyser upp nar allt gar ihop ar den gula knappen
 * langst ner, for det ar det enda som ar kvar att gora.
 *
 * Kvittensraden bar beskedet i ord och med en ikon, sa att en slocknad kant
 * aldrig ar det enda som sager att raden ar klar.
 */
export function PassTiderRows({
  problems,
  state,
  setStart,
  setEnd,
  setHours,
}: { problems: PassProblem[] } & Omit<
  ReturnType<typeof usePassProblemRows>,
  "unresolved"
>) {
  return (
    <>
      {problems.map((problem, i) => {
        const { row, span, hours, hoursOk, agrees } = state[i];
        const logged =
          problem.startTime && problem.endTime
            ? passSpanHours(problem.startTime, problem.endTime)
            : null;

        return (
          <div
            key={problem.shiftIds.join(",")}
            className={`glass rounded-2xl p-4 transition-colors duration-300 ease-out motion-reduce:transition-none ${
              agrees ? "" : "!border-night-accent/45"
            }`}
          >
            <input
              type="hidden"
              name={`pass_ids_${i}`}
              value={problem.shiftIds.join(",")}
            />

            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-sm font-bold tabular-nums text-white">
                {problem.date}
              </span>
              <span className="text-right text-[11px] font-semibold text-white/55">
                {problem.kind === "saknar"
                  ? "Pass Tider saknas"
                  : `${problem.startTime}–${problem.endTime} är ${
                      logged === null ? "0" : formatHoursSv(logged)
                    }h, inte ${formatHoursSv(problem.hours)}h`}
              </span>
            </div>
            <p className="mb-3.5 text-xs text-white/55">
              {problem.workers.join(", ")}
            </p>

            <div className="flex flex-col gap-3.5">
              <label className="block">
                <FieldLabel>Pass Timmar</FieldLabel>
                <input
                  name={`pass_hours_${i}`}
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={row.hours}
                  onChange={(e) => setHours(i, e.target.value)}
                  className={`${FIELD_BOX} tabular-nums`}
                />
              </label>

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
              </div>

              {/* Kvittensraden: ikonen och orden bar beskedet, fargen bara
                  forstarker det. Nar raden gar ihop tonar den ner till samma
                  vita som resten av kortet i stallet for att byta till en ny
                  farg — bocken och orden ar kvittensen. */}
              <div
                className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 transition-colors duration-300 ease-out motion-reduce:transition-none ${
                  agrees
                    ? "border border-white/12 bg-white/5"
                    : "border border-night-accent/35 bg-night-accent/10"
                }`}
              >
                <span
                  className={`flex items-center gap-2 text-sm font-semibold ${
                    agrees ? "text-white/75" : "text-night-accent"
                  }`}
                >
                  {agrees ? (
                    <Check className="h-4 w-4 shrink-0" />
                  ) : (
                    <Warning className="h-4 w-4 shrink-0" />
                  )}
                  {agrees ? "Spannet stämmer" : "Spannet"}
                </span>
                <span
                  className={`text-base font-extrabold tabular-nums ${
                    agrees ? "text-white" : "text-night-accent"
                  }`}
                >
                  {span === null ? "–" : `${formatHoursSv(span)} h`}
                </span>
              </div>

              {!agrees && hoursOk && (
                <FieldHint tone="warn">
                  Tiden mellan start och sluttid blir inte{" "}
                  {formatHoursSv(hours)} h
                </FieldHint>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
