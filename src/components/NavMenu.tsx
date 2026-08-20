"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight } from "@/components/Icons";

/**
 * The three destinations the menu offers. Deliberately not every screen in the
 * app: Logga Project and Logga Timmar have their own full-width buttons on Home,
 * so listing them here would only duplicate what is already on screen. "Hem" is
 * what gets you back once you are inside one of the two list pages.
 *
 * Papperskorgen is deliberately NOT here — it lives behind the cog on the right
 * (SettingsMenu). This menu is the work you are doing; that one is the app.
 */
const NAV = [
  { href: "/", label: "Hem" },
  { href: "/alla-project", label: "Alla Project" },
  { href: "/alla-arbetare", label: "Alla Arbetare" },
];

/** Vilken av de tre man star pa. Exakt matchning for Hem, prefix for de andra,
 *  sa att en detaljvy raknas till listan den ligger under.
 *
 *  Anvands bara till `aria-current`. Menyn markerar inte langre den aktuella
 *  sidan visuellt — raderna ar tre namn och inget mer — men den som lyssnar
 *  sig igenom den ska anda fa veta var hen star, och det kostar ingenting att
 *  behalla. */
function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function NavMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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
      {/* En 44px glascirkel: samma material och samma storlek som kuggen till
          hoger, sa de tva laser som ett par i stallet for som tva olika sorters
          knapp. 44 ar ocksa golvet for en trafftyta. */}
      <button
        type="button"
        aria-label="Meny"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(true)}
        className="glass flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-out active:bg-white/20 motion-reduce:transition-none"
      >
        <span className="flex w-[18px] flex-col gap-[3px]">
          <span className="h-[2px] rounded-full bg-white" />
          <span className="h-[2px] rounded-full bg-white" />
          <span className="h-[2px] rounded-full bg-white" />
        </span>
      </button>

      {/* The overlay stays mounted so both directions animate: unmounting on
          close would snap the sheet away with no slide. `inert` keeps the links
          out of tab order and off screen readers while it is parked above the
          viewport, and the single onClick means anything that is not an option
          — the dimmed page, the sheet's own padding — dismisses it. Options
          bubble up to it too, which is exactly what they want on tap.

          `z-60` puts this whole layer — dimmer and sheet — above the cog on the
          right (`z-50` in SettingsMenu), so the sheet slides down over it
          instead of the cog sitting on top of the panel. */}
      <div
        className={`fixed inset-0 z-60 ${open ? "" : "pointer-events-none"}`}
        inert={!open}
        onClick={() => setOpen(false)}
      >
        <div
          aria-hidden
          className={`absolute inset-0 bg-black/70 transition-opacity duration-300 ease-out motion-reduce:transition-none ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Parked 2rem past its own height so the drop shadow clears the top
            edge instead of smudging the screen while the sheet is closed. */}
        <nav
          role="menu"
          className={`glass-overlay absolute inset-x-0 top-0 rounded-b-3xl text-white transition-transform duration-300 ease-out motion-reduce:transition-none ${
            open ? "translate-y-0" : "translate-y-[calc(-100%-2rem)]"
          }`}
        >
          <div className="mx-auto w-full max-w-md px-3 pb-3 pt-[env(safe-area-inset-top)]">
            {/* Greppet: en sheet som dras ner uppifran ska se ut att ga att
                dra tillbaka, aven nar det ar ett tryck var som helst som
                stanger den. */}
            <div
              aria-hidden
              className="mx-auto mb-2 mt-3 h-1 w-10 rounded-full bg-white/25"
            />
            <div className="divide-y divide-night-line">
              {NAV.map((item) => {
                const current = isCurrent(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    /* aria-current, inte bara farg: den som lyssnar sig igenom
                       menyn far veta var hen star utan att se accenten. */
                    aria-current={current ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className="flex min-h-[52px] items-center gap-3 rounded-xl px-2 py-3 transition-colors duration-200 ease-out active:bg-white/10 motion-reduce:transition-none"
                  >
                    <span className="min-w-0 flex-1 truncate text-base font-bold text-white">
                      {item.label}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
