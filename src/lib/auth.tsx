"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/browser";

/**
 * Who is signed in, for the whole app.
 *
 * On the old server-rendered app there was no login at all: the tool ran on one
 * machine behind the office door, every query went out under the service role,
 * and RLS denied the browser everything. Neither half of that survives a static
 * export — the browser is now the only thing making queries, and the site
 * answers to the public internet. The signed-in user's JWT is what Postgres
 * checks against the policies in `20260820180000_rls_authenticated.sql`, so
 * this context is not a convenience: it is the app's access control.
 *
 * Accounts already exist in `auth.users` — Installningar > Konto created them
 * through the admin API. Nothing new is minted here; this only signs them in.
 */

type AuthState = {
  session: Session | null;
  /** True until the first session lookup settles. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();

    // Two things feed this. getSession() reads the session the last visit left
    // in localStorage, so a reload does not bounce the user to the login
    // screen. onAuthStateChange then keeps it current — it fires on sign-in,
    // sign-out, and on every silent token refresh an hour apart.
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await getSupabase().auth.signInWithPassword({
      email,
      password,
    });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await getSupabase().auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
