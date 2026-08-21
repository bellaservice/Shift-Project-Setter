"use client";

import { useState } from "react";
import { FIELD_BOX, FieldHint, FieldLabel } from "@/components/Field";
import { TimeRangeSelect } from "@/components/TimeWheelSelect";
import { formatHoursSv, passSpanHours } from "@/lib/format";

/**
 * Passets längd, i den ordning man minns den.
 *
 * Fältet hade tidigare två lägen — "Pass Tider" eller "Pass Timmar" — och en
 * skena högst upp för att välja mellan dem. Läget avgjorde vilket av de två
 * fälten som betydde något, och i tidsläget var timmarna inte ett fält alls
 * utan en uträkning som varken gick att röra eller att avvika från. Det höll
 * inte: ett pass med obetald rast är kortare än sitt spann, och det är det
 * normala fallet och inte undantaget. Skenan är därför borta, och de två
 * fälten säger numera två olika saker som båda är sanna samtidigt:
 *
 *   Pass Tider   när man var på plats. Frivilligt — Arbetsdagbokens kolumn,
 *                och ingenting annat i appen räknar på den.
 *   Pass Timmar  hur mycket som ska betalas. Obligatoriskt. Det här är den
 *                siffra som sparas i shifts.hours och som varje timsumma i
 *                appen — Hem, Alla Project, "Ordinarie tid" — bygger på.
 *
 * Kopplingen dem emellan är ett förslag och inte en regel: väljer man båda
 * tiderna skrivs spannet in i Pass Timmar, färdigt att godta eller att ändra.
 * Det överlever att tiderna rensas bort igen, vilket är hela poängen med att
 * det är ett värde i ett fält och inte en uträkning — den som tar 07:00–16:00
 * för att få fram nio och sedan ångrar tiderna har fortfarande sina nio timmar.
 */

/**
 * Passets längd som ett block: klockslagen och timmarna hör ihop och läses av
 * både formuläret och arbetarraderna. Tillståndet ligger i en hook för att
 * `echoHours` ska nå <WorkerRows> längre ner i formuläret.
 */
export function usePassFields(initial?: {
  hours?: string;
  start?: string;
  end?: string;
}) {
  const [start, setStart] = useState(initial?.start ?? "");
  const [end, setEnd] = useState(initial?.end ?? "");
  const [hours, setHours] = useState(initial?.hours ?? "");

  const span = passSpanHours(start, end);

  /**
   * Spannet skrivs in i timfältet så fort båda tiderna finns.
   *
   * Det skriver över en siffra som redan står där, och det är avsiktligt: den
   * som går tillbaka och ändrar ett klockslag ändrar det för att passet var ett
   * annat, och då är det gamla talet det inaktuella av de två. Vill man ha
   * något annat än spannet är fältet ett fält — det skrivs efter tiderna, inte
   * före.
   */
  function syncHours(nextStart: string, nextEnd: string) {
    const next = passSpanHours(nextStart, nextEnd);
    if (next !== null) setHours(String(next));
  }

  function changeStart(value: string) {
    setStart(value);
    syncHours(value, end);
  }

  function changeEnd(value: string) {
    setEnd(value);
    syncHours(start, value);
  }

  /** Tillbaka till ett pass utan Pass Tider. Timmarna rörs INTE: står det nio
   *  där för att spannet var nio, så är passet fortfarande nio timmar långt. */
  function clearTimes() {
    setStart("");
    setEnd("");
  }

  const typed = Number(hours);
  const typedIsUsable = hours.trim() !== "" && Number.isFinite(typed) && typed > 0;

  return {
    hours,
    setHours,
    start,
    end,
    changeStart,
    changeEnd,
    clearTimes,
    span,
    /** Timmarna att eka bredvid varje vald arbetare — alla på passet får samma
     *  siffra. Null tills den är ett användbart tal. */
    echoHours: typedIsUsable ? formatHoursSv(typed) : null,
  };
}

export function PassFields({
  hours,
  setHours,
  start,
  end,
  changeStart,
  changeEnd,
  clearTimes,
  span,
}: ReturnType<typeof usePassFields>) {
  const typed = Number(hours);
  const typedIsUsable = hours.trim() !== "" && Number.isFinite(typed) && typed > 0;
  // Timmarna avviker från spannet. Inte ett fel — en obetald rast ser precis så
  // ut — men det ska stå vad man avvikit från, annars är siffran i fältet det
  // enda beviset på att man menade det.
  const differs =
    span !== null && typedIsUsable && Math.abs(span - typed) > 0.01;
  // Samma klockslag två gånger. Spannet blir noll timmar och går därför inte att
  // föreslå, så fältet lämnas i fred och raden nedan säger varför.
  const sameTime = start !== "" && end !== "" && span === null;

  return (
    <div className="flex flex-col gap-4">
      {/* Pass Tider först och Pass Timmar under: tiderna är det man har i huvudet
          när man kommer från jobbet, och timmarna faller ur dem av sig själva.
          Ordningen är också vad som gör förslaget begripligt — siffran dyker upp
          i fältet under det man just fyllt i, inte i ett fält längre upp. */}
      <div>
        <FieldLabel>Pass Tider</FieldLabel>
        <TimeRangeSelect
          onClear={clearTimes}
          start={{
            name: "start_time",
            label: "Pass start",
            value: start,
            fallback: "07:00",
            onChange: changeStart,
          }}
          end={{
            name: "end_time",
            label: "Pass slut",
            value: end,
            fallback: "16:00",
            onChange: changeEnd,
          }}
        />
      </div>

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
        {/* Kvittot på vad spannet var, och bara när det tillför något: när
            timmarna är just spannet står siffran redan i fältet och en rad som
            upprepar den är brus. Är de olika är den här raden det enda som visar
            vad man ändrade ifrån. */}
        {sameTime ? (
          <FieldHint tone="warn">
            Pass start och Pass slut är samma tid, så det finns inget spann att
            räkna ur. Skriv in timmarna själv.
          </FieldHint>
        ) : differs ? (
          <FieldHint tone="warn">Pass Tider är {formatHoursSv(span)} h.</FieldHint>
        ) : (
          <FieldHint>
            Timmarna som betalas, och som varje timsumma i appen räknar med.
          </FieldHint>
        )}
      </label>
    </div>
  );
}
