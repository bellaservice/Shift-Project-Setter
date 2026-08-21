"use client";

import { useState } from "react";
import {
  Chevron,
  DropdownOption,
  DropdownPanel,
  dropdownTrigger,
  useDropdown,
} from "@/components/Dropdown";
import { FieldLabel } from "@/components/Field";
import { MONTH_NAMES, daysInMonth, pad } from "@/lib/format";

/**
 * "Pass Datum" -- ar, manad och dag i samma paneler som Project Start, i
 * stallet for tre <select>. Ett pass loggas nastan alltid samma dag eller dagen
 * efter, sa faltet oppnar pa dagens datum och aret racker med i gar, i dag och
 * i morgon.
 *
 * Dagarna foljer manaden: en 31:a som blir omojlig nar man byter till februari
 * faller tillbaka pa manadens sista dag, sa att formularet aldrig skickar ett
 * datum som inte finns. Valet ligger kvar, sa 31:an kommer tillbaka om man
 * byter tillbaka.
 *
 * I panelerna bar dagens ar, dagens manad och dagens dag en liten punkt. Den ar
 * till for den som har bladdrat bort fran i dag och vill tillbaka utan att
 * rakna, och den ar ocksa det enda som markerar faltets startvarden: den svarta
 * plattan sparas till det anvandaren sjalv trycker fram, sa att ett forslag
 * aldrig ser ut som ett fattat beslut. Trycker man pa i dag ar det ett val som
 * alla andra -- da kommer plattan, och punkten blir vit for att synas pa den.
 */
export function DateSelect({
  label = "Pass Datum",
  defaultDate,
}: {
  /** Fältets rubrik. "Pass Datum" på ett pass, "Datum" på ett ärende. */
  label?: string;
  /**
   * 'YYYY-MM-DD' att öppna på i stället för dagens datum — dagen man tryckte på
   * i Kalendern, eller den dag ett sparat pass redan ligger på.
   *
   * Ett medskickat datum är ett fattat beslut och inte ett förslag, så alla tre
   * delarna får den svarta plattan direkt. Dagens datum får det fortfarande
   * inte: skillnaden mellan "det här valde jag" och "det här stod här när jag
   * kom" är precis vad plattan och punkten är till för.
   */
  defaultDate?: string;
} = {}) {
  const [today] = useState(() => new Date());
  const given = /^(\d{4})-(\d{2})-(\d{2})$/.exec(defaultDate ?? "");
  const [year, setYear] = useState(given?.[1] ?? String(today.getFullYear()));
  const [month, setMonth] = useState(given?.[2] ?? pad(today.getMonth() + 1));
  const [dayChoice, setDayChoice] = useState(given?.[3] ?? pad(today.getDate()));
  const [chosen, setChosen] = useState(() => {
    const picked = given !== null;
    return { year: picked, month: picked, day: picked };
  });

  const dd = useDropdown<"year" | "month" | "day">();

  const currentYear = today.getFullYear();
  // I fjol, i år och nästa år räcker för ett pass. Det valda året läggs till om
  // det ligger utanför — Kalendern kan bläddras hur långt som helst, och ett
  // ärende i mars 2029 får inte öppna ett årsfält som saknar 2029 och därmed
  // tyst flytta sig till i år.
  const years = [
    ...new Set([currentYear - 1, currentYear, currentYear + 1, Number(year)]),
  ]
    .sort((a, b) => a - b)
    .map(String);

  const maxDay = daysInMonth(Number(year), Number(month));
  const day = Number(dayChoice) <= maxDay ? dayChoice : pad(maxDay);

  // Punkten far bara peka ut i dag -- inte samma siffra i en annan manad. Darfor
  // visas manadens punkt bara under innevarande ar, och dagens bara i den manad
  // vi faktiskt befinner oss i.
  const todayMonth = pad(today.getMonth() + 1);
  const todayDay = pad(today.getDate());
  const inCurrentYear = Number(year) === currentYear;
  const inCurrentMonth = inCurrentYear && month === todayMonth;

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>

      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="day" value={day} />

      <div className="relative" onKeyDown={dd.onRootKeyDown}>
        {/* `flex-wrap` plus a floor on the month is the safety net for very
            narrow screens. The month is the only one of the three that holds a
            word rather than a number, so it is the only one that can run out of
            room — and as `flex-1` it is also the one flexbox shrinks first,
            which is exactly backwards. The floor stops it shrinking past its
            own text; the wrap then drops the day onto a second line instead of
            clipping "Månad" to "M…". At 360px and up the row never wraps. */}
        <div className="flex flex-wrap gap-1.5">
          <button
            ref={dd.registerTrigger("year")}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={dd.open === "year"}
            aria-label="Passets år"
            onClick={() => dd.toggle("year")}
            {...dropdownTrigger(dd.open === "year", true, "w-[5.75rem] shrink-0")}
          >
            <span className="truncate tabular-nums">{year}</span>
            <Chevron open={dd.open === "year"} />
          </button>

          <button
            ref={dd.registerTrigger("month")}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={dd.open === "month"}
            aria-label="Passets månad"
            onClick={() => dd.toggle("month")}
            {...dropdownTrigger(dd.open === "month", true, "min-w-[6.5rem] flex-1")}
          >
            <span className="truncate">{MONTH_NAMES[Number(month) - 1]}</span>
            <Chevron open={dd.open === "month"} />
          </button>

          <button
            ref={dd.registerTrigger("day")}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={dd.open === "day"}
            aria-label="Passets dag"
            onClick={() => dd.toggle("day")}
            {...dropdownTrigger(dd.open === "day", true, "w-[4.25rem] shrink-0")}
          >
            <span className="truncate tabular-nums">{Number(day)}</span>
            <Chevron open={dd.open === "day"} />
          </button>
        </div>

        {dd.open === "year" && (
          <DropdownPanel label="Välj år" columns={3} panelRef={dd.panelRef}>
            <div className="grid grid-cols-3 gap-1">
              {years.map((y) => (
                <DropdownOption
                  key={y}
                  selected={year === y}
                  chosen={chosen.year && year === y}
                  today={Number(y) === currentYear}
                  className="tabular-nums"
                  onSelect={() => {
                    setYear(y);
                    setChosen((c) => ({ ...c, year: true }));
                    dd.close(true);
                  }}
                >
                  {y}
                </DropdownOption>
              ))}
            </div>
          </DropdownPanel>
        )}

        {dd.open === "month" && (
          <DropdownPanel label="Välj månad" columns={3} panelRef={dd.panelRef}>
            <div className="grid grid-cols-3 gap-1">
              {MONTH_NAMES.map((label, i) => {
                const value = pad(i + 1);
                return (
                  <DropdownOption
                    key={value}
                    selected={month === value}
                    chosen={chosen.month && month === value}
                    today={inCurrentYear && value === todayMonth}
                    onSelect={() => {
                      setMonth(value);
                      setChosen((c) => ({ ...c, month: true }));
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
                    chosen={chosen.day && day === value}
                    today={inCurrentMonth && value === todayDay}
                    className="tabular-nums"
                    onSelect={() => {
                      setDayChoice(value);
                      setChosen((c) => ({ ...c, day: true }));
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
