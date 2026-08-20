-- supabase/migrations/20260817121000_project_auto_deactivation.sql
-- Canonical migration #11 (build order 7.0.2).
--
-- Automatic two-week no-shift project deactivation. Implements the "Automatic"
-- path of spec section 3, "Project Activation / Deactivation Logic".
--
-- Depends on: public.projects(status, activated_at, deactivated_at) and
--             public.shifts(project_id) -- migration #04 and supabase/schema.sql.
--
-- "Zero shifts" means zero shift rows EVER for that project, not zero within
-- the window (spec 3.3, Interpretation 1: the locked SQL has no date filter and
-- the SQL wins over the prose). That makes this a one-shot new-project hygiene
-- sweep: it can only ever touch a project that has produced no data at all.

-- ---------------------------------------------------------------------------
-- 1. Private helper schema. Restates the #01 privilege preamble so this file
--    is runnable on its own; idempotent, so applying both is a no-op.
-- ---------------------------------------------------------------------------

create schema if not exists kit;

alter default privileges in schema kit
    revoke execute on functions from public, anon, authenticated;

revoke all on schema kit from public, anon;
grant usage on schema kit to postgres, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Supporting index. `if not exists` so it is safe alongside #04, which
--    declares the same index. public.shifts(project_id) is already indexed by
--    supabase/schema.sql as shifts_project_id_idx, which is what the NOT EXISTS
--    anti-join needs.
-- ---------------------------------------------------------------------------

create index if not exists projects_active_activated_at_idx
    on public.projects (activated_at)
    where status = 'active';

comment on index public.projects_active_activated_at_idx is
    'Partial index serving kit.deactivate_stale_projects(): active projects ordered by activation time.';

-- ---------------------------------------------------------------------------
-- 3. The job function.
--
--    security definer: the function runs as its owner, which owns
--    public.projects. Table owners are exempt from RLS unless `force row level
--    security` is set, and schema.sql enables RLS with zero policies on every
--    table -- without definer rights the sweep would match zero rows forever.
--    Contract: do not add `force row level security` to public.projects
--    without revisiting this function.
--
--    set timezone = 'UTC': makes `now() - interval '2 weeks'` a deterministic
--    336 hours regardless of caller session.
--
--    The predicate lives in the UPDATE ... WHERE, never in a CTE the UPDATE
--    joins to. Under READ COMMITTED a colliding UPDATE re-evaluates its own
--    WHERE against the new row version, correlated NOT EXISTS included; an
--    id-join against a pre-computed CTE would re-check only the id and would
--    wrongly deactivate a project reactivated microseconds earlier.
-- ---------------------------------------------------------------------------

create or replace function kit.deactivate_stale_projects()
    returns integer
    language plpgsql
    security definer
    set search_path = ''
    set timezone = 'UTC'
as
$fn$
declare
    v_cutoff timestamptz;
    v_ids    uuid[];
    v_count  integer;
begin
    -- Serialise runs against each other. Not required for correctness -- the
    -- UPDATE below is self-guarding under READ COMMITTED -- but it stops a
    -- manual invocation and the scheduled run from doing the same work twice
    -- and blocking on each other's row locks. Transaction-scoped, so it is
    -- released automatically however this function exits.
    -- 4815162342 is an arbitrary fixed key; it exceeds int4 range, so the
    -- bigint overload is selected unambiguously. Reserve it for this job.
    if not pg_try_advisory_xact_lock(4815162342) then
        raise log 'deactivate_stale_projects: skipped, another run holds the advisory lock';
        return 0;
    end if;

    -- now() is the transaction timestamp: one frozen instant for the whole run.
    v_cutoff := now() - interval '2 weeks';

    with deactivated as (
        update public.projects p
        set status         = 'inactive',
            deactivated_at = now()
        where p.status = 'active'
          and p.activated_at < v_cutoff
          and not exists (
              select 1
              from public.shifts s
              where s.project_id = p.id
          )
        returning p.id
    )
    select count(*)::integer,
           array_agg(d.id order by d.id)
    into v_count, v_ids
    from deactivated d;

    v_count := coalesce(v_count, 0);

    if v_count > 0 then
        raise log 'deactivate_stale_projects: deactivated=% cutoff=% ids=%',
            v_count, v_cutoff, v_ids;
    else
        raise log 'deactivate_stale_projects: deactivated=0 cutoff=%', v_cutoff;
    end if;

    return v_count;
end;
$fn$;

comment on function kit.deactivate_stale_projects() is
    'Auto-deactivation sweep (spec section 3): sets status=inactive, deactivated_at=now() on active projects activated more than two weeks ago that have never had a shift logged. Idempotent. Returns the number of rows deactivated.';

revoke all on function kit.deactivate_stale_projects() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Narrow public wrapper. Exists only so a PostgREST RPC caller can reach the
--    logic, since PostgREST can only see schemas in the API exposure list.
-- ---------------------------------------------------------------------------

create or replace function public.deactivate_stale_projects()
    returns integer
    language plpgsql
    security definer
    set search_path = ''
as
$fn$
begin
    return kit.deactivate_stale_projects();
end;
$fn$;

comment on function public.deactivate_stale_projects() is
    'PostgREST-callable wrapper around kit.deactivate_stale_projects(). Executable by service_role only.';

-- EXECUTE on functions is granted to PUBLIC by default in PostgreSQL. Revoke
-- explicitly, then grant narrowly.
revoke all on function public.deactivate_stale_projects() from public, anon, authenticated;
grant execute on function public.deactivate_stale_projects() to service_role;

-- ---------------------------------------------------------------------------
-- 5. Extension and schedule -- fail-soft (build order 7.0.2).
--
--    Migrations #12-#14 sort after this file and carry the Home read model and
--    every write RPC, so this file must NOT abort a push when pg_cron is
--    unavailable. The sweep function above is created unconditionally; only
--    the extension and the schedule are conditional, and cron.* is reached
--    only through EXECUTE so PL/pgSQL never resolves the cron schema on a
--    stack that lacks it.
--
--    `create extension pg_cron` is written bare -- never `with schema
--    extensions`; pg_cron is not relocatable and the clause errors.
--
--    '15 2 * * *' = 02:15 daily in the server timezone (UTC on Supabase). The
--    hour is not load-bearing: the cutoff is a rolling 336 hours, not a
--    calendar boundary.
--
--    Unschedule explicitly before scheduling rather than relying on
--    cron.schedule()'s upsert-by-name, so re-running replaces the job instead
--    of risking a duplicate.
-- ---------------------------------------------------------------------------

do $outer$
begin
    if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
        execute 'create extension if not exists pg_cron';
        execute 'grant usage on schema cron to postgres';

        execute $unsched$
            select cron.unschedule(jobid)
            from cron.job
            where jobname in ('deactivate-stale-projects', 'purge-cron-run-history')
        $unsched$;

        execute $sched$
            select cron.schedule(
                'deactivate-stale-projects',
                '15 2 * * *',
                $job$select kit.deactivate_stale_projects();$job$)
        $sched$;

        -- cron.job_run_details grows without bound; nothing prunes it by
        -- default. Weekly on Sunday at 03:30, keep 30 days.
        execute $sched2$
            select cron.schedule(
                'purge-cron-run-history',
                '30 3 * * 0',
                $job2$delete from cron.job_run_details where end_time < now() - interval '30 days';$job2$)
        $sched2$;
    else
        raise warning 'pg_cron unavailable: kit.deactivate_stale_projects() installed but NOT scheduled.';
    end if;
end
$outer$;
