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

/**
 * Approllen, som `accounts_role_check` stavar den.
 *
 * Aterexporterad och inte omdeklarerad. Typen stod skriven pa tva stallen, och
 * tva listor over samma tre strangar ar en list for lite: den dag en fjarde roll
 * laggs till i den ena fortsatter den andra att kompilera, och skillnaden syns
 * forst nar nagot beter sig fel i drift.
 */
export type { Roll } from "@/lib/types";
import type { Roll } from "@/lib/types";

type AuthState = {
  session: Session | null;
  /** True until the first session lookup settles. */
  loading: boolean;
  /**
   * Den inloggades approll, eller null medan den hamtas — och null ocksa for en
   * inloggning som saknar rad i `public.accounts`.
   *
   * ⚠️ Det har ar KOSMETIK, inte access control. Rollen avgor vad skarmen
   * visar; vad som faktiskt far skrivas avgors av RLS och av
   * kit.shifts_guard_leader_columns() i databasen. Webblasaren haller sin egen
   * JWT och kan tala med PostgREST direkt, sa en knapp som goms har ar en knapp
   * nagon annan anda kan trycka pa. Grinden ar i databasen; det har ar bara
   * artighet mot den som inte ska se knappen.
   *
   * Null behandlas som den mest begransade rollen overallt — faller man ur
   * kontotabellen ska man inte fa mer, utan mindre.
   */
  roll: Roll | null;
  /**
   * Vilken rad i `public.workers` den inloggade AR, eller null for ett konto
   * utan arbetare (kontorspersonal). Hamtas i samma fraga som rollen.
   *
   * Stamplingsskarmen behover den for att kunna filtrera fram egna pass:
   * SELECT pa shifts ar oppet for alla inloggade, sa "mina pass" ar ett
   * filter appen satter, inte ett RLS gor. SKRIVNINGARNA ar daremot
   * lasta till egen rad av shifts_update_egen_stampling.
   */
  arbetareId: string | null;
  /**
   * Den inloggades namn och profilbild, ur arbetarraden kontot pekar pa.
   *
   * De foljer med i SAMMA fraga som rollen i stallet for att hamtas dar de
   * behovs. Skalet ar att profilbilden numera ar knappen uppe i hogra hornet pa
   * VARJE skarm: en egen hamtning for den hade blivit en extra fraga per
   * sidladdning for ett par falt som redan lag i svaret vi anda vantade pa.
   *
   * Bada ar null for ett konto utan arbetare — kontorspersonal har en
   * inloggning men ingen arbetarrad, och da finns varken namn eller bild att
   * visa. Knappen faller tillbaka pa en siluett.
   */
  namn: string | null;
  bild: string | null;
  /** Adressen man loggade in med. Ur sessionen, inte ur databasen. */
  epost: string | null;
  /** Kontots status ('aktiv', 'avstangd', …), for kortet pa Konto-skarmen. */
  kontostatus: string | null;
  /** True medan rollen hamtas, sa skarmar kan vanta i stallet for att blinka. */
  rollLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * Kontouppgifterna, stamplade med vems de ar.
   *
   * `uid` ligger med i objektet i stallet for i en egen state, sa att ett svar
   * som hor till en tidigare inloggning aldrig kan lasas som den nuvarandes.
   * Rollen harleds sedan ur jamforelsen nedan, vilket ocksa gor att utloggning
   * inte behover nollstalla nagot: matchar inte uid:t finns ingen roll.
   */
  const [kontouppgifter, setKontouppgifter] = useState<{
    uid: string;
    roll: Roll | null;
    arbetareId: string | null;
    namn: string | null;
    bild: string | null;
    kontostatus: string | null;
  } | null>(null);

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

  const uid = session?.user.id;

  // Rollen hamtas ur public.accounts och inte ur JWT:n. Skalet ar att en roll
  // som andras ska sla igenom vid nasta laddning i stallet for att sitta kvar
  // tills tokenen gar ut en timme senare — och att lagga approller i JWT:n
  // hade krävt en custom access token hook, alltsa en sanning till att halla i
  // synk. accounts har SELECT oppet for alla inloggade, sa laget racker.
  // Ingen setState i effektens kropp: utloggning hanteras av harledningen
  // nedan i stallet, sa effekten har exakt en uppgift — att hamta nar det finns
  // nagon att hamta for.
  useEffect(() => {
    if (!uid) return;

    let avbruten = false;
    getSupabase()
      .from("accounts")
      // `workers(...)` utan `!inner`, av samma skal som i getKonton: ett konto
      // utan arbetare har ingen rad att joina mot, och ett inner join hade gjort
      // hela svaret tomt — alltsa slagit ut ROLLEN ocksa, och med den varje
      // rollberoende skarm. Utan !inner kommer kontot tillbaka med `workers`
      // tom, vilket ar precis vad vi vill sага: inloggning finns, person saknas.
      .select("role, worker_id, status, workers(name, profile_picture_url)")
      .eq("id", uid)
      .maybeSingle()
      .then(({ data }) => {
        if (avbruten) return;
        // Okand roll blir null, och null behandlas som arbetare av varje
        // anropare. Ett trasigt svar ska inte kunna befordra nagon.
        const raw = data?.role;
        // PostgREST typar en inbaddad tabell som array. Utan !inner kan den
        // ocksa vara null eller tom — fallet "konto utan arbetare".
        const w = (Array.isArray(data?.workers) ? data.workers[0] : data?.workers) as
          | { name: string | null; profile_picture_url: string | null }
          | null
          | undefined;
        setKontouppgifter({
          uid,
          roll:
            raw === "admin" || raw === "arbetsledare" || raw === "arbetare"
              ? raw
              : null,
          arbetareId: typeof data?.worker_id === "string" ? data.worker_id : null,
          namn: w?.name ?? null,
          bild: w?.profile_picture_url ?? null,
          kontostatus: typeof data?.status === "string" ? data.status : null,
        });
      });

    return () => {
      avbruten = true;
    };
  }, [uid]);

  // Bara uppgifter som hor till den som faktiskt ar inloggad just nu raknas.
  // Ett kvarliggande svar fran ett tidigare konto filtreras bort har i stallet
  // for att nollstallas i en effekt.
  const aktuella = kontouppgifter?.uid === uid ? kontouppgifter : null;
  const roll = aktuella?.roll ?? null;
  const arbetareId = aktuella?.arbetareId ?? null;
  const namn = aktuella?.namn ?? null;
  const bild = aktuella?.bild ?? null;
  const kontostatus = aktuella?.kontostatus ?? null;
  // Adressen kommer ur sessionen och inte ur kontoraden: den ar sann sa fort
  // man ar inloggad, alltsa utan att vanta pa fragan ovan.
  const epost = session?.user.email ?? null;
  // Utloggad ar inte "laddar": da finns det inget att vanta pa.
  const rollLoading = uid !== undefined && aktuella === null;

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
    <AuthContext.Provider
      value={{
        session,
        loading,
        roll,
        arbetareId,
        namn,
        bild,
        epost,
        kontostatus,
        rollLoading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
