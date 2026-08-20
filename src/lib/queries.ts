import { supabase } from "@/lib/supabase/browser";
import { formatPassTider, monthStartOf, passSpanHours } from "@/lib/format";
import type {
  ArbetsdagbokData,
  ArbetsdagbokDay,
  HomeStats,
  KontoItem,
  KontoKandidat,
  KontoStatus,
  OngoingProject,
  PassProblem,
  Project,
  ProjectListItem,
  ProjectMonthGroup,
  ProjectWithDetails,
  RecentShiftRow,
  TrashItem,
  Worker,
  WorkerListItem,
} from "@/lib/types";

/**
 * First day of the current Europe/Stockholm calendar month, as 'YYYY-MM-01'.
 *
 * Anchored on the Swedish wall clock, not UTC (spec LD-1.1): between Stockholm
 * midnight and UTC midnight on the 1st, a UTC-derived month is still the
 * previous one, so the count and its label would both name the wrong month.
 */
function stockholmMonthStart(): string {
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return `${today.slice(0, 7)}-01`;
}

/** Exclusive upper bound for the month starting at `monthStart`. */
function nextMonthStart(monthStart: string): string {
  const [year, month] = monthStart.split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

/** numeric hours folded through IEEE doubles: 0.1 + 0.2 must not reach a screen. */
function roundHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}

export async function getHomeStats(): Promise<HomeStats> {
  const monthStart = stockholmMonthStart();
  const monthEnd = nextMonthStart(monthStart);

  const [hoursResult, activeResult, monthResult] = await Promise.all([
    // NOTE: spec 4.1.3 puts this behind `sum()` in a get_home_stats() RPC so the
    // whole shifts table is not transferred per page view. That migration is not
    // applied to the linked project yet, so the fold stays in Node for now.
    // `!inner` plus `is(..., null)` is how the papperskorg stays out of every
    // total: a pass whose project or whose worker was thrown away does not
    // count. Deleting used to cascade the pass away entirely, so the number
    // dropping is exactly what the user expects to see -- the difference is
    // that the row survives, and a restore brings the hours back with it.
    supabase
      .from("shifts")
      .select("hours, projects!inner(deleted_at), workers!inner(deleted_at)")
      .is("projects.deleted_at", null)
      .is("workers.deleted_at", null),
    supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .is("deleted_at", null),
    // Half-open range, so no special-casing for 28/29/30/31-day months.
    supabase
      .from("shifts")
      .select("*, projects!inner(deleted_at), workers!inner(deleted_at)", {
        count: "exact",
        head: true,
      })
      .is("projects.deleted_at", null)
      .is("workers.deleted_at", null)
      .gte("shift_date", monthStart)
      .lt("shift_date", monthEnd),
  ]);

  // A query that errors and a query that returns nothing are different
  // situations; swallowing the first paints a confident "0 / 0 / 0" over a
  // broken database connection.
  const error = hoursResult.error ?? activeResult.error ?? monthResult.error;
  if (error) {
    throw new Error(`Kunde inte lasa hemstatistik: ${error.message}`, {
      cause: error,
    });
  }

  const totalHours = (hoursResult.data ?? []).reduce(
    (sum, s) => sum + Number(s.hours),
    0
  );

  return {
    totalHours: roundHours(totalHours),
    activeProjectCount: activeResult.count ?? 0,
    monthShiftCount: monthResult.count ?? 0,
    monthStart,
  };
}

/**
 * "Pågående Project" is exactly `projects.status = 'active'` (spec 4.1,
 * Interpretation A) — the same set the "Aktiva Project" tile counts, so the
 * number and the row count always agree. A project with no shifts yet is still
 * ongoing and renders 0h; it is the lifecycle column, not shift recency, that
 * decides.
 */
export async function getOngoingProjects(): Promise<OngoingProject[]> {
  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, name, address")
    .eq("status", "active")
    .is("deleted_at", null)
    // PostgREST guarantees no order without this. The id tiebreak makes the
    // order total, so the list never reshuffles between two identical renders.
    .order("activated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });

  if (projectsError) {
    throw new Error(`Kunde inte lasa pagaende project: ${projectsError.message}`, {
      cause: projectsError,
    });
  }

  const projectIds = (projects ?? []).map((p) => p.id);
  if (projectIds.length === 0) return [];

  const [servicesResult, shiftsResult] = await Promise.all([
    supabase
      .from("project_services")
      .select("project_id, service_name")
      .in("project_id", projectIds)
      .order("service_name", { ascending: true }),
    supabase
      .from("shifts")
      .select("project_id, hours, workers!inner(deleted_at)")
      .in("project_id", projectIds)
      .is("workers.deleted_at", null),
  ]);

  const error = servicesResult.error ?? shiftsResult.error;
  if (error) {
    throw new Error(`Kunde inte lasa projectdetaljer: ${error.message}`, {
      cause: error,
    });
  }

  const hoursByProject = new Map<string, number>();
  for (const s of shiftsResult.data ?? []) {
    hoursByProject.set(
      s.project_id,
      (hoursByProject.get(s.project_id) ?? 0) + Number(s.hours)
    );
  }

  const servicesByProject = new Map<string, string[]>();
  for (const svc of servicesResult.data ?? []) {
    const list = servicesByProject.get(svc.project_id) ?? [];
    list.push(svc.service_name);
    servicesByProject.set(svc.project_id, list);
  }

  // Driven by the project list, not by the shift list: a project with zero
  // shifts still gets a row.
  return (projects ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    serviceNames: servicesByProject.get(p.id) ?? [],
    totalHours: roundHours(hoursByProject.get(p.id) ?? 0),
  }));
}

export async function getWorkers(): Promise<Worker[]> {
  const { data } = await supabase
    .from("workers")
    .select("*")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  return data ?? [];
}

/** One worker, for the Redigera Arbetare screen. Null when the id is unknown. */
export async function getWorker(id: string): Promise<Worker | null> {
  const { data, error } = await supabase
    .from("workers")
    .select("*")
    .eq("id", id)
    // A worker in Papperskorgen is not editable from Alla Arbetare; the page
    // 404s and the trash screen is where the row is reachable.
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Kunde inte lasa arbetaren: ${error.message}`, {
      cause: error,
    });
  }

  return data ?? null;
}

export async function getProjects(): Promise<Project[]> {
  const { data } = await supabase
    .from("projects")
    .select("*")
    .is("deleted_at", null)
    // Sorted by the label the dropdown shows, with the address fallback last so
    // named projects stay alphabetical among themselves.
    .order("name", { ascending: true, nullsFirst: false })
    .order("address", { ascending: true });
  return data ?? [];
}

export async function getProjectWithDetails(
  id: string
): Promise<ProjectWithDetails | null> {
  const [{ data: project }, { data: services }, { data: assignments }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("project_services")
        .select("*")
        .eq("project_id", id)
        .order("service_name", { ascending: true }),
      supabase
        .from("project_workers")
        .select("worker_id, workers!inner(deleted_at)")
        .eq("project_id", id)
        .is("workers.deleted_at", null),
    ]);

  if (!project) return null;

  return {
    ...project,
    services: services ?? [],
    workerIds: (assignments ?? []).map((a) => a.worker_id),
  };
}

export async function getRecentShiftsForProject(
  projectId: string,
  limit = 20
): Promise<RecentShiftRow[]> {
  const { data: shifts } = await supabase
    .from("shifts")
    .select("id, shift_date, hours, worker_id, workers!inner(deleted_at)")
    .eq("project_id", projectId)
    .is("workers.deleted_at", null)
    .order("shift_date", { ascending: false })
    .limit(limit);

  if (!shifts || shifts.length === 0) return [];

  const workerIds = [...new Set(shifts.map((s) => s.worker_id))];
  const { data: workers } = await supabase
    .from("workers")
    .select("id, name")
    .in("id", workerIds);

  const nameById = new Map((workers ?? []).map((w) => [w.id, w.name]));

  return shifts.map((s) => ({
    id: s.id,
    shift_date: s.shift_date,
    hours: Number(s.hours),
    worker_id: s.worker_id,
    workerName: nameById.get(s.worker_id) ?? "Okand arbetare",
  }));
}

/**
 * Every project ever logged, bundled under the month it started in — the
 * "Alla Project" list.
 *
 * "Started" is `start_date` when the user set one on Logga Project, else
 * `activated_at`. Reading only `activated_at` would be wrong here: the
 * activation trigger that derives it from `start_date` is a `before insert`
 * trigger, so a start date edited in afterwards never reaches the column, and
 * the row would stay filed under the month it was typed in rather than the
 * month the work began.
 */
export async function getProjectsByStartMonth(): Promise<ProjectMonthGroup[]> {
  const [projectsResult, shiftsResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, address, status, start_date, activated_at")
      .is("deleted_at", null),
    supabase
      .from("shifts")
      .select("project_id, hours, workers!inner(deleted_at)")
      .is("workers.deleted_at", null),
  ]);

  const error = projectsResult.error ?? shiftsResult.error;
  if (error) {
    throw new Error(`Kunde inte lasa alla project: ${error.message}`, {
      cause: error,
    });
  }

  const hoursByProject = new Map<string, number>();
  for (const s of shiftsResult.data ?? []) {
    hoursByProject.set(
      s.project_id,
      (hoursByProject.get(s.project_id) ?? 0) + Number(s.hours)
    );
  }

  const items: ProjectListItem[] = (projectsResult.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    status: p.status,
    startedAt: p.start_date ?? p.activated_at,
    totalHours: roundHours(hoursByProject.get(p.id) ?? 0),
  }));

  const byMonth = new Map<string, ProjectListItem[]>();
  for (const item of items) {
    const key = monthStartOf(item.startedAt);
    const list = byMonth.get(key) ?? [];
    list.push(item);
    byMonth.set(key, list);
  }

  // Newest month first, and newest project first inside it. The id tiebreak
  // makes the order total, so two renders of the same data never disagree.
  return [...byMonth.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([monthStart, projects]) => ({
      monthStart,
      projects: projects.sort(
        (a, b) =>
          b.startedAt.localeCompare(a.startedAt) || a.id.localeCompare(b.id)
      ),
    }));
}

/** Every worker with their logged totals — the "Alla Arbetare" list. */
export async function getWorkerList(): Promise<WorkerListItem[]> {
  const [workersResult, shiftsResult] = await Promise.all([
    supabase
      .from("workers")
      .select("id, name, email, phone, profile_picture_url")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("shifts")
      .select("worker_id, project_id, hours, projects!inner(deleted_at)")
      .is("projects.deleted_at", null),
  ]);

  const error = workersResult.error ?? shiftsResult.error;
  if (error) {
    throw new Error(`Kunde inte lasa arbetare: ${error.message}`, {
      cause: error,
    });
  }

  const hoursByWorker = new Map<string, number>();
  const projectsByWorker = new Map<string, Set<string>>();
  for (const s of shiftsResult.data ?? []) {
    hoursByWorker.set(
      s.worker_id,
      (hoursByWorker.get(s.worker_id) ?? 0) + Number(s.hours)
    );
    const seen = projectsByWorker.get(s.worker_id) ?? new Set<string>();
    seen.add(s.project_id);
    projectsByWorker.set(s.worker_id, seen);
  }

  // Driven by the worker list, so someone who has not logged a pass yet still
  // gets a row, at 0h.
  return (workersResult.data ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    email: w.email,
    phone: w.phone,
    profile_picture_url: w.profile_picture_url,
    totalHours: roundHours(hoursByWorker.get(w.id) ?? 0),
    projectCount: projectsByWorker.get(w.id)?.size ?? 0,
  }));
}

/**
 * Everything the generated Arbetsdagbok prints, folded into the shape the
 * template consumes.
 *
 * Two things the shape settles, both from the client's own wording:
 *
 * - The cover's "Project:" line is the project *name*. The per-row column that
 *   DocMaker also called "Project" is a different thing entirely: it is the
 *   service, so it is headed "Tjanst" and carries `tjanst` below.
 * - `tjanst` is the project's service *names* only. Prices are deliberately
 *   left out — an Arbetsdagbok is a work log the client signs, not a quote.
 */
export async function getArbetsdagbokData(
  projectId: string
): Promise<ArbetsdagbokData | null> {
  const [{ data: project }, servicesResult, shiftsResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, address, client_name, client_address, client_org_number")
      .eq("id", projectId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("project_services")
      .select("service_name")
      .eq("project_id", projectId)
      .order("service_name", { ascending: true }),
    supabase
      .from("shifts")
      .select("worker_id, shift_date, hours, start_time, end_time, workers!inner(deleted_at)")
      .eq("project_id", projectId)
      .is("workers.deleted_at", null)
      // Chronological: the document reads as a diary, oldest day first.
      .order("shift_date", { ascending: true }),
  ]);

  if (!project) return null;

  const error = servicesResult.error ?? shiftsResult.error;
  if (error) {
    throw new Error(`Kunde inte lasa arbetsdagboken: ${error.message}`, {
      cause: error,
    });
  }

  const shifts = shiftsResult.data ?? [];
  const workerIds = [...new Set(shifts.map((s) => s.worker_id))];
  const nameById = new Map<string, string>();
  if (workerIds.length > 0) {
    const { data: workers, error: workersError } = await supabase
      .from("workers")
      .select("id, name")
      .in("id", workerIds);
    if (workersError) {
      throw new Error(`Kunde inte lasa arbetare: ${workersError.message}`, {
        cause: workersError,
      });
    }
    for (const w of workers ?? []) nameById.set(w.id, w.name);
  }

  const byDate = new Map<string, ArbetsdagbokDay>();
  let totalHours = 0;
  for (const s of shifts) {
    totalHours += Number(s.hours);
    const day: ArbetsdagbokDay = byDate.get(s.shift_date) ?? {
      date: s.shift_date,
      rows: [],
    };
    day.rows.push({
      arbetare: nameById.get(s.worker_id) ?? "Okand arbetare",
      hours: Number(s.hours),
      passTider: formatPassTider(s.start_time, s.end_time),
    });
    byDate.set(s.shift_date, day);
  }

  return {
    projectId: project.id,
    // `address` is the fallback the whole app uses when a row predates the
    // name column, so the cover can never print "Project:" with nothing after it.
    projectName: project.name ?? project.address,
    hasName: project.name !== null,
    bestallare: {
      adress: project.client_address,
      bolag: project.client_name,
      orgnr: project.client_org_number,
    },
    tjanst: (servicesResult.data ?? [])
      .map((s) => s.service_name)
      .join(", "),
    totalHours: roundHours(totalHours),
    days: [...byDate.values()].map((day) => ({
      ...day,
      rows: day.rows.sort((a, b) => a.arbetare.localeCompare(b.arbetare, "sv")),
    })),
  };
}

/**
 * Passen på ett project där "Pass Timmar" och "Pass Tider" inte säger samma sak,
 * som frågan innan arbetsdagboken skapas behöver dem.
 *
 * Två sorters trasig rad, av samma skäl: kolumnerna ska gå att läsa mot varandra
 * i det färdiga dokumentet. Antingen står Pass Tider tom — raden loggades innan
 * kolumnerna fanns — eller så står det ett spann där som inte är de timmar
 * raden skriver ut bredvid.
 *
 * Passen som är hela nämns inte: frågan ska vara kort, och ett project med
 * hundra korrekta pass ska gå rakt igenom till dokumentet.
 */
export async function getPassProblems(
  projectId: string
): Promise<PassProblem[]> {
  const { data: shifts, error } = await supabase
    .from("shifts")
    .select("id, worker_id, shift_date, hours, start_time, end_time, workers!inner(name, deleted_at)")
    .eq("project_id", projectId)
    .is("workers.deleted_at", null)
    .order("shift_date", { ascending: true });

  if (error) {
    throw new Error(`Kunde inte lasa passen: ${error.message}`, { cause: error });
  }

  // Ett pass är de rader som delar dag, timmar och tider — det är precis vad
  // ett tryck på "Logga Timmar" med flera arbetare valda lämnar efter sig.
  const byPass = new Map<string, PassProblem>();
  for (const shift of shifts ?? []) {
    const hours = Number(shift.hours);
    const start = shift.start_time ? shift.start_time.slice(0, 5) : null;
    const end = shift.end_time ? shift.end_time.slice(0, 5) : null;

    let kind: PassProblem["kind"];
    if (!start || !end) {
      kind = "saknar";
    } else {
      const span = passSpanHours(start, end);
      // Två decimaler är vad både spannet och en handskriven siffra behåller,
      // så allt därifrån och neråt är avrundning och inte en avvikelse.
      if (span !== null && Math.abs(span - hours) <= 0.01) continue;
      kind = "stammer-ej";
    }

    const key = `${shift.shift_date}|${hours}|${start ?? ""}|${end ?? ""}`;
    const pass: PassProblem = byPass.get(key) ?? {
      shiftIds: [],
      date: shift.shift_date,
      workers: [],
      hours,
      startTime: start,
      endTime: end,
      kind,
    };
    pass.shiftIds.push(shift.id);
    // Supabase typar en !inner-join som en array när relationen är till-en.
    const worker = shift.workers as unknown as { name: string } | null;
    pass.workers.push(worker?.name ?? "Okand arbetare");
    byPass.set(key, pass);
  }

  return [...byPass.values()].map((pass) => ({
    ...pass,
    workers: pass.workers.sort((a, b) => a.localeCompare(b, "sv")),
  }));
}

// ---------------------------------------------------------------------------
// Papperskorgen
//
// Everything above hides `deleted_at is not null`; everything below is the one
// screen that is only interested in it. The rows are the originals — nothing
// was copied into a shadow table when they were thrown away — so what the trash
// shows is literally what a restore gives back.
// ---------------------------------------------------------------------------

/** Everything currently in Papperskorgen, most recently thrown away first. */
export async function getTrashItems(): Promise<TrashItem[]> {
  const [workersResult, projectsResult] = await Promise.all([
    supabase
      .from("workers")
      .select("id, name, email, phone, deleted_at")
      .not("deleted_at", "is", null),
    supabase
      .from("projects")
      .select("id, name, address, deleted_at")
      .not("deleted_at", "is", null),
  ]);

  const error = workersResult.error ?? projectsResult.error;
  if (error) {
    throw new Error(`Kunde inte lasa papperskorgen: ${error.message}`, {
      cause: error,
    });
  }

  const items: TrashItem[] = [
    ...(workersResult.data ?? []).map((w) => ({
      kind: "worker" as const,
      id: w.id,
      label: w.name,
      detail: w.phone ?? w.email ?? "Ingen kontaktuppgift",
      deletedAt: w.deleted_at as string,
    })),
    ...(projectsResult.data ?? []).map((p) => ({
      kind: "project" as const,
      id: p.id,
      label: p.name ?? p.address,
      detail: p.address,
      deletedAt: p.deleted_at as string,
    })),
  ];

  // Newest first, with the id as tiebreak so two rows thrown away in the same
  // millisecond never swap places between renders.
  return items.sort(
    (a, b) => b.deletedAt.localeCompare(a.deletedAt) || a.id.localeCompare(b.id)
  );
}

/** One worker in Papperskorgen. Null when the id is unknown, or still live. */
export async function getTrashedWorker(id: string): Promise<Worker | null> {
  const { data, error } = await supabase
    .from("workers")
    .select("*")
    .eq("id", id)
    .not("deleted_at", "is", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Kunde inte lasa arbetaren: ${error.message}`, { cause: error });
  }

  return data ?? null;
}

/** One project in Papperskorgen, with the services and assignments it kept. */
export async function getTrashedProject(
  id: string
): Promise<ProjectWithDetails | null> {
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .not("deleted_at", "is", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Kunde inte lasa projectet: ${error.message}`, { cause: error });
  }
  if (!project) return null;

  const [{ data: services }, { data: assignments }] = await Promise.all([
    supabase
      .from("project_services")
      .select("*")
      .eq("project_id", id)
      .order("service_name", { ascending: true }),
    supabase
      .from("project_workers")
      .select("worker_id, workers!inner(deleted_at)")
      .eq("project_id", id)
      .is("workers.deleted_at", null),
  ]);

  return {
    ...project,
    services: services ?? [],
    workerIds: (assignments ?? []).map((a) => a.worker_id),
  };
}

/**
 * The ids of every worker currently in Papperskorgen.
 *
 * Read by saveProject, which rewrites `project_workers` from the checkboxes.
 * Those checkboxes only list live workers, so without this the rewrite would
 * quietly drop a thrown-away worker's assignment to the project and restoring
 * them would give back someone who is no longer on the job they were on.
 */
export async function getTrashedWorkerIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("workers")
    .select("id")
    .not("deleted_at", "is", null);

  if (error) {
    throw new Error(`Kunde inte lasa papperskorgen: ${error.message}`, {
      cause: error,
    });
  }

  return (data ?? []).map((w) => w.id);
}

/**
 * Kontona, som de star i Inställningar → Konto.
 *
 * Raden ar en join och inte en tabell: kontot bidrar med kopplingen och
 * statusen, arbetaren med allt man faktiskt ser. Arbetare i Papperskorgen tas
 * INTE bort ur listan — kontot deras finns fortfarande och kan fortfarande
 * logga in, och en inloggning som inte syns nagonstans ar precis den sortens
 * kvarglomma den har skarmen ska gora omojlig.
 */
export async function getKonton(): Promise<KontoItem[]> {
  const { data, error } = await supabase
    .from("accounts")
    // `workers(...)` och inte `workers!inner(...)`: ett konto utan arbetare har
    // ingen rad att joina mot, och ett inner join hade tystat bort det ur
    // listan i stallet for att visa det.
    .select(
      "id, worker_id, status, created_at, email, workers(name, email, profile_picture_url)"
    )
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Kunde inte lasa konton: ${error.message}`, { cause: error });
  }

  return (data ?? []).map((a) => {
    // PostgREST typar en inbaddad tabell som array. Utan !inner kan den ocksa
    // vara tom eller null — det ar precis fallet "konto utan arbetare".
    const w = (Array.isArray(a.workers) ? a.workers[0] : a.workers) as
      | { name: string; email: string | null; profile_picture_url: string | null }
      | null
      | undefined;

    const kopplad = w != null;
    const epost = kopplad ? w.email ?? "" : String(a.email ?? "");

    return {
      id: a.id as string,
      workerId: (a.worker_id as string | null) ?? null,
      // Ett konto utan arbetare heter sin adress. Det ar inte ett fint namn,
      // men det ar det enda sanna: det finns ingen person i appen att namnge.
      namn: kopplad ? w.name : epost,
      epost,
      bild: kopplad ? w.profile_picture_url : null,
      status: a.status as KontoStatus,
      kopplad,
      skapad: String(a.created_at).slice(0, 10),
    };
  });
}

/**
 * Arbetarna som gar att tillverka ett konto at.
 *
 * Ett villkor, och det ar samma villkor som databasen sjalv haller pa
 * (accounts_require_worker_email och unique(worker_id)): arbetaren maste ha en
 * e-post, for det ar den man loggar in med, och far inte redan ha ett konto.
 * Att filtrera har ar inte valideringen — det ar att slippa erbjuda ett val som
 * anda hade avvisats.
 */
export async function getKontoKandidater(): Promise<KontoKandidat[]> {
  const [workersResult, accountsResult] = await Promise.all([
    supabase
      .from("workers")
      .select("id, name, email")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase.from("accounts").select("worker_id"),
  ]);

  const error = workersResult.error ?? accountsResult.error;
  if (error) {
    throw new Error(`Kunde inte lasa arbetare: ${error.message}`, { cause: error });
  }

  const upptagna = new Set((accountsResult.data ?? []).map((a) => a.worker_id));

  // Bara ett villkor kvar: arbetaren far inte redan ha ett konto. Att sakna
  // e-post diskvalificerar henne inte langre — adressen fylls i formularet och
  // sparas pa arbetaren nar kontot tillverkas.
  return (workersResult.data ?? [])
    .filter((w) => !upptagna.has(w.id))
    .map((w) => ({
      id: w.id,
      namn: w.name,
      epost: String(w.email ?? "").trim() || null,
    }));
}
