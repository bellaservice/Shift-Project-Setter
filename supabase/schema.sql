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
  emergency_contact_name text,   -- narmst anhorig
  emergency_contact_phone text,
  emergency_contact_email text,
  profile_picture_url text,
  created_at timestamptz not null default now(),
  -- Papperskorgen. Null = aktiv; en tidsstampel = borttagen och kvar i korgen
  -- sedan da, dold ur alla listor och summor men i ovrigt orord, sa en
  -- aterstallning ger tillbaka exakt det som slangdes. kit.purge_expired_trash()
  -- raderar raden pa riktigt tre veckor senare, och kaskaderna nedan tar da
  -- passen med sig.
  deleted_at timestamptz,
  -- Narmst anhorig ar antingen helt utelamnad, eller ett namn med minst en
  -- kontaktvag. Ett ensamt namn gar inte att na och sparas darfor inte.
  constraint workers_emergency_contact_reachable check (
    (emergency_contact_name is null
      and emergency_contact_phone is null
      and emergency_contact_email is null)
    or (emergency_contact_name is not null
      and (emergency_contact_phone is not null or emergency_contact_email is not null))
  )
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  -- Projectets namn: det appen visar i listor och val nar den refererar till
  -- projectet. Nullable for rader som skapades innan faltet fanns; UI:t faller
  -- da tillbaka pa address.
  name text,
  address text not null,
  -- "Bestallare" i Logga Project: bolaget som bestallt jobbet. Skrivs ut som
  -- "Bolag" i Arbetsdagbokens bestallarblock.
  client_name text,
  client_phone text,
  -- Bestallarens egen adress, och organisationsnummer. Adressen ar medvetet
  -- skild fran `address` ovan, som ar arbetsplatsen -- pa de flesta jobb ar de
  -- inte samma. Bada fylls i Logga Project, eller efterfragas i den enkat som
  -- foregar en generering av Arbetsdagboken nar de saknas.
  client_address text,
  client_org_number text,
  description text,
  start_date date,
  -- Lifecycle. "Pagaende Project" pa Home ar exakt status = 'active', och
  -- listan sorteras pa activated_at — bada kolumnerna laser queries.ts, sa de
  -- hor till schemat och inte till en losryckt alter i SQL-editorn.
  status text not null default 'active',
  activated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  -- Papperskorgen; se workers.deleted_at. `status` ror sig inte av en
  -- borttagning, och den nattliga avaktiveringen hoppar over rader som ligger i
  -- korgen -- annars vore det inte samma project som kom tillbaka.
  deleted_at timestamptz,
  constraint projects_status_check check (status in ('active', 'inactive')),
  -- Ett inaktivt project har alltid ett datum for nar det stangdes, och ett
  -- aktivt har aldrig ett. Utan detta kan de tva kolumnerna saga emot varandra.
  constraint projects_deactivated_at_matches_status check (
    (status = 'active' and deactivated_at is null)
    or (status = 'inactive' and deactivated_at is not null)
  ),
  constraint projects_start_date_sane check (
    start_date >= date '2000-01-01' and start_date <= date '2100-01-01'
  )
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

-- Publika URL:er till Storage-objekt vars rad ar permanent raderad. Postgres
-- kan inte tala med Storage, sa gallringen lagger profilbilden har och appen
-- tommer kon nasta gang Papperskorgen oppnas. Utan den skulle ett foto pa en
-- person ligga kvar publikt efter att raden sagts vara permanent borta.
create table storage_purge_queue (
  id uuid primary key default gen_random_uuid(),
  public_url text not null,
  enqueued_at timestamptz not null default now()
);

-- Kontona: vilka som kan logga in i appen, och vem var och en av dem AR.
-- Inloggningen sjalv (e-post, losenord) bor i auth.users och skapas med
-- Supabases admin-API; raden har kopplar den till personen i workers. E-posten
-- man loggar in med ar workers.email och lagras INTE en gang till -- se
-- supabase/migrations/20260820120000_konton.sql for hela resonemanget och for
-- de tva triggrarna som haller ihop det.
create table accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  -- Unik: en arbetare har hogst en inloggning.
  worker_id uuid not null unique references workers(id) on delete cascade,
  -- Appens ord, inte Auths. Auth kanner bara "bannad eller inte"; skillnaden
  -- mellan ett tillfalligt och ett permanent stopp star har.
  status text not null default 'aktiv',
  created_at timestamptz not null default now(),
  constraint accounts_status_check check (status in ('aktiv', 'pausad', 'avstangd'))
);

create table shifts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  worker_id uuid not null references workers(id) on delete cascade,
  shift_date date not null,
  -- Sanningen for alla timsummor i appen och for "Ordinarie tid" i
  -- Arbetsdagboken. Harleds INTE ur tiderna nedan: ett pass med obetald rast
  -- har ett langre spann an de timmar som faktiskt arbetats.
  hours numeric not null,
  -- "Pass Tider" i Arbetsdagboken. Nullbara for rader som loggades innan
  -- kolumnerna fanns; dokumentet renderar da en tom cell i stallet for att
  -- hitta pa ett spann.
  start_time time,
  end_time time,
  created_at timestamptz not null default now(),
  -- Antingen bada tiderna eller ingen. Ett halvifyllt spann gar inte att
  -- skriva som "07:00-16:00" och skulle tyst ge en skev cell.
  constraint shifts_pass_times_paired check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null)
  )
);

-- ---------------------------------------------------------------------------
-- Indexes for the aggregate queries the Home dashboard runs
-- ---------------------------------------------------------------------------

create index shifts_project_id_idx on shifts(project_id);
create index shifts_worker_id_idx on shifts(worker_id);
create index shifts_shift_date_idx on shifts(shift_date);
create index project_services_project_id_idx on project_services(project_id);
create index project_workers_worker_id_idx on project_workers(worker_id);
-- Partiella: bara det som faktiskt ligger i papperskorgen indexeras, vilket ar
-- precis den mangd bade korgen och gallringen laser.
create index workers_deleted_at_idx on workers(deleted_at) where deleted_at is not null;
create index projects_deleted_at_idx on projects(deleted_at) where deleted_at is not null;
create index storage_purge_queue_enqueued_at_idx on storage_purge_queue(enqueued_at);

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
alter table accounts enable row level security;
alter table storage_purge_queue enable row level security;
