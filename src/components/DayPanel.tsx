"use client";

import { DropdownPanel } from "@/components/Dropdown";
import {
  WEEKDAY_LONG,
  WEEKDAY_MINI,
  daysInMonth,
  pad,
  weekdayIndex,
} from "@/lib/format";

/**
 * Dagrutan som fälls ut ur Pass Datum och ur Project Start — en riktig
 * kalendermånad och inte sex kolumner löpande siffror.
 *
 * Sex kolumner var en tabell över *hur många* dagar månaden har. Det är sällan
 * frågan. Den som ska lägga ett pass vet oftast vilken veckodag det gäller och
 * letar efter datumet, och i en löpande sifferrad går det bara att räkna sig
 * fram till svaret. Här står den 24:e under må för att den 24:e *är* en måndag,
 * och kolumnen svarar innan man hunnit räkna.
 *
 * Dagarna före den 1:a och efter den sista är grannmånadernas, utgråade. De är
 * med för att raderna ska gå jämnt ut: en första rad som börjar mitt i veckan
 * med tomrum till vänster läses som om månaden saknade dagar, medan samma rad
 * med den 27:e–31:a i grått läses som den vecka den faktiskt är. De går inte
 * att trycka på — månaden byter man i månadsrutan bredvid, och en siffra som
 * tyst flyttade både månad och år vore ett svar på en fråga användaren inte
 * ställde.
 *
 * Rutnätet ligger här och inte i vart och ett av de två fälten, eftersom det är
 * det enda de har helt gemensamt — och en kalender som drev isär i två kopior
 * skulle förr eller senare lägga samma datum på två veckodagar.
 */
export function DayPanel({
  panelRef,
  year,
  month,
  maxDay,
  value,
  chosen = true,
  today,
  onSelect,
}: {
  panelRef: React.RefObject<HTMLDivElement | null>;
  /**
   * Året och månaden rutnätet ställs upp efter.
   *
   * Aldrig tomma. Project Start får vara halvt ifyllt, och tills år och månad
   * är valda står kalendern på den månad användaren befinner sig i — fältet
   * räknar fram den och skickar in den hit. En kalender som höll sig borta
   * tills datumet var ifyllt vore en kalender man bara får se när man redan
   * vet svaret.
   */
  year: number;
  month: number;
  /** Antal dagar i månaden. Ägs av fältet, som klipper sitt dagval mot samma tal. */
  maxDay: number;
  /** Vald dag, tvåsiffrig, eller '' när ingen är vald. */
  value: string;
  /**
   * Om den valda dagen ska bära accentringen. Pass Datum öppnar redan ifyllt
   * på dagens datum, och ett förslag markeras med punkten och inte med ringen
   * förrän användaren själv tryckt fram det.
   */
  chosen?: boolean;
  /** Dagens datum, tvåsiffrigt, när panelen visar den månad vi är i. */
  today: string | null;
  onSelect: (value: string) => void;
}) {
  const lead = weekdayIndex(`${year}-${pad(month)}-01`);
  // Föregående månads sista dagar fyller raden fram till den 1:a. Januari
  // hämtar dem ur december *förra året* — det är hela skälet till att det här
  // räknas och inte skrivs som `month - 1`.
  const prevMax = daysInMonth(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);
  // Så många hela veckor som månaden faktiskt spänner över, inte alltid sex:
  // en 28-dagarsfebruari som börjar på en måndag skulle annars få en sista rad
  // som bara innehöll grannmånaden.
  const rows = Math.ceil((lead + maxDay) / 7);
  const trail = rows * 7 - lead - maxDay;

  function day(d: number) {
    const dayValue = pad(d);
    const selected = value === dayValue;
    const plate = chosen && selected;
    return (
      <button
        key={dayValue}
        type="button"
        role="option"
        aria-selected={selected}
        // Veckodagen står i en kolumnrubrik som skärmläsaren aldrig kommer åt.
        // Utan den här etiketten vore panelen en rad lösa siffror för den som
        // lyssnar sig igenom den.
        aria-label={`${d} ${WEEKDAY_LONG[(lead + d - 1) % 7]}`}
        onClick={() => onSelect(dayValue)}
        /* min-h-11 på knappen och ringen som ett eget element inuti: 44px är
           golvet för en träffyta i den här appen, och en ring som var 44px bred
           skulle bli ett klot i en kolumn som bara är 38px. Träffytan är alltså
           hela rutan, medan ringen håller sin egen storlek. */
        className="group relative flex min-h-11 cursor-pointer items-center justify-center rounded-full outline-none"
      >
        {/* Hela rutan är träffytan, men det är ringen som svarar. Därför bärs
            hovring och fokus av knappens `group` och inte av spannet självt —
            annars tänds ringen först när pekaren råkar hitta just den. */}
        <span
          className={`flex aspect-square w-full max-w-9 items-center justify-center rounded-full text-[15px] tabular-nums ${
            plate
              ? "bg-white/20 font-bold text-white"
              : "text-white/85 group-hover:bg-white/12 group-focus-visible:bg-white/18 group-focus-visible:ring-1 group-focus-visible:ring-white/30"
          }`}
        >
          {d}
        </span>
        {today === dayValue && (
          <>
            {/* Punkten ligger absolut placerad: rutnätet ska se likadant ut med
                och utan den, så att raderna inte flyttar sig när månaden byts.
                På accentringen byter den till vitt för att inte försvinna. */}
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                plate ? "bg-white/70" : "bg-white/45"
              }`}
            />
            <span className="sr-only"> (i dag)</span>
          </>
        )}
      </button>
    );
  }

  return (
    /* columns={7} styr piltangenterna. Upp och Ner hoppar sju alternativ, och
       eftersom varje rad utom den första är full ligger dag N + 7 alltid i
       samma kolumn som dag N — pilen följer alltså kolumnen på skärmen, trots
       att grannmånadernas rutor inte är alternativ att räkna med. */
    <DropdownPanel label="Välj dag" columns={7} panelRef={panelRef}>
      {/* aria-hidden: veckodagen står redan i varje rutas egen etikett, och en
          uppläst rad med sju förkortningar före rutnätet hjälper ingen. */}
      <div aria-hidden className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAY_MINI.map((label) => (
          <div key={label} className="text-center text-xs font-semibold text-white/45">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {/* Grannmånadernas dagar: sedda, inte valbara, och aldrig upplästa. */}
        {Array.from({ length: lead }, (_, i) => (
          <Adjacent key={`f-${i}`} n={prevMax - lead + 1 + i} />
        ))}
        {Array.from({ length: maxDay }, (_, i) => day(i + 1))}
        {Array.from({ length: trail }, (_, i) => (
          <Adjacent key={`e-${i}`} n={i + 1} />
        ))}
      </div>
    </DropdownPanel>
  );
}

/** En dag ur månaden före eller efter — med för radens skull, inget annat. */
function Adjacent({ n }: { n: number }) {
  return (
    <div
      aria-hidden
      className="flex min-h-11 items-center justify-center text-[15px] tabular-nums text-white/20"
    >
      {n}
    </div>
  );
}
