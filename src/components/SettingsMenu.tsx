"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  const { roll, rollLoading } = useAuth();

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
      <button
        type="button"
        aria-label="Inställningar"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="glass relative z-50 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-out active:bg-white/20 motion-reduce:transition-none"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-5 w-5 text-white transition-transform duration-300 ease-out motion-reduce:transition-none ${
            open ? "rotate-90" : ""
          }`}
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
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
          <p className="mt-0.5 text-sm font-bold text-night-accent">
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
      </nav>
    </div>
  );
}
