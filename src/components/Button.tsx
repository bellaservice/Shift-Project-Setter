import Link from "next/link";

/**
 * The app's four buttons, and nothing else.
 *
 * The hierarchy is the point. Before this, a "save" button was `bg-slate-900`,
 * an inline "add" was `text-blue-600`, a delete was `border-red-300`, and each
 * screen picked its own — so nothing on any screen told you which control was
 * the one you had come for. Here there is exactly one filled amber button per
 * screen, and everything else is quieter than it:
 *
 *   primary    Amber fill, black text. The thing this screen is for — Logga
 *              Timmar, Spara Detaljer, Ladda ner. One per screen. The fill is
 *              the brand's own colour, and black-on-amber measures 11:1, which
 *              is the highest-contrast pairing anywhere in the app. That is not
 *              a coincidence: the primary action should be the most legible
 *              thing on the page.
 *   secondary  Glass, white text. Real actions that are not the main one.
 *   danger     Glass with a red hairline and red text. Destructive, and
 *              deliberately NOT a red fill: a red block reads as the primary
 *              action of the screen, which "Ta Bort" never is.
 *   dangerSolid  Red fill, white text. Only inside a confirmation dialog, where
 *              destruction genuinely is the action being confirmed.
 *
 * `ghost` is the fifth thing, and it is not a button: it is the inline
 * "+ Lagg Till" that adds a row to a list. Amber text, no chrome, but a real
 * 44px target — it used to be a 20px-tall blue string.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "dangerSolid"
  | "ghost";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-night-accent text-black active:bg-[#e5a41f] disabled:bg-white/15 disabled:text-white/40 disabled:shadow-none",
  secondary: "glass text-white active:bg-white/20 disabled:opacity-45",
  danger:
    "border border-night-danger/40 bg-night-danger/10 text-night-danger active:bg-night-danger/20 disabled:opacity-45",
  dangerSolid:
    "bg-night-danger text-black active:bg-[#e05c5c] disabled:opacity-50",
  ghost:
    "text-night-accent active:text-night-accent/70 disabled:opacity-45",
};

/**
 * The amber button's own light, in two strengths — pulled out of `VARIANT`
 * because they are two values for ONE property, and two `shadow-[...]` classes
 * on the same element are settled by stylesheet order rather than by which one
 * was written last. Picking one here means only ever emitting one.
 *
 *   rest   The drop the primary button has always had: a short amber fall
 *          beneath it, enough to lift the slab off the black.
 *   glow   `glow` — the screen is answered and this is now the only thing left
 *          to do. The light leaves the button's box on all sides and reaches
 *          about 70px, so the eye is pulled down to it without anything else on
 *          the page having to change colour to say so.
 */
const PRIMARY_SHADOW = {
  rest: "shadow-[0_10px_30px_-12px_rgba(255,185,46,0.75)]",
  glow: "shadow-[0_0_0_1px_rgba(255,185,46,0.35),0_0_26px_rgba(255,185,46,0.5),0_0_70px_rgba(255,185,46,0.28)]",
} as const;

/**
 * `lg` is the full-width action at the foot of a form; `md` is a control that
 * shares its row with something else. Both clear the 44px touch floor — `md` is
 * exactly on it, which is why there is no `sm`.
 */
const SIZE = {
  lg: "h-14 rounded-2xl px-5 text-base font-extrabold tracking-tight",
  md: "h-11 rounded-xl px-4 text-sm font-bold",
} as const;

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: keyof typeof SIZE = "lg",
  className = "",
  glow = false
) {
  return [
    // `justify-center` on a flex row rather than `text-center`: every one of
    // these can hold an icon beside its label, and centred text with a leading
    // icon centres the text, not the pair.
    "inline-flex cursor-pointer select-none items-center justify-center gap-2",
    // `box-shadow` is in the transition list, not just the colours: `glow`
    // switches shadows while the button stands still, and an instant jump from
    // a drop to a halo reads as a flicker rather than as the button lighting up.
    "transition-[color,background-color,border-color,box-shadow] duration-300 ease-out motion-reduce:transition-none",
    "disabled:cursor-not-allowed",
    variant === "ghost" ? GHOST_SIZE[size] : SIZE[size],
    VARIANT[variant],
    variant === "primary" ? PRIMARY_SHADOW[glow ? "glow" : "rest"] : "",
    className,
  ].join(" ");
}

/** A ghost keeps the height — the target has to stay 44px — but drops the pill
 *  and most of the padding, because it is text that acts, not a slab. */
const GHOST_SIZE = {
  lg: "h-11 rounded-lg px-2 text-sm font-bold",
  md: "h-11 rounded-lg px-2 text-sm font-bold",
} as const;

export function Button({
  variant = "primary",
  size = "lg",
  className,
  glow,
  ...props
}: React.ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: keyof typeof SIZE;
  /** Light the amber slab up — for the moment a screen is finished and this is
   *  the one thing left to press. `primary` only. */
  glow?: boolean;
}) {
  return (
    <button {...props} className={buttonClass(variant, size, className, glow)} />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "lg",
  className,
  glow,
  ...props
}: React.ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: keyof typeof SIZE;
  glow?: boolean;
}) {
  return (
    <Link {...props} className={buttonClass(variant, size, className, glow)} />
  );
}
