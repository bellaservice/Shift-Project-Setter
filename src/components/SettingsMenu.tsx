"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { User } from "@/components/Icons";
import { useAuth } from "@/lib/auth";

/**
 * Vad kugghjulet innehaller: det som handlar om appen och foretaget snarare an
 * om dagens arbete. Papperskorgen hor hemma har och inte i hamburgaren till
 * vanster — den listar inget man arbetar i, den ar stallet man gar till nar
 * nagot ska tas tillbaka.
 *
 * Profil star inte langre i listan. Den ligger i Installningar tillsammans med
 * Konto och Papperskorgen, och en genvag forbi rummet till en av sakerna i det
 * gor menyn till en andra innehallsforteckning som maste hallas i takt med den
 * forsta. Genvagen som ar kvar — Papperskorgen — ar den enda man gar till i en
 * hast, nar nagot precis forsvunnit.
 */
const SETTINGS_NAV = [
  { href: "/installningar", label: "Inställningar" },
  { href: "/papperskorg", label: "Papperskorg" },
];

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { roll, rollLoading, namn, bild, epost, session, signOut } = useAuth();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="relative shrink-0">
      {/* `relative z-50`: knappen ligger over dimmern nedan, sa den syns kvar
          och gar att trycka pa igen for att stanga. Glascirkel i samma storlek
          som hamburgaren, sa de tva ser ut att hora ihop i stallet for att vara
          tva olika sorters knappar. */}
      {/* Ansiktet, inte kugghjulet.

          Ett kugghjul sager "appens instalningar". Men det som ligger bakom den
          har knappen ar numera lika mycket VEM man ar: rollen man arbetar som,
          kontot, och vagen ut. En profilbild sager det utan ord, och den svarar
          dessutom pa en fraga en delad telefon staller pa riktigt — ar det jag
          som ar inloggad? Kugghjulet kunde aldrig svara pa den.

          Ingen rotation nar den oppnas, till skillnad fran kugghjulet: ett
          ansikte som snurrar ar en leksak. Ringen tanda i amber sager samma sak
          lugnare. */}
      <button
        type="button"
        aria-label={namn ? `${namn} — konto och inställningar` : "Konto och inställningar"}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className={`glass relative z-50 flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden rounded-full text-white/45 transition duration-200 ease-out active:bg-white/20 motion-reduce:transition-none ${
          open ? "ring-2 ring-night-accent" : ""
        }`}
      >
        {bild ? (
          /* Ingen next/image, av samma skal som Avatar i KontoList: kallan ar
             profilbilden i Supabase Storage, den ar redan liten, och den visas
             i 44px. */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bild} alt="" className="h-full w-full object-cover" />
        ) : (
          <User className="h-5 w-5" />
        )}
      </button>

      {/* Dimmern ar sitt eget lager under panelen, till skillnad fran NavMenu
          dar bada ligger i samma: panelen har ar ankrad till knappen och maste
          darfor sitta kvar i det har `relative`-flodet, inte inuti ett
          `fixed inset-0`. Ett tryck var som helst utanfor stanger. */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Stannar monterad sa bada riktningarna animeras; `inert` haller
          lankarna utanfor tabbordningen och skarmlasaren medan den ar dold.
          Skalas fram ur sitt eget ovre hogra horn — alltsa ur knappen — sa att
          panelen ser ut att komma nagonstans ifran. */}
      <nav
        role="menu"
        inert={!open}
        className={`glass-overlay absolute right-0 top-full z-50 mt-2 w-56 origin-top-right overflow-hidden rounded-2xl text-white transition duration-200 ease-out motion-reduce:transition-none ${
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        {/* Vilken roll man ar inne som, overst i panelen.

            Rollen avgor vad hela appen visar, och den gar att byta — sa den som
            undrar varfor en knapp saknas ska kunna fa svaret utan att gissa.
            Det har ar det enda stallet i appen dar den star skriven.

            En rubrik och inte en menyrad: det ar en upplysning, inte nagot att
            trycka pa. Rollen byts i Installningar > Konto. */}
        <div className="border-b border-night-line px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">
            Inloggad som
          </p>
          {/* Namnet forst, sedan adressen, sist rollen.

              Ett konto utan arbetarrad har inget namn — da far adressen vara
              namnet, precis som i kontolistan, i stallet for att raden star tom
              och ser trasig ut. */}
          <p className="mt-1 truncate text-sm font-bold text-white">
            {namn ?? epost ?? "—"}
          </p>
          {namn && epost && (
            <p className="truncate text-xs text-white/55">{epost}</p>
          )}
          <p className="mt-1 text-sm font-bold text-night-accent">
            {rollLoading
              ? "…"
              : roll === "arbetsledare"
                ? "Arbetsledare"
                : roll === "arbetare"
                  ? "Arbetare"
                  : "Ingen roll"}
          </p>
        </div>

        <div className="divide-y divide-night-line">
          {SETTINGS_NAV.map((item) => {
            // Bara till `aria-current`: panelen markerar inte den aktuella
            // sidan visuellt, men den ska anda ga att hora.
            const current = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                aria-current={current ? "page" : undefined}
                // Stanger direkt vid tryck: panelen ska inte sta kvar och blinka
                // medan nasta sida hamtas.
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center px-4 py-3 text-sm font-bold text-white transition-colors duration-200 ease-out active:bg-white/10 motion-reduce:transition-none"
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Vagen ut, sist och avskild.

            Den fanns inte alls forut: signOut() har legat i auth.tsx sedan
            inloggningen bygddes utan att nagon knapp nagonsin kallat pa den, sa
            det enda sattet att byta anvandare var att rensa webblasarens
            lagring. Pa en telefon som gar mellan tva personer ar det inte ett
            saknat bekvamlighetsdrag utan en trasig inloggning.

            Under en egen linje och i rott: den ar inte en av de tva
            destinationerna ovan, den avslutar. Ingen bekraftelsedialog — man
            oppnar menyn med flit, och det som gar forlorat ar ett tryck pa
            "Logga in" igen.

            Texten vander pa sig efter sessionen. I praktiken star det alltid
            "Logga ut", eftersom AuthGate visar inloggningsskarmen i stallet for
            appen nar sessionen saknas och den har menyn da inte ritas alls. Men
            knappen ska saga sanningen om det laget den faktiskt ar i, inte
            forutsatta det. */}
        <div className="border-t border-night-line">
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              if (session) await signOut();
            }}
            className="flex min-h-11 w-full items-center px-4 py-3 text-sm font-bold text-night-danger transition-colors duration-200 ease-out active:bg-white/10 motion-reduce:transition-none"
          >
            {session ? "Logga ut" : "Logga in"}
          </button>
        </div>
      </nav>
    </div>
  );
}
