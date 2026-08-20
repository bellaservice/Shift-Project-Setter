-- supabase/migrations/20260817120300_projects.sql
-- Canonical migration #04 (build order 7.0.2): the public.projects lifecycle.
--
-- Scope note: the base `create table public.projects` still lives in the flat
-- supabase/schema.sql, which predates the migration set and has already been
-- applied to the linked project. This file carries the part of #04 that
-- schema.sql does not: the four lifecycle columns, their invariants, and BOTH
-- lifecycle triggers. Every statement is idempotent, so it is a no-op against a
-- database that already has them.
--
-- Deliberately NOT included from #04's canonical content: the
-- `set_projects_updated_at` trigger. It calls kit.set_updated_at() from
-- migration #01, which has not been applied, and public.projects has no
-- updated_at column -- installing it would make every UPDATE fail.

-- ---------------------------------------------------------------------------
-- 1. Private helper schema (restates the #01 privilege preamble; idempotent).
--    The lockdown is per function, not per schema: revoking USAGE on kit from
--    authenticated would break every RLS policy that calls a kit helper.
-- ---------------------------------------------------------------------------

create schema if not exists kit;

alter default privileges in schema kit
    revoke execute on functions from public, anon, authenticated;

revoke all on schema kit from public, anon;
grant usage on schema kit to postgres, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Lifecycle columns and invariants (LD-2.1, LD-2.2)
--    INV-1 status = 'active'   => deactivated_at is null
--    INV-2 status = 'inactive' => deactivated_at is not null
--    INV-3 activated_at is never null
--    INV-4 status in ('active', 'inactive')
--
--    The check constraints are added only when absent rather than dropped and
--    recreated, so there is never a window in which the table is unprotected.
--    INV-1/INV-2 is named projects_deactivated_at_matches_status per the 7.0.2
--    manifest (LD-2.2 calls the same constraint projects_lifecycle_ck; the
--    manifest name is the one that is live and it wins).
--
--    Rejected, and must not be added: a `deactivated_at >= activated_at` check.
--    A future-dated start_date plus an immediate "Avsluta Project" is a legal
--    state that such a constraint would reject.
-- ---------------------------------------------------------------------------

alter table public.projects
    add column if not exists start_date     date,
    add column if not exists status         text not null default 'active',
    add column if not exists activated_at   timestamptz,
    add column if not exists deactivated_at timestamptz;

update public.projects
   set activated_at = coalesce(
         (start_date::timestamp at time zone 'Europe/Stockholm'),
         created_at,
         now())
 where activated_at is null;

alter table public.projects
    alter column activated_at set not null;                            -- INV-3

do $inv$
begin
    if not exists (select 1 from pg_constraint
                    where conrelid = 'public.projects'::regclass
                      and conname  = 'projects_status_check') then
        alter table public.projects
            add constraint projects_status_check
            check (status in ('active', 'inactive'));                  -- INV-4
    end if;

    if not exists (select 1 from pg_constraint
                    where conrelid = 'public.projects'::regclass
                      and conname  = 'projects_deactivated_at_matches_status') then
        alter table public.projects
            add constraint projects_deactivated_at_matches_status
            check (
                 (status = 'active'   and deactivated_at is null)       -- INV-1
              or (status = 'inactive' and deactivated_at is not null)   -- INV-2
            );
    end if;
end
$inv$;

-- Partial index serving the nightly sweep and the Logga Timmar dropdown.
-- Only active rows are ever scanned.
create index if not exists projects_active_activated_at_idx
    on public.projects (activated_at)
    where status = 'active';

-- ---------------------------------------------------------------------------
-- 3. Insert-time activation (LD-2.3). Already live; restated so this file
--    reconstructs the lifecycle on its own.
-- ---------------------------------------------------------------------------

create or replace function kit.projects_set_activation_defaults() returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$fn$
begin
    -- Locked: every project is born active. status and deactivated_at are
    -- privileged columns at insert time and client-supplied values are
    -- discarded rather than rejected, so a stale form or a bulk import cannot
    -- create a project that is dead on arrival.
    new.status := 'active';
    new.deactivated_at := null;

    if new.created_at is null then
        new.created_at := now();
    end if;

    if new.start_date is not null then
        -- start_date is a DATE denoting local midnight in the application
        -- timezone ('Europe/Stockholm'), NOT UTC midnight. A bare
        -- start_date::timestamptz would use the session TimeZone (UTC on
        -- Supabase) and land activation 1-2 hours late, shifting the 2-week
        -- auto-deactivation deadline by the same amount.
        new.activated_at := (new.start_date::timestamp at time zone 'Europe/Stockholm');
    else
        new.activated_at := new.created_at;
    end if;

    return new;
end;
$fn$;

comment on function kit.projects_set_activation_defaults() is 'BEFORE INSERT on public.projects: activated_at = start_date at Europe/Stockholm midnight when start_date is given, else created_at; status forced to ''active'' and deactivated_at to null. INSERT only, so reactivation UPDATEs keep control of activated_at.';

revoke all on function kit.projects_set_activation_defaults() from public;

drop trigger if exists projects_set_activation_defaults on public.projects;

create trigger projects_set_activation_defaults
    before insert
    on public.projects
    for each row
execute function kit.projects_set_activation_defaults();

-- ---------------------------------------------------------------------------
-- 4. The status state machine (LD-2.4 / LD-2.5).
--
--    This trigger -- not the UI, not the server action -- is the authority on
--    the project lifecycle. It permits exactly the two transitions spec 3
--    defines, DERIVES activated_at / deactivated_at from the transition so a
--    writer that sets only `status` always produces a row satisfying
--    projects_deactivated_at_matches_status, and pins both timestamps when
--    status does not change, so editing "Project Start" on Project Detail
--    cannot move the two-week clock.
-- ---------------------------------------------------------------------------

create or replace function kit.projects_enforce_status_transition() returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$fn$
begin
    if new.id is distinct from old.id then
        raise exception 'projects.id är oföränderlig'
            using errcode = 'restrict_violation';
    end if;

    if new.created_at is distinct from old.created_at then
        raise exception 'projects.created_at är oföränderlig'
            using errcode = 'restrict_violation';
    end if;

    if new.status is distinct from old.status then
        if old.status = 'active' and new.status = 'inactive' then
            -- Manual "Avsluta Project" (spec 4.3) and
            -- kit.deactivate_stale_projects() (migration #11) both land here.
            -- Client-supplied timestamps are overwritten, never trusted.
            new.activated_at := old.activated_at;
            new.deactivated_at := now();

        elsif old.status = 'inactive' and new.status = 'active' then
            -- Spec 3 reactivation: activated_at = now(), deactivated_at
            -- cleared. Deliberately now() and not start_date: reactivation
            -- restarts the 2-week window from the moment the user pressed the
            -- button.
            new.activated_at := now();
            new.deactivated_at := null;

        else
            raise exception 'Otillåten statusövergång: % -> %', old.status, new.status
                using errcode = 'check_violation';
        end if;

    else
        -- No status change: the lifecycle timestamps are immutable. This is
        -- what stops a direct PostgREST/SQL update from clearing
        -- deactivated_at on an inactive project, or back-dating activated_at
        -- to dodge the nightly job. start_date, address, client_name,
        -- client_phone and description stay freely editable (spec 4.3).
        if new.activated_at is distinct from old.activated_at
            or new.deactivated_at is distinct from old.deactivated_at then
            raise exception
                'activated_at/deactivated_at kan bara ändras genom en statusövergång (nuvarande status: %)',
                old.status
                using errcode = 'restrict_violation';
        end if;
    end if;

    return new;
end;
$fn$;

comment on function kit.projects_enforce_status_transition() is 'BEFORE UPDATE on public.projects: permits only active<->inactive, derives activated_at/deactivated_at from the transition, and rejects any change to those two columns without one. id and created_at are immutable.';

revoke all on function kit.projects_enforce_status_transition() from public;

drop trigger if exists projects_enforce_status_transition on public.projects;

create trigger projects_enforce_status_transition
    before update
    on public.projects
    for each row
execute function kit.projects_enforce_status_transition();
