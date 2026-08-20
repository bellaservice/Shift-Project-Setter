"use client";

import { useState, useSyncExternalStore } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { Dropdown } from "@/components/Dropdown";
import { Plus, Trash, User } from "@/components/Icons";
import { EmptyState } from "@/components/Screen";
import {
  getKonton,
  getServerKonton,
  removeKonto,
  setKontoStatus,
  subscribeKonton,
  KONTO_STATUS,
  type Konto,
} from "@/lib/konton";

/**
 * Kontolistan: ett kort med en rad per konto, och under det den enda knappen
 * som lagger till ett nytt.
 *
 * Raden ar tva vaningar och inte en. Namn, e-post och bild hor ihop och laser
 * som en person; statusen ar ett val man gor OM personen, och ett val i samma
 * rad som en identitet blir en rad man laser tva ganger. Pa en telefonbredd
 * finns dessutom inte plats for bade en e-postadress och en dropdown utan att
 * en av dem klipps.
 *
 * Listan lases ur `lib/konton` med `useSyncExternalStore` — samma grepp som
 * utkastet i Logga Project: servern renderar tomt, webblasaren fyller pa efter
 * hydreringen, och ingen av dem ljuger om vad den vet.
 */
export function KontoList() {
  const konton = useSyncExternalStore(
    subscribeKonton,
    getKonton,
    getServerKonton
  );
  /** Vilket konto som star med fingret pa knappen. Ett i taget. */
  const [raderar, setRaderar] = useState<string | null>(null);

  return (
    <>
      {konton.length === 0 ? (
        <EmptyState
          title="Inga konton än."
          hint="Kontona du skapar här är de som ska kunna logga in i appen."
        />
      ) : (
        /* Ett kort med hairlines i, inte ett kort per konto — samma regel som
           varje annan lista i appen. Men INTE <PanelList>: den klipper sitt
           innehall (`overflow-hidden`) for att raderna ska folja hornen, och
           statusens dropdown oppnar nedat ut ur sista raden. Ett klippt kort
           och en avklippt lista ar inte ett val man vill gora, sa kortet ritas
           har utan klippning; raderna har ingen egen yta som kan hanga utanfor
           hornen anda. */
        <div className="glass rounded-2xl">
          <div className="divide-y divide-night-line">
            {konton.map((konto) => (
              <KontoRad
                key={konto.id}
                konto={konto}
                raderar={raderar === konto.id}
                onRadera={() => setRaderar(konto.id)}
                onAvbryt={() => setRaderar(null)}
                onBekrafta={() => {
                  removeKonto(konto.id);
                  setRaderar(null);
                }}
              />
            ))}
          </div>
        </div>
      )}

      <ButtonLink href="/installningar/konto/nytt" className="mt-1 w-full">
        <Plus className="h-5 w-5" />
        Tillverka Konto
      </ButtonLink>
    </>
  );
}

function KontoRad({
  konto,
  raderar,
  onRadera,
  onAvbryt,
  onBekrafta,
}: {
  konto: Konto;
  raderar: boolean;
  onRadera: () => void;
  onAvbryt: () => void;
  onBekrafta: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3.5">
      <div className="flex items-center gap-3">
        <Avatar bild={konto.bild} />

        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold text-white">
            {konto.namn}
          </div>
          <div className="truncate text-xs text-white/60">{konto.epost}</div>
        </div>

        {/* Papperskorgen ar en ikonknapp och inte "Ta Bort" i klartext: raden
            har redan tva textbarande falt, och en tredje rad text i den skulle
            gora att man laser innan man ser. Ordet kommer i steget efter, dar
            det faktiskt behovs. */}
        <button
          type="button"
          aria-label={`Ta bort kontot ${konto.namn}`}
          onClick={onRadera}
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-night-danger transition-colors duration-200 ease-out active:bg-night-danger/15 motion-reduce:transition-none"
        >
          <Trash className="h-[18px] w-[18px]" />
        </button>
      </div>

      {raderar ? (
        /* Bekraftelsen i raden i stallet for i en dialog over sidan: det som
           forsvinner ar raden man just tryckte pa, den syns bakom fingret,
           och en modal som upprepar namnet ar ett steg for mycket for nagot som
           inte tar med sig ett halvt ars loggade timmar. Papperskorgens
           permanenta radering far behalla sin dialog — den ar oaterkallelig pa
           ett annat satt. */
        <div className="flex items-center gap-2 rounded-xl border border-night-danger/40 bg-night-danger/10 p-2 pl-3">
          <span className="min-w-0 flex-1 text-xs font-semibold text-white/80">
            Ta bort kontot?
          </span>
          <Button type="button" variant="secondary" size="md" onClick={onAvbryt}>
            Avbryt
          </Button>
          <Button
            type="button"
            variant="dangerSolid"
            size="md"
            onClick={onBekrafta}
          >
            Ta Bort
          </Button>
        </div>
      ) : (
        <Dropdown
          value={konto.status}
          onChange={(status) =>
            setKontoStatus(
              konto.id,
              status as (typeof KONTO_STATUS)[number]["value"]
            )
          }
          options={KONTO_STATUS}
          placeholder="Status"
          ariaLabel={`Status för ${konto.namn}`}
        />
      )}
    </div>
  );
}

/**
 * Bilden, eller det som star i stallet for den.
 *
 * Ingen `next/image`: kallan ar en data-URL ur telefonens eget bildbibliotek,
 * och optimeraren har varken en fil att hamta eller nagot att gora med en bild
 * som redan ar nerskalad till 192px (se `toAvatarDataUrl`).
 */
function Avatar({ bild }: { bild: string | null }) {
  return (
    <span className="glass-flat flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-white/45">
      {bild ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bild} alt="" className="h-full w-full object-cover" />
      ) : (
        <User className="h-5 w-5" />
      )}
    </span>
  );
}
