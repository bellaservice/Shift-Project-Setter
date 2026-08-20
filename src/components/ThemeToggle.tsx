"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "@/components/Icons";

/**
 * Natt eller dag, som ett val och inte som en knapp med tva betydelser.
 *
 * En ensam knapp som "byter tema" sager aldrig vilket tema man har — bara att
 * det gar att byta. Tva alternativ bredvid varandra, dar det ena bar den fyllda
 * plattan, sager bade vad som galler nu och vad alternativet ar. Det ar samma
 * skena som "Passets langd" i Logga Timmar, och med flit: appen har en form for
 * "valj en av tva", inte tre.
 *
 * Sjalva temat ar ett attribut pa <html> och ingenting annat (se
 * theme-light.css). Den har komponenten skriver attributet, sparar valet, och
 * ropar ut att det andrats — den ager inget utseende utover sin egen skena.
 */
const STORAGE_KEY = "bella:tema";
/** Egen handelse: `storage` utlöses bara i ANDRA flikar, sa den som byter tema
 *  i den har fliken skulle aldrig fa veta om det. */
const CHANGED = "bella:tema-andrat";

type Theme = "mork" | "ljus";

const OPTIONS: Array<{ value: Theme; label: string; Icon: typeof Sun }> = [
  { value: "mork", label: "Mörkt", Icon: Moon },
  { value: "ljus", label: "Ljust", Icon: Sun },
];

/**
 * Temat las ur DOM:en i stallet for att haldas i en `useState`.
 *
 * Attributet sitter redan pa <html> nar React startar — skriptet i layout.tsx
 * satte det fore forsta malningen — sa ett eget tillstand bredvid det ar en
 * andra sanning som kan komma i otakt med den forsta. `useSyncExternalStore` ar
 * det som far lasa DOM under rendering utan att hydreringen klagar: servern far
 * sitt svar ur `getServerSnapshot`, webblasaren sitt ur `getSnapshot`.
 */
function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "ljus"
    : "mork";
}

/** Servern har varken DOM eller lagring: appen ar mork tills nagon sagt annat. */
function getServerSnapshot(): Theme {
  return "mork";
}

function apply(next: Theme) {
  const root = document.documentElement;
  // Morkt ar frånvaron av attributet, inte ett eget varde: da ar det bara ett
  // stalle som kan säga "ljus", och stilmallen behover ingen `[data-theme=dark]`
  // som upprepar det som redan star i :root.
  if (next === "ljus") root.setAttribute("data-theme", "light");
  else root.removeAttribute("data-theme");

  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Privat lage nekar lagring. Temat galler den har sidan ut, och kommer
    // tillbaka som mork nasta gang — battre an att inte ga att byta alls.
  }

  // Remsan ovanfor sidan pa en telefon. Utan den star statusfaltet kvar i svart
  // ovanfor en vit app, vilket ser ut som att sidan borjar en bit ner.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", next === "ljus" ? "#eceff3" : "#000000");

  window.dispatchEvent(new Event(CHANGED));
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div
      role="radiogroup"
      aria-label="Utseende"
      className="glass-field flex gap-1 rounded-xl p-1"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = value === theme;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => apply(value)}
            className={`flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-bold transition-colors duration-200 ease-out motion-reduce:transition-none ${
              active
                ? "bg-night-accent text-black"
                : "text-white/60 active:bg-white/10"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
