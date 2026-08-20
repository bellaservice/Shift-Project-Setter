"use client";

import { useEffect, useRef, useState } from "react";
import {
  Chevron,
  DropdownOption,
  DropdownPanel,
  dropdownTrigger,
  useDropdown,
} from "@/components/Dropdown";
import { FieldLabel } from "@/components/Field";
import { MONTH_NAMES, daysInMonth, pad } from "@/lib/format";

/** ["manad", "dag"] -> "manad och dag". */
function joinParts(parts: string[]) {
  if (parts.length < 2) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} och ${parts[parts.length - 1]}`;
}

/**
 * Project Start som tre delar i stallet for ett fritt datumfalt: aret bestar
 * av ett fast "20" plus tva siffror, sa det gar inte langre att rada ut ett
 * project som borjar ar 4035. Manaden valjs med namn och dagen ur en
 * siffertabell, dar dagarna foljer manaden (ingen 31 februari).
 *
 * Listorna ar egna paneler och inte <select> -- se Dropdown.tsx, som ager bade
 * utseendet och tangentbordet at appens ovriga dropdowns.
 *
 * I panelerna bar dagens manad och dagens dag en liten punkt: faltet borjar
 * tomt, och de flesta project startar nara det datum de laggs in.
 *
 * Faltet ar frivilligt: antingen ar alla tre tomma, eller sa ar alla ifyllda.
 * Ett halvt ifyllt datum blockerar submit via setCustomValidity pa arsfaltet
 * (ett dolt falt deltar inte i webblasarens validering).
 */
export function ProjectStartDateField({ defaultValue }: { defaultValue?: string | null }) {
  // Endast 20xx-datum kan visas har. Databasens check tillater aven 2100-01-01,
  // och ett sadant arv far bli ett tomt falt i stallet for ett felaktigt ar.
  const saved = /^20(\d{2})-(\d{2})-(\d{2})$/.exec(defaultValue ?? "");
  const [yy, setYy] = useState(saved?.[1] ?? "");
  const [month, setMonth] = useState(saved?.[2] ?? "");
  const [dayChoice, setDayChoice] = useState(saved?.[3] ?? "");

  const dd = useDropdown<"month" | "day">();
  const yearRef = useRef<HTMLInputElement>(null);

  // Panelerna oppnas forst efter ett klick, sa dagens datum far lasas rakt i
  // renderingen -- servern hinner aldrig rita punkten ur sin egen tidszon.
  const today = new Date();
  const todayMonth = pad(today.getMonth() + 1);
  const todayDay = pad(today.getDate());
  // Ett tomt ar raknas som i ar: punkten ar en genvag till dagens datum, och
  // den ska synas redan innan aret ar ifyllt. Star det ett annat ar dar pekar
  // punkten pa fel dag och tas darfor bort.
  const inCurrentYear = yy === "" || `20${yy}` === String(today.getFullYear());
  const inCurrentMonth = inCurrentYear && month === todayMonth;

  const maxDay = daysInMonth(
    yy.length === 2 ? Number(`20${yy}`) : null,
    month ? Number(month) : null
  );
  // Den valda dagen ligger kvar i state aven nar manaden tillfalligt saknar
  // den, sa att en 31:a kommer tillbaka om man gar Jan -> Feb -> Jan.
  const day = dayChoice && Number(dayChoice) <= maxDay ? dayChoice : "";

  const missing = [
    yy.length !== 2 ? "år" : null,
    !month ? "månad" : null,
    !day ? "dag" : null,
  ].filter((part): part is string => part !== null);
  const complete = missing.length === 0;
  const empty = missing.length === 3;
  // Bara delvis ifyllt: sag vad som fattas. Ingen text under faltet -- "20 ÅÅ",
  // "Månad" och "Dag" visar redan vad som ska fyllas i. Meddelandet kommer i
  // webblasarens bubbla, och bara nar man faktiskt forsoker spara.
  const problem = complete || empty ? null : `Startdatumet behöver också ${joinParts(missing)}.`;

  useEffect(() => {
    yearRef.current?.setCustomValidity(problem ?? "");
  }, [problem]);

  return (
    <div>
      <FieldLabel>Project Start</FieldLabel>

      <input type="hidden" name="start_date" value={complete ? `20${yy}-${month}-${day}` : ""} />

      <div className="relative" onKeyDown={dd.onRootKeyDown}>
        {/* `flex-wrap` plus a floor on the month is the safety net for very
            narrow screens. The month is the only one of the three that holds a
            word rather than a number, so it is the only one that can run out of
            room — and as `flex-1` it is also the one flexbox shrinks first,
            which is exactly backwards. The floor stops it shrinking past its
            own text; the wrap then drops the day onto a second line instead of
            clipping "Månad" to "M…". At 360px and up the row never wraps. */}
        <div className="flex flex-wrap gap-1.5">
          {/* Sekelsiffrorna ar tryckta i faltet, inte skrivna av anvandaren:
              rutan ar ett glass-field precis som varje annat falt, och "20"
              ligger i den som en fast etikett. Hela rutan lyser upp nar
              markoren gar in i inputen — det ar `focus-within` i materialet som
              gor det, sa prefixet och siffrorna reagerar som en enda ruta. */}
          <div className="glass-field flex h-12 w-[4.5rem] shrink-0 items-center rounded-xl pl-3">
            <span className="text-base text-white/50">20</span>
            <input
              ref={yearRef}
              type="text"
              inputMode="numeric"
              maxLength={2}
              placeholder="ÅÅ"
              aria-label="Startår, två siffror efter 20"
              value={yy}
              onChange={(event) => setYy(event.currentTarget.value.replace(/\D/g, "").slice(0, 2))}
              onFocus={() => dd.setOpen(null)}
              className="w-full min-w-0 bg-transparent py-2 pl-0.5 pr-2 text-base tabular-nums text-white outline-none"
            />
          </div>

          <button
            ref={dd.registerTrigger("month")}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={dd.open === "month"}
            aria-label="Startmånad"
            onClick={() => dd.toggle("month")}
            {...dropdownTrigger(dd.open === "month", month !== "", "min-w-[6.5rem] flex-1")}
          >
            <span className="truncate">{month ? MONTH_NAMES[Number(month) - 1] : "Månad"}</span>
            <Chevron open={dd.open === "month"} />
          </button>

          <button
            ref={dd.registerTrigger("day")}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={dd.open === "day"}
            aria-label="Startdag"
            onClick={() => dd.toggle("day")}
            {...dropdownTrigger(dd.open === "day", day !== "", "w-[5rem] shrink-0")}
          >
            <span className="truncate tabular-nums">{day ? Number(day) : "Dag"}</span>
            <Chevron open={dd.open === "day"} />
          </button>
        </div>

        {dd.open === "month" && (
          <DropdownPanel label="Välj månad" columns={3} panelRef={dd.panelRef}>
            <div className="grid grid-cols-3 gap-1">
              {MONTH_NAMES.map((label, i) => {
                const value = pad(i + 1);
                return (
                  <DropdownOption
                    key={value}
                    selected={month === value}
                    today={inCurrentYear && value === todayMonth}
                    onSelect={() => {
                      setMonth(value);
                      dd.close(true);
                    }}
                  >
                    {label}
                  </DropdownOption>
                );
              })}
            </div>
          </DropdownPanel>
        )}

        {dd.open === "day" && (
          <DropdownPanel label="Välj dag" columns={6} panelRef={dd.panelRef}>
            <div className="grid grid-cols-6 gap-1">
              {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => {
                const value = pad(d);
                return (
                  <DropdownOption
                    key={value}
                    selected={day === value}
                    today={inCurrentMonth && value === todayDay}
                    className="tabular-nums"
                    onSelect={() => {
                      setDayChoice(value);
                      dd.close(true);
                    }}
                  >
                    {d}
                  </DropdownOption>
                );
              })}
            </div>
          </DropdownPanel>
        )}
      </div>
    </div>
  );
}
