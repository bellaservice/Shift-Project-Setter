"use client";

import { useCallback, useState } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { FormError } from "@/components/FormError";
import { Panel, PanelList } from "@/components/Panel";
import { Query } from "@/components/Query";
import { EmptyState, GroupLabel, Screen } from "@/components/Screen";
import { formatWeekdayDateSv } from "@/lib/format";
import { getMinaPassAttStampla } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@/lib/useQuery";
import type { StamplaPass } from "@/lib/types";
import { stamplaIn, stamplaUt } from "./actions";

/**
 * Stamplingen — arbetarens skarm (spec Fas 3).
 *
 * Skarmen ar avsiktligt nastan tom. Den anvands staende i en port med
 * telefonen i ena handen och nagot annat i den andra, och da ska det finnas
 * exakt en sak att trycka pa per pass. Inga tidsvaljare, inga falt: klockslaget
 * ar det ogonblick knappen trycks, och det hamtas ur databasen (se actions.ts).
 *
 * Fonstret ar idag och igar — se getMinaPassAttStampla for varfor igar ar med.
 */

/** 'HH:MM' i svensk tid ur en ISO-strang. */
function klockslag(iso: string): string {
  return new Date(iso).toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Stockholm",
  });
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
  const pagar = pass.clockIn !== null;

  return (
    <div className="px-4 py-4">
      <p className="truncate text-[15px] font-bold text-white">
        {pass.projectName}
      </p>
      <p className="mt-0.5 text-xs text-white/60">
        {pagar ? (
          <>
            Instamplad{" "}
            <span className="font-bold tabular-nums text-night-accent">
              {klockslag(pass.clockIn as string)}
            </span>
          </>
        ) : (
          "Inte pabörjat"
        )}
      </p>

      {/* En knapp per pass, i full bredd och `lg`. Det ar dagens enda handling
          och den ska ga att traffa utan att sikta. */}
      <form action={pagar ? onUt : onIn} className="mt-3">
        <input type="hidden" name="shift_id" value={pass.id} />
        <Button
          type="submit"
          size="lg"
          variant={pagar ? "secondary" : "primary"}
          glow={!pagar}
          disabled={pending}
          className="w-full"
        >
          {pagar ? "Stampla Ut" : "Stampla In"}
        </Button>
      </form>
    </div>
  );
}

export default function StamplaPage() {
  const { arbetareId, rollLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Fragan stalls forst nar vi vet vem som fragar. `arbetareId` i deps gor att
  // den stalls om av sig sjalv sa fort kontot laddats.
  const hamta = useCallback(
    () => (arbetareId ? getMinaPassAttStampla(arbetareId) : Promise.resolve([])),
    [arbetareId]
  );
  const pass = useQuery(hamta, [arbetareId ?? ""]);

  function run(action: (formData: FormData) => Promise<void>) {
    return async (formData: FormData) => {
      setPending(true);
      setError(null);
      try {
        await action(formData);
        pass.reload();
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Nagot gick fel. Forsok igen."
        );
      } finally {
        setPending(false);
      }
    };
  }

  // Ett konto utan arbetare — kontorspersonal — har inga egna pass att stampla
  // pa. Det ar inte ett fel, sa skarmen sager det rent ut i stallet for att visa
  // en tom lista som ser trasig ut.
  if (!rollLoading && arbetareId === null) {
    return (
      <Screen
        tone="amber"
        eyebrow="Stampling"
        title="Stampla"
        back={{ href: "/", label: "Hem" }}
      >
        <EmptyState
          title="Det har kontot ar inte kopplat till nagon arbetare."
          hint="Stamplingen hor till den som gar passen. Ett konto for kontoret har inga egna pass att stampla pa."
          action={
            <ButtonLink href="/" size="md">
              Hem
            </ButtonLink>
          }
        />
      </Screen>
    );
  }

  const dagar = [...new Set((pass.data ?? []).map((p) => p.shiftDate))];

  return (
    <Screen
      tone="amber"
      eyebrow="Stampling"
      title="Stampla"
      back={{ href: "/", label: "Hem" }}
      lead={error ? <FormError message={error} /> : undefined}
    >
      <Query state={pass}>
        {(rader) =>
          rader.length === 0 ? (
            <EmptyState
              title="Inga pass att stampla pa just nu."
              hint="Har visas dina pass for idag och igar. Ar ett pass slut och utstamplat ligger det hos arbetsledaren for bekraftelse."
              action={
                <ButtonLink href="/" size="md">
                  Hem
                </ButtonLink>
              }
            />
          ) : (
            <div className="space-y-5">
              {dagar.map((dag) => (
                <section key={dag}>
                  <GroupLabel>{formatWeekdayDateSv(dag)}</GroupLabel>
                  <Panel>
                    <PanelList>
                      {rader
                        .filter((p) => p.shiftDate === dag)
                        .map((p) => (
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
              ))}
            </div>
          )
        }
      </Query>
    </Screen>
  );
}
