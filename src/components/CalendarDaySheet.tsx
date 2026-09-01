"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ButtonLink } from "@/components/Button";
import { ChevronRight, Clock, Plus } from "@/components/Icons";
import { arendeFargHex } from "@/lib/arendeFarger";
import { GroupLabel } from "@/components/Screen";
import {
  formatHoursSv,
  formatPassTimmar,
  formatPassTider,
  formatWeekdayDateSv,
} from "@/lib/format";
import type { Arende, DayShift } from "@/lib/types";

/** Vart "Logga Timmar" leder: dagen ifylld, och vägen tillbaka hit inbakad.
 *  Returvägen måste kodas — den bär sitt eget `?`. */
function loggaTimmarHref(date: string): string {
  const retur = encodeURIComponent(`/kalender?datum=${date}`);
  return `/logga-timmar?datum=${date}&retur=${retur}`;
}

/**
 * Dagen man tryckte på, som ett kort mitt på skärmen.
 *
 * Arket är dagens hela innehåll och inte bara ett val: två knappar som ber om
 * ett beslut innan man ens fått se vad dagen redan innehåller är två knappar man
 * trycker fel på. Så ordningen är vad-som-finns först, vad-man-kan-göra sist —
 * och den som bara ville boka något scrollar förbi en lista som ändå var värd
 * att se.
 *
 * Mitt på skärmen även på telefon, till skillnad från appens
 * bekräftelsedialoger som klistrar sig mot underkanten. De är svar på en fråga
 * man just ställt och hör därför hemma vid tummen; det här är en vy av en dag
 * man valt ur rutnätet ovanför, och ett kort som ligger centrerat över det
 * rutnätet läses som "den här dagen, förstorad" i stället för som en låda som
 * åkt upp underifrån.
 *
 * Passen står per arbetare, som frågan "vem jobbade den dagen" faktiskt ställs.
 * Varje rad leder till sin egen redigering; ärendena likaså.
 *
 * Materialet är hämtat rakt av från <ConfirmDeleteButton> och <NavMenu> — samma
 * svarta dimmer, samma `glass-overlay`. Allt som lägger sig över sidan i den
 * här appen gör det på samma sätt.
 */
export function CalendarDaySheet({
  date,
  shifts,
  arenden,
  loading,
  error,
  onClose,
}: {
  /** 'YYYY-MM-DD'. */
  date: string;
  shifts: DayShift[];
  arenden: Arende[];
  /** Dagens innehåll är ännu inte hämtat. Arket öppnar ändå — rubriken och de
   *  två knapparna är kända direkt, och de är det man oftast kom för. */
  loading: boolean;
  /**
   * Läsningen gick fel, redan på svenska.
   *
   * Egen rad och inte en tom lista: "Ingenting loggat den här dagen" är ett
   * svar, och att måla det över en död databasuppkoppling är att svara fel på
   * den enda fråga arket finns för. Knapparna står kvar under det — att boka
   * något är fortfarande möjligt, och det man skriver in går inte förlorat av
   * att en annan läsning misslyckats.
   */
  error: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Ett obekräftat pass bidrar med ingenting till dagens summa.
  //
  // Villkoret stod tidigare i `s.hours ?? 0` ensamt, och det RÄCKTE så länge ett
  // obekräftat pass alltid hade null i kolumnen. Sedan Skapa Pass fick sin
  // timruta föds ett schemalagt pass med ett planerat timtal, så nollan kom
  // tillbaka som en riktig siffra och dagens summa började räkna arbete som
  // ingen ännu utfört. `status` är det enda som skiljer de två.
  const totalHours = shifts.reduce(
    (sum, s) => sum + (s.status === "confirmed" ? s.hours ?? 0 : 0),
    0
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={formatWeekdayDateSv(date)}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="glass-overlay max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl p-5"
      >
        {/* Inget grepp: kortet ligger centrerat och kommer inte underifrån, så
            ett dragreglage hade lovat en rörelse som inte finns. */}
        <header className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="min-w-0 text-lg font-extrabold leading-tight tracking-tight text-white">
            {formatWeekdayDateSv(date)}
          </h2>
          {totalHours > 0 && (
            <span className="shrink-0 text-sm font-bold tabular-nums text-night-accent">
              {formatHoursSv(totalHours)} h
            </span>
          )}
        </header>

        {error !== null ? (
          <div className="mb-4 rounded-xl border border-night-danger/40 bg-night-danger/10 p-3.5">
            <p className="text-sm font-bold text-night-danger">
              Kunde inte hämta dagen.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/70">{error}</p>
          </div>
        ) : loading ? (
          <div
            className="mb-5 flex animate-pulse flex-col gap-2 motion-reduce:animate-none"
            aria-hidden
          >
            <div className="glass-flat h-14 rounded-xl" />
            <div className="glass-flat h-14 rounded-xl opacity-60" />
          </div>
        ) : (
          <>
            {shifts.length > 0 && (
              <section className="mb-4">
                <GroupLabel>Loggade Timmar</GroupLabel>
                <div className="glass-flat divide-y divide-night-line overflow-hidden rounded-xl">
                  {shifts.map((shift) => (
                    <Link
                      key={shift.id}
                      href={`/kalender/redigera?pass=${shift.id}`}
                      className="flex min-h-14 items-center gap-3 px-3.5 py-2.5 transition-colors duration-200 ease-out active:bg-white/15 motion-reduce:transition-none"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-white">
                          {shift.workerName}
                        </div>
                        <div className="truncate text-xs text-white/60">
                          {shift.projectName}
                          {/* Pass Tider bara när de finns. Ett pass utan dem är
                              inte trasigt — timmarna är passets längd. */}
                          {shift.startTime && shift.endTime && (
                            <>
                              {" · "}
                              {formatPassTider(shift.startTime, shift.endTime)}
                            </>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-night-accent">
                        {formatPassTimmar(shift.hours)}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {arenden.length > 0 && (
              <section className="mb-4">
                <GroupLabel>Ärenden</GroupLabel>
                <div className="glass-flat divide-y divide-night-line overflow-hidden rounded-xl">
                  {arenden.map((arende) => (
                    <Link
                      key={arende.id}
                      href={`/kalender/arende?id=${arende.id}`}
                      className="flex min-h-14 items-center gap-3 px-3.5 py-2.5 transition-colors duration-200 ease-out active:bg-white/15 motion-reduce:transition-none"
                    >
                      {/* Skivan bär ärendets egen färg — samma kulör som
                          pricken i kalenderrutan, så raden och rutan känns igen
                          som samma sak. Klockan är svart i den, eftersom alla
                          sex färgerna är ljusa. */}
                      <span
                        aria-hidden
                        style={{ backgroundColor: arendeFargHex(arende.farg) }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-black"
                      >
                        <Clock className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-white">
                          {arende.titel}
                        </div>
                        <div className="truncate text-xs text-white/60">
                          {/* Heldag är inte "tid saknas" — det är ett svar, och
                              det ska stå som ett. */}
                          {arende.start_time && arende.end_time
                            ? formatPassTider(arende.start_time, arende.end_time)
                            : "Heldag"}
                          {arende.plats && ` · ${arende.plats}`}
                          {/* "Bara jag" och "Valda konton" står i klartext på
                              raden. Ett delat ärende ser annars exakt ut som ett
                              öppet, och vem som ser det är inte något man ska
                              behöva öppna ärendet för att kontrollera. */}
                          {arende.synlighet === "egen" && " · Bara jag"}
                          {arende.synlighet === "valda" && " · Delat"}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {shifts.length === 0 && arenden.length === 0 && (
              <p className="mb-4 px-1 text-sm text-white/55">
                Ingenting loggat eller bokat den här dagen än.
              </p>
            )}
          </>
        )}

        {/* De två vägarna vidare. Båda är fyllda accentknappar och inte en
            primär plus en sekundär: skärmen frågar vilketdera man vill, och den
            har inget svar på vilket som är det rätta för just den här dagen. */}
        <div className="flex flex-col gap-2">
          <ButtonLink href={loggaTimmarHref(date)} className="w-full">
            <Plus className="h-5 w-5" />
            Snabb Pass
          </ButtonLink>
          <ButtonLink
            href={`/kalender/arende?datum=${date}`}
            variant="secondary"
            className="w-full"
          >
            <Plus className="h-5 w-5" />
            Tillverka Ärende
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
