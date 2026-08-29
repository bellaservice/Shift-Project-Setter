"use client";

import { useRef, useState } from "react";
import {
  WEEKDAY_LONG,
  WEEKDAY_MINI,
  daysInMonth,
  formatMonthYearSv,
  pad,
  stockholmToday,
  weekdayIndex,
} from "@/lib/format";

/**
 * Manadsrutnatet man MALAR i: dra over dagarna for att valja dem, dra over
 * valda dagar for att ta bort dem igen.
 *
 * <DayPanel> gor nastan samma bild men svarar pa en annan fraga — den valjer
 * ETT datum, och gor det med ett tryck. Har ar svaret en mangd dagar, och det
 * som skiljer ar inte utseendet utan gesten. Att gora DayPanel
 * flervalsdugligt hade gjort en enkel komponent till en med lagen.
 *
 * Gesten
 * ------
 * Vid nedtryck avgors LAGET av dagen man startade pa: startade man pa en ovald
 * dag valjer dragningen, startade man pa en vald tar den bort. Det ar samma
 * regel som en penna i ett ritprogram och den ar vard att halla, for den gor
 * "jag ville inte ha de dar tre" till en rorelse i stallet for tre tryck.
 *
 * Fingret spåras med `elementFromPoint` och inte med `pointerenter`. Skalet ar
 * att en touch-pekare fangas av elementet den startade pa, sa granndagarna
 * aldrig far nagot enter-event — rutnatet skulle svara pa mus men inte pa
 * tumme, vilket ar precis fel halva att fa rätt i den har appen.
 *
 * `touch-action: none` pa rutnatet: utan den tolkar webblasaren dragningen som
 * en scroll och sidan glider i vag under fingret.
 */

/** 'YYYY-MM-DD' for en dag i den visade manaden. */
function datum(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function ManadsVal({
  valda,
  onValda,
}: {
  /** Valda dagar som 'YYYY-MM-DD'. Ordningen spelar ingen roll. */
  valda: Set<string>;
  onValda: (nasta: Set<string>) => void;
}) {
  const idag = stockholmToday();
  const [ar, setAr] = useState(() => Number(idag.slice(0, 4)));
  const [manad, setManad] = useState(() => Number(idag.slice(5, 7)));

  // Laget for den pagaende dragningen. `null` = ingen dragning pagar.
  const drag = useRef<"valj" | "avvalj" | null>(null);

  const maxDag = daysInMonth(ar, manad);
  const lead = weekdayIndex(datum(ar, manad, 1));
  const rader = Math.ceil((lead + maxDag) / 7);
  const trail = rader * 7 - lead - maxDag;

  function applicera(dag: string) {
    if (drag.current === null) return;
    const har = valda.has(dag);
    if (drag.current === "valj" && har) return;
    if (drag.current === "avvalj" && !har) return;

    const nasta = new Set(valda);
    if (drag.current === "valj") nasta.add(dag);
    else nasta.delete(dag);
    onValda(nasta);
  }

  /** Dagen under pekaren, eller null om den ar utanfor rutnatet. */
  function dagUnder(e: React.PointerEvent): string | null {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    return el?.closest<HTMLElement>("[data-dag]")?.dataset.dag ?? null;
  }

  function borja(e: React.PointerEvent) {
    const dag = dagUnder(e);
    if (!dag) return;
    drag.current = valda.has(dag) ? "avvalj" : "valj";
    applicera(dag);
  }

  function bytManad(steg: number) {
    // Dragningen avbryts nar manaden byts: ett finger som halls nere over en
    // pil ska inte fortsatta mala i nasta manad.
    drag.current = null;
    const m = manad + steg;
    if (m < 1) {
      setAr(ar - 1);
      setManad(12);
    } else if (m > 12) {
      setAr(ar + 1);
      setManad(1);
    } else {
      setManad(m);
    }
  }

  return (
    <div className="select-none">
      {/* Manadsraden. Pilarna ar 44px trots att de ritar en liten symbol. */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Foregaende manad"
          onClick={() => bytManad(-1)}
          className="glass flex h-11 w-11 items-center justify-center rounded-full text-xl font-bold text-white active:bg-white/20"
        >
          ‹
        </button>
        <p className="text-base font-extrabold tracking-tight text-white">
          {formatMonthYearSv(datum(ar, manad, 1))}
        </p>
        <button
          type="button"
          aria-label="Nasta manad"
          onClick={() => bytManad(1)}
          className="glass flex h-11 w-11 items-center justify-center rounded-full text-xl font-bold text-white active:bg-white/20"
        >
          ›
        </button>
      </div>

      {/* Veckodagsrubrikerna. aria-hidden: varje dag bar sin veckodag i sin
          egen etikett, sa den som lyssnar far den dar den behovs. */}
      <div
        aria-hidden
        className="mb-1 grid grid-cols-7 text-center text-[11px] font-bold uppercase tracking-widest text-white/45"
      >
        {WEEKDAY_MINI.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>

      <div
        role="group"
        aria-label="Valj dagar"
        className="grid touch-none grid-cols-7 gap-1"
        onPointerDown={borja}
        onPointerMove={(e) => {
          if (drag.current === null) return;
          const dag = dagUnder(e);
          if (dag) applicera(dag);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        {/* Foregaende manads sista dagar, som utfyllnad. Inte valbara: den som
            vill lagga ett pass i forra manaden byter manad. */}
        {Array.from({ length: lead }).map((_, i) => (
          <span key={`f${i}`} aria-hidden className="min-h-11" />
        ))}

        {Array.from({ length: maxDag }).map((_, i) => {
          const d = i + 1;
          const dag = datum(ar, manad, d);
          const vald = valda.has(dag);
          const arIdag = dag === idag;
          return (
            <button
              key={dag}
              type="button"
              data-dag={dag}
              role="checkbox"
              aria-checked={vald}
              aria-label={`${d} ${WEEKDAY_LONG[(lead + d - 1) % 7]}`}
              className="flex min-h-11 items-center justify-center rounded-xl outline-none"
            >
              <span
                className={`flex aspect-square w-full max-w-11 items-center justify-center rounded-xl text-[15px] tabular-nums transition-colors duration-150 ease-out motion-reduce:transition-none ${
                  vald
                    ? "bg-night-accent font-extrabold text-black"
                    : arIdag
                      ? "bg-white/10 font-bold text-white ring-1 ring-inset ring-night-accent/50"
                      : "text-white/80"
                }`}
              >
                {d}
              </span>
            </button>
          );
        })}

        {Array.from({ length: trail }).map((_, i) => (
          <span key={`e${i}`} aria-hidden className="min-h-11" />
        ))}
      </div>
    </div>
  );
}
