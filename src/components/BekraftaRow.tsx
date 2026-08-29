"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { FIELD_BOX, FieldHint, FieldLabel } from "@/components/Field";
import { formatHoursSv } from "@/lib/format";
import type { BekraftaShift } from "@/lib/types";

/**
 * En rad i bekraftelsekon: ett pass, en arbetare, ett beslut.
 *
 * Raden bar sitt eget utkast och skriver ingenting forran Bekrafta trycks -- se
 * app/bekrafta/actions.ts for varfor det ar en enda skrivning och inte en per
 * klick.
 *
 * Ordningen i raden foljer spec avsnitt 6: vem och var overst, sedan bevisen
 * (de stamplade tiderna och timmarna ur dem), sedan kontrollerna, sist
 * beslutet. Bevisen star over kontrollerna med flit -- arbetsledaren ska ha
 * last vad klockan sager innan hen borjar andra pa den.
 */

/** Steget varje tryck pa plus eller minus flyttar ett klockslag. */
const STEG_MINUTER = 15;

/** 'HH:MM' i svensk tid ur en ISO-strang. Tom strang blir ett tankstreck. */
function klockslag(iso: string | null): string {
  if (iso === null) return "–";
  return new Date(iso).toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Stockholm",
  });
}

/** Spannet mellan tva tidpunkter i timmar, eller null om nagon saknas. */
function spannTimmar(fran: string | null, till: string | null): number | null {
  if (fran === null || till === null) return null;
  const ms = new Date(till).getTime() - new Date(fran).getTime();
  return Math.round((ms / 3_600_000) * 100) / 100;
}

function flytta(iso: string | null, minuter: number): string | null {
  if (iso === null) return null;
  return new Date(new Date(iso).getTime() + minuter * 60_000).toISOString();
}

/**
 * Plus/minus-kontrollen for ett klockslag (spec avsnitt 3, Fas 4).
 *
 * Knapparna ar 44px och sitter isar fran varandra: den har skarmen anvands med
 * tummen, och tva smala knappar intill varandra ar hur man rakar dra av en
 * kvart i stallet for att lagga till en.
 */
function TidsJustering({
  label,
  varde,
  original,
  disabled,
  onChange,
}: {
  label: string;
  varde: string | null;
  original: string | null;
  disabled: boolean;
  onChange: (next: string | null) => void;
}) {
  const andrad = varde !== original && original !== null;

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled={disabled || varde === null}
          onClick={() => onChange(flytta(varde, -STEG_MINUTER))}
          aria-label={`${label}: ${STEG_MINUTER} minuter tidigare`}
        >
          −
        </Button>
        <span className="flex-1 text-center text-base font-bold tabular-nums text-white">
          {klockslag(varde)}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled={disabled || varde === null}
          onClick={() => onChange(flytta(varde, STEG_MINUTER))}
          aria-label={`${label}: ${STEG_MINUTER} minuter senare`}
        >
          +
        </Button>
      </div>
      {andrad && (
        /* Originalet star kvar under den andrade tiden och inte i stallet for
           den. Arbetsledaren ska kunna se bada -- det ar skillnaden mellan att
           justera en uppgift och att skriva om den. */
        <FieldHint tone="warn">
          Arbetaren stamplade {klockslag(original)}. Originalet sparas.
        </FieldHint>
      )}
    </div>
  );
}

export function BekraftaRow({
  shift,
  onConfirm,
  onNoShow,
  pending,
}: {
  shift: BekraftaShift;
  onConfirm: (formData: FormData) => void;
  onNoShow: (formData: FormData) => void;
  pending: boolean;
}) {
  const [sen, setSen] = useState(false);
  const [clockIn, setClockIn] = useState(shift.clockIn);
  const [clockOut, setClockOut] = useState(shift.clockOut);
  // Forslaget ar klockans timmar, men bara som utgangslage: `hours` ar
  // arbetsledarens siffra och far skilja sig fran spannet. En obetald rast ar
  // det normala fallet, inte ett fel att ratta (samma resonemang som i
  // PassTiderRows).
  /**
   * Forslaget i Timmar-faltet, i fallande ordning av vem som vet bast:
   *
   *   1. Det PLANERADE timtalet, om arbetsledaren satte ett pa Skapa Pass. Det
   *      ar vad man kom overens om, och det tar redan hansyn till obetald rast.
   *   2. Annars klockans timmar — spannet mellan stamplingarna.
   *   3. Annars tomt, och arbetsledaren far fylla i sjalv.
   *
   * Bara ett utgangslage: faltet ar ett falt, och siffran som star kvar nar
   * Bekrafta trycks ar den som betalas.
   */
  const [timmar, setTimmar] = useState(() => {
    if (shift.hours !== null) return formatHoursSv(shift.hours);
    if (shift.calculatedHours !== null) return formatHoursSv(shift.calculatedHours);
    return "";
  });

  const justerat = spannTimmar(clockIn, clockOut);
  const harStampling = shift.clockIn !== null;
  const oppet = shift.status === "open";

  return (
    <div className="px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-white">
            {shift.workerName}
          </p>
          <p className="truncate text-xs text-white/60">{shift.projectName}</p>
        </div>
        {oppet && (
          /* Ett pass som last kvar over natten. Det ar den vanligaste orsaken
             till att en rad hamnar har utan utstampling, och arbetsledaren
             behover se det innan hen undrar varfor timmarna ar tomma. */
          <span className="shrink-0 rounded-full border border-night-danger/40 bg-night-danger/10 px-2.5 py-1 text-[11px] font-bold text-night-danger">
            Ej utstamplad
          </span>
        )}
      </div>

      {/* Bevisen */}
      <div className="mt-3 rounded-xl bg-white/5 px-3 py-2.5">
        {harStampling ? (
          <>
            <p className="text-xs text-white/60">
              Stamplat{" "}
              <span className="font-bold tabular-nums text-white/85">
                {/* Inget spann att skriva ut nar utstamplingen saknas: ett
                    "08:16–" med tomrum efter ser ut som en avklippt mening, och
                    ett "08:16––" (separatorn plus tankstrecket for null) ser ut
                    som ett fel. Passet sager i stallet vad det faktiskt vet. */}
                {shift.clockOutOriginal === null
                  ? `fran ${klockslag(shift.clockInOriginal)}`
                  : `${klockslag(shift.clockInOriginal)}–${klockslag(shift.clockOutOriginal)}`}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-white/60">
              Klockan sager{" "}
              <span className="font-bold tabular-nums text-white/85">
                {shift.calculatedHours === null
                  ? "–"
                  : `${formatHoursSv(shift.calculatedHours)} h`}
              </span>
              {justerat !== null &&
                shift.calculatedHours !== null &&
                Math.abs(justerat - shift.calculatedHours) > 0.001 && (
                  <>
                    {" · justerat till "}
                    <span className="font-bold tabular-nums text-night-accent">
                      {formatHoursSv(justerat)} h
                    </span>
                  </>
                )}
            </p>
          </>
        ) : (
          <p className="text-xs text-white/60">
            Passet har ingen stampling — det loggades utan att nagon stamplade
            in. Fyll i timmarna direkt.
          </p>
        )}
      </div>

      {/* Sen-kryssrutan later kontrollerna vara, precis som spec avsnitt 6 vill:
          att andra en tid ska vara ett medvetet val och inte nagot som sker for
          att tummen glider. */}
      {harStampling && (
        <label className="mt-3 flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={sen}
            onChange={(e) => setSen(e.target.checked)}
            className="h-5 w-5 rounded border-white/25 bg-white/10 accent-[#ffb92e]"
          />
          <span className="text-sm font-semibold text-white/85">
            Sen — lat mig justera tiderna
          </span>
        </label>
      )}

      {harStampling && sen && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <TidsJustering
            label="Instamplad"
            varde={clockIn}
            original={shift.clockInOriginal}
            disabled={pending}
            onChange={setClockIn}
          />
          <TidsJustering
            label="Utstamplad"
            varde={clockOut}
            original={shift.clockOutOriginal}
            disabled={pending}
            onChange={setClockOut}
          />
        </div>
      )}

      <form
        action={onConfirm}
        className="mt-3 flex items-end gap-2"
      >
        <input type="hidden" name="shift_id" value={shift.id} />
        {/* Klockslagen skickas BARA nar de faktiskt andrats.

            Att alltid skicka tillbaka dem sag ofarligt ut och var det inte:
            PostgREST lamnar en timestamptz med mikrosekunder, medan
            JavaScripts Date bara bar millisekunder. Ett varde som gick ut och
            in igen kom alltsa tillbaka nagra mikrosekunder trubbigare an det
            gick — vilket triggern helt korrekt las som en andring, och
            stamplade clock_edited_at pa ett pass ingen rort. Bekraftelsekon
            markte det inte; det syntes forst i databasen efter ett kedjetest.

            Ett falt som inte skickas ror inte sin kolumn — se confirmShift. */}
        {clockIn !== shift.clockIn && (
          <input type="hidden" name="clock_in_time" value={clockIn ?? ""} />
        )}
        {clockOut !== shift.clockOut && (
          <input type="hidden" name="clock_out_time" value={clockOut ?? ""} />
        )}
        <label className="block flex-1">
          <FieldLabel>Timmar</FieldLabel>
          <input
            name="hours"
            value={timmar}
            onChange={(e) => setTimmar(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            disabled={pending}
            className={FIELD_BOX}
          />
        </label>
        <Button type="submit" size="md" disabled={pending}>
          Bekrafta
        </Button>
      </form>

      <form action={onNoShow} className="mt-2">
        <input type="hidden" name="shift_id" value={shift.id} />
        <Button
          type="submit"
          variant="danger"
          size="md"
          disabled={pending}
          className="w-full"
        >
          Kom inte — bekrafta 0 timmar
        </Button>
      </form>
    </div>
  );
}
