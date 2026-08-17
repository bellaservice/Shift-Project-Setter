-- Shift Setting System — schema + RLS
-- Run this once in the Supabase SQL editor (or via `supabase db push`) against a fresh project.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  address text,
  personal_number text,       -- personnummer, sensitive: treat as PII
  account_number text,        -- bank account, sensitive: treat as PII
  emergency_contact text,     -- narmst anhorig
  profile_picture_url text,
  created_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  client_name text,
  client_phone text,
  description text,
  created_at timestamptz not null default now()
);

create table project_services (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  service_name text not null,
  price numeric
);

create table project_workers (
  project_id uuid not null references projects(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete cascade,
  primary key (project_id, worker_id)
);

create table shifts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete cascade,
  shift_date date not null,
  hours numeric not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes for the aggregate queries the Home dashboard runs
-- ---------------------------------------------------------------------------

create index shifts_project_id_idx on shifts(project_id);
create index shifts_worker_id_idx on shifts(worker_id);
create index shifts_shift_date_idx on shifts(shift_date);
create index project_services_project_id_idx on project_services(project_id);
create index project_workers_worker_id_idx on project_workers(worker_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- v1 has no auth (single-admin internal tool, no login screen — per spec
-- section 6/8). Since there is no `authenticated` user to scope policies to,
-- the safe way to satisfy "sensitive fields must be RLS-restricted even in
-- v1" is: enable RLS on every table and add NO policies for `anon` /
-- `authenticated`. With RLS on and zero policies, Postgres denies all access
-- to those roles by default. `service_role` bypasses RLS entirely (Supabase
-- grants it BYPASSRLS), so the app's server-side code — Next.js Route
-- Handlers / Server Actions using SUPABASE_SERVICE_ROLE_KEY — is the only
-- thing that can read or write these tables. The browser only ever holds the
-- anon key, which after this migration cannot see workers.personal_number,
-- workers.account_number, or any other row in any of these tables.
--
-- If real multi-user auth is added later, replace this deny-all with
-- per-role policies (e.g. only admins can select personal_number/
-- account_number columns via a restricted view).
-- ---------------------------------------------------------------------------

alter table workers enable row level security;
alter table projects enable row level security;
alter table project_services enable row level security;
alter table project_workers enable row level security;
alter table shifts enable row level security;
