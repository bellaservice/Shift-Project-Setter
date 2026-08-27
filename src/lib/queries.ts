import { supabase } from "@/lib/supabase/browser";
import {
  addDays,
  formatPassTider,
  monthStartOf,
  projectLabel,
  shiftMonth,
  stockholmToday,
} from "@/lib/format";
import type {
  ArbetsdagbokData,
  ArbetsdagbokDay,
  Arende,
  ArendeDetalj,
  BekraftaDay,
  CalendarDay,
  DayShift,
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
  Roll,
  ShiftDetail,
  StamplaPass,
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
  return monthStartOf(stockholmToday());
}

/** Exclusive upper bound for the month starting at `monthStart`. */
function nextMonthStart(monthStart: string): string {
  return shiftMonth(monthStart, 1);
}

/** numeric hours folded through IEEE doubles: 0.1 + 0.2 must not reach a screen. */
function roundHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}

/**
 * `shifts.hours` är nullbar sedan stämplingen infördes: null betyder "ännu inte
 * bekräftat av arbetsledaren" (spec 5.3), aldrig noll timmar.
 *
 * Varje läsning måste gå genom `readHours` eller `hoursForSum` — aldrig genom
 * `Number()` direkt. Skälet är att `Number(null)` är `0` i JavaScript, inte
 * `NaN`, och att appens Supabase-klient är otypad: en null hade alltså blivit
 * en tyst nolla utan att vare sig kompilatorn eller körningen sagt ifrån. Det
 * är precis den sortens fel som inte upptäcks förrän någon undrar varför en
 * lönesumma är för låg.
 *
 * PostgREST lämnar dessutom `numeric` som sträng, så konverteringen behövs —
 * det är bara tolkningen av frånvaro som skiljer.
 */
function readHours(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Bidraget till en timsumma. Ett obekräftat pass lägger till ingenting — och
 * gör det avsiktligt och synligt här, i stället för av misstag via `Number()`.
 */
function hoursForSum(raw: unknown): number {
  return readHours(raw) ?? 0;
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
    (sum, s) => sum + hoursForSum(s.hours),
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
      (hoursByProject.get(s.project_id) ?? 0) + hoursForSum(s.hours)
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
    hours: readHours(s.hours),
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
      (hoursByProject.get(s.project_id) ?? 0) + hoursForSum(s.hours)
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
      (hoursByWorker.get(s.worker_id) ?? 0) + hoursForSum(s.hours)
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

  // Dokumentet är ett juridiskt underlag, och ett obekräftat pass har inget
  // timtal att skriva in i det. Raden får därför INTE folda in i dagtabellen:
  // `hoursForSum` hade gjort den till en nolla, och en nolla i det här
  // dokumentet läses som "arbetaren var här och jobbade inte", inte som "det
  // här är inte klart än". Den räknas i stället, och räkningen stänger grinden
  // i alla-project/arbetsdagbok/page.tsx (spec avsnitt 7).
  const byDate = new Map<string, ArbetsdagbokDay>();
  let totalHours = 0;
  let obekraftade = 0;
  for (const s of shifts) {
    const hours = readHours(s.hours);
    if (hours === null) {
      obekraftade += 1;
      continue;
    }
    totalHours += hours;
    const day: ArbetsdagbokDay = byDate.get(s.shift_date) ?? {
      date: s.shift_date,
      rows: [],
    };
    day.rows.push({
      arbetare: nameById.get(s.worker_id) ?? "Okand arbetare",
      hours,
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
    obekraftade,
    days: [...byDate.values()].map((day) => ({
      ...day,
      rows: day.rows.sort((a, b) => a.arbetare.localeCompare(b.arbetare, "sv")),
    })),
  };
}

/**
 * Passen på ett project som saknar "Pass Tider", som frågan innan
 * arbetsdagboken skapas behöver dem.
 *
 * EN sorts obesvarat pass, inte två. Fram till omskrivningen av Logga Timmar
 * räknades även ett pass vars spann inte var dess timmar som trasigt, och
 * enkäten spärrade dokumentet tills de två kolumnerna sa samma sak. Det kravet
 * är borta: Pass Timmar skrivs numera för hand och Pass Tider är frivilliga, så
 * ett åttatimmarspass med spannet 07:00–16:00 är en obetald rast och inte ett
 * fel. Hade kontrollen stått kvar hade den frågat om varenda sådant pass och
 * vägrat generera förrän användaren skrivit om det ena till att ljuga om det
 * andra.
 *
 * Kvar är den enda fråga som fortfarande går att svara på: cellen är tom, och
 * dokumentet har ingenting att skriva i den.
 *
 * Passen som har sina tider nämns inte: frågan ska vara kort, och ett project
 * med hundra kompletta pass ska gå rakt igenom till dokumentet.
 */
export async function getPassProblems(
  projectId: string
): Promise<PassProblem[]> {
  const { data: shifts, error } = await supabase
    .from("shifts")
    .select("id, worker_id, shift_date, hours, workers!inner(name, deleted_at)")
    .eq("project_id", projectId)
    .is("workers.deleted_at", null)
    // Halva paret räcker: shifts_pass_times_paired garanterar att den andra
    // halvan är tom också, så en rad med start_time null saknar hela spannet.
    .is("start_time", null)
    .order("shift_date", { ascending: true });

  if (error) {
    throw new Error(`Kunde inte lasa passen: ${error.message}`, { cause: error });
  }

  // Ett pass är de rader som delar dag och timmar — det är precis vad ett tryck
  // på "Logga Timmar" med flera arbetare valda lämnar efter sig, eftersom alla
  // på passet får samma siffra.
  const byPass = new Map<string, PassProblem>();
  for (const shift of shifts ?? []) {
    const hours = readHours(shift.hours);
    // Nyckeln måste skilja "obekräftat" från siffran 0, och de två är inte
    // samma sak: `Number(null)` hade gjort dem identiska och tyst slagit ihop
    // varje obekräftat pass på dagen med ett pass som faktiskt bekräftats till
    // noll timmar. Markören kan inte krocka med ett tal.
    const key = `${shift.shift_date}|${hours === null ? "obekraftat" : hours}`;
    const pass: PassProblem = byPass.get(key) ?? {
      shiftIds: [],
      date: shift.shift_date,
      workers: [],
      hours,
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
// Kalendern
//
// Tre läsningar, i den ordning man går in i dem: månaden som rutnät, en dag som
// lista, och ett enskilt pass eller ärende som ett formulär. Varje nivå läser
// bara det den visar — månadsrutnätet hämtar aldrig hem trettio dagars
// arbetarnamn för att ett av dem kanske ska öppnas.
// ---------------------------------------------------------------------------

/**
 * En månad som rutnätet ritar den: en rad per dag som faktiskt har något på sig.
 *
 * Halvöppet spann på arende_date respektive shift_date, precis som
 * `getHomeStats` räknar sin månad, så ingen månadslängd behöver ett specialfall.
 *
 * `!inner` plus `is(..., null)` av samma skäl som överallt annars: ett pass vars
 * project eller vars arbetare ligger i Papperskorgen syns inte i kalendern
 * heller. Ärenden har ingen sådan koppling att förlora — ett ärende vars project
 * raderats behåller sin dag och tappar bara sin underrubrik.
 */
export async function getMonthCalendar(
  monthStart: string
): Promise<CalendarDay[]> {
  const monthEnd = nextMonthStart(monthStart);

  const [shiftsResult, arendenResult] = await Promise.all([
    supabase
      .from("shifts")
      .select(
        "shift_date, hours, worker_id, projects!inner(deleted_at), workers!inner(deleted_at)"
      )
      .is("projects.deleted_at", null)
      .is("workers.deleted_at", null)
      .gte("shift_date", monthStart)
      .lt("shift_date", monthEnd),
    // Ingen synlighetsfiltrering här: RLS-policyn arenden_select_synliga har
    // redan gjort den, och ett filter till i JavaScript hade bara varit ett
    // andra ställe att glömma att uppdatera. Se migrationen.
    supabase
      .from("arenden")
      .select("arende_date, farg, start_time, titel")
      .gte("arende_date", monthStart)
      .lt("arende_date", monthEnd)
      .order("start_time", { ascending: true, nullsFirst: true })
      .order("titel", { ascending: true }),
  ]);

  const error = shiftsResult.error ?? arendenResult.error;
  if (error) {
    throw new Error(`Kunde inte lasa kalendern: ${error.message}`, { cause: error });
  }

  const rawShifts = shiftsResult.data ?? [];

  // Namnen hämtas i en andra omgång, på de arbetare som faktiskt förekommer i
  // månaden. Det är det som gör rutorna möjliga att skriva namn i utan att
  // hämta hela rostern: en månad rör sällan mer än en handfull personer, och
  // frågan ställs en gång för hela rutnätet i stället för en gång per dag.
  const workerIds = [...new Set(rawShifts.map((s) => s.worker_id))];
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

  const byDate = new Map<
    string,
    { hours: number; workers: Set<string>; farger: string[] }
  >();
  function cell(date: string) {
    const existing = byDate.get(date);
    if (existing) return existing;
    const fresh = { hours: 0, workers: new Set<string>(), farger: [] as string[] };
    byDate.set(date, fresh);
    return fresh;
  }

  for (const s of rawShifts) {
    const day = cell(s.shift_date);
    day.hours += hoursForSum(s.hours);
    // En mängd av NAMN och inte av id:n: två pass på samma arbetare samma dag
    // är en person på plats, och rutan ska inte skriva ut henne två gånger.
    day.workers.add(nameById.get(s.worker_id) ?? "Okand arbetare");
  }
  for (const a of arendenResult.data ?? []) {
    cell(a.arende_date).farger.push(a.farg);
  }

  return [...byDate.entries()]
    .map(([date, day]) => ({
      date,
      totalHours: roundHours(day.hours),
      workerNames: [...day.workers].sort((a, b) => a.localeCompare(b, "sv")),
      arendeFarger: day.farger,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * En dags innehåll, som arket under rutnätet listar det: passen per arbetare och
 * ärendena.
 *
 * Arbetarnas namn slås upp i en andra omgång i stället för att joinas in, av
 * samma skäl som `getRecentShiftsForProject` gör det: PostgREST typar en
 * inbäddad relation som en array, vilket kostar en `as unknown as` per fält,
 * medan ett `in`-anrop på de ids som faktiskt förekom är både typat och färre
 * rader hem.
 */
export async function getDayLog(
  date: string
): Promise<{ shifts: DayShift[]; arenden: Arende[] }> {
  const [shiftsResult, arendenResult] = await Promise.all([
    supabase
      .from("shifts")
      .select(
        "id, worker_id, project_id, hours, start_time, end_time, projects!inner(deleted_at), workers!inner(deleted_at)"
      )
      .eq("shift_date", date)
      .is("projects.deleted_at", null)
      .is("workers.deleted_at", null),
    supabase
      .from("arenden")
      .select("*")
      .eq("arende_date", date)
      // Heldagarna först, sedan i klockslagsordning: det är den ordning dagen
      // faktiskt sker i. En heldag har inget klockslag att sorteras på, den
      // omfattar dem alla — därav nullsFirst.
      .order("start_time", { ascending: true, nullsFirst: true })
      .order("titel", { ascending: true }),
  ]);

  const error = shiftsResult.error ?? arendenResult.error;
  if (error) {
    throw new Error(`Kunde inte lasa dagen: ${error.message}`, { cause: error });
  }

  const rawShifts = shiftsResult.data ?? [];
  const workerIds = [...new Set(rawShifts.map((s) => s.worker_id))];
  const projectIds = [...new Set(rawShifts.map((s) => s.project_id))];

  const [workersResult, projectsResult] = await Promise.all([
    workerIds.length > 0
      ? supabase.from("workers").select("id, name").in("id", workerIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    projectIds.length > 0
      ? supabase.from("projects").select("id, name, address").in("id", projectIds)
      : Promise.resolve({
          data: [] as { id: string; name: string | null; address: string }[],
        }),
  ]);

  const nameById = new Map((workersResult.data ?? []).map((w) => [w.id, w.name]));
  const projectById = new Map(
    (projectsResult.data ?? []).map((p) => [p.id, projectLabel(p)])
  );

  const shifts: DayShift[] = rawShifts
    .map((s) => ({
      id: s.id,
      workerId: s.worker_id,
      workerName: nameById.get(s.worker_id) ?? "Okand arbetare",
      projectId: s.project_id,
      projectName: projectById.get(s.project_id) ?? "Okant project",
      hours: readHours(s.hours),
      startTime: s.start_time ? s.start_time.slice(0, 5) : null,
      endTime: s.end_time ? s.end_time.slice(0, 5) : null,
    }))
    // Efter namn, så dagens lista står i samma ordning som Arbetsdagbokens
    // dagtabell gör. Id:t som tiebreak gör ordningen total, så två renderingar
    // av samma dag aldrig byter plats på två arbetare som heter lika.
    .sort(
      (a, b) =>
        a.workerName.localeCompare(b.workerName, "sv") || a.id.localeCompare(b.id)
    );

  return { shifts, arenden: (arendenResult.data ?? []) as Arende[] };
}

/** Ett pass, för sin redigeringsskärm. Null när id:t är okänt — eller när
 *  passets project eller arbetare hunnit hamna i Papperskorgen. */
export async function getShiftDetail(id: string): Promise<ShiftDetail | null> {
  const { data, error } = await supabase
    .from("shifts")
    .select(
      "id, shift_date, project_id, worker_id, hours, start_time, end_time, projects!inner(deleted_at), workers!inner(name, deleted_at)"
    )
    .eq("id", id)
    .is("projects.deleted_at", null)
    .is("workers.deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Kunde inte lasa passet: ${error.message}`, { cause: error });
  }
  if (!data) return null;

  const worker = data.workers as unknown as { name: string } | null;

  return {
    id: data.id,
    shiftDate: data.shift_date,
    projectId: data.project_id,
    workerId: data.worker_id,
    workerName: worker?.name ?? "Okand arbetare",
    hours: readHours(data.hours),
    startTime: data.start_time ? data.start_time.slice(0, 5) : null,
    endTime: data.end_time ? data.end_time.slice(0, 5) : null,
  };
}

/**
 * Ett ärende med de konton det visas för, för sitt formulär.
 *
 * Null när id:t är okänt — eller när ärendet finns men inte får ses av den som
 * frågar. De två går inte att skilja åt härifrån, och det är rätt: RLS svarar
 * med noll rader i båda fallen, och skärmen ska inte kunna användas för att
 * bekräfta att någon annans privata ärende existerar.
 */
export async function getArende(id: string): Promise<ArendeDetalj | null> {
  const { data, error } = await supabase
    .from("arenden")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Kunde inte lasa arendet: ${error.message}`, { cause: error });
  }
  if (!data) return null;

  const { data: tittare, error: tittareError } = await supabase
    .from("arende_tittare")
    .select("konto_id")
    .eq("arende_id", id);

  if (tittareError) {
    throw new Error(`Kunde inte lasa arendets konton: ${tittareError.message}`, {
      cause: tittareError,
    });
  }

  return {
    ...(data as Arende),
    tittare: (tittare ?? []).map((t) => t.konto_id as string),
  };
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
      "id, worker_id, status, role, created_at, email, workers(name, email, profile_picture_url)"
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
      // Okand roll blir null, aldrig en gissning: en rad ska inte kunna se mer
      // privilegierad ut an den ar.
      roll:
        a.role === "arbetsledare" || a.role === "arbetare"
          ? (a.role as Roll)
          : null,
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

// ---------------------------------------------------------------------------
// Bekraftelsekon (spec Fas 4)
// ---------------------------------------------------------------------------

/**
 * Passen som vantar pa arbetsledarens bekraftelse, aldsta dagen forst.
 *
 * Vad som kommer in i kon, och nar:
 *   'closed'  Utstamplat. In direkt — arbetaren ar klar och passet ar redo att
 *             bekraftas samma dag.
 *   'open'    Instamplat men aldrig utstamplat. In forst nar dagen passerat.
 *             Ett pass som pagar just nu ska inte ligga i kon och se ut som ett
 *             arende (spec Fas 3), men ett som last kvar over natten far inte
 *             heller forsvinna — det ar precis den rad nagon glomde stampla ut.
 *
 * Sorteringen ar hela poangen med skarmen: aldsta passerade pass overst, sa att
 * arbetsledaren aldrig behover scrolla for att hitta det som legat langst.
 * `id` som sista nyckel gor ordningen total, sa listan inte kastar om sig
 * mellan tva identiska renderingar.
 */
export async function getShiftsAwaitingConfirmation(): Promise<BekraftaDay[]> {
  const today = stockholmToday();

  const { data, error } = await supabase
    .from("shifts")
    .select(
      "id, shift_date, status, hours, calculated_hours, clock_in_time, clock_out_time, clock_in_original, clock_out_original, clock_edited_at, projects!inner(name, address, deleted_at), workers!inner(name, deleted_at)"
    )
    .neq("status", "confirmed")
    // Papperskorgen halls utanfor kon pa samma satt som utanfor varje total:
    // ett pass vars project eller arbetare ar bortkastat ska inte krava ett
    // beslut av nagon.
    .is("projects.deleted_at", null)
    .is("workers.deleted_at", null)
    .order("shift_date", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Kunde inte lasa bekraftelsekon: ${error.message}`, {
      cause: error,
    });
  }

  const byDate = new Map<string, BekraftaDay>();
  for (const s of data ?? []) {
    const status = s.status as "open" | "closed";
    // Det pagaende passet: instamplat, dagen inte slut. Det hor hemma pa
    // arbetarens skarm, inte i arbetsledarens ko.
    if (status === "open" && s.shift_date >= today) continue;

    // Supabase typar en !inner-join som en array nar relationen ar till-en.
    const project = s.projects as unknown as {
      name: string | null;
      address: string;
    } | null;
    const worker = s.workers as unknown as { name: string } | null;

    const day: BekraftaDay = byDate.get(s.shift_date) ?? {
      date: s.shift_date,
      shifts: [],
    };
    day.shifts.push({
      id: s.id,
      shiftDate: s.shift_date,
      workerName: worker?.name ?? "Okand arbetare",
      projectName: project ? projectLabel(project) : "Okant project",
      status,
      clockIn: s.clock_in_time,
      clockOut: s.clock_out_time,
      clockInOriginal: s.clock_in_original,
      clockOutOriginal: s.clock_out_original,
      clockEditedAt: s.clock_edited_at,
      calculatedHours: readHours(s.calculated_hours),
      hours: readHours(s.hours),
    });
    byDate.set(s.shift_date, day);
  }

  return [...byDate.values()].map((day) => ({
    ...day,
    shifts: day.shifts.sort((a, b) =>
      a.workerName.localeCompare(b.workerName, "sv")
    ),
  }));
}

// ---------------------------------------------------------------------------
// Stamplingen (spec Fas 3)
// ---------------------------------------------------------------------------

/**
 * Den inloggade arbetarens egna pass att stampla pa.
 *
 * FONSTRET ar idag och igar, och det ar ett medvetet val (spec 8.4). Igar ar
 * med av tva skal som bada handlar om verkligheten pa en byggarbetsplats:
 * ett nattpass som borjar 22:00 stamplas ut efter midnatt och hor da till
 * gardagens shift_date, och den som stod utan tackning nar passet tog slut ska
 * kunna stampla ut nasta morgon i stallet for att be arbetsledaren fixa det.
 *
 * Fonstret ar ett FILTER, inte en spärr: databasen forbjuder inte stampling pa
 * andra datum. Det som faktiskt haller emot ar att arbetsledaren bekraftar
 * varje pass och satter `hours` sjalv -- klockslagen ar underlag, inte lon.
 *
 * `worker_id`-filtret ar appens och inte RLS: SELECT pa shifts ar oppet for
 * alla inloggade (schemat ar arbetslagets gemensamma information). Det som ar
 * last till egen rad ar SKRIVNINGARNA, via shifts_update_egen_stampling. Ett
 * pass som inte ar ens eget gar alltsa varken att se har eller att stampla pa.
 */
export async function getMinaPassAttStampla(
  arbetareId: string
): Promise<StamplaPass[]> {
  const idag = stockholmToday();
  const igar = addDays(idag, -1);

  const { data, error } = await supabase
    .from("shifts")
    .select("id, shift_date, clock_in_time, clock_out_time, projects!inner(name, address, deleted_at)")
    .eq("worker_id", arbetareId)
    .eq("status", "open")
    .gte("shift_date", igar)
    .lte("shift_date", idag)
    .is("projects.deleted_at", null)
    .order("shift_date", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Kunde inte lasa dina pass: ${error.message}`, { cause: error });
  }

  return (data ?? []).map((s) => {
    const project = s.projects as unknown as {
      name: string | null;
      address: string;
    } | null;
    return {
      id: s.id,
      shiftDate: s.shift_date,
      projectName: project ? projectLabel(project) : "Okant project",
      clockIn: s.clock_in_time,
      clockOut: s.clock_out_time,
    };
  });
}
