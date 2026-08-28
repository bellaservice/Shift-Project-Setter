"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { FormError } from "@/components/FormError";
import { Panel, PanelList } from "@/components/Panel";
import { GroupLabel, SectionHeading } from "@/components/Screen";
import { StatCard, StatRow } from "@/components/StatCard";
import {
  formatHoursSv,
  formatMonthNameSv,
  formatPassTider,
  formatWeekdayDateSv,
} from "@/lib/format";
import { stamplaIn, stamplaUt } from "@/app/stampla/actions";
import type { ArbetareHem as Data, StamplaPass } from "@/lib/types";

/**
 * Hem, sett av en arbetare.
 *
 * Skarmen var fram till nu densamma for alla: foretagets totala timmar, antalet
 * aktiva project, och tva knappar for att logga project och timmar. En arbetare
 * har ingen nytta av nagot av det, och far dessutom inte rora halva det.
 *
 * Det har ar samma fraga som Hem alltid stallt, "vad ar pa gang just nu", fast
 * om arbetarens egen dag — och den gar att BESVARA harifran: varje pass bar sin
 * egen stamplingsknapp, sa vagen fran att oppna appen till att vara instamplad
 * ar ett tryck. /stampla finns kvar for den som vill se listan for sig.
 */

/** 'HH:MM' i svensk tid ur en ISO-strang. */
function klockslag(iso: string): string {
  return new Date(iso).toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Stockholm",
  });
}

/**
 * Passets lage i klartext.
 *
 * Tre lagen, och de foljer klockan snarare an `status`-kolumnen: ett pass ar
 * 'open' bade innan och under, och skillnaden — den som arbetaren bryr sig om —
 * ligger i om det finns en instampling.
 */
function statusText(pass: StamplaPass): string {
  if (pass.clockOut !== null) return "Utstamplad";
  if (pass.clockIn !== null) return `Instamplad ${klockslag(pass.clockIn)}`;
  return "Tilldelat";
}

function PassRad({
  pass,
  pending,
  onIn,
  onUt,
}: {
  pass: StamplaPass;
  pending: boolean;
  onIn: (formData: FormData) => void;
  onUt: (formData: FormData) => void;
}) {
  const pagar = pass.clockIn !== null && pass.clockOut === null;
  const spann = formatPassTider(pass.startTime, pass.endTime);

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-[15px] font-bold text-white">
          {pass.projectName}
        </p>
        {/* Det planerade spannet, nar arbetsledaren skrev in ett. Tomt spann
            ritar ingenting hellre an ett tankstreck: raden har redan ett datum
            och ett lage, och en tom cell till sager ingenting. */}
        {spann !== "" && (
          <span className="shrink-0 text-xs font-bold tabular-nums text-white/70">
            {spann}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-white/60">
        {formatWeekdayDateSv(pass.shiftDate)} ·{" "}
        <span className={pagar ? "font-bold text-night-accent" : undefined}>
          {statusText(pass)}
        </span>
      </p>

      <form action={pagar ? onUt : onIn} className="mt-2.5">
        <input type="hidden" name="shift_id" value={pass.id} />
        <Button
          type="submit"
          size="md"
          variant={pagar ? "secondary" : "primary"}
          disabled={pending}
          className="w-full"
        >
          {pagar ? "Stampla Ut" : "Stampla In"}
        </Button>
      </form>
    </div>
  );
}

export function ArbetareHem({
  data,
  onStamplat,
}: {
  data: Data;
  /** Kors efter en lyckad stampling, sa Hem kan lasa om sig sjalv. */
  onStamplat: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function run(action: (formData: FormData) => Promise<void>) {
    return async (formData: FormData) => {
      setPending(true);
      setError(null);
      try {
        await action(formData);
        onStamplat();
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Nagot gick fel. Forsok igen."
        );
      } finally {
        setPending(false);
      }
    };
  }

  // Det pagaende passet forst, sedan de opabörjade. Ett pass man star i ar
  // alltid mer angelaget an ett man inte borjat.
  const pass = [
    ...(data.pagaende ? [data.pagaende] : []),
    ...data.attStampla,
  ];

  return (
    <>
      <FormError message={error} />

      {data.pagaende && (
        <section>
          <GroupLabel>Pagar nu</GroupLabel>
          <div className="rounded-2xl border border-night-accent/35 bg-night-accent/10 px-4 py-4">
            <p className="truncate text-[15px] font-bold text-white">
              {data.pagaende.projectName}
            </p>
            <p className="mt-0.5 text-xs text-white/70">
              Instamplad{" "}
              <span className="font-bold tabular-nums text-night-accent">
                {klockslag(data.pagaende.clockIn as string)}
              </span>
            </p>
            <form action={run(stamplaUt)} className="mt-3">
              <input type="hidden" name="shift_id" value={data.pagaende.id} />
              <Button type="submit" size="lg" disabled={pending} className="w-full">
                Stampla Ut
              </Button>
            </form>
          </div>
        </section>
      )}

      <StatRow label="Din manad">
        <StatCard
          label={"Bekraftade\nTimmar"}
          value={`${formatHoursSv(data.timmarDennaManad)}h`}
          subtitle={formatMonthNameSv(data.monthStart)}
        />
        <StatCard label={"Bekraftade\nPass"} value={data.passDennaManad} />
        <StatCard
          label={"Dina\nPass"}
          value={pass.length}
          href="/stampla"
          action
        />
      </StatRow>

      {/* Sektionen ritas bara nar det finns pass. En tom lista med en rubrik och
          en knapp over sig sag ut som ett fel — det ar den vanliga dagen for den
          som inte har ett pass utlagt just nu. */}
      {data.attStampla.length > 0 && (
        <section>
          <SectionHeading>Kommande Pass</SectionHeading>
          <Panel>
            <PanelList>
              {data.attStampla.map((p) => (
                <PassRad
                  key={p.id}
                  pass={p}
                  pending={pending}
                  onIn={run(stamplaIn)}
                  onUt={run(stamplaUt)}
                />
              ))}
            </PanelList>
          </Panel>
        </section>
      )}

      {pass.length === 0 && (
        <ButtonLink href="/stampla" size="lg" className="w-full">
          Stampla
        </ButtonLink>
      )}
    </>
  );
}
