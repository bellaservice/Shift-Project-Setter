"use client";

import { PanelList, RowLink } from "@/components/Panel";
import { Query } from "@/components/Query";
import { EmptyState, GroupLabel, Screen } from "@/components/Screen";
import { purgeExpiredTrash } from "@/lib/purge";
import { getTrashItems } from "@/lib/queries";
import { formatPurgeNotice } from "@/lib/trash";
import type { TrashItem } from "@/lib/types";
import { useQuery } from "@/lib/useQuery";

/** Where the detail view for one item lives. */
function trashHref(item: TrashItem): string {
  return item.kind === "worker"
    ? `/papperskorg/arbetare?id=${item.id}`
    : `/papperskorg/project?id=${item.id}`;
}

function TrashSection({ title, items }: { title: string; items: TrashItem[] }) {
  if (items.length === 0) return null;

  return (
    <section>
      <GroupLabel>{title}</GroupLabel>

      <PanelList>
        {items.map((item) => (
          <RowLink
            key={`${item.kind}-${item.id}`}
            href={trashHref(item)}
            title={item.label}
            subtitle={item.detail}
            /* Deadline pa raden, inte bara inne i detaljvyn: det ar det enda
               som skiljer en rad har fran en rad i vilken annan lista som
               helst, och det ar det man kommer hit for att se. Accentfargad,
               eftersom den ar radens enda tickande uppgift. */
            note={
              <div className="mt-1 truncate text-[11px] font-bold text-night-accent">
                {formatPurgeNotice(item.deletedAt)}
              </div>
            }
          />
        ))}
      </PanelList>
    </section>
  );
}

/**
 * Papperskorgen: allt som tagits bort, med uppgifterna det hade nar det togs
 * bort, tills tre veckor gatt.
 *
 * `ember` — gult med rott i: det ligger en klocka pa allt som star har, och det
 * ar det enda stallet i appen dar rott hor till rummet snarare an till en
 * enskild knapp.
 *
 * Gallringen kors innan listan lases. Cron-jobbet i migration
 * 20260819160000 ar garantin for att fristen halls aven om ingen oppnar appen,
 * men det kor 02:45 -- utan det har anropet skulle en rad kunna sta kvar och
 * saga "Raderas permanent inom kort" i upp till ett dygn efter att den skulle
 * ha varit borta. Anropet ar idempotent och delar advisory-las med jobbet.
 *
 * Gallringen kors numera i webblasaren, under den inloggade anvandarens JWT,
 * och det ar samma anrop som forr: `purge_expired_trash` ar en SECURITY DEFINER-
 * funktion, sa vad den far gora bestams av funktionen och inte av vem som
 * ringer den. Att den ligger forst i samma `useQuery` som listan ar viktigt --
 * de maste ske i den ordningen, annars visar skarmen rader som just gallrades.
 */
export default function PapperskorgPage() {
  const trash = useQuery(async () => {
    await purgeExpiredTrash();
    return getTrashItems();
  }, []);

  return (
    <Screen
      tone="ember"
      eyebrow="Appen"
      title="Papperskorg"
      back={{ href: "/", label: "Hem" }}
    >
      <p className="-mt-1 px-1 text-xs leading-relaxed text-white/65">
        Papperskorgen blir permanent rensad varje 2 veckor.
      </p>

      <Query state={trash}>
        {(items) =>
          items.length === 0 ? (
            <EmptyState
              title="Papperskorgen är tom."
              hint="Project och arbetare du tar bort hamnar här först — inget försvinner direkt."
            />
          ) : (
            <div className="flex flex-col gap-5">
              <TrashSection
                title="Project"
                items={items.filter((item) => item.kind === "project")}
              />
              <TrashSection
                title="Arbetare"
                items={items.filter((item) => item.kind === "worker")}
              />
            </div>
          )
        }
      </Query>
    </Screen>
  );
}
