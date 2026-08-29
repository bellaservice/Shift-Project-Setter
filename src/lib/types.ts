export type Worker = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  personal_number: string | null;
  account_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_email: string | null;
  profile_picture_url: string | null;
  created_at: string;
  /** Null while the worker is live; a timestamp while the row sits in
   *  Papperskorgen. See supabase/migrations/20260819160000_papperskorg.sql. */
  deleted_at: string | null;
};

export type Project = {
  id: string;
  /** "Project Namn" — how the app refers to the project. Null on rows created
   *  before the field existed; render it through `projectLabel`. */
  name: string | null;
  address: string;
  /** "Bestallare" in Logga Project — the company that ordered the job. Prints
   *  as "Bolag" in the Arbetsdagbok's bestallare block. */
  client_name: string | null;
  client_phone: string | null;
  /** The bestallare's own address, NOT the work site in `address`. */
  client_address: string | null;
  client_org_number: string | null;
  description: string | null;
  start_date: string | null;
  status: "active" | "inactive";
  activated_at: string;
  deactivated_at: string | null;
  created_at: string;
  /** Null while the project is live; a timestamp while the row sits in
   *  Papperskorgen. See supabase/migrations/20260819160000_papperskorg.sql. */
  deleted_at: string | null;
};

export type ProjectService = {
  id: string;
  project_id: string;
  service_name: string;
  price: number | null;
};

export type Shift = {
  id: string;
  project_id: string;
  worker_id: string;
  shift_date: string;
  /** Null tills arbetsledaren bekräftat passet (spec 5.3) — aldrig noll timmar. */
  hours: number | null;
  /** "Pass Tider". Postgres `time`, so 'HH:MM:SS'. Null on rows logged before
   *  the columns existed; paired by shifts_pass_times_paired. */
  start_time: string | null;
  end_time: string | null;
  created_at: string;
};

/** Screen 4.1 stat row. Shape defined by spec LD-1.5. */
export type HomeStats = {
  /** sum(shifts.hours) across all shifts, ever. 0 when there are none. */
  totalHours: number;
  /** count of projects where status = 'active'. */
  activeProjectCount: number;
  /** count of shifts whose shift_date is in the current Stockholm month. */
  monthShiftCount: number;
  /** First day of the counted month, 'YYYY-MM-01'. Label source of truth. */
  monthStart: string;
};

export type OngoingProject = {
  id: string;
  name: string | null;
  address: string;
  serviceNames: string[];
  totalHours: number;
};

export type RecentShiftRow = {
  id: string;
  shift_date: string;
  /** Null tills arbetsledaren bekräftat passet (spec 5.3) — aldrig noll timmar. */
  hours: number | null;
  worker_id: string;
  workerName: string;
};

export type ProjectWithDetails = Project & {
  services: ProjectService[];
  workerIds: string[];
};

/** One row of the "Alla Project" list. */
export type ProjectListItem = {
  id: string;
  name: string | null;
  address: string;
  status: "active" | "inactive";
  /** The date the project started: `start_date` when the user set one, else
   *  `activated_at`. Drives which month heading the row sits under. */
  startedAt: string;
  totalHours: number;
};

/** "Alla Project" rows bundled under the month they started in. */
export type ProjectMonthGroup = {
  /** 'YYYY-MM-01' — the key the heading is formatted from. */
  monthStart: string;
  projects: ProjectListItem[];
};

/** One row of the "Alla Arbetare" list. */
export type WorkerListItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  profile_picture_url: string | null;
  totalHours: number;
  /** How many distinct projects this worker has logged a pass against. */
  projectCount: number;
};

/** One row of one day table in the generated Arbetsdagbok. */
export type ArbetsdagbokRow = {
  arbetare: string;
  hours: number;
  /** 'HH:MM-HH:MM', or '' when the pass predates the Pass Tider columns. */
  passTider: string;
};

export type ArbetsdagbokDay = {
  date: string;
  rows: ArbetsdagbokRow[];
};

/**
 * Ett pass som saknar "Pass Tider", som frågan innan arbetsdagboken skapas
 * behöver det.
 *
 * Bara det som saknas. Ett pass vars spann inte är dess timmar är sedan
 * omskrivningen av Logga Timmar INTE ett problem: timmarna är egna och betalda,
 * spannet är när man var på plats, och en obetald rast mellan dem är det
 * normala fallet snarare än ett fel att rätta. Det som fortfarande behöver
 * frågas är en tom cell — dokumentet har då inget att skriva i kolumnen alls.
 *
 * Ett pass, inte en rad: samma dag med samma timmar loggades in i ett svep för
 * flera arbetare, och då ska det besvaras i ett svep också. `shiftIds` är
 * raderna bakom det — en per arbetare i `workers`.
 */
export type PassProblem = {
  shiftIds: string[];
  /** 'YYYY-MM-DD', dagen passet ligger under i dagtabellerna. */
  date: string;
  /** Arbetarnas namn, i bokstavsordning. Står i frågan: "Vilken tid började
   *  och slutade Anna den ... ". */
  workers: string[];
  /** Kolumnen "Pass Timmar". Bara sammanhang i frågan — den är redan besvarad
   *  och ändras inte här. Null när passet ännu inte bekräftats; grupperas då
   *  under en egen markör, aldrig ihop med ett pass som bekräftats till 0. */
  hours: number | null;
};

/** Everything the Arbetsdagbok document renders, already folded into the shape
 *  the template consumes. */
export type ArbetsdagbokData = {
  projectId: string;
  /** The cover page's "Project:" line. */
  projectName: string;
  /** False when `projectName` is only the address fallback, so the survey knows
   *  to ask for a real name before the cover prints one. */
  hasName: boolean;
  bestallare: {
    /** Cover "Adress:" — the bestallare's address, not the work site. */
    adress: string | null;
    /** Cover "Bolag:" */
    bolag: string | null;
    /** Cover "Org nummer:" */
    orgnr: string | null;
  };
  /** Service names only, no prices — the value repeated down the "Tjanst"
   *  column of every day table. */
  tjanst: string;
  /** Cover "Ordinarie tid" — sum of every CONFIRMED pass logged to the project.
   *  Obekräftade pass räknas inte in; de räknas i `obekraftade` i stället. */
  totalHours: number;
  /** Hur många pass på projectet som ännu inte bekräftats av arbetsledaren
   *  (`hours` är null). Sådana pass finns medvetet INTE i `days` — dokumentet
   *  får inte trycka en nolla för ett pass som bara inte är klart än.
   *
   *  Grinden framför dokumentet är hård när den här är > 0: till skillnad från
   *  de andra frågorna går den inte att gå förbi med `fortsatt=1`, eftersom
   *  spec avsnitt 7 gör den till hela dokumentets spärr. */
  obekraftade: number;
  days: ArbetsdagbokDay[];
};

/** Which screen an item in Papperskorgen came from, and goes back to. */
export type TrashKind = "worker" | "project";

/** One row of Papperskorgen. */
export type TrashItem = {
  kind: TrashKind;
  id: string;
  /** The name the item was thrown away under. */
  label: string;
  /** The second line: whatever identifies the item beyond its name. */
  detail: string;
  /** When it was thrown away — the start of its three weeks. */
  deletedAt: string;
};

/** aktiv | pausad | avstangd — se supabase/migrations/20260820120000_konton.sql. */
export type KontoStatus = "aktiv" | "pausad" | "avstangd";

/** Approllen, som `accounts_role_check` stavar den. Speglar `Roll` i lib/auth. */
export type Roll = "arbetsledare" | "arbetare";

/**
 * En rad i kontolistan: inloggningen och personen den ar, i ett.
 *
 * For ett arbetarkonto kommer `namn`, `epost` och `bild` ur arbetaren och inte
 * ur kontot — kontot ager bara kopplingen och statusen. Byter arbetaren namn
 * eller bild byter raden med, av sig sjalv.
 *
 * For ett konto utan arbetare finns ingen sadan rad att hamta ur. Da star
 * adressen i accounts.email och `namn` ar adressen, eftersom det ar det enda
 * kontot heter. `kopplad` sager vilket av de tva en rad ar, sa att listan slipper
 * gissa pa om `workerId` rakar vara null.
 */
export type KontoItem = {
  /** Kontots id, som ocksa ar auth-anvandarens. */
  id: string;
  /** Arbetaren kontot ar, eller null for ett konto utan arbetare. */
  workerId: string | null;
  namn: string;
  /** Adressen kontot loggar in med — ur arbetaren, eller ur kontot sjalvt. */
  epost: string;
  bild: string | null;
  status: KontoStatus;
  /**
   * Approllen. Avgor vad kontot far gora, och andras pa kontoskarmen.
   *
   * `null` for en inloggning vars accounts-rad bar ett varde appen inte kanner
   * igen. Behandlas som `arbetare` overallt — faller man ur det kanda ska man
   * fa mindre, inte mer.
   */
  roll: Roll | null;
  /** Om kontot hor till en arbetare i rostern. */
  kopplad: boolean;
  /** ISO-datum. Bara radens undertext; ingen logik hanger pa den. */
  skapad: string;
};

/**
 * En arbetare som kan fa ett konto: har inget konto redan.
 *
 * `epost` far vara null. Kravet att adressen finns star kvar — den ar
 * inloggningen — men det ar ett krav pa kontot, inte pa arbetaren, och det gar
 * att uppfylla pa stallet: formularet later anvandaren skriva in adressen, och
 * den sparas pa arbetaren nar kontot tillverkas. Att gomma arbetaren ur listan
 * i stallet vore att svara "hon finns inte" pa fragan "varfor kan jag inte ge
 * henne ett konto".
 */
export type KontoKandidat = {
  id: string;
  namn: string;
  epost: string | null;
};

/** Vem ett ärende visas för. Genomdrivs av RLS, inte av UI:t — se
 *  supabase/migrations/20260821120000_arenden.sql. */
export type ArendeSynlighet = "alla" | "egen" | "valda";

/**
 * Ett bokat ärende — en avtalad tid i Kalendern.
 *
 * Skilt från ett pass med flit: ett pass är arbetad tid som betalas ut och som
 * hamnar i Arbetsdagboken, ett ärende är något som ska hända och som ingen
 * timsumma i appen räknar med. Se supabase/migrations/20260821120000_arenden.sql.
 */
export type Arende = {
  id: string;
  titel: string;
  anteckning: string | null;
  /** 'YYYY-MM-DD'. */
  arende_date: string;
  /** Postgres `time`, alltså 'HH:MM:SS'. Båda null = heldag. */
  start_time: string | null;
  end_time: string | null;
  plats: string | null;
  /** Färgslug ur ARENDE_FARGER i src/lib/arendeFarger.ts. */
  farg: string;
  synlighet: ArendeSynlighet;
  /** auth.users.id för den som skapade ärendet. Sätts av databasen och går inte
   *  att ändra. Null bara om kontot raderats efteråt. */
  skapad_av: string | null;
  created_at: string;
};

/** Ett ärende som dess formulär läser in det: raden plus de konton den visas
 *  för, vilka bor i en egen tabell. */
export type ArendeDetalj = Arende & {
  /** accounts.id för varje ikryssat konto. Tom om synlighet inte är 'valda'. */
  tittare: string[];
};

/** En ruta i Kalenderns månadsrutnät. En dag utan någonting alls får ingen rad
 *  i svaret — rutnätet ritar de tomma dagarna själv. */
export type CalendarDay = {
  /** 'YYYY-MM-DD'. */
  date: string;
  /** Summan av dagens pass. Rutan skriver inte ut den — den står i namnen i
   *  stället — men månadssumman under rutnätet byggs av den. */
  totalHours: number;
  /** Arbetarna som har ett pass den dagen, i bokstavsordning. Det är DE som
   *  står i rutan: "vem jobbade" är frågan man ställer till en kalender, och
   *  en timsiffra utan namn svarar inte på den. */
  workerNames: string[];
  /** Färgsluggarna för dagens ärenden, i visningsordning. */
  arendeFarger: string[];
};

/** Ett loggat pass, som dagens lista i Kalendern visar det. */
export type DayShift = {
  id: string;
  workerId: string;
  workerName: string;
  projectId: string;
  /** Project Namn, med adressen som reserv — alltid `projectLabel`. */
  projectName: string;
  /** Null tills arbetsledaren bekräftat passet (spec 5.3) — aldrig noll timmar. */
  hours: number | null;
  /** 'HH:MM', eller null när passet loggades utan Pass Tider. */
  startTime: string | null;
  endTime: string | null;
};

/** Ett pass som dess redigeringsskärm läser in det. */
export type ShiftDetail = {
  id: string;
  /** 'YYYY-MM-DD'. */
  shiftDate: string;
  projectId: string;
  workerId: string;
  /** Bara till att känna igen passet på — arbetaren går inte att byta. */
  workerName: string;
  /** Null tills arbetsledaren bekräftat passet (spec 5.3) — aldrig noll timmar. */
  hours: number | null;
  /** 'HH:MM', eller null. */
  startTime: string | null;
  endTime: string | null;
};

// ---------------------------------------------------------------------------
// Bekraftelsekon (spec Fas 4 och avsnitt 6)
// ---------------------------------------------------------------------------

/** Passets lage i livscykeln. Speglar shifts_status_check. */
export type ShiftStatus = "open" | "closed" | "confirmed";

/**
 * Ett pass som vantar pa arbetsledarens bekraftelse.
 *
 * Kon innehaller bara obekraftade pass, sa `status` ar aldrig 'confirmed' har.
 * Bekraftelse ar slutgiltig (spec avsnitt 6), vilket ar precis varfor raden
 * lamnar kon i samma stund den bekraftas: det finns ingen vag tillbaka in.
 */
export type BekraftaShift = {
  id: string;
  shiftDate: string;
  workerName: string;
  /** Project Namn med adressen som reserv — alltid via `projectLabel`. */
  projectName: string;
  status: Exclude<ShiftStatus, "confirmed">;
  /**
   * Gallande stamplingar som ISO-strangar. `clockOut` null medan passet pagar
   * — det ar sa ett 'open' pass kanns igen. Bada null pa ett pass som loggats
   * via Logga Pass utan nagon stampling alls.
   */
  clockIn: string | null;
  clockOut: string | null;
  /**
   * Forsta varde kolumnen fick. Skiljer sig fran de gallande tiderna bara nar
   * nagon skrivit over dem, vilket ar exakt vad raden visar for anvandaren.
   * OBS: "original" betyder forsta registrerade vardet, inte nodvandigtvis
   * arbetarens egen stampling (spec 5.5).
   */
  clockInOriginal: string | null;
  clockOutOriginal: string | null;
  /** Null tills en gallande tid forst skrevs over. */
  clockEditedAt: string | null;
  /** Timmarna ur klockan. Null nar passet inte ar utstamplat. Underlag, aldrig lon. */
  calculatedHours: number | null;
  /**
   * Det PLANERADE timtalet fran Skapa Pass, eller null nar arbetsledaren
   * lamnade det oppet.
   *
   * Aldrig ett bekraftat varde: ett bekraftat pass har lamnat kon. Siffran ar
   * ett forslag att bekrafta eller andra, och den fyller Timmar-faltet i
   * bekraftelseraden nar den finns.
   */
  hours: number | null;
};

/** Kon grupperad per dag, aldsta dagen forst (spec Fas 4). */
export type BekraftaDay = {
  /** 'YYYY-MM-DD'. Rubriken skrivs ur den med `formatWeekdayDateSv`. */
  date: string;
  shifts: BekraftaShift[];
};

/**
 * Ett av den inloggade arbetarens egna pass, som stamplingsskarmen visar det.
 *
 * `clockIn` null = schemalagt men inte pabörjat. `clockIn` satt och `clockOut`
 * null = pagar just nu. Bada satta = utstamplat, och da ligger passet i
 * arbetsledarens ko i stallet (se BekraftaShift).
 */
export type StamplaPass = {
  id: string;
  /** 'YYYY-MM-DD'. */
  shiftDate: string;
  /** Project Namn med adressen som reserv — alltid via `projectLabel`. */
  projectName: string;
  clockIn: string | null;
  clockOut: string | null;
  /**
   * Det PLANERADE spannet, 'HH:MM:SS' eller null — det arbetsledaren skrev in
   * pa Skapa Pass. Sager nar passet ska boria, inte nar det borjade: det
   * senare star i `clockIn`.
   */
  startTime: string | null;
  endTime: string | null;
};

/**
 * Arbetarens egen oversikt pa Hem.
 *
 * Hem var fram till nu en enda skarm for alla: foretagets totala timmar,
 * antalet aktiva project, och knappar for att logga project. Ingenting av det
 * angar en arbetare, och halva det far hen inte ens rora. Den har typen ar
 * arbetarens svar pa samma fraga skarmen alltid stallt — "vad ar pa gang just
 * nu" — fast om hens egen dag.
 */
export type ArbetareHem = {
  /** Passet som pagar just nu: instamplat men inte utstamplat. Null annars. */
  pagaende: StamplaPass | null;
  /** Dagens och gardagens pass som annu gar att stampla pa, tidigast forst. */
  attStampla: StamplaPass[];
  /** Bekraftade timmar den har manaden. Obekraftade raknas inte — de ar inte
   *  lon an, och en siffra som krymper nar arbetsledaren rattar vore varre an
   *  ingen siffra alls. */
  timmarDennaManad: number;
  /** Bekraftade pass den har manaden. */
  passDennaManad: number;
  /** 'YYYY-MM-01' — manaden siffrorna galler, sa etiketten kan namna den. */
  monthStart: string;
};
