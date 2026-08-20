"use client";

import { useState } from "react";
import { FIELD_BOX, FieldHint, FieldLabel } from "@/components/Field";
import { Warning } from "@/components/Icons";
import { TimeRangeSelect } from "@/components/TimeWheelSelect";
import { formatHoursSv, passSpanHours } from "@/lib/format";

/**
 * Vad som bestämmer passets längd — de två sätten är inte lika exakta, så
 * användaren väljer vilket som gäller i stället för att appen gissar.
 *
 * 'tider': klockslagen är sanningen och timmarna räknas ur spannet. Default,
 * eftersom start och slut är det man minns efter ett pass.
 * 'timmar': siffran skrivs för hand. Ett pass med obetald rast är kortare än
 * sitt spann, och då är det timmarna — inte klockslagen — som bär lönen.
 *
 * Tiderna sparas i båda lägena: "Pass Tider" är en egen kolumn i
 * Arbetsdagboken och ska stå där även när timmarna skrivits för hand.
 */
export type PassMode = "tider" | "timmar";

const MODES: Array<{ value: PassMode; label: string }> = [
  { value: "tider", label: "Pass Tider" },
  { value: "timmar", label: "Pass Timmar" },
];

/**
 * Passets längd som ett block: läget, klockslagen och timmarna hör ihop och
 * läses av både formuläret och arbetarraderna. Tillståndet ligger i en hook
 * för att `echoHours` ska nå <WorkerRows> längre ner i formuläret.
 */
export function usePassFields() {
  const [mode, setMode] = useState<PassMode>("tider");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [hours, setHours] = useState("");

  const span = passSpanHours(start, end);

  /**
   * Spannet följer med över till handläget: den som slår om för att dra av en
   * obetald rast vill ändra 8 till 7,5, inte skriva in passet en gång till.
   * Ett värde som redan står kvar från ett tidigare byte skrivs inte över.
   */
  function changeMode(next: PassMode) {
    if (next === "timmar" && hours.trim() === "" && span !== null) {
      setHours(String(span));
    }
    setMode(next);
  }

  const typed = Number(hours);
  const typedIsUsable = hours.trim() !== "" && Number.isFinite(typed) && typed > 0;

  return {
    mode,
    changeMode,
    hours,
    setHours,
    start,
    setStart,
    end,
    setEnd,
    span,
    /** Det som skickas som `hours` — härlett ur spannet, eller handskrivet. */
    hoursValue: mode === "tider" ? (span === null ? "" : String(span)) : hours,
    /**
     * Timmarna att eka bredvid varje vald arbetare. Bara i handläget: i
     * tidsläget står de redan under spannet, och alla på passet får samma
     * siffra oavsett läge.
     */
    echoHours: mode === "timmar" && typedIsUsable ? formatHoursSv(typed) : null,
  };
}

export function PassFields({
  mode,
  changeMode,
  hours,
  setHours,
  start,
  setStart,
  end,
  setEnd,
  span,
  hoursValue,
}: ReturnType<typeof usePassFields>) {
  // Ett spann på noll går bara att få ihop med båda fälten ifyllda: tomma fält
  // stoppas redan av <select required> i tidshjulet.
  const sameTime = mode === "tider" && start !== "" && end !== "" && span === null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <FieldLabel>Passets längd</FieldLabel>
        {/* Skenan ar `glass-field` — samma insjunkna yta som ett textfalt, sa
            valet ser ut att ligga I formularet och inte ovanpa det. Den valda
            halvan far den fyllda accentplattan, som ar appens enda "det har ar
            det aktiva"-markering. Att den ar den mest lasbara ytan pa skarmen
            (svart pa gult, 11:1) ar poangen: laget avgor vad de tva falten
            under den betyder, sa det far inte ga att missa vilket som galler. */}
        <div
          role="radiogroup"
          aria-label="Passets längd"
          className="glass-field flex gap-1 rounded-xl p-1"
        >
          {MODES.map((option) => {
            const active = option.value === mode;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => changeMode(option.value)}
                className={`flex h-10 flex-1 cursor-pointer items-center justify-center rounded-lg text-sm font-bold transition-colors duration-200 ease-out motion-reduce:transition-none ${
                  active
                    ? "bg-night-accent text-black"
                    : "text-white/60 active:bg-white/10"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {mode === "timmar" && (
        <label className="block">
          <FieldLabel>
            Pass Timmar
            <span aria-hidden className="ml-1 text-night-accent">
              *
            </span>
          </FieldLabel>
          <input
            name="hours"
            type="number"
            step="any"
            min="0"
            required
            placeholder="t.ex. 8"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className={`${FIELD_BOX} tabular-nums`}
          />
        </label>
      )}

      <div>
        <FieldLabel>Pass Tider</FieldLabel>
        <TimeRangeSelect
          start={{
            name: "start_time",
            label: "Pass start",
            value: start,
            fallback: "07:00",
            onChange: setStart,
          }}
          end={{
            name: "end_time",
            label: "Pass slut",
            value: end,
            fallback: "16:00",
            onChange: setEnd,
          }}
        />
      </div>

      {mode === "tider" && (
        <>
          {/* Spannet räknat i timmar: det är den här siffran som sparas, så den
              ska synas innan passet loggas och inte först i Arbetsdagboken.
              Kvittot ar accentfargat nar det gar ihop och rott nar det inte
              gor det — samma siffra, tva olika besked. */}
          <div
            className={`flex items-center justify-between rounded-xl px-4 py-3 ${
              sameTime
                ? "border border-night-danger/40 bg-night-danger/10"
                : "glass-flat"
            }`}
          >
            <span className="text-sm font-semibold text-white/75">Pass Timmar</span>
            <span
              className={`text-lg font-extrabold tabular-nums ${
                span === null ? "text-white/40" : "text-night-accent"
              }`}
            >
              {span === null ? "–" : `${formatHoursSv(span)} h`}
            </span>
          </div>
          {sameTime && (
            <div className="flex items-start gap-1.5">
              <Warning className="mt-2 h-3.5 w-3.5 shrink-0 text-night-danger" />
              <FieldHint tone="danger">
                Pass start och Pass slut är samma tid — passet blir 0 timmar.
              </FieldHint>
            </div>
          )}
          <input type="hidden" name="hours" value={hoursValue} />
        </>
      )}
    </div>
  );
}
