import { PanelList, RowLink } from "@/components/Panel";
import { EmptyState, GroupLabel, Screen } from "@/components/Screen";
import { purgeExpiredTrash } from "@/lib/purge";
import { getTrashItems } from "@/lib/queries";
import { formatPurgeNotice } from "@/lib/trash";
import type { TrashItem } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Where the detail view for one item lives. */
function trashHref(item: TrashItem): string {
  return item.kind === "worker"
    ? `/papperskorg/arbetare/${item.id}`
    : `/papperskorg/project/${item.id}`;
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
 */
export default async function PapperskorgPage() {
  await purgeExpiredTrash();
  const items = await getTrashItems();

  const projects = items.filter((item) => item.kind === "project");
  const workers = items.filter((item) => item.kind === "worker");

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

      {items.length === 0 ? (
        <EmptyState
          title="Papperskorgen är tom."
          hint="Project och arbetare du tar bort hamnar här först — inget försvinner direkt."
        />
      ) : (
        <div className="flex flex-col gap-5">
          <TrashSection title="Project" items={projects} />
          <TrashSection title="Arbetare" items={workers} />
        </div>
      )}
    </Screen>
  );
}
