"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Appens dropdowns, i den form Project Start forst gav dem.
 *
 * En <select> lagger sin lista dar webblasaren vill -- ofta uppat nar faltet
 * ligger langt ner pa skarmen -- och gar varken att forma eller att fylla med
 * annat an <option>. Darfor ar varje dropdown har en knapp plus en egen panel
 * som alltid oppnar under faltet (top-full).
 *
 * Formularvardet bars fortfarande av ett riktigt formularfalt: listvarianten
 * haller en dold <select> under knappen, sa att required, formData och
 * webblasarens felbubbla fungerar precis som innan.
 *
 * Utseendet ar appens tva material och inget eget: knappen ar `glass-field`,
 * samma ruta som ett textfalt, och panelen ar `glass`, samma skiva som varje
 * kort pa Hem. Det ar avsiktligt att en stangd dropdown inte gar att skilja
 * fran ett textfalt — bada ar "har fyller du i nagot", och skillnaden ar hur
 * man gor det, inte vad det ar.
 */

export type DropdownItem = { value: string; label: string };

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 text-white/50 transition-transform duration-200 ease-out motion-reduce:transition-none ${
        open ? "rotate-180" : ""
      }`}
    >
      <path
        d="M6 8l4 4 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Knappens egenskaper, inte bara dess klasser.
 *
 * Det oppna laget bars av `data-state` och inte av en extra kantfarg-klass:
 * `glass-field` ager sin egen kant och sin egen skugga i globals.css, och en
 * losryckt `border-...`-klass bredvid den vinner eller forlorar beroende pa i
 * vilken ordning Tailwind rakar sortera de tva. Ett attributselektor gor det
 * inte — det slar alltid en ren klass, oavsett ordning.
 *
 * Bredden satts av den som anvander knappen: annars krockar w-full med w-20.
 */
export function dropdownTrigger(
  isOpen: boolean,
  hasValue: boolean,
  className = ""
) {
  return {
    "data-state": isOpen ? "open" : "closed",
    className: [
      "glass-field flex h-12 cursor-pointer items-center justify-between gap-1",
      // px-3 rather than the input's px-3.5: a trigger also has to fit a
      // chevron, and on a 320px screen the date row is three of these side by
      // side. The 4px back per side is what keeps the month name whole.
      "rounded-xl px-3 text-left text-base",
      hasValue ? "text-white" : "text-white/40",
      className,
    ].join(" "),
  };
}

/**
 * Oppet/stangt, klick utanfor, Escape och fokus for en grupp dropdowns som
 * delar panelyta (ar, manad och dag i samma rad). Bara en i taget ar oppen:
 * nyckeln sager vilken.
 */
export function useDropdown<T extends string>() {
  const [open, setOpen] = useState<T | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggers = useRef(new Map<T, HTMLButtonElement | null>());

  const registerTrigger = (key: T) => (el: HTMLButtonElement | null) => {
    triggers.current.set(key, el);
  };

  // Stang panelen nar man tar i nagot annat. Triggarna raknas som "innanfor",
  // sa att ett klick pa grannens knapp byter panel i stallet for att bara
  // stanga den oppna.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      for (const el of triggers.current.values()) {
        if (el?.contains(target)) return;
      }
      setOpen(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Flytta fokus in i panelen pa det valda alternativet, och rulla fram den om
  // den hamnade utanfor skarmen ("nearest" rullar inte nar den redan syns).
  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    const target =
      panel.querySelector<HTMLButtonElement>('[aria-selected="true"]') ??
      panel.querySelector<HTMLButtonElement>('[role="option"]');
    target?.focus({ preventScroll: true });
    panel.scrollIntoView({ block: "nearest" });
  }, [open]);

  function close(refocus: boolean) {
    const trigger = open ? triggers.current.get(open) : null;
    setOpen(null);
    if (refocus) trigger?.focus();
  }

  function toggle(key: T) {
    setOpen(open === key ? null : key);
  }

  /** Placeras pa elementet runt knapparna och panelen. */
  function onRootKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      close(true);
    }
  }

  return { open, setOpen, toggle, close, panelRef, registerTrigger, onRootKeyDown };
}

/**
 * Sjalva listan. `columns` styr piltangenterna: panelerna ar rutnat, sa Upp och
 * Ner ska hoppa en rad -- inte ett alternativ.
 *
 * Panelen ar `glass-overlay` och inte `glass`: den lagger sig OVER formularet,
 * ofta inuti ett kort som redan ar suddat, och en nastlad `backdrop-filter`
 * suddar ingenting alls (se globals.css). Overlay-materialet bar sin egen
 * tathet i stallet, sa panelen ar lika lasbar var den an oppnar. Den tunga
 * skuggan ar det som sager att den svavar — pa svart finns inget annat som
 * kan saga det.
 *
 * `data-dropdown-panel` anvands inte har inne: det ar markoren globals.css
 * hakar pa for att lyfta kortet som panelen ligger i. `glass` bar en
 * backdrop-filter, och en sadan skapar en egen stapelkontext -- panelens z-30
 * raknas darfor bara inuti sitt eget kort, och utan lyftet skjuter nasta kort
 * i formularet in framfor den oppna listan.
 */
export function DropdownPanel({
  label,
  columns,
  panelRef,
  role = "listbox",
  className = "",
  children,
}: {
  label: string;
  columns: number;
  panelRef: React.RefObject<HTMLDivElement | null>;
  /**
   * Panelen ar sjalv listan i de flesta fall. Tidshjulet ar undantaget: dar ar
   * varje kolumn en egen lista, och en lista far inte innehalla listor.
   */
  role?: "listbox" | "group";
  className?: string;
  children: React.ReactNode;
}) {
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const panel = panelRef.current;
    if (!panel) return;
    const options = Array.from(panel.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;

    let next: number;
    if (event.key === "ArrowRight") next = index + 1;
    else if (event.key === "ArrowLeft") next = index - 1;
    else if (event.key === "ArrowDown") next = index + columns;
    else if (event.key === "ArrowUp") next = index - columns;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    else return;

    event.preventDefault();
    options[Math.min(Math.max(next, 0), options.length - 1)]?.focus();
  }

  return (
    <div
      ref={panelRef}
      data-dropdown-panel=""
      role={role}
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`glass-overlay absolute inset-x-0 top-full z-30 mt-2 rounded-2xl p-2 ${className}`}
    >
      {children}
    </div>
  );
}

export function DropdownOption({
  selected,
  chosen = selected,
  today = false,
  ariaLabel,
  onSelect,
  align = "center",
  className = "",
  children,
}: {
  selected: boolean;
  /**
   * Om accentplattan ska ritas. Foljer normalt `selected`, men Pass Datum
   * oppnar redan ifyllt: dagens datum ar ett forslag tills anvandaren sjalv
   * tryckt fram det, och ett forslag markeras med punkten -- inte med plattan.
   */
  chosen?: boolean;
  /** Dagens manad respektive dagens dag -- se punkten nedan. */
  today?: boolean;
  /**
   * Ersatter den upplasta texten nar rutan sager mindre an den visar.
   * Dagrutnatet ar fallet: veckodagen star i en kolumnrubrik som skarmlasaren
   * aldrig kommer at, sa varje dag bar den i sin egen etikett i stallet.
   */
  ariaLabel?: string;
  onSelect: () => void;
  /** Rutnat (manad, dag) centrerar; en lista med namn lases battre vansterstalld. */
  align?: "center" | "left";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-label={ariaLabel}
      onClick={onSelect}
      /* min-h-11: ett alternativ i ett rutnat ar det minsta man traffar i hela
         appen, och 44px ar golvet aven nar rutan bara innehaller "3". */
      className={`relative flex min-h-11 cursor-pointer items-center rounded-lg py-2 text-[15px] outline-none ${
        align === "left" ? "justify-start truncate px-3 text-left" : "justify-center px-1"
      } ${
        chosen
          ? "bg-white/20 font-bold text-white"
          : "text-white/85 hover:bg-white/12 focus-visible:bg-white/18 focus-visible:ring-1 focus-visible:ring-white/30"
      } ${className}`}
    >
      {children}
      {today && (
        <>
          {/* Punkten ligger absolut placerad: rutnatet ska se likadant ut med
              och utan den, sa att raderna inte flyttar sig nar manaden byts.
              Pa accentplattan byter den till svart for att inte forsvinna. */}
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
              chosen ? "bg-white/70" : "bg-white/45"
            }`}
          />
          {/* Punkten syns inte for den som lyssnar sig igenom panelen. */}
          <span className="sr-only"> (i dag)</span>
        </>
      )}
    </button>
  );
}

/**
 * En dropdown med en kolumn namn -- project, arbetare -- med samma utseende som
 * datumfaltens paneler.
 *
 * `name` ger den dolda <select>:en som bar vardet in i formularet. Den ligger
 * genomskinlig ovanpa knappens yta i stallet for att vara borttagen: en <input
 * type="hidden"> valideras aldrig, sa `required` skulle tappas, och ett falt
 * som webblasaren inte kan flytta fokus till stoppar submit helt utan att visa
 * varfor.
 */
export function Dropdown({
  name,
  value,
  onChange,
  options,
  placeholder,
  required,
  ariaLabel,
  action,
  emptyMessage = "Inga alternativ än.",
}: {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: DropdownItem[];
  placeholder: string;
  required?: boolean;
  ariaLabel?: string;
  /** Sista raden i panelen, t.ex. "+ Ny Arbetare". */
  action?: { label: string; onSelect: () => void };
  emptyMessage?: string;
}) {
  const dd = useDropdown<"list">();
  const isOpen = dd.open === "list";
  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative" onKeyDown={dd.onRootKeyDown}>
      {name && (
        <select
          name={name}
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-hidden="true"
          tabIndex={-1}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        >
          <option value="" />
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      <button
        ref={dd.registerTrigger("list")}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel ?? placeholder}
        onClick={() => dd.toggle("list")}
        {...dropdownTrigger(isOpen, selected !== undefined, "w-full")}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <Chevron open={isOpen} />
      </button>

      {isOpen && (
        <DropdownPanel
          label={placeholder}
          columns={1}
          panelRef={dd.panelRef}
          className="max-h-64 overflow-y-auto"
        >
          <div className="flex flex-col gap-1">
            {options.length === 0 && (
              <p className="px-3 py-2 text-sm text-white/55">{emptyMessage}</p>
            )}
            {options.map((o) => (
              <DropdownOption
                key={o.value}
                selected={o.value === value}
                align="left"
                onSelect={() => {
                  onChange(o.value);
                  dd.close(true);
                }}
              >
                {o.label}
              </DropdownOption>
            ))}
            {action && (
              /* Utvagen ur listan, avskild med en hairline: den lamnar sidan,
                 och det ar nagot annat an att valja en rad ur den. */
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  dd.close(false);
                  action.onSelect();
                }}
                className="mt-1 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-3 pt-3 text-left text-sm font-bold text-white outline-none hover:bg-white/12 focus-visible:bg-white/18"
              >
                <span aria-hidden className="text-base leading-none">
                  +
                </span>
                {action.label}
              </button>
            )}
          </div>
        </DropdownPanel>
      )}
    </div>
  );
}
