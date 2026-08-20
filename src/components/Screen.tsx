import { Backdrop, type BackdropTone } from "@/components/Backdrop";
import { TopBar } from "@/components/TopBar";

/**
 * Every screen in the app, from the outside in.
 *
 * This exists so that the design language spreads by *reference* rather than by
 * copy. Before it, Home owned the backdrop, the bar, the eyebrow and the
 * wordmark as ten lines of its own markup — and the only way to give another
 * page the same face was to paste those ten lines into it. Ten pasted copies is
 * ten places to forget a change, and it is also how a family of screens quietly
 * turns into ten screens that merely resemble each other.
 *
 * So the frame is here, and a page says only what is different about it:
 *
 *   tone      which light the room is under (see Backdrop)
 *   eyebrow   the small uppercase line — what kind of screen this is
 *   title     the big line — which screen it is
 *   badge     an optional counter or status beside the title
 *   back      the way out, folded into the top bar
 *   lead      anything that must sit between the heading and the content and
 *             still be full width (a hero action, a notice)
 *
 * Note what is NOT a prop: spacing, type sizes, the width cap, the order of the
 * bar and the heading. Those are the family resemblance, and a screen does not
 * get a say in them.
 *
 * `max-w-md` rather than the shell's `max-w-2xl`: this is a phone-first tool
 * used one-handed on a site, and a 672px-wide form on a desktop monitor is a
 * row of very long lines, not a better form. The one screen that needs the full
 * width — the A4 preview — opts out with `wide`.
 */
export function Screen({
  tone,
  eyebrow,
  title,
  hero,
  badge,
  back,
  lead,
  wide,
  children,
}: {
  tone: BackdropTone;
  eyebrow: string;
  /** Text in almost every case; a node when the title has to break by hand. */
  title: React.ReactNode;
  /**
   * The larger wordmark, and the one prop here that is a deviation rather than
   * a parameter. Home uses it and nothing else does: it is the app's front
   * door, and a front door being bigger than the rooms behind it is a statement
   * about hierarchy rather than a screen deciding it deserves special type.
   */
  hero?: boolean;
  badge?: React.ReactNode;
  back?: { href: string; label?: string };
  lead?: React.ReactNode;
  wide?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      /* The tone, on the content as well as on the backdrop. It changes nothing
         here; it is a hook for the one rule that has to know what is BEHIND the
         heading — on the daylight theme the `photo` tone leaves the picture
         undimmed under the first 240px, so those two lines are set white with a
         navy halo instead of near-black (see theme-light.css). A screen still
         says only which room it is in; the stylesheet decides what that costs. */
      data-tone={tone}
      className={`flex w-full flex-col gap-4 ${wide ? "" : "mx-auto max-w-md"}`}
    >
      <Backdrop tone={tone} />

      {/* `app-chrome` on the bar and the heading: the Arbetsdagbok screen is a
          real page that Chrome prints to PDF, and the navigation has no
          business on the paper. See the print rule in globals.css. */}
      <div className="app-chrome">
        <TopBar back={back} />
      </div>

      {/* The eyebrow/title pair is the app's signature: a small uppercase line
          naming the category, then the screen's own name set as large as the
          page can afford. It is what makes an eight-field form and a list of
          forty rows read as the same product — you recognise a screen by its
          heading long before you have parsed what is under it.

          `text-balance` so a two-word title never drops a single short word
          onto a line of its own.

          Both lines carry their own shadow. On the `photo` tone the picture is
          left undimmed behind them, so the heading cannot borrow contrast from
          a wash the way the panels borrow it from the black inside `glass` —
          it has to bring its own. A soft dark halo does that without darkening
          the photograph, and on the five tones with no picture behind them it
          is invisible. */}
      <header className="app-chrome flex items-end justify-between gap-3 pt-1 pb-1">
        <div className="min-w-0 [text-shadow:0_1px_3px_rgba(0,0,0,0.95),0_2px_14px_rgba(0,0,0,0.85)]">
          {/* The eyebrow overrides that halo with a denser one of its own.
              Measured at the glyph pixels, the title clears 19.8:1 on the photo
              tone while this line only reached 2.3:1 against a bokeh highlight:
              the title is 38px and extra-bold, so a wide soft blur banks up
              plenty of density around its strokes, but at 11px with 0.2em
              tracking the same blur washes straight through. Three stacked
              zero-offset blurs build the density a thin glyph needs. */}
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white [text-shadow:0_0_2px_#000,0_0_4px_rgba(0,0,0,0.98),0_0_9px_rgba(0,0,0,0.95),0_0_18px_rgba(0,0,0,0.9)]">
            {eyebrow}
          </p>
          <h1
            className={`mt-1.5 text-balance font-extrabold leading-[1.06] tracking-tight text-white ${
              hero ? "text-[38px]" : "text-[32px]"
            }`}
          >
            {title}
          </h1>
        </div>
        {badge && <div className="shrink-0 pb-1.5">{badge}</div>}
      </header>

      {lead}

      {children}
    </div>
  );
}

/**
 * The counter that sits beside a heading — "12" next to Alla Project, the
 * number of pagaende project on Home. A glass pill rather than a coloured
 * badge: it is a fact about the list, not a warning about it.
 */
export function CountBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="glass rounded-full px-3 py-1.5 text-xs font-bold tabular-nums text-white/80">
      {children}
    </span>
  );
}

/**
 * A section heading inside a screen — "Pagaende Project", "Senaste Pass".
 *
 * Smaller and quieter than the screen's own <h1> by design: the hierarchy on a
 * page has to be visible at a glance, and two headings of similar weight are
 * two headings you have to read to tell apart.
 */
export function SectionHeading({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3 px-1">
      <h2 className="text-lg font-extrabold tracking-tight text-white">
        {children}
      </h2>
      {aside}
    </div>
  );
}

/**
 * The small uppercase label above a group of rows — a month, "Project",
 * "Arbetare". One rung below <SectionHeading>, and the same shape as the
 * screen's own eyebrow, so the page reads as one system of labels rather than
 * as three different kinds of small text.
 */
export function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
      {children}
    </h2>
  );
}

/**
 * What a screen shows when it has nothing to show.
 *
 * A glass panel rather than a bare line of grey text: an empty list that renders
 * as one sentence floating on black looks like a page that failed to load. The
 * panel says the space is meant to be there, and the action says how to fill it.
 */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl px-5 py-9 text-center">
      <p className="text-sm font-semibold text-white/80">{title}</p>
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-white/60">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
