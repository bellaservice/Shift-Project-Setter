"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Hjulet, löst från tiden.
 *
 * Det ritades först för "Pass Tider" och satt kvar i TimeWheelSelect så länge
 * klockslag var det enda som rullades. Året är det andra: en lista där man vet
 * ungefär var man ska och vill dra sig dit med tummen, inte läsa igenom ett
 * rutnät. Att det är samma hjul och inte ett hjul till är hela poängen — den
 * som rullat fram 07:00 behöver inte lära sig något nytt för att rulla fram
 * 2026.
 *
 * Rullningen är styrande: fingret, mushjulet och piltangenterna ändrar samma
 * sak, och värdet läses tillbaka först när rullningen stannat.
 */

/** Radhöjd och antal synliga rader. Allt annat i hjulet mäts ur dessa två. */
export const ROW = 40;
export const VISIBLE = 5;
/** Tomrum över och under listan, så att första och sista raden når mitten. */
export const EDGE = ((VISIBLE - 1) / 2) * ROW;

function clamp(index: number, length: number) {
  return Math.min(Math.max(index, 0), length - 1);
}

/**
 * Var i hjulet ett värde ligger. Ett värde utanför stegen — t.ex. 07:23 från en
 * rad som sparats någon annanstans ifrån — landar på närmaste rad i stället för
 * att tappas.
 */
function indexOf(values: string[], value: string) {
  const exact = values.indexOf(value);
  if (exact >= 0) return exact;

  const target = Number(value);
  if (!Number.isFinite(target)) return 0;
  let best = 0;
  values.forEach((v, i) => {
    if (Math.abs(Number(v) - target) < Math.abs(Number(values[best]) - target)) best = i;
  });
  return best;
}

/**
 * Plattan som säger vilken rad som är vald.
 *
 * Ligger under kolumnerna och utanför dem: den ska inte tona bort tillsammans
 * med raderna, och när hjulet har två kolumner (timme och minut) är det en
 * platta över båda och inte en per kolumn.
 */
export function WheelPlate() {
  return (
    <div
      aria-hidden="true"
      style={{ top: EDGE, height: ROW }}
      className="pointer-events-none absolute inset-x-1 rounded-xl border-y border-white/15 bg-white/10"
    />
  );
}

/**
 * En kolumn i hjulet.
 *
 * Kolumnen ställs bara en gång — vid öppning — annars skulle den rycka tillbaka
 * mitt i en rörelse.
 */
export function Wheel({
  label,
  values,
  unit,
  initialValue,
  autoFocus = false,
  onChange,
}: {
  label: string;
  values: string[];
  /**
   * Enheten som hör till talet — "h" i Pass Timmar. Den ritas inuti raden och
   * inte bredvid hjulet: ett tecken utanför kolumnen dras ut mot kolumnens
   * ytterkant medan talet står kvar i mitten, och då läses "8" och "h" som två
   * saker med ett tomrum emellan i stället för som ett värde. Utelämnas den är
   * raden bara sitt tal, precis som i tids- och årshjulen.
   */
  unit?: string;
  /** Bara utgångsläget: därefter är det rullningen som säger vad som är valt. */
  initialValue: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | null>(null);
  /**
   * Öppningen ställer hjulet på förslaget genom att rulla dit. Utan den här
   * flaggan skulle den rullningen se ut som ett val, och ett tomt fält vore
   * ifyllt av att man tittat på det.
   */
  const touched = useRef(false);
  const optionId = useId();
  const [active, setActive] = useState(() => indexOf(values, initialValue));
  /**
   * Talets plats i raden, mätt i tecken efter hjulets längsta värde. Talen är
   * högerställda i den rutan, så enheten står stilla medan hjulet rullar: utan
   * en reserverad bredd knuffar "7,5" h:et i sidled och kolumnen vinglar för
   * varje rad som passerar.
   */
  const valueWidth = `${Math.max(...values.map((v) => v.length))}ch`;

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = indexOf(values, initialValue) * ROW;
    if (autoFocus) list.focus({ preventScroll: true });
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
    // Enbart vid öppning: efter det är det hjulet som bär värdet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commit(index: number) {
    touched.current = true;
    setActive(index);
    onChange(values[index]);
  }

  function scrollTo(index: number, behavior: ScrollBehavior) {
    listRef.current?.scrollTo({ top: index * ROW, behavior });
  }

  /**
   * Ett hjul har inget "släpp": fingret lämnar skärmen långt innan rullningen
   * tagit slut. Värdet läses därför en stund efter den sista rörelsen, när
   * snäppet redan lagt raden mitt i plattan.
   */
  function onScroll() {
    const list = listRef.current;
    if (!list) return;
    const index = clamp(Math.round(list.scrollTop / ROW), values.length);
    setActive((prev) => (prev === index ? prev : index));

    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      if (!touched.current || !listRef.current) return;
      const settled = clamp(Math.round(listRef.current.scrollTop / ROW), values.length);
      onChange(values[settled]);
    }, 90);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    let next: number;
    if (event.key === "ArrowDown") next = active + 1;
    else if (event.key === "ArrowUp") next = active - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = values.length - 1;
    else {
      // PageUp/PageDown rullar kolumnen på egen hand — då är det ett val ändå.
      touched.current = true;
      return;
    }

    event.preventDefault();
    const index = clamp(next, values.length);
    commit(index);
    scrollTo(index, "smooth");
  }

  return (
    <div
      ref={listRef}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-activedescendant={`${optionId}-${active}`}
      onScroll={onScroll}
      onPointerDown={() => (touched.current = true)}
      onWheel={() => (touched.current = true)}
      onKeyDown={onKeyDown}
      style={{ height: VISIBLE * ROW, paddingBlock: EDGE }}
      className="min-w-0 flex-1 snap-y snap-mandatory overflow-y-scroll overscroll-contain rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-night-accent/40 [-webkit-mask-image:linear-gradient(to_bottom,transparent,black_28%,black_72%,transparent)] [mask-image:linear-gradient(to_bottom,transparent,black_28%,black_72%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {values.map((v, i) => {
        // Raderna tonar och krymper med avståndet till plattan, så att mitten
        // syns som mitten även när hjulet står stilla.
        const distance = Math.abs(i - active);
        // Mitten ar vit som de ovriga raderna, inte accentfargad: markeringen
        // bars av storleken, vikten och plattan bakom — och eftersom fargen
        // darmed inte ar ensam barare av "vald" fungerar hjulet lika bra for
        // den som inte skiljer amber fran vitt. Raderna darifran tonar ut i
        // vitt — en gradvis nedtoning som pa svart gor samma jobb som
        // gratonerna gjorde pa vitt.
        const look =
          distance === 0
            ? "text-xl font-bold text-white"
            : distance === 1
              ? "text-lg text-white/75"
              : distance === 2
                ? "text-base text-white/45"
                : "text-sm text-white/25";
        return (
          <div
            key={v}
            id={`${optionId}-${i}`}
            role="option"
            aria-selected={i === active}
            onClick={() => {
              commit(i);
              scrollTo(i, "smooth");
            }}
            style={{ height: ROW }}
            className={`flex cursor-pointer snap-center items-center justify-center tabular-nums ${look}`}
          >
            {unit ? (
              <>
                <span style={{ width: valueWidth }} className="text-right">
                  {v}
                </span>
                {/* Följer radens egen färg och tonar alltså bort med den, men
                    aldrig fet och aldrig lika stor: enheten är inte det man
                    väljer. */}
                <span className="pl-1 text-[0.72em] font-normal opacity-60">{unit}</span>
              </>
            ) : (
              v
            )}
          </div>
        );
      })}
    </div>
  );
}
