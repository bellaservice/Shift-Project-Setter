import Image from "next/image";
import { Panel, DataRow } from "@/components/Panel";
import { Screen } from "@/components/Screen";
import { COMPANY } from "@/lib/company";

export const metadata = { title: "Profil — Bella Service" };

/**
 * Foretagets egna uppgifter.
 *
 * Samma varden som skrivs i sidfoten pa varje sida av en genererad
 * Arbetsdagbok — det ar darfor de ar vard en egen sida: nar en kund undrar
 * vilket org.nr eller bankgiro som star pa dokumentet de fatt, star svaret har.
 *
 * Lasta med flit. Kallan ar `src/lib/company.ts`, som i sin tur speglar
 * DocMakers `config/company.json`; ett redigerbart falt har skulle bara kunna
 * andra den ena av de tva och tyst lata dokumenten saga olika saker.
 *
 * Sidan ar den enda som visar loggan, och den star i en glascirkel i stallet
 * for att ligga los pa svart: bella-logo.png ar ritad for vitt papper, och pa
 * en svart yta hanger dess morka partier i luften. Skivan ger den ett underlag
 * att sta pa — samma grepp som varje annan rund knapp i appen anvander.
 */
export default function ProfilPage() {
  return (
    <Screen
      tone="steel"
      eyebrow="Företaget"
      title="Bella Service"
      back={{ href: "/", label: "Hem" }}
    >
      <Panel className="flex items-center gap-4 !rounded-3xl p-4">
        {/* `bg-[#ffffff]/90` och inte `bg-white/90`: i dagtemat ar `white` inte
            langre vitt utan appens black (se theme-light.css), och skivan under
            loggan ska vara PAPPER i bada temana. Den ar det enda stallet i
            appen som menar den faktiska fargen och inte "framgrundstonen". */}
        <span className="glass-flat flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#ffffff]/90">
          <Image
            src="/bella-logo.png"
            alt=""
            width={56}
            height={56}
            className="h-12 w-12 object-contain"
          />
        </span>
        <div className="min-w-0">
          {/* Rubriken star redan i sidhuvudet, sa kortet upprepar den inte —
              det bar i stallet det enda om foretaget som inte ar en uppgift i
              listan under: att det ar godkant for F-skatt. */}
          <p className="text-sm font-bold text-white">{COMPANY.orgnote}</p>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            Uppgifterna nedan står i sidfoten på varje Arbetsdagbok.
          </p>
        </div>
      </Panel>

      <dl className="glass divide-y divide-night-line overflow-hidden rounded-2xl">
        {/* Egna etiketter, inte COMPANY:s. De ar skrivna for sidfoten pa ett
            A4 ("Postadress Adress:"), och det ar vardena — inte orden framfor
            dem — som ar poangen med den har sidan. */}
        <DataRow label="Postadress">
          {COMPANY.postadress.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </DataRow>
        <DataRow label="Telefon">
          {/* Numret ringer. Accentfargat for att sага att det gar att trycka
              pa — det ar den enda raden i listan som gor nagot. */}
          <a
            href={`tel:${COMPANY.telefon.replace(/[^\d+]/g, "")}`}
            className="text-night-accent"
          >
            {COMPANY.telefon}
          </a>
        </DataRow>
        <DataRow label="Bankgiro">
          <span className="tabular-nums">{COMPANY.bankgiro}</span>
        </DataRow>
        <DataRow label="Org.nr">
          <span className="tabular-nums">{COMPANY.orgnr}</span>
        </DataRow>
        <DataRow label="Momsreg.nr">
          <span className="tabular-nums">{COMPANY.momsregnr}</span>
        </DataRow>
      </dl>
    </Screen>
  );
}
