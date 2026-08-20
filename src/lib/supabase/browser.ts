import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The browser's Supabase client, holding the anon key.
 *
 * This replaces `admin.ts` for every read and write in the app. On GitHub Pages
 * there is no server, so there is nowhere to keep the service role key — it is
 * gone from the app entirely, and this client is now the only way data moves.
 *
 * The anon key is public by design and is compiled into the bundle; that is
 * safe, and only safe, because it carries no privileges of its own. What a
 * request may touch is decided server-side by Row Level Security, against the
 * JWT of the signed-in user. The policies live in
 * `supabase/migrations/*_rls_authenticated.sql`, and every table denies the
 * `anon` role outright — a visitor who never logs in can read nothing.
 *
 * `persistSession` keeps the session in localStorage so a reload does not throw
 * the user back to the login screen, and `autoRefreshToken` renews the access
 * token before its hour is up.
 */
let cachedClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY (locally in .env.local; for the deployed " +
        "site as GitHub Actions repository variables)."
    );
  }

  cachedClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return cachedClient;
}

/**
 * Same lazy-proxy shape the old admin client used, so call sites read as
 * `supabase.from(...)` rather than `getSupabase().from(...)`. Constructing
 * lazily matters because `next build` imports every module while prerendering,
 * and a top-level throw would fail the build whenever the env vars are absent.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabase(), prop, receiver);
  },
});
