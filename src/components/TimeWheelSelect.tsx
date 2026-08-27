"use client";

import { useRef, useState } from "react";
import { Button, buttonClass } from "@/components/Button";
import {
  Chevron,
  DropdownPanel,
  dropdownTrigger,
  useDropdown,
} from "@/components/Dropdown";
import { Wheel, WheelPlate } from "@/components/Wheel";
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

const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));

/**
 * Fem minuter i taget. Ett pass börjar inte 07:23, och tolv rader rullas fram
 * med tummen medan sextio måste letas igenom.
 */
const MINUTE_STEP = 5;
const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => pad(i * MINUTE_STEP));

/** 'HH:MM' isär, med förslaget som utgångsläge när fältet är tomt. */
function splitTime(value: string, fallback: string) {
  const source = /^\d{2}:\d{2}/.test(value) ? value : fallback;
  return { hour: source.slice(0, 2), minute: source.slice(3, 5) };
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
      <WheelPlate />
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
