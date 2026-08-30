"use client";

import { ActionRow } from "@/components/Panel";
import { PanelSkeleton, Query } from "@/components/Query";
import { EmptyState, Screen } from "@/components/Screen";
import { ArbetareHem } from "@/components/ArbetareHem";
import { getArbetareHem } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@/lib/useQuery";
import { farLeda } from "@/lib/roller";

/**
 * Hem.
 *
 * Tva skarmar bakom en adress, for att de tva rollerna har tva olika dagar.
 *
 * ARBETSLEDAREN gor tva saker: lagger ut pass, och bekraftar dem nar de ar
 * gjorda. Darfor tva knappar och ingenting annat. Har stod tidigare foretagets
 * nyckeltal, en lista over pagaende project och knappar for att logga project
 * och timmar — allt sant, och allt i vagen. En startsida som visar tio saker
 * later anvandaren leta reda pa de tva som ar dagens arbete.
 *
 * De bortplockade skarmarna finns kvar och nas via sin adress; de ar borta ur
 * menyn och harifran, inte ur appen. Se NavMenu for samma avvagning.
 *
 * ARBETAREN ser sin egen dag: passet som pagar, passen som ska stamplas, och
 * timmarna manaden gett. Se <ArbetareHem>.
 *
 * Skarmen behaller tva saker som ingen annan har: fotografiet (`tone="photo"`)
 * och det storre ordmarket (`hero`). Bada sager samma sak — det har ar ytterdorren.
 */
export default function Home() {
  const { roll, arbetareId, rollLoading } = useAuth();
  // Okand roll raknas som arbetare: den som fallit ur kontotabellen ska se
  // mindre, inte mer. Samma hallning som kit.ar_arbetsledare() i databasen.
  const arArbetare = !rollLoading && !farLeda(roll);

  // Bara arbetaren har nagot att hamta. Arbetsledarens Hem ar tva lankar och
  // stallor darfor ingen fraga alls — foretagets totaler hamtades forr aven nar
  // de inte skulle visas.
  const mitt = useQuery(async () => {
    if (!arArbetare || !arbetareId) return null;
    return getArbetareHem(arbetareId);
  }, [arArbetare, arbetareId ?? "", rollLoading]);

  return (
    <Screen tone="photo" eyebrow="Översikt" hero title={<>Bella<br />Service</>}>
      {rollLoading ? (
        <PanelSkeleton />
      ) : arArbetare ? (
        <Query state={mitt}>
          {(data) =>
            data === null ? (
              /* Ett konto som varken ar arbetsledare eller kopplat till en
                 arbetare. Ingen egen dag att visa, och inga av ledarens
                 siffror att visa i stallet. */
              <EmptyState
                title="Ingenting att visa har an."
                hint="Kontot ar varken kopplat till en arbetare eller satt som arbetsledare. Sag till den som skapade det."
              />
            ) : (
              <ArbetareHem data={data} onStamplat={mitt.reload} />
            )
          }
        </Query>
      ) : (
        /* Arbetsledarens hela Hem. Skapa Pass forst: det ar det som ska handa,
           och bekraftelsen kommer efterat i tiden precis som pa skarmen. */
        <div className="flex flex-col gap-2.5">
          <ActionRow href="/skapa-pass" label="Skapa Pass" />
          <ActionRow href="/bekrafta" label="Bekrafta Pass" />
        </div>
      )}
    </Screen>
  );
}
