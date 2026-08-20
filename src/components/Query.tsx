"use client";

import { Button } from "@/components/Button";
import type { QueryState } from "@/lib/useQuery";

/**
 * The two states a screen used to be born past.
 *
 * Server-rendered, a page arrived with its rows already in it: there was no
 * moment where the data was missing, so there was nothing to draw for that
 * moment. Reading from the browser puts that moment back — every screen now
 * spends a few hundred milliseconds with nothing, and some of them end with an
 * error instead of rows. Both belong to every screen equally, so both are drawn
 * once here rather than thirteen times.
 *
 * Children is a function and not a node, and that is the whole point of the
 * component: it is only called once `data` exists, so a screen writes
 * `data.projects` with no `?.` and no `?? []` anywhere in it. The undefined
 * window is real, but it is this file's problem rather than every screen's.
 */
export function Query<T>({
  state,
  children,
}: {
  state: QueryState<T>;
  children: (data: T) => React.ReactNode;
}) {
  // `data` first, and `error` only after it. A screen that has an answer shows
  // the answer; the other two branches are both "no answer yet", and which of
  // them is drawn is the difference between a wait and a dead end.
  if (state.data !== undefined) return <>{children(state.data)}</>;

  if (state.error !== null) {
    return (
      <div className="glass rounded-2xl px-5 py-9 text-center">
        <p className="text-sm font-semibold text-white/80">
          Kunde inte hämta data.
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-white/60">
          {state.error}
        </p>
        <div className="mt-4 flex justify-center">
          <Button type="button" size="md" onClick={state.reload}>
            Försök igen
          </Button>
        </div>
      </div>
    );
  }

  return <PanelSkeleton />;
}

/**
 * Three grey slabs at the heights the panels above them will be.
 *
 * A spinner would say "something is happening"; this says "a list is coming and
 * it starts here", which is the more useful of the two on a screen that is
 * about to be a list. The exact heights do not matter and are not meant to
 * match the real rows to the pixel — what matters is that the page does not
 * jump from nothing to full height, and that the eye already knows where to
 * look when it does.
 *
 * Exported as well as used here: every screen that reads its subject out of the
 * query string has to sit inside a <Suspense> boundary under `output: "export"`,
 * and this is the fallback that boundary shows. Same shape for "waiting on the
 * URL" as for "waiting on the database", because from the reader's side of the
 * glass they are the same wait.
 *
 * `animate-pulse` is the one animation, and `motion-reduce` turns it off: a
 * pulsing block is decoration, and decoration is exactly what that setting is
 * asking not to be shown.
 */
export function PanelSkeleton() {
  return (
    <div
      className="flex animate-pulse flex-col gap-2.5 motion-reduce:animate-none"
      aria-hidden
    >
      <div className="glass h-20 rounded-2xl" />
      <div className="glass h-20 rounded-2xl" />
      <div className="glass h-20 rounded-2xl opacity-60" />
      <span className="sr-only">Laddar…</span>
    </div>
  );
}
