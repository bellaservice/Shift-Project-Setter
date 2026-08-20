import { ProjectMonthList } from "@/components/ProjectMonthList";
import { ActionRow } from "@/components/Panel";
import { CountBadge, Screen } from "@/components/Screen";
import { getProjectsByStartMonth } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Alla Project. "Logga Project" star overst, likt "Lagg Till Arbetare" i Alla
 * Arbetare, sa ett nytt project nas utan att forst scrolla forbi hela listan —
 * och det ar samma <ActionRow> som pa Hem, eftersom det ar samma handling.
 *
 * Ingen summeringsrad har. Skarmen ar ett arkiv: det man kommer hit for ar en
 * rad, inte en siffra. De tre rutorna sag dessutom ut som ett andra Hem mitt i
 * listan — samma tre-i-rad som Hems nyckeltal, men om samma projectlista som
 * borjar tva centimeter langre ner. Antalet star kvar i rubrikens brickan, och
 * timmarna star pa den rad de hor till.
 */
export default async function AllaProjectPage() {
  const groups = await getProjectsByStartMonth();
  const count = groups.reduce((sum, group) => sum + group.projects.length, 0);

  return (
    <Screen
      tone="veil"
      eyebrow="Arkiv"
      title="Alla Project"
      badge={count > 0 && <CountBadge>{count}</CountBadge>}
      back={{ href: "/", label: "Hem" }}
      lead={<ActionRow href="/logga-project" label="Logga Project" />}
    >
      <ProjectMonthList groups={groups} />
    </Screen>
  );
}
