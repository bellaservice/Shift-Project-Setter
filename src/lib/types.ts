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
 * Ett pass vars två kolumner i arbetsdagboken inte går ihop, som det ser ut i
 * frågan innan dokumentet skapas.
 *
 * Ett pass, inte en rad: samma dag med samma tider och samma timmar loggades in
 * i ett svep för flera arbetare, och då ska det rättas i ett svep också.
 * `shiftIds` är raderna bakom det — en per arbetare i `workers`.
 */
export type PassProblem = {
  shiftIds: string[];
  /** 'YYYY-MM-DD', dagen passet ligger under i dagtabellerna. */
  date: string;
  /** Arbetarnas namn, i bokstavsordning, bara till att känna igen passet på. */
  workers: string[];
  /** Kolumnen "Pass Timmar". */
  hours: number;
  /** Kolumnen "Pass Tider", 'HH:MM'. Null när passet loggades innan kolumnerna
   *  fanns — då står cellen tom i dokumentet. */
  startTime: string | null;
  endTime: string | null;
  /** 'saknar': ingen tid alls att skriva ut. 'stammer-ej': båda tiderna finns,
   *  men spannet mellan dem är inte de timmar som står på raden. */
  kind: "saknar" | "stammer-ej";
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
 * `namn`, `epost` och `bild` kommer ur arbetaren och inte ur kontot — kontot
 * ager bara kopplingen och statusen. Byter arbetaren namn eller bild byter
 * raden med, av sig sjalv.
 */
export type KontoItem = {
  /** Kontots id, som ocksa ar auth-anvandarens. */
  id: string;
  workerId: string;
  namn: string;
  /** Arbetarens e-post — adressen kontot loggar in med. */
  epost: string;
  bild: string | null;
  status: KontoStatus;
  /** ISO-datum. Bara radens undertext; ingen logik hanger pa den. */
  skapad: string;
};

/** En arbetare som kan fa ett konto: har e-post och har inget konto redan. */
export type KontoKandidat = {
  id: string;
  namn: string;
  epost: string;
};
