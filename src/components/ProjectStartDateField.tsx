"use client";

import { useEffect, useRef, useState } from "react";
import { Button, buttonClass } from "@/components/Button";
import { DayPanel } from "@/components/DayPanel";
import {
  Chevron,
  DropdownOption,
  DropdownPanel,
  dropdownTrigger,
  useDropdown,
} from "@/components/Dropdown";
import { FieldLabel } from "@/components/Field";
import { Wheel, WheelPlate } from "@/components/Wheel";
import {
  MONTH_NAMES,
  daysInMonth,
  pad,
  weekdayNameSv,
  weekdayShortSv,
} from "@/lib/format";

/** ["manad", "dag"] -> "manad och dag". */
function joinParts(parts: string[]) {
  if (parts.length < 2) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} och ${parts[parts.length - 1]}`;
}

/**
 * Hur langt tillbaka och framat arshjulet racker.
 *
 * Det gamla faltet var ett fast "20" plus tva siffror, och det fanns dar for
 * att det inte skulle ga att rada ut ett project som borjar ar 4035. Hjulet gor
 * samma jobb battre: det som inte star i listan gar inte att valja alls. Bakat
 * racker det langre an framat -- ett project laggs in efter att det borjat
 * oftare an langt innan.
 */
const AR_BAKAT = 10;
const AR_FRAMAT = 5;

/**
 * Project Start som tre delar i stallet for ett fritt datumfalt: aret rullas
 * fram ur ett hjul, manaden valjs med namn och dagen ur en siffertabell, dar
 * dagarna foljer manaden (ingen 31 februari).
 *
 * Aret var tidigare en textruta dar man skrev arets tva sista siffror bredvid
 * ett tryckt "20". Nu ar hela rutan en knapp, och den oppnar samma hjul som
 * Pass Tider rullar klockslag med (se Wheel.tsx) -- att det ar samma hjul och
 * inte ett hjul till ar poangen: den som rullat fram 07:00 behover inte lara
 * sig nagot nytt for att rulla fram 2026.
 *
 * Aret star ifyllt fran borjan. Ett sparat datum visar sitt eget ar, och ett
 * tomt falt visar innevarande -- ratt svar nastan varje gang, och aldrig nagot
 * man behover skriva. Manaden och dagen star kvar som "Månad" och "Dag": de
 * har inget sjalvklart forslag pa samma satt.
 *
 * Listorna ar egna paneler och inte <select> -- se Dropdown.tsx, som ager bade
 * utseendet och tangentbordet at appens ovriga dropdowns.
 *
 * I panelerna bar dagens manad och dagens dag en liten punkt: de flesta project
 * startar nara det datum de laggs in.
 *
 * Faltet ar frivilligt: antingen ar det orort, eller sa ar det helt ifyllt. Ett
 * halvt ifyllt datum blockerar submit via setCustomValidity pa arsfaltet (ett
 * dolt falt deltar inte i webblasarens validering).
 */
export function ProjectStartDateField({ defaultValue }: { defaultValue?: string | null }) {
  // Endast 20xx-datum kan visas har. Databasens check tillater aven 2100-01-01,
  // och ett sadant arv far bli innevarande ar i stallet for ett felaktigt.
  const saved = /^20(\d{2})-(\d{2})-(\d{2})$/.exec(defaultValue ?? "");

  // Last en gang och inte per rendering: forslaget far inte kunna byta ar mitt
  // i att nagon fyller i formularet.
  const [today] = useState(() => new Date());
  const currentYear = today.getFullYear();
  const defaultYy = pad(currentYear % 100);

  const [yy, setYy] = useState(saved?.[1] ?? defaultYy);
  const [month, setMonth] = useState(saved?.[2] ?? "");
  const [dayChoice, setDayChoice] = useState(saved?.[3] ?? "");
  /**
   * Har anvandaren sjalv tagit i aret?
   *
   * Aret bar inte langre pa nagon information om huruvida faltet ar pabörjat --
   * det star ifyllt fran forsta sekunden. Utan den har flaggan skulle ett
   * orort formular se halvt ifyllt ut ("aret ar satt, manaden saknas") och
   * blockera submit pa ett frivilligt falt. Ett sparat datum raknas som taget:
   * det ar ett fattat beslut, inte ett forslag.
   */
  const [yearChosen, setYearChosen] = useState(saved !== null);

  const dd = useDropdown<"year" | "month" | "day">();
  // Bararen av valideringen. Ett <input type="hidden"> valideras aldrig och en
  // <button> inte heller, sa meddelandet hanger pa en genomskinlig <select>
  // ovanpa arsknappen -- samma grepp som Dropdown.tsx och Pass Tider anvander.
  const yearRef = useRef<HTMLSelectElement>(null);

  const todayMonth = pad(today.getMonth() + 1);
  const todayDay = pad(today.getDate());

  const year = `20${yy}`;

  /**
   * Raderna i hjulet. Det valda aret laggs till om det ligger utanfor spannet,
   * sa att ett arvt datum fran 2009 inte tyst flyttar sig till 2016 nar hjulet
   * oppnas.
   */
  const years = [
    ...new Set([
      ...Array.from(
        { length: AR_BAKAT + AR_FRAMAT + 1 },
        (_, i) => currentYear - AR_BAKAT + i
      ),
      Number(year),
    ]),
  ]
    .filter((y) => y >= 2000 && y <= 2099)
    .sort((a, b) => a - b)
    .map(String);

  // Månaden kalendern står uppslagen på. Fältet får vara halvt ifyllt, och
  // innan månaden är vald är den månad användaren befinner sig i det enda
  // rimliga uppslaget: rutnätet ska finnas där direkt, inte visa sig först när
  // datumet redan är känt. Året behöver ingen sådan gissning längre — det står
  // alltid för sig självt.
  const gridYear = Number(year);
  const gridMonth = month ? Number(month) : today.getMonth() + 1;

  // Punkten är en genväg till dagens datum och ska synas när rutnätet faktiskt
  // visar den månad vi är i — vare sig den står där för att användaren valt
  // den eller för att fältet ännu är tomt.
  const inCurrentYear = gridYear === currentYear;
  const inCurrentMonth = inCurrentYear && gridMonth === today.getMonth() + 1;

  // Räknat på samma månad som rutnätet ritar, så att det som går att trycka på
  // och det som får ligga kvar i fältet aldrig kan säga olika saker.
  const maxDay = daysInMonth(gridYear, gridMonth);
  // Den valda dagen ligger kvar i state aven nar manaden tillfalligt saknar
  // den, sa att en 31:a kommer tillbaka om man gar Jan -> Feb -> Jan.
  const day = dayChoice && Number(dayChoice) <= maxDay ? dayChoice : "";

  const missing = [!month ? "månad" : null, !day ? "dag" : null].filter(
    (part): part is string => part !== null
  );
  const complete = missing.length === 0;
  // Orort, inte tomt: aret gar inte att tomma, sa det ar de tva andra plus
  // "har ingen rort hjulet" som avgor om faltet ska lamnas utanfor helt.
  const untouched = !month && !day && !yearChosen;
  // Bara delvis ifyllt: sag vad som fattas. Ingen text under faltet -- "Månad"
  // och "Dag" visar redan vad som ska fyllas i. Meddelandet kommer i
  // webblasarens bubbla, och bara nar man faktiskt forsoker spara.
  const problem =
    complete || untouched ? null : `Startdatumet behöver också ${joinParts(missing)}.`;

  // Veckodagen kräver hela datumet — året avgör den lika mycket som dagen gör.
  const isoDay = complete ? `${year}-${month}-${day}` : null;

  useEffect(() => {
    yearRef.current?.setCustomValidity(problem ?? "");
  }, [problem]);

  /** Tillbaka till orort: aret till sitt forslag, manad och dag tomma. */
  function clear() {
    setYy(saved?.[1] ?? defaultYy);
    setMonth("");
    setDayChoice("");
    setYearChosen(false);
    dd.setOpen(null);
  }

  return (
    <div>
      <FieldLabel>Project Start</FieldLabel>

      <input
        type="hidden"
        name="start_date"
        value={complete ? `${year}-${month}-${day}` : ""}
      />

      <div className="relative" onKeyDown={dd.onRootKeyDown}>
        {/* `flex-wrap` plus a floor on the month is the safety net for very
            narrow screens. The month is the only one of the three that holds a
            word rather than a number, so it is the only one that can run out of
            room — and as `flex-1` it is also the one flexbox shrinks first,
            which is exactly backwards. The floor stops it shrinking past its
            own text; the wrap then drops the day onto a second line instead of
            clipping "Månad" to "M…". At 360px and up the row never wraps. */}
        <div className="flex flex-wrap items-end gap-1.5">
          {/* Hela rutan ar knappen, sekelsiffrorna inkluderade. Den gamla
              rutan delade sig i ett tryckt "20" och tva skrivbara siffror, och
              det var tva olika saker att sikta pa i samma ruta; nu ar det en. */}
          <div className="relative w-[5.75rem] shrink-0">
            <select
              ref={yearRef}
              value={yy}
              onChange={(event) => setYy(event.target.value)}
              aria-hidden="true"
              tabIndex={-1}
              className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
            >
              {years.map((y) => (
                <option key={y} value={y.slice(2)}>
                  {y}
                </option>
              ))}
            </select>

            <button
              ref={dd.registerTrigger("year")}
              type="button"
              aria-haspopup="listbox"
              aria-expanded={dd.open === "year"}
              aria-label="Startår"
              onClick={() => dd.toggle("year")}
              {...dropdownTrigger(dd.open === "year", true, "w-full")}
            >
              <span className="truncate tabular-nums">{year}</span>
              <Chevron open={dd.open === "year"} />
            </button>
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

          {/* Samma veckodagsrad som på Pass Datum — se DateSelect.tsx.
              Skillnaden är att det här fältet får vara halvt ifyllt, och en
              veckodag går inte att skriva ut ur ett halvt datum. Raden töms då
              i stället för att försvinna: en rad som kommer och går skulle
              flytta hela datumraden ett snäpp varje gång dagen fylldes i. */}
          <div className="flex w-[5rem] shrink-0 flex-col">
            <span
              aria-hidden="true"
              className="mb-1 block text-center text-[10px] font-bold uppercase tracking-wider text-white/45"
            >
              {isoDay ? weekdayShortSv(isoDay) : " "}
            </span>
            <button
              ref={dd.registerTrigger("day")}
              type="button"
              aria-haspopup="listbox"
              aria-expanded={dd.open === "day"}
              aria-label={isoDay ? `Startdag, ${weekdayNameSv(isoDay)}` : "Startdag"}
              onClick={() => dd.toggle("day")}
              {...dropdownTrigger(dd.open === "day", day !== "", "w-full")}
            >
              <span className="truncate tabular-nums">{day ? Number(day) : "Dag"}</span>
              <Chevron open={dd.open === "day"} />
            </button>
          </div>
        </div>

        {/* Vagen tillbaka till orort. Ett hjul kan bara rullas till ett annat
            ar, aldrig till inget, sa utan den har knappen vore "frivilligt"
            sant bara fram till forsta gangen nagon rakat oppna arspanelen.
            Samma losning som "Rensa tiderna" pa Pass Tider, av samma skal. */}
        {!untouched && (
          <div className="mt-1.5 flex justify-end">
            <Button type="button" variant="ghost" size="md" onClick={clear}>
              Rensa datumet
            </Button>
          </div>
        )}

        {dd.open === "year" && (
          <DropdownPanel
            label="Välj år"
            columns={1}
            /* Hjulet ar sjalvt en listbox -- en lista far inte innehalla en
               lista, sa panelen ar bara en grupp har. Samma sak som i Pass
               Tider. */
            role="group"
            panelRef={dd.panelRef}
          >
            <div className="relative">
              <WheelPlate />
              <div className="relative mx-auto flex max-w-60 items-center">
                <Wheel
                  label="År"
                  values={years}
                  initialValue={year}
                  autoFocus
                  onChange={(picked) => {
                    setYy(picked.slice(2));
                    setYearChosen(true);
                  }}
                />
              </div>
              {/* "Klar" tar det som ligger i plattan, även om hjulet aldrig
                  rörts: den som öppnar fältet, ser 2026 och trycker Klar har
                  valt 2026. */}
              <button
                type="button"
                onClick={() => {
                  setYearChosen(true);
                  dd.close(true);
                }}
                className={buttonClass("primary", "md", "mt-2 w-full")}
              >
                Klar
              </button>
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
          <DayPanel
            panelRef={dd.panelRef}
            year={gridYear}
            month={gridMonth}
            maxDay={maxDay}
            value={day}
            today={inCurrentMonth ? todayDay : null}
            onSelect={(value) => {
              setDayChoice(value);
              dd.close(true);
            }}
          />
        )}
      </div>
    </div>
  );
}
