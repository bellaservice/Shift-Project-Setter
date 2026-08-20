/**
 * The app's icon set.
 *
 * One family, drawn to one spec: a 24-unit box, no fill, `currentColor`, round
 * caps and joins, and a 2 stroke — 2.5 only on the two chevrons that appear at
 * 16px or smaller, where a 2 thins out to nothing. Sizing is the caller's job
 * (`h-5 w-5`), so an icon never carries a hard-coded dimension.
 *
 * Written out rather than pulled from a package because there are nine of them:
 * a dependency would ship a few hundred more, and the point of a set this small
 * is that every glyph in the app is visibly cut from the same stroke.
 *
 * All of them are `aria-hidden`. Every one sits either beside a text label or
 * inside a control that carries its own `aria-label`, so announcing the glyph
 * as well would only say the same thing twice.
 */
function Icon({
  className,
  strokeWidth = 2,
  children,
}: {
  className?: string;
  strokeWidth?: number;
  children: React.ReactNode;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export function ChevronRight({ className }: { className?: string }) {
  return (
    <Icon className={className} strokeWidth={2.5}>
      <path d="m9 18 6-6-6-6" />
    </Icon>
  );
}

export function ChevronLeft({ className }: { className?: string }) {
  return (
    <Icon className={className} strokeWidth={2.5}>
      <path d="m15 18-6-6 6-6" />
    </Icon>
  );
}

export function Plus({ className }: { className?: string }) {
  return (
    <Icon className={className} strokeWidth={2.5}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function Trash({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
      <path d="M10 11v5M14 11v5" />
    </Icon>
  );
}

export function Restore({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </Icon>
  );
}

export function Download({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M4 20h16" />
    </Icon>
  );
}

export function Warning({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </Icon>
  );
}

export function Check({ className }: { className?: string }) {
  return (
    <Icon className={className} strokeWidth={2.5}>
      <path d="m4 12 5.5 5.5L20 7" />
    </Icon>
  );
}

export function Clock({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </Icon>
  );
}

/** The two themes, on the switch that changes them. A sun and a moon rather
 *  than the words alone: the pair is read as one choice at a glance, which two
 *  Swedish words of similar length are not. */
export function Sun({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
  );
}

export function Moon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </Icon>
  );
}

/** Show / hide the password. The struck-through eye is the standard pair and
 *  the only one people already know, so it is not reinvented here. */
export function Eye({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

export function EyeOff({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.1 3.7M6.2 7.6A17 17 0 0 0 2 12s3.6 6 10 6a9.8 9.8 0 0 0 4.1-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </Icon>
  );
}

/** Two sheets, one behind the other — copy to clipboard. */
export function Copy({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
    </Icon>
  );
}

/** A person with no photograph — the fallback in an avatar circle, never a
 *  standalone icon. */
export function User({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </Icon>
  );
}
