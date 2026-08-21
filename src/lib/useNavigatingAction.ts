"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Wraps a form action so that where it says to go next actually happens — and
 * so that a failure lands IN the form instead of taking the app down with it.
 *
 * Every one of these actions used to end in `redirect("/alla-project")`. That
 * was a server function throwing a signal the framework caught on its way out
 * of the request — and it is specifically not available here: `redirect()` may
 * be called while a Client Component renders, but not from an event handler,
 * and a form action is an event handler. Next says so outright and points at
 * `useRouter` instead.
 *
 * So the actions stopped navigating and started *answering*: each one now
 * returns the path it used to redirect to, and this turns that answer back into
 * a navigation. Which is the better shape regardless of what is possible — the
 * action's job is the write, and "where the user should be afterwards" is a
 * fact about the screen that called it, not about the row that changed.
 *
 * The try/catch is the other half, and it is not a nicety. React treats a
 * rejected form action as a render error: with no error boundary above it the
 * whole tree unmounts and Next paints its blank "This page couldn't load"
 * page. So every refusal these actions make on purpose — "Namn pa narmst
 * anhorig kravs" — and every network hiccup on the way to Supabase looked
 * identical to the user: a white screen with no message, and a form they had
 * just spent a minute filling in, gone. Caught here, the message is a string on
 * the screen and the form is still standing.
 *
 * `void` is a real return value here and not an oversight — an action with
 * nothing to say leaves the user where they are, and the screen reloads its own
 * data instead.
 */
export function useNavigatingAction(
  action: (formData: FormData) => Promise<string | void>
): {
  /** Hand this to `<form action={...}>`. */
  submit: (formData: FormData) => Promise<void>;
  /** Vad som gick fel, redan pa svenska, eller null. */
  error: string | null;
  /** Sant medan atgarden pagar — for att spärra knappen mot dubbeltryck. */
  pending: boolean;
} {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return {
    error,
    pending,
    submit: async (formData: FormData) => {
      setError(null);
      setPending(true);
      try {
        const destination = await action(formData);
        if (typeof destination === "string" && destination.length > 0) {
          router.push(destination);
        }
      } catch (cause) {
        setError(actionErrorMessage(cause));
      } finally {
        setPending(false);
      }
    },
  };
}

/**
 * Ett fel som gick att lasa.
 *
 * De flesta av appens fel ar redan skrivna for den som star vid skarmen
 * ("Telefonnummer eller e-post till narmst anhorig kravs") och slapps da
 * igenom ordagrant. De tva som inte ar det far en oversattning, eftersom de ar
 * de tva som faktiskt intraffar i drift:
 *
 *   - `TypeError: Failed to fetch` — telefonen tappade natet, eller webblasaren
 *     (Brave med skoldarna uppe) stoppade anropet. Ett engelskt TypeError sager
 *     ingenting om att det ar natet som ar borta.
 *   - En utgangen inloggning. Access-token lever en timme; ligger fliken oppen
 *     over natten ar den dod, och Postgres svarar "JWT expired" pa forsta
 *     sparandet. Det ar inte ett fel i formularet, och rattelsen ar att logga
 *     in igen.
 */
export function actionErrorMessage(cause: unknown): string {
  const raw =
    cause instanceof Error
      ? cause.message
      : typeof cause === "string"
        ? cause
        : "";

  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return (
      "Ingen kontakt med servern. Kontrollera nätet och försök igen — " +
      "inget har sparats."
    );
  }

  if (/jwt|token|not authenticated|401|expired/i.test(raw)) {
    return (
      "Din inloggning har gått ut. Ladda om sidan och logga in igen, " +
      "så finns uppgifterna kvar att fylla i på nytt."
    );
  }

  return raw.trim().length > 0 ? raw : "Något gick fel. Försök igen.";
}
