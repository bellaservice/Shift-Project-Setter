"use client";

import { ActionRow, PanelList, RowLink, RowMeta } from "@/components/Panel";
import { Query } from "@/components/Query";
import { CountBadge, EmptyState, Screen } from "@/components/Screen";
import { formatHoursSv } from "@/lib/format";
import { getWorkerList } from "@/lib/queries";
import { useQuery } from "@/lib/useQuery";

/** Initialen i en skiva, for den som inte har nagot foto. Samma storlek och
 *  form som avataren bredvid, sa raderna radar upp sig aven i en lista dar bara
 *  halften har bild. */
function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      /* Plain <img>: next/image would need every Supabase Storage hostname
         listed in images.remotePatterns, and a 40px avatar has nothing to gain
         from the optimizer. */
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={url}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/15"
      />
    );
  }

  return (
    <span className="glass-flat flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white/70">
      {name.slice(0, 1).toLocaleUpperCase("sv-SE")}
    </span>
  );
}

/**
 * Rostern. "Lagg Till Arbetare" star overst sa den nas utan att forst scrolla
 * forbi hela listan, och varje rad ar en lank till arbetarens detaljvy dar
 * uppgifterna redigeras eller arbetaren tas bort.
 *
 * Knappen ar samma <ActionRow> som Hems tva stora knappar, inte en egen svart
 * platta: det ar samma sorts handling, sa den ska ha samma form. `veil` ar
 * samma fotografi som Hem, nedtonat — arkivet ar samma rum med lampan avslagen.
 *
 * Ingen summeringsrad har, lika lite som i Alla Project. Rostern ar en lista
 * man kommer till for att hitta EN person, och tre rutor mellan knappen och
 * forsta raden ar tre siffror i vagen for det. De sag dessutom ut som Hems
 * nyckeltal, sa arkivet borjade med att se ut som Hem en gang till. Antalet
 * star kvar i rubrikens bricka, och timmarna star pa den rad de hor till.
 */
export default function AllaArbetarePage() {
  const roster = useQuery(() => getWorkerList(), []);

  return (
    <Screen
      tone="veil"
      eyebrow="Personal"
      title="Alla Arbetare"
      badge={
        (roster.data?.length ?? 0) > 0 && (
          <CountBadge>{roster.data!.length}</CountBadge>
        )
      }
      back={{ href: "/", label: "Hem" }}
      lead={<ActionRow href="/ny-arbetare" label="Lägg Till Arbetare" />}
    >
      <Query state={roster}>
        {(workers) =>
          workers.length === 0 ? (
            <EmptyState
              title="Inga arbetare registrerade än."
              hint="Lägg till den första."
            />
          ) : (
            <PanelList>
              {workers.map((w) => (
                <RowLink
                  key={w.id}
                  href={`/alla-arbetare/redigera?id=${w.id}`}
                  media={<Avatar name={w.name} url={w.profile_picture_url} />}
                  title={w.name}
                  subtitle={w.phone ?? w.email ?? "Ingen kontaktuppgift"}
                  meta={
                    <RowMeta
                      value={`${formatHoursSv(w.totalHours)}h`}
                      label={`${w.projectCount} project`}
                    />
                  }
                />
              ))}
            </PanelList>
          )
        }
      </Query>
    </Screen>
  );
}
