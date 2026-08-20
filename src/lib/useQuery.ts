"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A read, from the browser.
 *
 * The server-rendered app had no hook like this and did not need one: a screen
 * was an `async function Page()`, it awaited `queries.ts` on the server, and
 * React had the rows in hand before the first byte reached the browser. A
 * static export deletes that step entirely — there is no server to await on, so
 * every screen now ships as empty markup and fills itself in after mount. This
 * is that "after mount", written once so thirteen screens do not each grow
 * their own useEffect with its own subtly different race.
 *
 * The race is the only interesting part. `run` is re-created on every render,
 * so it cannot be the dependency; `deps` is what the caller says the read
 * actually depends on (a project id out of the query string, usually) and an
 * empty array means "once". Between a change to those deps and the answer
 * coming back there can be two requests in flight, and PostgREST does not
 * promise to answer them in order — so each run takes a ticket and a late
 * answer to a superseded question is dropped rather than painted. Without that,
 * switching projects twice quickly leaves the first project's pass on screen
 * under the second project's heading.
 *
 * `reload` is the other half of what `revalidatePath` used to do. On the server
 * a mutation could tell Next to throw a route's cache away and re-render it;
 * here a mutation finishes, the caller calls `reload()`, and the screen asks
 * again. Same idea, one less machine.
 */
export type QueryState<T> = {
  /** Undefined until the first answer lands — including while reloading. */
  data: T | undefined;
  /** A message fit to show a user, or null. */
  error: string | null;
  loading: boolean;
  reload: () => void;
};

export function useQuery<T>(
  run: () => Promise<T>,
  deps: readonly unknown[]
): QueryState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Bumped to re-run the effect on demand. A counter rather than a boolean so
  // two reloads in a row are two runs, not one run and one no-op.
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // The ticket described above. A ref, not state: it must be readable by an
  // async continuation that closed over an older render.
  const latest = useRef(0);

  // `run` is deliberately read through a ref. The caller writes it inline
  // (`() => getWorkers()`), so it is a new function every render and depending
  // on it would re-fetch forever; `deps` is the contract instead.
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    const ticket = ++latest.current;
    setLoading(true);
    setError(null);

    runRef.current().then(
      (result) => {
        if (ticket !== latest.current) return;
        setData(result);
        setLoading(false);
      },
      (cause: unknown) => {
        if (ticket !== latest.current) return;
        setError(cause instanceof Error ? cause.message : "Något gick fel.");
        setLoading(false);
      }
    );

    // Nothing to abort: the supabase-js builder returns a thenable rather than
    // a cancellable request, so the ticket is what stops a late answer, not a
    // cancelled one. The request itself is left to finish and be ignored.
    return () => {
      latest.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, error, loading, reload };
}
