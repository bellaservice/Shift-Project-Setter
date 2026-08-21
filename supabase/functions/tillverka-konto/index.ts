// Tillverkar en inloggning. Den enda kod i projektet som kor pa en server.
//
// Varfor den finns
// ----------------
// Att skapa en anvandare i Supabase Auth gar genom `auth.admin.createUser`, och
// det API:et svarar bara pa service role-nyckeln. Den nyckeln gar forbi RLS pa
// varje tabell, sa den far aldrig na en webblasare -- och en statisk sida pa
// GitHub Pages har ingen server att gomma den pa. Darfor den har funktionen:
// den kor hos Supabase, nyckeln finns i dess miljo och lamnar den aldrig, och
// appen ber den om saken over HTTP i stallet for att gora den sjalv.
//
// Vem som far anropa den
// ----------------------
// `verify_jwt` (pa som standard) racker INTE som vakt. Anon-nyckeln ar ocksa en
// giltig JWT, sa den slapper igenom en besokare som aldrig loggat in. Vakten ar
// darfor `getUser()` nedan: den vaxlar in anroparens token mot en riktig
// anvandare, och en anon-nyckel har ingen. Samma grans som RLS drar i resten av
// appen -- inloggad eller ingenting.
//
// Rollback
// --------
// Kontot ar tva rader i tva olika system: en i auth.users, en i
// public.accounts. Det gar inte att skriva bada i en transaktion. Faller den
// andra tas den forsta bort igen, eftersom en auth-anvandare utan konto-rad ar
// vardre an inget konto alls: den syns inte i Konto-listan, men den kan logga
// in, och RLS ger varje inloggad full atkomst.

import { createClient } from "jsr:@supabase/supabase-js@2";

// CORS, och den ENDA raden som ar vard att lasa noga ar allow-headers.
//
// En handskriven lista star sig inte har. supabase-js skickar inte bara
// Authorization och Content-Type: den lagger till apikey och x-client-info
// pa varje anrop, och webblasaren jamfor sin onskelista mot den har listan FORE
// den skickar sjalva begaran. Saknas ett enda namn skickas ingenting alls, och
// felet som nar appen ar inte 401 eller 500 utan "failed to send a request" --
// funktionen ar helt oskyldig, den blev aldrig anropad.
//
// Darfor eko: det webblasaren ber om ar per definition det den behover, och
// listan kan inte hamna ur takt med vad klientbiblioteket rakar skicka i nasta
// version. Fallback for anrop utan preflight (curl, server till server).
function huvuden(req: Request) {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      req.headers.get("Access-Control-Request-Headers") ??
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

function svar(req: Request, kropp: unknown, status = 200) {
  return new Response(JSON.stringify(kropp), { status, headers: huvuden(req) });
}

function fel(req: Request, meddelande: string, status = 400) {
  return svar(req, { error: meddelande }, status);
}

type Kropp = {
  /** Arbetaren kontot ska tillhora, eller null for ett konto utan arbetare. */
  workerId?: string | null;
  email?: string;
  password?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: huvuden(req) });
  }
  if (req.method !== "POST") return fel(req, "Metoden stods inte", 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    return fel(req, "Funktionen saknar miljovariabler", 500);
  }

  // --- Vakten -------------------------------------------------------------
  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return fel(req, "Inte inloggad", 401);

  const somAnroparen = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: anropare, error: anroparFel } = await somAnroparen.auth.getUser();
  if (anroparFel || !anropare?.user) return fel(req, "Inte inloggad", 401);

  // --- Vad som begars -----------------------------------------------------
  let kropp: Kropp;
  try {
    kropp = await req.json();
  } catch {
    return fel(req, "Ogiltig begaran");
  }

  const workerId = kropp.workerId?.trim() || null;
  const email = (kropp.email ?? "").trim().toLowerCase();
  const password = kropp.password ?? "";

  if (!email || !email.includes("@")) return fel(req, "E-postadressen ar ogiltig");
  // Samma golv som Supabase Auth sjalv haller. Kontrollen finns har for att ge
  // ett svenskt fel i stallet for ett engelskt fran Auth.
  if (password.length < 6) {
    return fel(req, "Losenordet maste vara minst 6 tecken");
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- Arbetaren, om det ar ett arbetarkonto -------------------------------
  if (workerId) {
    const { data: arbetare, error: arbetarFel } = await admin
      .from("workers")
      .select("id, email, deleted_at")
      .eq("id", workerId)
      .maybeSingle();

    if (arbetarFel) return fel(req, `Kunde inte lasa arbetaren: ${arbetarFel.message}`, 500);
    if (!arbetare || arbetare.deleted_at) return fel(req, "Arbetaren finns inte");

    const befintlig = (arbetare.email ?? "").trim().toLowerCase();

    if (befintlig && befintlig !== email) {
      // Adressen ar inloggningen. Att skapa kontot pa en annan adress an den
      // som star pa arbetaren vore att skapa den glidning
      // assertLoginEmailUnchanged() finns for att forhindra.
      return fel(req, 
        `Arbetaren har e-posten ${arbetare.email}. Andra den pa arbetaren forst om kontot ska ha en annan adress.`
      );
    }


    // Kontrollen forst, skrivningen sedan. Ordningen ar inte kosmetisk: har
    // arbetaren redan ett konto ska ingenting handa, och en e-post skriven
    // fore den kontrollen vore en andring som blev kvar efter ett avbrutet
    // forsok.
    const { data: redan, error: redanFel } = await admin
      .from("accounts")
      .select("id")
      .eq("worker_id", workerId)
      .maybeSingle();
    if (redanFel) return fel(req, `Kunde inte lasa konton: ${redanFel.message}`, 500);
    if (redan) return fel(req, "Arbetaren har redan ett konto");

    if (!befintlig) {
      // Arbetaren saknade adress och anvandaren fyllde i en. Den skrivs till
      // arbetaren, dels for att triggern accounts_require_worker_email kraver
      // det, dels for att de tva maste vara samma adress for alltid darefter.
      const { error: sparaFel } = await admin
        .from("workers")
        .update({ email })
        .eq("id", workerId);
      if (sparaFel) {
        return fel(req, `Kunde inte spara e-posten pa arbetaren: ${sparaFel.message}`, 500);
      }
    }
  }

  // --- Inloggningen --------------------------------------------------------
  const { data: skapad, error: skapaFel } = await admin.auth.admin.createUser({
    email,
    password,
    // Ingen bekraftelselank. Adressen ar utdelad av en administrator som just
    // kopierat losenordet till urklipp, inte pastadd av den som ager den, och
    // ett konto som inte gar att logga in i forran nagon oppnat ett mejl vore
    // ett halvt utdelat konto.
    email_confirm: true,
  });

  if (skapaFel || !skapad?.user) {
    const m = skapaFel?.message ?? "okant fel";
    if (/already|registered|exists/i.test(m)) {
      return fel(req, `Det finns redan en inloggning pa ${email}`);
    }
    return fel(req, `Kunde inte skapa inloggningen: ${m}`, 500);
  }

  // --- Kontoraden ----------------------------------------------------------
  const { error: kontoFel } = await admin.from("accounts").insert({
    id: skapad.user.id,
    worker_id: workerId,
    // accounts_worker_xor_email: exakt en av de tva. For ett arbetarkonto ar
    // workers.email sanningen och den har kolumnen tom.
    email: workerId ? null : email,
    status: "aktiv",
  });

  if (kontoFel) {
    await admin.auth.admin.deleteUser(skapad.user.id);
    return fel(req, `Kunde inte spara kontot: ${kontoFel.message}`, 500);
  }

  return svar(req, { id: skapad.user.id, email });
});
