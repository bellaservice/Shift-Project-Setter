"use client";

import { ProjectMonthList } from "@/components/ProjectMonthList";
import { ActionRow } from "@/components/Panel";
import { Query } from "@/components/Query";
import { CountBadge, Screen } from "@/components/Screen";
import { getProjectsByStartMonth } from "@/lib/queries";
import { useQuery } from "@/lib/useQuery";

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
 *
 * Brickan lases ur `groups.data` snarare an inifran <Query>, eftersom den sitter
 * pa <Screen> och inte bland barnen. Innan svaret kommit ar antalet 0 och
 * brickan ritas inte alls — vilket ar ratt: en bricka som sager "0" medan
 * listan laddar ar ett pastaende om arkivet, inte ett tecken pa att det laddar.
 */
export default function AllaProjectPage() {
  const groups = useQuery(() => getProjectsByStartMonth(), []);

  const count =
    groups.data?.reduce((sum, group) => sum + group.projects.length, 0) ?? 0;

  return (
    <Screen
      tone="veil"
      eyebrow="Arkiv"
      title="Alla Project"
      badge={count > 0 && <CountBadge>{count}</CountBadge>}
      back={{ href: "/", label: "Hem" }}
      lead={<ActionRow href="/logga-project" label="Logga Project" />}
    >
      <Query state={groups}>
        {(data) => <ProjectMonthList groups={data} />}
      </Query>
    </Screen>
  );
}
