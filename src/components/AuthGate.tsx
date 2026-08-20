"use client";

import Image from "next/image";
/* Importerad och inte `src="/yellow.jpg"`, av samma skal som Backdrop importerar
   sina foton — plus ett som bara galler i drift: sajten ligger under
   /Shift-Project-Setter/ pa GitHub Pages, och en strang som borjar med `/` pekar
   forbi det prefixet, rakt pa domanens rot. `basePath` raddar den inte heller:
   det prefixet laggs pa optimerarens URL, och exporten kor `images.unoptimized`,
   som skickar vidare `src` precis som den star. Resultatet ar 404 pa loggan i
   det enda som syns nar man inte ar inloggad. En import gar genom bundlern, som
   skriver ut ratt URL med prefix och innehallshash. */
import logo from "../../public/yellow.jpg";
import { useState } from "react";
import { Button } from "@/components/Button";
import { FIELD_BOX } from "@/components/Field";
import { useAuth } from "@/lib/auth";

/**
 * The login screen, and the only thing that stands between the worker records
 * and the open internet.
 *
 * It renders instead of the app whenever there is no session. That is a real
 * boundary rather than a cosmetic one: with no session the browser holds only
 * the anon key, and every table denies `anon` outright, so an unauthenticated
 * visitor who skipped this screen would see a page of empty lists rather than
 * anyone's personnummer. The gate exists so they see a login prompt instead of
 * a broken app — Postgres is what actually refuses them.
 *
 * There is deliberately no "create account" here. Logins are minted by an admin
 * in Installningar > Konto, which needs the service role and therefore no
 * longer runs in this app at all (see README). A self-serve signup on a public
 * URL would let anyone on the internet issue themselves a staff account.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  // Held back until the stored session has been read. Rendering the login form
  // during this window would flash it at every already-signed-in user on every
  // reload.
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-white/50">Laddar…</p>
      </div>
    );
  }

  if (!session) return <LoginForm />;

  return <>{children}</>;
}

function LoginForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const { error } = await signIn(email.trim(), password);

    // On success the auth listener in AuthProvider swaps this whole screen out,
    // so there is nothing to do here but stop spinning on the failure path.
    if (error) {
      // Supabase answers a wrong password and an unknown address with the same
      // "Invalid login credentials", which is the behaviour worth keeping: a
      // distinct "no such user" on a public URL tells a stranger which email
      // addresses hold accounts.
      setError(
        error === "Invalid login credentials"
          ? "Fel e-post eller losenord."
          : error
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col justify-center">
      {/* Loggan i stallet for en rubrik: den bar redan namnet i sig, och en
          <h1> med "Bella Service" under den hade sagt samma sak en gang till.
          Bilden ar ritad pa svart och far darfor behalla sin egen botten i
          stallet for att laggas pa appens — rundade horn gor den till en bricka
          i stallet for en fyrkant som slutar mitt i skarmen.

          `priority`: det ar det enda som syns pa skarmen, och en logga som
          tonar in efter formularet under den ar en sida som ser trasig ut i ett
          ogonblick. Ingen `sizes` behovs — bilden ar aldrig bredare an 224px. */}
      <Image
        src={logo}
        alt="Bella Service"
        priority
        className="mx-auto mb-7 h-auto w-full max-w-[224px] rounded-2xl"
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-white/75">
            E-post
          </span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD_BOX}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-white/75">
            Losenord
          </span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={FIELD_BOX}
          />
        </label>

        {error && (
          <p
            role="alert"
            className="text-[13px] leading-relaxed text-night-danger"
          >
            {error}
          </p>
        )}

        <Button type="submit" disabled={busy} glow className="mt-2">
          {busy ? "Loggar in…" : "Logga In"}
        </Button>
      </form>
    </div>
  );
}
