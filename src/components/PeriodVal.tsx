"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Pin } from "@/components/Icons";
import {
  WEEKDAY_MINI,
  daysInMonth,
  formatMonthYearSv,
  formatWeekdayDateSv,
  pad,
  weekdayIndex,
} from "@/lib/format";

/**
 * Ramen en Arbetsdagbok ska tacka: en strackа med en nal i var ande.
 *
 * Bilden ar en resa och inte tva falt. Tva datumrutor bredvid varandra sager
 * "fyll i tva varden"; en linje med en nal i borjan och en i slutet sager "har
 * borjar det, har slutar det, och det som ligger emellan foljer med" — vilket
 * ar precis vad dokumentet gor med dagarna. Att den ar lodrat och inte vagrat
 * ar for telefonen: en vagrat strackа med tva datum under sig blir trang vid
 * 390px, en lodrat far all bredd den behover for bada.
 *
 * Den understa nalen ar amber och den ovre ar dampad. Slutdatumet ar det som
 * flyttar sig varje gang ett nytt dokument skrivs ut — startdatumet foljer av
 * forra ramen — sa det ar den anden man faktiskt staller in.
 */

/** 'YYYY-MM-DD' for en dag i den visade manaden. */
function datum(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Manadsrutnatet som oppnas under en nal. Ett tryck, ett datum.
 *
 * Skilt fran <ManadsVal>, som MALAR en mangd dagar och sparrar allt som
 * passerat. Har galler bada delarna omvant: man valjer en enda dag, och den
 * ligger nastan alltid bakat i tiden — en Arbetsdagbok skrivs ut over arbete
 * som redan ar utfort.
 */
function ManadsRutnat({
  varde,
  onValj,
}: {
  varde: string;
  onValj: (dag: string) => void;
}) {
  const [ar, setAr] = useState(() => Number(varde.slice(0, 4)));
  const [manad, setManad] = useState(() => Number(varde.slice(5, 7)));

  const maxDag = daysInMonth(ar, manad);
  const lead = weekdayIndex(datum(ar, manad, 1));

  function bytManad(steg: number) {
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
    <div className="mt-2 rounded-xl bg-white/5 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Foregaende manad"
          onClick={() => bytManad(-1)}
          className="glass flex h-9 w-9 items-center justify-center rounded-full text-white active:bg-white/20"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-extrabold tracking-tight text-white">
          {formatMonthYearSv(datum(ar, manad, 1))}
        </p>
        <button
          type="button"
          aria-label="Nasta manad"
          onClick={() => bytManad(1)}
          className="glass flex h-9 w-9 items-center justify-center rounded-full text-white active:bg-white/20"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div
        aria-hidden
        className="mb-1 grid grid-cols-7 text-center text-[10px] font-bold uppercase tracking-widest text-white/40"
      >
        {WEEKDAY_MINI.map((d) => (
          <span key={d} className="py-0.5">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }).map((_, i) => (
          <span key={`f${i}`} aria-hidden className="min-h-9" />
        ))}
        {Array.from({ length: maxDag }).map((_, i) => {
          const d = i + 1;
          const dag = datum(ar, manad, d);
          const vald = dag === varde;
          return (
            <button
              key={dag}
              type="button"
              aria-pressed={vald}
              onClick={() => onValj(dag)}
              className={`flex min-h-9 items-center justify-center rounded-lg text-[13px] tabular-nums transition-colors duration-150 ease-out motion-reduce:transition-none ${
                vald
                  ? "bg-night-accent font-extrabold text-black"
                  : "text-white/75 active:bg-white/10"
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** En nal med sitt datum. */
function Ande({
  etikett,
  varde,
  accent,
  oppen,
  onOppna,
  onValj,
}: {
  etikett: string;
  varde: string;
  accent: boolean;
  oppen: boolean;
  onOppna: () => void;
  onValj: (dag: string) => void;
}) {
  return (
    <div className="relative pl-11">
      {/* Nalen sitter OVANPA linjen, med samma bakgrund som panelen bakom sig,
          sa linjen ser ut att ga in i den i stallet for igenom den. */}
      <span
        aria-hidden
        className={`absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-full ${
          accent
            ? "bg-night-accent text-black"
            : "glass-flat text-white/60"
        }`}
      >
        <Pin className="h-4 w-4" />
      </span>

      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">
        {etikett}
      </p>
      <button
        type="button"
        onClick={onOppna}
        aria-expanded={oppen}
        className="mt-0.5 flex min-h-9 w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-[15px] font-bold text-white">
          {formatWeekdayDateSv(varde)}
        </span>
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-white/45 transition-transform duration-200 ease-out motion-reduce:transition-none ${
            oppen ? "rotate-90" : ""
          }`}
        />
      </button>

      {oppen && <ManadsRutnat varde={varde} onValj={onValj} />}
    </div>
  );
}

export function PeriodVal({
  fran,
  till,
  onFran,
  onTill,
  senaste,
}: {
  /** 'YYYY-MM-DD'. Bada alltid satta — ramen har ingen halvt ifylld form. */
  fran: string;
  till: string;
  onFran: (dag: string) => void;
  onTill: (dag: string) => void;
  /**
   * Ramen forra dokumentet tackte, om det finns nagon.
   *
   * Den star utskriven for att det ar den enda uppgift som gor det mojligt att
   * upptacka ett GLAPP. Ett dokument som slutar den 14:e foljt av ett som
   * borjar den 16:e betyder att den 15:e aldrig kom med nagonstans — och den
   * dagen ar arbete nagon utfort och ingen fakturerat. Utan den har raden ar
   * det ingenting man ser; man maste minnas det.
   */
  senaste: { fran: string; till: string } | null;
}) {
  const [oppen, setOppen] = useState<"fran" | "till" | null>(null);

  // Bakvant spann. Databasen har samma villkor (arbetsdagbok_perioder_ordning),
  // men ett fel som star pa skarmen medan man valjer ar battre an ett som
  // kommer nar man trycker Skapa.
  const bakvant = till < fran;

  // Glappet mot forra ramen: forsta dagen som inte kom med nagonstans.
  const glapp =
    senaste !== null && fran > nastaDag(senaste.till) ? nastaDag(senaste.till) : null;

  return (
    <div className="glass rounded-2xl p-4">
      {/* Linjen mellan nalarna. Den borjar mitt i den ovre nalen och slutar
          mitt i den undre: `top-[18px]` ar halva nalhojden (36px), och samma
          matt dras av i botten. */}
      <div className="relative">
        <span
          aria-hidden
          className="absolute bottom-[18px] left-[17px] top-[18px] w-0.5 rounded-full bg-white/15"
        />

        <div className="relative space-y-5">
          <Ande
            etikett="Fran"
            varde={fran}
            accent={false}
            oppen={oppen === "fran"}
            onOppna={() => setOppen(oppen === "fran" ? null : "fran")}
            onValj={(d) => {
              onFran(d);
              setOppen(null);
            }}
          />
          <Ande
            etikett="Till"
            varde={till}
            accent
            oppen={oppen === "till"}
            onOppna={() => setOppen(oppen === "till" ? null : "till")}
            onValj={(d) => {
              onTill(d);
              setOppen(null);
            }}
          />
        </div>
      </div>

      {(senaste || bakvant || glapp) && (
        <div className="mt-4 border-t border-night-line pt-3">
          {bakvant && (
            <p className="text-xs font-bold text-night-danger">
              Slutdatumet ligger fore startdatumet.
            </p>
          )}
          {senaste && !bakvant && (
            <p className="text-xs leading-relaxed text-white/60">
              Forra dokumentet tackte{" "}
              <span className="font-bold text-white/85">
                {formatWeekdayDateSv(senaste.fran)} – {formatWeekdayDateSv(senaste.till)}
              </span>
              .
            </p>
          )}
          {glapp && !bakvant && (
            <p className="mt-1 text-xs font-bold leading-relaxed text-night-accent">
              Dagarna fran {formatWeekdayDateSv(glapp)} kommer inte med i nagot
              dokument. Satt Fran till {formatWeekdayDateSv(glapp)} om de ska med.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Dagen efter, som 'YYYY-MM-DD'. */
function nastaDag(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
