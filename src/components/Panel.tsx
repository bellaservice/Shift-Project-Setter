import Link from "next/link";
import { ChevronRight, Plus } from "@/components/Icons";

/**
 * The app's hero action: a full-width glass slab with the amber disc on the
 * left and the destination named as large as the row can hold.
 *
 * Home invented this shape for "Logga Project" and "Logga Timmar". It is here
 * rather than in page.tsx because the two list screens open on the same move —
 * Alla Project on "Logga Project", Alla Arbetare on "Lagg Till Arbetare" — and
 * three screens that each drew their own version of it is precisely how a
 * family stops being one. The label changes; the shape does not.
 *
 * The "+" is a filled disc rather than a glyph in the text. Two long strings
 * both beginning with a plus read as two strings; the same label with the plus
 * lifted out into a disc reads as one shape repeated, which is what makes the
 * two rows on Home look like a pair of buttons rather than a list.
 */
export function ActionRow({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="glass flex h-[80px] items-center gap-4 rounded-2xl px-5 transition-colors duration-200 ease-out active:bg-white/25 motion-reduce:transition-none"
    >
      <span
        aria-hidden
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-night-accent text-black"
      >
        <Plus className="h-6 w-6" />
      </span>
      <span className="min-w-0 text-balance text-2xl font-extrabold leading-[1.05] tracking-tight text-white">
        {label}
      </span>
      <ChevronRight className="ml-auto h-5 w-5 shrink-0 text-white/55" />
    </Link>
  );
}

/**
 * The containers.
 *
 * Home established the rule the whole app now follows: a run of related rows is
 * ONE glass panel divided by hairlines, never a stack of separately bordered
 * boxes. At phone width, six bordered boxes are six competing rectangles; one
 * panel with five hairlines in it is a list. The rounding lives on the panel
 * and the rows are clipped by it, so the corners belong to the group rather
 * than to whichever row happens to be first.
 */
export function Panel({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`glass overflow-hidden rounded-2xl ${className}`}>
      {children}
    </div>
  );
}

/**
 * A panel whose children are rows: one hairline between each, and none at the
 * ends.
 *
 * `bleed` turns the clipping off for a list whose rows can glow. `overflow-
 * hidden` is what normally makes the corners belong to the group, but it also
 * crops anything a row paints outside its own box — an outer glow included —
 * leaving a highlighted row with its light sliced off square at the panel edge.
 * A bleeding list therefore rounds its own first and last rows instead, which
 * <RowLink> does when it is told to.
 */
export function PanelList({
  className = "",
  bleed,
  children,
}: {
  className?: string;
  bleed?: boolean;
  children: React.ReactNode;
}) {
  if (bleed) {
    return (
      <div className={`glass rounded-2xl ${className}`}>
        <div className="divide-y divide-night-line">{children}</div>
      </div>
    );
  }

  return (
    <Panel className={className}>
      <div className="divide-y divide-night-line">{children}</div>
    </Panel>
  );
}

/**
 * One tappable row in a <PanelList> — the shape used by Pagaende Project, Alla
 * Project, Alla Arbetare and Papperskorg alike. One component, so a fifth list
 * cannot quietly invent a fifth row layout.
 *
 * The parts are named for what they do rather than for where they sit: `media`
 * is the avatar slot, `title` and `subtitle` are the left column, `note` is a
 * third line for whatever that particular list is actually about, and `meta` is
 * the right-hand figure. The chevron is not optional — every row here leads
 * somewhere, whether by navigating or by opening a choice.
 *
 * `onClick` instead of `href` renders the same row as a <button>. Alla Project
 * needs that: its rows open a two-way choice rather than a page. It is the same
 * row either way, because it is the same thing to the person tapping it.
 */
export function RowLink({
  href,
  onClick,
  media,
  title,
  subtitle,
  note,
  meta,
  highlight,
  rounded,
}: {
  href?: string;
  onClick?: () => void;
  media?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** A third line under the subtitle, for a row that carries a deadline or a
   *  status the list is actually about. */
  note?: React.ReactNode;
  meta?: React.ReactNode;
  /**
   * The row is live — an active project. It gets the brand's amber as a ring
   * and an outer glow, which is the one place in the app where the accent
   * describes a *state* rather than an action.
   *
   * Three shadow stops rather than two, and each reaching further than it did:
   * a tight halo on the ring, a mid bloom, and a wide wash that fades out
   * around 120px. The light has to leave the row's own box for the row to look
   * lit rather than outlined — a glow that stops at the hairline reads as a
   * second border. The stops fall off fast enough that the neighbouring rows
   * are warmed, not washed out.
   *
   * `relative z-10` so the glow lands over its neighbours' hairlines instead of
   * under them; without it the divider draws a line straight through the light.
   */
  highlight?: boolean;
  /** Round this row's own outer corners — for a `bleed` list, which cannot clip
   *  them at the panel edge. */
  rounded?: boolean;
}) {
  const className = [
    "flex min-h-[64px] items-center gap-3 px-4 py-3 text-left",
    "transition-colors duration-200 ease-out active:bg-white/20 motion-reduce:transition-none",
    rounded ? "first:rounded-t-2xl last:rounded-b-2xl" : "",
    highlight
      ? "relative z-10 rounded-2xl ring-1 ring-night-accent/45 shadow-[0_0_28px_rgba(255,185,46,0.26),0_0_72px_rgba(255,185,46,0.16),0_0_120px_rgba(255,185,46,0.08)]"
      : "",
  ].join(" ");

  const content = (
    <>
      {media}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-bold text-white">{title}</div>
        {subtitle && (
          <div className="truncate text-xs text-white/60">{subtitle}</div>
        )}
        {note}
      </div>
      {meta && <div className="shrink-0 text-right">{meta}</div>}
      <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full cursor-pointer ${className}`}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={href ?? "#"} className={className}>
      {content}
    </Link>
  );
}

/**
 * The status line on a row — "Aktiv" / "Inaktiv", and anything else a list
 * ranks its rows by.
 *
 * A dot plus a word, never a colour alone: amber and grey are the same value to
 * a person who cannot separate them, so the state has to survive being read in
 * black and white. The dot is also what ties the row to the glow around it —
 * same colour, same meaning.
 */
export function RowStatus({
  on,
  children,
}: {
  on: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`mt-1.5 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
        on ? "text-night-accent" : "text-white/45"
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${on ? "bg-night-accent" : "bg-white/30"}`}
      />
      {children}
    </span>
  );
}

/**
 * The right-hand figure on a row: a number in the accent over a small caption.
 * Amber because it is the one piece of data the row is ranked by, and tabular
 * because a column of numbers that shifts by a pixel per row is a column that
 * looks broken.
 */
export function RowMeta({
  value,
  label,
  tone = "accent",
}: {
  value: React.ReactNode;
  label: string;
  tone?: "accent" | "plain";
}) {
  return (
    <>
      <div
        className={`text-[15px] font-bold tabular-nums ${
          tone === "accent" ? "text-night-accent" : "text-white"
        }`}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-white/55">
        {label}
      </div>
    </>
  );
}

/**
 * A label/value pair, stacked — the Profil page's company details, and any
 * other read-only fact. Label above value rather than beside it: Swedish
 * labels ("Momsreg.nr", "Postadress") are long enough that a two-column row
 * either wraps the label or truncates the value, and both are worse than the
 * extra 14px of height.
 */
export function DataRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
        {label}
      </dt>
      <dd className="text-sm font-bold text-white">{children}</dd>
    </div>
  );
}

/**
 * A group of form fields as one glass card.
 *
 * A long form on black with nothing but fields in it is a wall — twelve rows of
 * identical rectangles with no seams, which is exactly the shape a person
 * cannot hold in their head. Grouping the fields into two or three titled cards
 * turns it into "kontakt", "ersattning", "narmst anhorig": three things to fill
 * in rather than twelve.
 *
 * The card is the same `glass` as every panel elsewhere, and the fields inside
 * it are `glass-field`, which is darker. That pairing is the reason the group
 * reads as a container at all — the fields sink into it instead of stacking on
 * top of it.
 */
export function FormSection({
  title,
  hint,
  action,
  children,
}: {
  title?: string;
  hint?: string;
  /** A control belonging to the group as a whole, e.g. "+ Lagg Till". */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    /* `aria-label` rather than a <fieldset>/<legend>: a legend is painted INTO
       the box's own border, which on a glass card cuts a notch through the
       hairline and the top sheen at the same time. A labelled section groups
       the fields for a screen reader just as well and leaves the card whole. */
    <section aria-label={title} className="glass rounded-2xl p-4">
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
                {title}
              </h2>
            )}
            {hint && (
              <p className="mt-1 text-xs leading-relaxed text-white/60">{hint}</p>
            )}
          </div>
          {action}
        </header>
      )}
      <div className="flex flex-col gap-3.5">{children}</div>
    </section>
  );
}

/**
 * A block of prose inside a panel — the one-paragraph explanations on
 * Installningar and the notes under a form.
 *
 * Its own component only so that the two type tones stay paired: a bold white
 * lead line and body text at 70%. Body copy on black at full white vibrates;
 * at 55% it stops being readable at 12px. 70% is the band that does both.
 */
export function NoteRow({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3.5">
      {title && (
        <div className="text-sm font-bold text-white">{title}</div>
      )}
      <p className={`text-xs leading-relaxed text-white/70 ${title ? "mt-1.5" : ""}`}>
        {children}
      </p>
    </div>
  );
}
