"use client";

import { ChevronLeft, ChevronRight } from "@/components/Icons";
import { arendeFargHex } from "@/lib/arendeFarger";
import {
  WEEKDAY_SHORT,
  daysInMonth,
  formatMonthYearSv,
  pad,
  weekdayIndex,
} from "@/lib/format";
import type { CalendarDay } from "@/lib/types";

/**
 * Förnamnet ur ett fullständigt namn.
 *
 * En kalenderruta är omkring 56px bred på en telefon, och "Anna Andersson"
 * ryms inte. Förnamnet gör det oftast, och det är också vad man säger när man
 * pratar om vem som var där. Har två personer samma förnamn står de som två
 * rader med samma ord — dagens ark under rutnätet är där man reder ut vilka.
 */
function firstName(name: string): string {
  return name.split(" ")[0] || name;
}

/** Hur många namn en ruta skriver ut innan den byter till "+N". */
const MAX_NAMES = 2;

/** Hur många ärendeprickar en ruta ritar innan de slutar rymmas. */
const MAX_DOTS = 3;

/**
 * En månad som ett rutnät.
 *
 * Sju kolumner, måndag först, och en ruta per dag i månaden. Rutorna före den
 * första är tomma platshållare och inte förra månadens sista dagar: en gråtonad
 * 31:a i en ruta man ändå inte kan trycka på är en ruta man försöker trycka på.
 *
 * Vad en ruta säger, i den ordning ögat tar den:
 *
 *   siffran   dagens datum, alltid.
 *   namnen    vilka som jobbade den dagen, med förnamn. Det är frågan man
 *             faktiskt ställer till en kalender — "vem var på plats i tisdags" —
 *             och en timsiffra svarar inte på den. Summan finns kvar en nivå
 *             ner, i dagens ark, per arbetare och per project.
 *   prickarna ett bokat ärende var, i ärendets egen färg. Prickar och inte
 *             rubriker: en ruta som ska rymma namn har inte plats för två sorters
 *             text, och färgen är det som gör att man känner igen sitt eget möte
 *             utan att öppna dagen. Vad de betyder står i rutans `aria-label`.
 *
 * Dagens ruta bär accentens ring. Det är samma markering som RowLink använder
 * för ett pågående project — "det här är den som gäller nu" — och den är
 * medvetet inte den fyllda plattan: plattan sparas till den dag man själv
 * tryckt fram, precis som i datumfältens paneler.
 */
export function CalendarMonth({
  monthStart,
  days,
  today,
  selected,
  onPickDay,
  onChangeMonth,
}: {
  /** 'YYYY-MM-01' — månaden som ritas. */
  monthStart: string;
  /** Bara de dagar som har något på sig; resten ritas tomma. */
  days: CalendarDay[];
  /** 'YYYY-MM-DD' på svensk väggklocka. Bär ringen när den ligger i månaden. */
  today: string;
  /** Dagen vars ark är uppe, eller null. */
  selected: string | null;
  onPickDay: (date: string) => void;
  onChangeMonth: (delta: number) => void;
}) {
  const [year, month] = monthStart.split("-").map(Number);
  const total = daysInMonth(year, month);
  // Hur många tomma rutor månaden börjar med: den 1:as kolumn.
  const lead = weekdayIndex(monthStart);

  const byDate = new Map(days.map((d) => [d.date, d]));

  return (
    <section className="glass rounded-2xl p-3" aria-label={formatMonthYearSv(monthStart)}>
      {/* Månadsraden. Pilarna är 44px glascirklar, samma par som menyn och
          kuggen högst upp — allt som är "en knapp utan ord" i appen ser likadant
          ut. Namnet står i mitten och är sidans egentliga rubrik; <Screen> har
          redan sagt att det här är Kalendern. */}
      <header className="mb-3 flex items-center justify-between gap-2">
        <MonthArrow direction={-1} onClick={() => onChangeMonth(-1)} />
        <h2
          aria-live="polite"
          className="min-w-0 flex-1 truncate text-center text-base font-extrabold tracking-tight text-white"
        >
          {formatMonthYearSv(monthStart)}
        </h2>
        <MonthArrow direction={1} onClick={() => onChangeMonth(1)} />
      </header>

      {/* aria-hidden: veckodagen står redan i varje rutas egen etikett, och en
          uppläst rad med sju förkortningar före rutnätet hjälper ingen. */}
      <div aria-hidden className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAY_SHORT.map((label) => (
          <div
            key={label}
            className="text-center text-[10px] font-bold uppercase tracking-wider text-white/45"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <div key={`tom-${i}`} aria-hidden />
        ))}

        {Array.from({ length: total }, (_, i) => {
          const date = `${year}-${pad(month)}-${pad(i + 1)}`;
          return (
            <DayCell
              key={date}
              date={date}
              day={byDate.get(date)}
              isToday={date === today}
              isSelected={date === selected}
              onClick={() => onPickDay(date)}
            />
          );
        })}
      </div>
    </section>
  );
}

function MonthArrow({
  direction,
  onClick,
}: {
  direction: 1 | -1;
  onClick: () => void;
}) {
  const Glyph = direction === -1 ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={direction === -1 ? "Föregående månad" : "Nästa månad"}
      onClick={onClick}
      className="glass-flat flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/70 transition-colors duration-200 ease-out active:bg-white/20 motion-reduce:transition-none"
    >
      <Glyph className="h-4 w-4" />
    </button>
  );
}

/**
 * En dag.
 *
 * Alltid en knapp, även när dagen är tom: varje ruta leder någonstans — arket
 * med "Logga Timmar" och "Tillverka Ärende" — och en tom dag är den vanligaste
 * dagen att vilja boka något på.
 *
 * Etiketten skrivs ut i klartext för den som lyssnar: rutan kapar förnamn för
 * att den är 56px bred och säger sina ärenden med färgade prickar, och varken
 * kapningen eller prickarna finns i en uppläsning. Etiketten bär därför hela
 * namn och räknar ärendena med ord.
 */
function DayCell({
  date,
  day,
  isToday,
  isSelected,
  onClick,
}: {
  date: string;
  day: CalendarDay | undefined;
  isToday: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const dayNumber = Number(date.slice(8));
  const names = day?.workerNames ?? [];
  const farger = day?.arendeFarger ?? [];

  const shown = names.slice(0, MAX_NAMES);
  const extra = names.length - shown.length;

  const label = [
    `${dayNumber}`,
    // Hela namn för den som lyssnar, inte de avkortade förnamnen: rutan kapar
    // för att den är 56px bred, och en uppläsning har ingen sådan begränsning.
    names.length > 0 ? names.join(", ") : "ingen loggad arbetare",
    farger.length > 0
      ? `${farger.length} ${farger.length === 1 ? "bokat ärende" : "bokade ärenden"}`
      : null,
    isToday ? "i dag" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isSelected}
      onClick={onClick}
      /* min-h och inte h: rutan ska kunna växa när en dag har två namn på sig,
         hellre än att klippa det andra. 4rem är över 44px-golvet redan vid
         tomma dagar. */
      className={`relative flex min-h-16 cursor-pointer flex-col items-center justify-start gap-0.5 rounded-lg px-0.5 pb-1 pt-1.5 transition-colors duration-200 ease-out active:bg-white/20 motion-reduce:transition-none ${
        isSelected
          ? "bg-night-accent text-black"
          : names.length > 0
            ? "glass-flat"
            : "bg-white/[0.03]"
      } ${isToday && !isSelected ? "ring-1 ring-night-accent/60" : ""}`}
    >
      <span
        className={`text-[13px] font-bold tabular-nums leading-none ${
          isSelected ? "text-black" : isToday ? "text-night-accent" : "text-white"
        }`}
      >
        {dayNumber}
      </span>

      {/* `w-full` plus `truncate` på varje rad: ett långt förnamn ska kapas med
          ellips inuti sin ruta, inte tvinga rutnätets kolumn bredare och därmed
          skeva hela veckan. */}
      {shown.length > 0 && (
        <span aria-hidden className="w-full min-w-0">
          {shown.map((name) => (
            <span
              key={name}
              className={`block truncate text-[9px] font-bold leading-tight ${
                isSelected ? "text-black/80" : "text-night-accent"
              }`}
            >
              {firstName(name)}
            </span>
          ))}
          {extra > 0 && (
            <span
              className={`block truncate text-[9px] font-bold leading-tight ${
                isSelected ? "text-black/60" : "text-white/55"
              }`}
            >
              +{extra}
            </span>
          )}
        </span>
      )}

      {/* Prickarna sist och nedtryckta med `mt-auto`, så de står på samma rad i
          varje ruta oavsett hur många namn som ligger ovanför. Färgen är
          ärendets egen; på den valda gula plattan får de en svart ring så att en
          gul prick inte försvinner i underlaget. */}
      {farger.length > 0 && (
        <span aria-hidden className="mt-auto flex shrink-0 items-center gap-0.5 pt-0.5">
          {farger.slice(0, MAX_DOTS).map((farg, i) => (
            <span
              key={i}
              style={{ backgroundColor: arendeFargHex(farg) }}
              className={`h-1.5 w-1.5 rounded-full ${
                isSelected ? "ring-1 ring-black/40" : ""
              }`}
            />
          ))}
          {farger.length > MAX_DOTS && (
            <span
              className={`text-[8px] font-bold leading-none ${
                isSelected ? "text-black/60" : "text-white/55"
              }`}
            >
              +
            </span>
          )}
        </span>
      )}
    </button>
  );
}
