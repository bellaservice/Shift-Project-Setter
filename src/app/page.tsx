"use client";

import { ActionRow, PanelList, RowLink, RowMeta } from "@/components/Panel";
import { Query } from "@/components/Query";
import { CountBadge, EmptyState, Screen, SectionHeading } from "@/components/Screen";
import { StatCard, StatRow } from "@/components/StatCard";
import { formatHoursSv, formatMonthNameSv, projectLabel } from "@/lib/format";
import { ArbetareHem } from "@/components/ArbetareHem";
import { getArbetareHem, getHomeStats, getOngoingProjects } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@/lib/useQuery";

/**
 * Hem.
 *
 * The screen that set the app's look, and now the screen with the least markup
 * of its own: the backdrop, the bar and the heading live in <Screen>, the two
 * big buttons in <ActionRow>, the tiles in <StatRow>, and the list in
 * <PanelList>. What is left here is which numbers to show and in what order —
 * which is the only thing that was ever specific to Home.
 *
 * It keeps two things nothing else has: the photograph (`tone="photo"`) and the
 * larger wordmark (`hero`). Both say the same thing — this is the front door.
 *
 * The two reads are one `useQuery` returning a pair rather than two hooks, so
 * the screen has one loading state instead of two. Stats and the project list
 * are the same answer to the same question — "what is going on right now" — and
 * a page that fills in half at a time reads as a page that is broken.
 */
export default function Home() {
  const { roll, arbetareId, rollLoading } = useAuth();
  // Okand roll raknas som arbetare, samma hallning som overallt annars: den som
  // fallit ur kontotabellen ska se mindre, inte mer.
  const arArbetare = !rollLoading && roll !== "arbetsledare";

  const overview = useQuery(async () => {
    // Arbetarens Hem laser BARA hens egna pass. Att stalla ledarens fragor och
    // sedan gomma svaren hade betytt att foretagets totala timmar anda hamtades
    // till en telefon som inte ska visa dem.
    if (arArbetare) {
      const mitt = arbetareId ? await getArbetareHem(arbetareId) : null;
      return { mitt, stats: null, ongoingProjects: null };
    }
    const [stats, ongoingProjects] = await Promise.all([
      getHomeStats(),
      getOngoingProjects(),
    ]);
    return { mitt: null, stats, ongoingProjects };
  }, [arArbetare, arbetareId ?? "", rollLoading]);

  return (
    <Screen tone="photo" eyebrow="Översikt" hero title={<>Bella<br />Service</>}>
      <Query state={overview}>
        {({ mitt, stats, ongoingProjects }) =>
          stats === null || ongoingProjects === null ? (
            mitt === null ? (
              /* Arbetare utan arbetarrad — ett kontorskonto som inte ar
                 arbetsledare. Ingen egen dag att visa, och inga av ledarens
                 siffror att visa i stallet. */
              <EmptyState
                title="Ingenting att visa har an."
                hint="Kontot ar varken kopplat till en arbetare eller satt som arbetsledare. Sag till den som skapade det."
              />
            ) : (
              <ArbetareHem data={mitt} />
            )
          ) : (
          <>
            {/* Row 2: three stat tiles plus the add-worker tile. Four equal
                columns, all four rendered by StatCard, so the tiles are the same
                width and their labels and values sit on the same lines — inside
                one panel divided by hairlines rather than as four separate
                bordered boxes. */}
            <StatRow label="Nyckeltal">
              <StatCard
                label={"Loggade\nTimmar"}
                value={`${formatHoursSv(stats.totalHours)}h`}
              />
              <StatCard label={"Aktiva\nProject"} value={stats.activeProjectCount} />
              {/* Third tile, the one adjacent to "Lägg Till Arbetare" (spec 4.1
                  Interpretation H). Replaces the scaffold's "Totalt Arbetare",
                  which the locked spec's three-box stat row does not contain. */}
              <StatCard
                label={"Månads\npass"}
                value={stats.monthShiftCount}
                subtitle={formatMonthNameSv(stats.monthStart)}
              />
              <StatCard
                label={"Lägg Till\nArbetare"}
                value="+"
                href="/ny-arbetare"
                action
              />
            </StatRow>

            {/* Rows 3 and 4: the two primary actions, full width and stacked. */}
            <div className="flex flex-col gap-2.5">
              <ActionRow href="/logga-project" label="Logga Project" />
              <ActionRow href="/logga-timmar" label="Logga Timmar" />
            </div>

            <section>
              <SectionHeading
                aside={
                  ongoingProjects.length > 0 && (
                    <CountBadge>{ongoingProjects.length}</CountBadge>
                  )
                }
              >
                Pågående Project
              </SectionHeading>

              {ongoingProjects.length === 0 ? (
                <EmptyState
                  title="Inga pågående project än."
                  hint="Lägg upp det första med Logga Project."
                />
              ) : (
                <PanelList>
                  {ongoingProjects.map((p) => (
                    <RowLink
                      key={p.id}
                      href={`/logga-project/redigera?id=${p.id}`}
                      title={projectLabel(p)}
                      subtitle={
                        p.serviceNames.length > 0
                          ? p.serviceNames.join(", ")
                          : "Inga tjänster"
                      }
                      meta={
                        <RowMeta
                          value={`${formatHoursSv(p.totalHours)}h`}
                          label="Timmar"
                        />
                      }
                    />
                  ))}
                </PanelList>
              )}
            </section>
          </>
          )
        }
      </Query>
    </Screen>
  );
}
