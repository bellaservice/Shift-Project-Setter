import Link from "next/link";
import { Plus } from "@/components/Icons";

/**
 * The stat row: a single glass panel with its tiles separated by hairlines.
 *
 * The grouping is the whole idea, and it is why <StatCard> below draws no
 * surface of its own. Four separately bordered boxes at phone width read as
 * clutter; one panel with three hairlines in it reads as a row of figures. It
 * is also what keeps the numbers on one baseline — tiles in a shared grid line
 * up, tiles in their own boxes only line up by luck.
 *
 * `grid-flow-col auto-cols-fr` rather than a `grid-cols-N` class: the row takes
 * however many tiles it is given and splits itself evenly, so a screen with two
 * figures to show does not need a second variant of this component.
 */
export function StatRow({
  label,
  children,
}: {
  /** What the row is, for a screen reader — "Nyckeltal", "Summering". */
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={label} className="glass overflow-hidden rounded-3xl">
      <div className="grid grid-flow-col auto-cols-fr divide-x divide-night-line">
        {children}
      </div>
    </section>
  );
}

/**
 * Wireframe stat tile: small label on top, large value centered underneath it.
 * `subtitle` is the small line under the value that "Månads pass" uses to name
 * the month it counted (spec LD-1.4).
 *
 * The tile is a fixed three-row grid (label / value / subtitle) instead of a
 * centred flex column so every tile in the row lines up: the label always
 * starts at the same y, the value band is the same height whether or not a
 * subtitle is present, and a label that wraps cannot push the value down.
 * Labels carry their own line break ("Loggade\nTimmar") so the stacking is the
 * same at every width rather than depending on where the text happens to wrap.
 *
 * With `href` the tile renders as a link, so the "Lägg Till Arbetare" tile is
 * the same shape as the stat tiles beside it. `action` then tints it, because a
 * tile that navigates has to look unlike the ones that only report a number —
 * at this size a bare "+" is not enough of an affordance on its own.
 */
export function StatCard({
  label,
  value,
  subtitle,
  href,
  action,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  href?: string;
  action?: boolean;
}) {
  const className =
    "grid h-[96px] grid-rows-[30px_1fr_14px] items-center px-1.5 py-2.5 text-center";

  const content = (
    <>
      <div
        className={`whitespace-pre-line text-[11px] font-semibold leading-[1.15] ${
          action ? "text-night-accent" : "text-white/70"
        }`}
      >
        {label}
      </div>

      <div className="self-center">
        {action ? (
          // The "+" as a filled disc rather than a glyph: it is the one tile in
          // the row you can press, and a disc is what makes that readable
          // before the label is.
          <span
            aria-hidden
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-night-accent text-black"
          >
            <Plus className="h-5 w-5" />
          </span>
        ) : (
          <span className="text-[26px] font-bold leading-none tracking-tight text-white tabular-nums">
            {value}
          </span>
        )}
      </div>

      <div className="text-[10px] leading-tight text-white/70">{subtitle}</div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        title={label.replace("\n", " ")}
        className={`${className} transition-colors duration-200 ease-out active:bg-white/25 motion-reduce:transition-none`}
      >
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
