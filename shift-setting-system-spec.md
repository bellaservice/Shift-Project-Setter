# Shift Setting System — Build Spec

Status: Wireframe complete (Excalidraw), locked for logic and data model, NOT locked for visual design.
Instruction to Claude Code: build full functionality and layout structure exactly as described below. Visual styling (colors, fonts, spacing, components) is placeholder — restyle freely as long as structure, fields, and flows stay intact.

---

## 1. Purpose

Internal tool for a client who manages workers (arbetare) across projects (project). Core actions:
- Log a new project
- Log worked hours against a project + worker
- Register a new worker
- See running totals on a home dashboard

Single-user or small-team internal tool. No public-facing pages.

---

## 2. Tech Stack

- Frontend: React (Next.js recommended for routing simplicity)
- Backend/DB: Supabase (Postgres + Auth + Storage for profile pictures)
- Claude Code will need a Supabase project URL + service/anon key supplied as env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Set up `.env.local`, do not hardcode keys.
- Auth: Supabase Auth, login required. v1 ships with a single role (admin, full access). Build the roles/permissions layer so additional roles with restricted access can be added later without restructuring (see section 3, `user_roles`).

---

## 3. Data Model (Supabase / Postgres)

```sql
-- Workers
create table workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  address text,
  personal_number text,       -- personnummer, sensitive: treat as PII
  account_number text,        -- bank account, sensitive: treat as PII
  emergency_contact text,     -- närmst anhörig
  profile_picture_url text,
  created_at timestamptz default now()
);

-- Projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  client_name text,
  client_phone text,
  description text,
  start_date date,                        -- manual "Project Start", optional
  status text not null default 'active',  -- 'active' | 'inactive'
  activated_at timestamptz,               -- = start_date if set, else created_at, set on insert
  deactivated_at timestamptz,             -- set when status flips to inactive
  created_at timestamptz default now()
);

-- Roles (v1 has only 'admin', built to extend without restructuring)
create table user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin'
);

-- Services/pricing tied to a project (repeatable rows: tjänster + pris)
create table project_services (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  service_name text not null,
  price numeric
);

-- Which workers are assigned to a project
create table project_workers (
  project_id uuid references projects(id) on delete cascade,
  worker_id uuid references workers(id) on delete cascade,
  primary key (project_id, worker_id)
);

-- Logged shifts (Pass)
create table shifts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  worker_id uuid references workers(id) on delete cascade,
  shift_date date not null,
  hours numeric not null,
  created_at timestamptz default now()
);
```

Sensitive fields (`personal_number`, `account_number`) should be access-restricted via Supabase RLS even in v1, not left fully open.

### Project Activation / Deactivation Logic

Activation:
- `activated_at` = `start_date` if the user filled it in on Logga Project, else falls back to `created_at` (project creation timestamp).
- `start_date` is optional. If left blank, the project activates immediately on creation.

Deactivation (two paths):
- Automatic: if a project has zero shifts logged within 2 weeks of `activated_at`, set `status = 'inactive'`, `deactivated_at = now()`. Requires a scheduled job — use Supabase `pg_cron` (or an Edge Function on a cron trigger) running at least daily, checking projects where `status = 'active' AND activated_at < now() - interval '2 weeks' AND not exists (select 1 from shifts where shifts.project_id = projects.id)`.
- Manual: "Avsluta Project" button on the Project Detail screen (section 4.5), visible only when `status = 'active'`. Sets `status = 'inactive'`, `deactivated_at = now()`.

Reactivation:
- An inactive project can be manually reactivated (button toggles to "Aktivera Project" when `status = 'inactive'`). Sets `status = 'active'`, `activated_at = now()`, clears `deactivated_at`.

Note from client: categorized/detailed project pages are a later phase — this logic covers the baseline only.

---

## 4. Screens

### 4.1 Home (Screen 1)

Top stat row (3 boxes):
- Loggade Timmar — total hours across all shifts (`sum(shifts.hours)`)
- Aktiva Project — count of projects where `status = 'active'`
- Månads pass — count of shifts where `shift_date` falls in the current calendar month. Small subtitle beneath the value shows the month name this count refers to (e.g. "Augusti"). This box sits directly next to "Lägg Till Arbetare".

Top-right: `+` icon → "Lägg Till Arbetare" → opens Ny Arbetare screen.

Two primary buttons:
- `+ Logga Project` → Logga Project screen
- `+ Logga Timmar` → Logga Timmar screen

List: "Pågående Project" (ongoing projects)
- Repeating row per project: Project Adress, Tjänst(er) (services list), Project Timmar (sum of hours logged to that project)
- Row is tappable → opens Project Detail (section 4.5), not the Logga Project form directly

### 4.2 Logga Project

Back button → Home.

Fields:
- Adress (text)
- Namn (text) — client name
- Telefon Nummer (text)
- Tjänster / Pris (repeatable pair: service name + price)
  - `+ Lägg Till` adds another Tjänster/Pris row
- Beskrivning (textarea)
- Project Start (date, optional) — sets `start_date`. If left blank, project activates on creation.
- Arbetare (assign workers to this project)
  - `+ Lägg Till` → navigates to Ny Arbetare screen (per mockup annotation)
- "Senaste Pass" (read-only list): most recent shifts for this project, grouped by Pass Dag, each row showing Arbetare namn / Tid & Dag / Pass Timmar
  - Only relevant when editing an existing project; empty on creation

Submit: `Logga Porject` button → insert into `projects`, `project_services`, `project_workers`.

### 4.3 Project Detail (opened by tapping a project row on Home)

Not in original wireframe — new screen required by activation logic.

Shows:
- All Logga Project fields, editable (Adress, Namn, Telefon Nummer, Tjänster/Pris, Beskrivning, Project Start, Arbetare)
- Total hours logged to this project (`sum(shifts.hours)` where `project_id` matches)
- Most recent shifts (same "Senaste Pass" layout as Logga Project)
- Action button:
  - If `status = 'active'`: "Avsluta Project" → deactivates (manual path, see Project Activation / Deactivation Logic)
  - If `status = 'inactive'`: "Aktivera Project" → reactivates

Back button → Home.

### 4.4 Logga Timmar

Back button → Home.

Fields:
- Pass Timmar (numeric input, hours)
- Pass Datum (Year / Month / Day dropdowns)
- Project (Dropdown)
  - Lists only projects where `status = 'active'` + inline `+ Nytt Project` option → opens Logga Project
  - Separate `+ Lägg Till` button below dropdown also → opens Logga Project. Kept intentionally (not redundant): if a project doesn't exist yet, it won't be in the dropdown at all, so the button is the visible escape hatch a user finds when the dropdown comes up empty or missing their project.
- Arbetare (Dropdown)
  - Lists existing workers (with avatar icon) + inline `+ Ny Arbetare` option → opens Ny Arbetare
  - Separate `+ Lägg Till` button below dropdown → adds a second Arbetare dropdown, to log the **same hours/date** against an additional worker in one submit (multi-worker single shift entry)
- "Senaste Pass": recent shifts for the selected project, same layout as 4.2

Submit: `Logga Timmar` → insert one row into `shifts` per worker selected.

### 4.5 Ny Arbetare

Back button → Home.

Fields:
- Namn
- Profile picture upload (circular placeholder, optional — Supabase Storage)
- E-postadress
- Telefon Nummer
- Adress
- Person nummer
- Kontonummer
- Närmst Anhörig

Submit: `Lägg Till Arbetare` → insert into `workers`.

---

## 5. Navigation Map

```
Home
 ├─ + (top right) ────────────→ Ny Arbetare
 ├─ + Logga Project ──────────→ Logga Project
 │                                  └─ Arbetare +Lägg Till → Ny Arbetare
 ├─ + Logga Timmar ───────────→ Logga Timmar
 │                                  ├─ Project dropdown "+Nytt Project" → Logga Project
 │                                  ├─ Project +Lägg Till button → Logga Project
 │                                  └─ Arbetare dropdown "+Ny Arbetare" → Ny Arbetare
 └─ Project row (list) ───────→ Project Detail
                                    └─ Avsluta / Aktivera Project button (toggles project status)
```

All sub-screens have a back button returning to Home.

---

## 6. Locked Decisions (resolved ambiguities from wireframe)

1. Second "Aktiva Project" stat box → relabeled "Månads pass," shows count of shifts logged this calendar month, with the month name shown as a subtitle.
2. Active project logic is dual: default activation on project creation, or manual via optional "Project Start" date. Deactivation is automatic (no shifts within 2 weeks of activation) or manual (`Avsluta Project` button). Deactivated projects can be manually reactivated. Full logic in section 3, "Project Activation / Deactivation Logic".
3. Tapping a project row → opens a new Project Detail screen (section 4.3): editable project fields, total hours, recent shifts, and the Avsluta/Aktivera Project button.
4. Logga Timmar keeps both paths to create a new project — the dropdown only lists active projects, so the separate button is the fallback when a project isn't listed yet.
5. Auth is required. v1 ships one role (admin, full access); schema built (`user_roles`) so additional restricted roles can be added later without rework.

---

## 7. Build Order (suggested)

1. Supabase schema (section 3), RLS policies, `user_roles`, Supabase Auth login screen
2. Ny Arbetare (simplest form, no dependencies)
3. Logga Project, including "Project Start" field and activation logic on insert
4. Project Detail screen (edit fields, Avsluta/Aktivera button)
5. Scheduled job (pg_cron/Edge Function) for automatic 2-week no-shift deactivation
6. Logga Timmar (depends on active projects + workers existing)
7. Home screen wired to real queries (Loggade Timmar, Aktiva Project, Månads pass, Pågående Project list)
8. Restyle

---

## 8. Explicitly Out of Scope for v1

- Final visual design (mockup is layout/logic only)
- Roles beyond admin (schema supports them, no UI/permission enforcement for other roles yet)
- Payments or invoicing beyond storing price per Tjänst
- Deleting shifts, projects, or workers (editing is supported via Project Detail; deletion is not wireframed)
- Categorized/detailed project sub-pages (explicitly deferred by client to a later phase)
