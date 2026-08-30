"use client";

import { useState } from "react";
import { BekraftaRow } from "@/components/BekraftaRow";
import { ButtonLink } from "@/components/Button";
import { FormError } from "@/components/FormError";
import { Panel, PanelList } from "@/components/Panel";
import { Query } from "@/components/Query";
import { CountBadge, EmptyState, GroupLabel, Screen } from "@/components/Screen";
import { formatWeekdayDateSv } from "@/lib/format";
import { getShiftsAwaitingConfirmation } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@/lib/useQuery";
import { confirmShift, markNoShow } from "./actions";
import { farLeda } from "@/lib/roller";

/**
 * Bekraftelsekon -- arbetsledarens close-out (spec Fas 4 och avsnitt 6).
 *
 * Ordningen ar skarmens hela funktion: aldsta passerade pass overst, nyaste
 * langst ner. Det ar darfor det inte finns nagon sortering att valja. En ko som
 * gar att sortera om ar en ko dar det aldsta arendet kan gomma sig, och den har
 * skarmen finns for att det inte ska kunna hanta.
 *
 * `amber` och inte `ember`: ingenting ar trasigt har. Det ar en hog uppgifter
 * att beta av, samma sorts skarm som Logga Timmar, och den star under samma
 * gula lampa.
 */
export default function BekraftaPage() {
  const { roll, rollLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // `reload` fran useQuery i stallet for en egen nyckel: den raknar upp sin egen
  // nonce, sa tva bekraftelser i rad blir tva laddningar och inte en.
  const ko = useQuery(getShiftsAwaitingConfirmation, []);

  /**
   * Bada skrivningarna gar igenom den har.
   *
   * try/catch och inte en rejected promise: React behandlar en form-action som
   * avvisar som ett renderingsfel, och utan errorgrans monteras hela tradet av
   * -- anvandaren far Next's tomma sida i stallet for "Fyll i timmarna". Samma
   * resonemang som i useNavigatingAction, som inte gar att anvanda rakt av har
   * eftersom kon laddar om sig sjalv i stallet for att navigera nagonstans.
   */
  function run(action: (formData: FormData) => Promise<void>) {
    return async (formData: FormData) => {
      setPending(true);
      setError(null);
      try {
        await action(formData);
        // Raden lamnar kon nar den bekraftats, sa listan maste lasas om.
        ko.reload();
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Nagot gick fel. Forsok igen."
        );
      } finally {
        setPending(false);
      }
    };
  }

  const antal = (ko.data ?? []).reduce((sum, day) => sum + day.shifts.length, 0);

  // Bekraftelsen ar arbetsledarens. En arbetare som anda hamnar har -- lanken
  // ar borta ur menyn men adressen gar att skriva -- ska motas av ett besked
  // och inte av en ko med knappar som alltid misslyckas. Databasen avvisar dem
  // (kit.shifts_guard_leader_columns), sa det har ar artighet, inte sparren.
  //
  // Null-rollen raknas som arbetare: faller man ur kontotabellen ska man se
  // mindre, inte mer.
  if (!rollLoading && !farLeda(roll)) {
    return (
      <Screen
        tone="amber"
        eyebrow="Arbetsledare"
        title="Bekrafta Pass"
        back={{ href: "/", label: "Hem" }}
      >
        <EmptyState
          title="Den har skarmen ar arbetsledarens."
          hint="Det ar arbetsledaren som bekraftar passen och satter timmarna. Dina egna pass stamplar du in och ut pa under Stampla."
          action={
            <ButtonLink href="/stampla" size="md">
              Stampla
            </ButtonLink>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen
      tone="amber"
      eyebrow="Arbetsledare"
      title="Bekrafta Pass"
      badge={antal > 0 ? <CountBadge>{antal}</CountBadge> : undefined}
      back={{ href: "/", label: "Hem" }}
      lead={error ? <FormError message={error} /> : undefined}
    >
      <Query state={ko}>
        {(dagar) =>
          dagar.length === 0 ? (
            <EmptyState
              title="Inga pass vantar pa bekraftelse."
              hint="Passen dyker upp har nar de stamplats ut, eller nar deras dag har passerat. Aldsta dagen hamnar overst."
              action={
                <ButtonLink href="/" size="md">
                  Hem
                </ButtonLink>
              }
            />
          ) : (
            <div className="space-y-5">
              {dagar.map((day) => (
                <section key={day.date}>
                  <GroupLabel>{formatWeekdayDateSv(day.date)}</GroupLabel>
                  <Panel>
                    <PanelList>
                      {day.shifts.map((shift) => (
                        <BekraftaRow
                          key={shift.id}
                          shift={shift}
                          pending={pending}
                          onConfirm={run(confirmShift)}
                          onNoShow={run(markNoShow)}
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
