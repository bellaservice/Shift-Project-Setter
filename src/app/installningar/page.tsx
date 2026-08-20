import { FormSection, PanelList, RowLink } from "@/components/Panel";
import { Screen } from "@/components/Screen";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TRASH_RETENTION_DAYS } from "@/lib/trash";

export const metadata = { title: "Inställningar — Bella Service" };

/**
 * Allt som handlar om appen sjalv, pa ett stalle.
 *
 * Sidan sa tidigare bara att det inte fanns nagot att stalla in, och listade i
 * stallet tva regler i klartext. Nu finns det tva saker att stalla in och tre
 * stallen att ga till, sa reglerna far ge plats: den ena av dem — hur lange
 * borttaget ligger kvar — star kvar som underrad pa Papperskorgen, dar den
 * faktiskt betyder nagot, och den andra hor hemma i Alla Project snarare an i
 * en ruta har.
 *
 * Profil ligger nu har i stallet for i menyn bakom kugghjulet. En sida som ar
 * "appens installningar" och en meny som listar samma sidor bredvid den ar tva
 * navigeringar for tre destinationer; kugghjulet ar dorren, det har ar rummet,
 * och rummet ar det som far vaxa nar det tillkommer nagot.
 *
 * `steel` och inte `amber`: det har handlar om appen, inte om jobbet. Det svala
 * ljuset ar det enda som sager det innan man last rubriken.
 */
export default function InstallningarPage() {
  return (
    <Screen
      tone="steel"
      eyebrow="Appen"
      title="Inställningar"
      back={{ href: "/", label: "Hem" }}
    >
      <PanelList>
        <RowLink
          href="/profil"
          title="Profil"
          subtitle="Företagets uppgifter i Arbetsdagboken."
        />
        <RowLink
          href="/installningar/konto"
          title="Konto"
          subtitle="Vilka som kan logga in i appen."
        />
        <RowLink
          href="/papperskorg"
          title="Papperskorg"
          subtitle={`Borttaget ligger kvar i ${TRASH_RETENTION_DAYS} dagar.`}
        />
      </PanelList>

      <FormSection title="Utseende">
        <ThemeToggle />
      </FormSection>
    </Screen>
  );
}
