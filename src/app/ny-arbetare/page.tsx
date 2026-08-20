import { ArbetareForm } from "@/components/ArbetareForm";
import { Screen } from "@/components/Screen";
import { internalPath } from "@/lib/searchParams";

export default async function NyArbetarePage({
  searchParams,
}: {
  /** `?next=<vag>`: sidan som skickade hit, t.ex. ett halvifyllt Logga Project. */
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const back = internalPath(next);

  return (
    <Screen
      // Amber: nagot skapas har. Samma ljus som Logga Project och Logga Timmar,
      // eftersom de tre ar samma sorts arende sett fran anvandarens sida.
      tone="amber"
      eyebrow="Arbetare"
      title="Ny Arbetare"
      // Kom man hit mitt i ett annat arende leder pilen tillbaka dit, inte
      // hem -- formularet man lamnade star kvar som det var.
      back={{ href: back ?? "/", label: back ? "Tillbaka" : "Hem" }}
    >
      <ArbetareForm next={back} />
    </Screen>
  );
}
