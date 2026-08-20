"use client";

import { useRouter } from "next/navigation";

/**
 * Wraps a form action so that where it says to go next actually happens.
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
 * fact about the screen that called it, not about the row that changed. Two of
 * them prove it: `saveWorker` returns Hem, the roster, or the form the user was
 * halfway through, and only the caller's URL could ever have said which.
 *
 * `void` is a real return value here and not an oversight — an action with
 * nothing to say leaves the user where they are, and the screen reloads its own
 * data instead.
 */
export function useNavigatingAction(
  action: (formData: FormData) => Promise<string | void>
): (formData: FormData) => Promise<void> {
  const router = useRouter();

  return async (formData: FormData) => {
    const destination = await action(formData);
    if (typeof destination === "string" && destination.length > 0) {
      router.push(destination);
    }
  };
}
