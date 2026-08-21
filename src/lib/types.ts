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
  hours: number;
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
  hours: number;
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
   *  och ändras inte här. */
  hours: number;
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
  /** Cover "Ordinarie tid" — sum of every pass logged to the project. */
  totalHours: number;
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
  hours: number;
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
  hours: number;
  /** 'HH:MM', eller null. */
  startTime: string | null;
  endTime: string | null;
};
