"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button, buttonClass } from "@/components/Button";
import {
  Chevron,
  DropdownPanel,
  dropdownTrigger,
  useDropdown,
} from "@/components/Dropdown";
import { pad } from "@/lib/format";

/**
 * "Pass Tider" som två hjul i stället för <input type="time">.
 *
 * Webbläsarens egen tidsruta lägger sig där den vill — oftast uppåt, eftersom
 * fältet ligger högt upp i ett kort formulär — och går varken att forma eller
 * att göra fingervänlig. Samma skäl som gav appen sina egna dropdowns gäller
 * här, så panelen öppnar under fältet precis som de andra.
 *
 * Timme och minut rullas fram var för sig, och det som ligger i plattan mitt i
 * panelen är det valda. Hjulet snäpper (scroll-snap), så en rad kan aldrig bli
 * stående halvvägs — värdet läses ur rullningen när den lagt sig.
 */

/** Radhöjd och antal synliga rader. Allt annat i hjulet mäts ur dessa två. */
const ROW = 40;
const VISIBLE = 5;
/** Tomrum över och under listan, så att första och sista raden når mitten. */
const EDGE = ((VISIBLE - 1) / 2) * ROW;

const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));

/**
 * Fem minuter i taget. Ett pass börjar inte 07:23, och tolv rader rullas fram
 * med tummen medan sextio måste letas igenom.
 */
const MINUTE_STEP = 5;
const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => pad(i * MINUTE_STEP));

function clamp(index: number, length: number) {
  return Math.min(Math.max(index, 0), length - 1);
}

/**
 * Var i hjulet ett värde ligger. En minut utanför stegen — t.ex. 07:23 från en
 * rad som sparats någon annanstans ifrån — landar på närmaste rad i stället för
 * att tappas.
 */
function indexOf(values: string[], value: string) {
  const exact = values.indexOf(value);
  if (exact >= 0) return exact;

  const target = Number(value);
  if (!Number.isFinite(target)) return 0;
  let best = 0;
  values.forEach((v, i) => {
    if (Math.abs(Number(v) - target) < Math.abs(Number(values[best]) - target)) best = i;
  });
  return best;
}

/** 'HH:MM' isär, med förslaget som utgångsläge när fältet är tomt. */
function splitTime(value: string, fallback: string) {
  const source = /^\d{2}:\d{2}/.test(value) ? value : fallback;
  return { hour: source.slice(0, 2), minute: source.slice(3, 5) };
}

/**
 * En kolumn i hjulet.
 *
 * Rullningen är styrande: fingret, mushjulet och piltangenterna ändrar samma
 * sak, och värdet läses tillbaka först när rullningen stannat. Därför ställs
 * kolumnen bara en gång — vid öppning — annars skulle den rycka tillbaka mitt i
 * en rörelse.
 */
function Wheel({
  label,
  values,
  initialValue,
  autoFocus = false,
  onChange,
}: {
  label: string;
  values: string[];
  /** Bara utgångsläget: därefter är det rullningen som säger vad som är valt. */
  initialValue: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | null>(null);
  /**
   * Öppningen ställer hjulet på förslaget genom att rulla dit. Utan den här
   * flaggan skulle den rullningen se ut som ett val, och ett tomt fält vore
   * ifyllt av att man tittat på det.
   */
  const touched = useRef(false);
  const optionId = useId();
  const [active, setActive] = useState(() => indexOf(values, initialValue));

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = indexOf(values, initialValue) * ROW;
    if (autoFocus) list.focus({ preventScroll: true });
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
    // Enbart vid öppning: efter det är det hjulet som bär värdet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commit(index: number) {
    touched.current = true;
    setActive(index);
    onChange(values[index]);
  }

  function scrollTo(index: number, behavior: ScrollBehavior) {
    listRef.current?.scrollTo({ top: index * ROW, behavior });
  }

  /**
   * Ett hjul har inget "släpp": fingret lämnar skärmen långt innan rullningen
   * tagit slut. Värdet läses därför en stund efter den sista rörelsen, när
   * snäppet redan lagt raden mitt i plattan.
   */
  function onScroll() {
    const list = listRef.current;
    if (!list) return;
    const index = clamp(Math.round(list.scrollTop / ROW), values.length);
    setActive((prev) => (prev === index ? prev : index));

    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      if (!touched.current || !listRef.current) return;
      const settled = clamp(Math.round(listRef.current.scrollTop / ROW), values.length);
      onChange(values[settled]);
    }, 90);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    let next: number;
    if (event.key === "ArrowDown") next = active + 1;
    else if (event.key === "ArrowUp") next = active - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = values.length - 1;
    else {
      // PageUp/PageDown rullar kolumnen på egen hand — då är det ett val ändå.
      touched.current = true;
      return;
    }

    event.preventDefault();
    const index = clamp(next, values.length);
    commit(index);
    scrollTo(index, "smooth");
  }

  return (
    <div
      ref={listRef}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-activedescendant={`${optionId}-${active}`}
      onScroll={onScroll}
      onPointerDown={() => (touched.current = true)}
      onWheel={() => (touched.current = true)}
      onKeyDown={onKeyDown}
      style={{ height: VISIBLE * ROW, paddingBlock: EDGE }}
      className="min-w-0 flex-1 snap-y snap-mandatory overflow-y-scroll overscroll-contain rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-night-accent/40 [-webkit-mask-image:linear-gradient(to_bottom,transparent,black_28%,black_72%,transparent)] [mask-image:linear-gradient(to_bottom,transparent,black_28%,black_72%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {values.map((v, i) => {
        // Raderna tonar och krymper med avståndet till plattan, så att mitten
        // syns som mitten även när hjulet står stilla.
        const distance = Math.abs(i - active);
        // Mitten ar vit som de ovriga raderna, inte accentfargad: markeringen
        // bars av storleken, vikten och plattan bakom — och eftersom fargen
        // darmed inte ar ensam barare av "vald" fungerar hjulet lika bra for
        // den som inte skiljer amber fran vitt. Raderna darifran tonar ut i
        // vitt — en gradvis nedtoning som pa svart gor samma jobb som
        // gratonerna gjorde pa vitt.
        const look =
          distance === 0
            ? "text-xl font-bold text-white"
            : distance === 1
              ? "text-lg text-white/75"
              : distance === 2
                ? "text-base text-white/45"
                : "text-sm text-white/25";
        return (
          <div
            key={v}
            id={`${optionId}-${i}`}
            role="option"
            aria-selected={i === active}
            onClick={() => {
              commit(i);
              scrollTo(i, "smooth");
            }}
            style={{ height: ROW }}
            className={`flex cursor-pointer snap-center items-center justify-center tabular-nums ${look}`}
          >
            {v}
          </div>
        );
      })}
    </div>
  );
}

/** Timme och minut sida vid sida, med plattan bakom båda. */
function TimeWheels({
  value,
  fallback,
  onChange,
  onDone,
}: {
  value: string;
  fallback: string;
  onChange: (value: string) => void;
  onDone: () => void;
}) {
  // Utgångsläget läses en gång, och de två halvorna hålls därefter i en ref.
  // Ett värde sätts ihop av båda, och två hjul som stannar samtidigt hinner
  // annars läsa varandras gamla halva: minuten skulle skriva tillbaka timmen
  // som gällde innan den rullades.
  const [initial] = useState(() => splitTime(value, fallback));
  const pair = useRef(initial);

  function commit(part: Partial<{ hour: string; minute: string }>) {
    pair.current = { ...pair.current, ...part };
    onChange(`${pair.current.hour}:${pair.current.minute}`);
  }

  return (
    <div className="relative">
      {/* Plattan ligger under kolumnerna: den ska inte tona bort med raderna. */}
      <div
        aria-hidden="true"
        style={{ top: EDGE, height: ROW }}
        className="pointer-events-none absolute inset-x-1 rounded-xl border-y border-white/15 bg-white/10"
      />
      {/* Smalare an plattan: timmen och minuten ska hanga ihop kring kolonet
          i stallet for att dras ut mot var sin kant. */}
      <div className="relative mx-auto flex max-w-60 items-center">
        <Wheel
          label="Timme"
          values={HOURS}
          initialValue={initial.hour}
          autoFocus
          onChange={(hour) => commit({ hour })}
        />
        <span aria-hidden="true" className="px-1 text-lg font-bold text-white/40">
          :
        </span>
        <Wheel
          label="Minut"
          values={MINUTES}
          initialValue={initial.minute}
          onChange={(minute) => commit({ minute })}
        />
      </div>

      {/* "Klar" tar det som ligger i plattan, även om hjulet aldrig rörts: den
          som öppnar fältet, ser 07:00 och trycker Klar har valt 07:00. */}
      <button
        type="button"
        onClick={() => {
          commit({});
          onDone();
        }}
        className={buttonClass("primary", "md", "mt-2 w-full")}
      >
        Klar
      </button>
    </div>
  );
}

export type TimeWheelField = {
  name: string;
  label: string;
  value: string;
  /** Var hjulet står när fältet är tomt. Ett förslag, inte ett ifyllt värde. */
  fallback: string;
  onChange: (value: string) => void;
};

/**
 * Två tidsfält på en rad — start och slut — som delar panelyta. Bara ett hjul
 * åt gången är framme, precis som i datumfältet.
 *
 * Värdet bärs fortfarande av ett riktigt formulärfält: en genomskinlig <select>
 * ligger över knappen, så att `required`, formData och webbläsarens felbubbla
 * fungerar precis som med <input type="time">.
 *
 * `required` är numera ett val och inte längre inbyggt. Pass Tider är frivilliga
 * i Logga Timmar — det är Pass Timmar som bär passets längd — så fältet måste
 * kunna lämnas tomt utan att webbläsaren stoppar formuläret.
 *
 * `onClear` är följdfrågan till det: ett hjul kan bara rullas till ett annat
 * klockslag, aldrig tillbaka till inget. Utan en väg ut vore "frivilligt" sant
 * bara fram till första gången man råkat öppna panelen, och ett pass skulle bära
 * ett spann ingen valt. Knappen visas bara när det finns något att rensa.
 */
export function TimeRangeSelect({
  start,
  end,
  required = false,
  onClear,
}: {
  start: TimeWheelField;
  end: TimeWheelField;
  /** Spärra submit tills båda tiderna är valda. Av som standard. */
  required?: boolean;
  /** Vägen tillbaka till tomt. Utelämnas den går fältet inte att rensa. */
  onClear?: () => void;
}) {
  const dd = useDropdown<"start" | "end">();
  const fields: Array<["start" | "end", TimeWheelField]> = [
    ["start", start],
    ["end", end],
  ];
  const open = fields.find(([key]) => key === dd.open);

  return (
    <div className="relative" onKeyDown={dd.onRootKeyDown}>
      <div className="flex items-center gap-2">
        {fields.map(([key, field], i) => (
          <div key={key} className="contents">
            {i > 0 && <span className="text-base text-white/40">–</span>}
            <div className="relative min-w-0 flex-1">
              <select
                name={field.name}
                required={required}
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
                aria-hidden="true"
                tabIndex={-1}
                className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
              >
                <option value="" />
                {field.value !== "" && <option value={field.value}>{field.value}</option>}
              </select>

              <button
                ref={dd.registerTrigger(key)}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={dd.open === key}
                aria-label={field.label}
                onClick={() => dd.toggle(key)}
                {...dropdownTrigger(dd.open === key, field.value !== "", "w-full")}
              >
                <span className="truncate tabular-nums">{field.value || "--:--"}</span>
                <Chevron open={dd.open === key} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Under raden och högerställd: den hör till båda fälten, inte till ettdera,
          och den ska inte kunna förväxlas med ett tredje klockslag att välja.
          En riktig ghost-knapp och inte en understruken rad text — 44px är
          golvet också för det man ångrar. */}
      {onClear && (start.value !== "" || end.value !== "") && (
        <div className="mt-1.5 flex justify-end">
          <Button type="button" variant="ghost" size="md" onClick={onClear}>
            Rensa tiderna
          </Button>
        </div>
      )}

      {open && (
        <DropdownPanel
          label={open[1].label}
          columns={1}
          role="group"
          panelRef={dd.panelRef}
        >
          <TimeWheels
            // Hjulen byggs om från grunden när man går från start till slut:
            // kolumnerna ställs vid öppning, och det gäller varje fält för sig.
            key={open[0]}
            value={open[1].value}
            fallback={open[1].fallback}
            onChange={open[1].onChange}
            onDone={() => dd.close(true)}
          />
        </DropdownPanel>
      )}
    </div>
  );
}
