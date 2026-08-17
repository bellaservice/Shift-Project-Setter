import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  HomeStats,
  OngoingProject,
  Project,
  ProjectWithDetails,
  RecentShiftRow,
  Worker,
} from "@/lib/types";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function getHomeStats(): Promise<HomeStats> {
  const [{ data: shifts }, { count: workerCount }] = await Promise.all([
    supabaseAdmin.from("shifts").select("project_id, hours, shift_date"),
    supabaseAdmin.from("workers").select("*", { count: "exact", head: true }),
  ]);

  const totalHoursLogged = (shifts ?? []).reduce(
    (sum, s) => sum + Number(s.hours),
    0
  );

  const cutoff = isoDaysAgo(30);
  const activeProjectIds = new Set(
    (shifts ?? [])
      .filter((s) => s.shift_date >= cutoff)
      .map((s) => s.project_id)
  );

  return {
    totalHoursLogged,
    activeProjectCount: activeProjectIds.size,
    totalWorkerCount: workerCount ?? 0,
  };
}

// "Ongoing" = active per section 6 (>= 1 shift in the last 30 days).
export async function getOngoingProjects(): Promise<OngoingProject[]> {
  const cutoff = isoDaysAgo(30);

  const { data: recentShifts } = await supabaseAdmin
    .from("shifts")
    .select("project_id, shift_date")
    .gte("shift_date", cutoff);

  const projectIds = [...new Set((recentShifts ?? []).map((s) => s.project_id))];
  if (projectIds.length === 0) return [];

  const [{ data: projects }, { data: services }, { data: allShifts }] =
    await Promise.all([
      supabaseAdmin.from("projects").select("id, address").in("id", projectIds),
      supabaseAdmin
        .from("project_services")
        .select("project_id, service_name")
        .in("project_id", projectIds),
      supabaseAdmin.from("shifts").select("project_id, hours").in("project_id", projectIds),
    ]);

  const hoursByProject = new Map<string, number>();
  for (const s of allShifts ?? []) {
    hoursByProject.set(
      s.project_id,
      (hoursByProject.get(s.project_id) ?? 0) + Number(s.hours)
    );
  }

  const servicesByProject = new Map<string, string[]>();
  for (const svc of services ?? []) {
    const list = servicesByProject.get(svc.project_id) ?? [];
    list.push(svc.service_name);
    servicesByProject.set(svc.project_id, list);
  }

  return (projects ?? []).map((p) => ({
    id: p.id,
    address: p.address,
    serviceNames: servicesByProject.get(p.id) ?? [],
    totalHours: hoursByProject.get(p.id) ?? 0,
  }));
}

export async function getWorkers(): Promise<Worker[]> {
  const { data } = await supabaseAdmin
    .from("workers")
    .select("*")
    .order("name", { ascending: true });
  return data ?? [];
}

export async function getProjects(): Promise<Project[]> {
  const { data } = await supabaseAdmin
    .from("projects")
    .select("*")
    .order("address", { ascending: true });
  return data ?? [];
}

export async function getProjectWithDetails(
  id: string
): Promise<ProjectWithDetails | null> {
  const [{ data: project }, { data: services }, { data: assignments }] =
    await Promise.all([
      supabaseAdmin.from("projects").select("*").eq("id", id).maybeSingle(),
      supabaseAdmin
        .from("project_services")
        .select("*")
        .eq("project_id", id)
        .order("service_name", { ascending: true }),
      supabaseAdmin
        .from("project_workers")
        .select("worker_id")
        .eq("project_id", id),
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
  const { data: shifts } = await supabaseAdmin
    .from("shifts")
    .select("id, shift_date, hours, worker_id")
    .eq("project_id", projectId)
    .order("shift_date", { ascending: false })
    .limit(limit);

  if (!shifts || shifts.length === 0) return [];

  const workerIds = [...new Set(shifts.map((s) => s.worker_id))];
  const { data: workers } = await supabaseAdmin
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
