-- supabase/migrations/20260819160000_papperskorg.sql
-- Papperskorgen: mjuk radering av arbetare och project, med 3 veckors angerfrist.
--
-- "Ta Bort" pa en arbetare eller ett project stamplar `deleted_at` i stallet
-- for att radera raden. Raden ligger kvar orord -- med sina pass, tjanster och
-- kopplingar -- sa en aterstallning ger tillbaka exakt det som slangdes. Efter
-- tre veckor raderas den pa riktigt, och FK-kaskaderna i supabase/schema.sql
-- tar da barnraderna med sig.
--
-- Beror pa: public.workers, public.projects (supabase/schema.sql) och
--           kit.deactivate_stale_projects() (migration #11), som skrivs om har
--           sa den inte ror det som ligger i papperskorgen.

-- ---------------------------------------------------------------------------
-- 1. Privat hjalpschema (restates the #01 privilege preamble; idempotent).
-- ---------------------------------------------------------------------------

create schema if not exists kit;

alter default privileges in schema kit
    revoke execute on functions from public, anon, authenticated;

revoke all on schema kit from public, anon;
grant usage on schema kit to postgres, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Sjalva markeringen.
--
--    Nullbar med flit: `null` = lever, tidsstampel = ligger i papperskorgen
--    sedan da. Ingen separat bool -- tva kolumner som kan saga emot varandra ar
--    precis vad projects_deactivated_at_matches_status finns for att slippa.
--
--    Partiella index: bara det som faktiskt ar slangt indexeras. Papperskorgen
--    och den nattliga gallringen laser bada exakt den mangden, och en tabell
--    dar nastan allt lever ska inte betala for ett fullt index.
-- ---------------------------------------------------------------------------

alter table public.workers  add column if not exists deleted_at timestamptz;
alter table public.projects add column if not exists deleted_at timestamptz;

comment on column public.workers.deleted_at is
    'Null = aktiv. Tidsstampel = ligger i papperskorgen sedan da, och gallras av kit.purge_expired_trash() tre veckor senare.';
comment on column public.projects.deleted_at is
    'Null = aktivt. Tidsstampel = ligger i papperskorgen sedan da, och gallras av kit.purge_expired_trash() tre veckor senare.';

create index if not exists workers_deleted_at_idx
    on public.workers (deleted_at)
    where deleted_at is not null;

create index if not exists projects_deleted_at_idx
    on public.projects (deleted_at)
    where deleted_at is not null;

-- ---------------------------------------------------------------------------
-- 3. Ko for filer som blev foraldralosa av en gallring.
--
--    Storage kaskaderar inte med raden. Nar gallringen kor som cron-jobb finns
--    ingen applikation narvarande som kan ta bort profilbilden ur bucketen, sa
--    URL:en laggs har och appen tommer kon nasta gang nagon oppnar
--    Papperskorgen. Utan den skulle ett foto pa en person ligga kvar publikt
--    efter att raden sagts vara permanent borta.
--
--    RLS pa utan policies, som alla andra tabeller: bara service_role ser den.
-- ---------------------------------------------------------------------------

create table if not exists public.storage_purge_queue (
    id          uuid primary key default gen_random_uuid(),
    public_url  text not null,
    enqueued_at timestamptz not null default now()
);

comment on table public.storage_purge_queue is
    'Publika URL:er till Storage-objekt vars rad ar permanent raderad. Toms av appen (src/lib/storage.ts), som ar den enda part som kan tala med Storage.';

alter table public.storage_purge_queue enable row level security;

create index if not exists storage_purge_queue_enqueued_at_idx
    on public.storage_purge_queue (enqueued_at);

-- ---------------------------------------------------------------------------
-- 4. Gallringen.
--
--    security definer av samma skal som kit.deactivate_stale_projects(): RLS ar
--    deny-all utan policies, och utan agarrattigheter skulle DELETE:en traffa
--    noll rader for alltid.
--
--    Tre veckor raknas som ett rullande intervall fran `deleted_at`, inte som
--    en kalendergrans -- den som slanger nagot 23:59 far samma frist som den
--    som slanger 00:01.
--
--    Anropas bade av cron-jobbet nedan och av appen nar Papperskorgen oppnas.
--    Advisory-laset gor att de tva aldrig gor samma jobb samtidigt.
-- ---------------------------------------------------------------------------

create or replace function kit.purge_expired_trash()
    returns integer
    language plpgsql
    security definer
    set search_path = ''
    set timezone = 'UTC'
as
$fn$
declare
    v_cutoff   timestamptz;
    v_workers  integer;
    v_projects integer;
begin
    -- Egen nyckel, granne med 4815162342 som deactivate_stale_projects tagit.
    if not pg_try_advisory_xact_lock(4815162343) then
        raise log 'purge_expired_trash: skipped, another run holds the advisory lock';
        return 0;
    end if;

    -- now() ar transaktionens tidsstampel: ett enda fruset nu for hela koringen.
    v_cutoff := now() - interval '3 weeks';

    -- `queued` laser ur `purged`, som ar en datamodifierande CTE och darfor kors
    -- exakt en gang och alltid till slutet. Bilderna hinner alltsa koas innan
    -- raden ar borta -- efterat gar de inte att fa tag pa.
    with purged as (
        delete from public.workers
         where deleted_at is not null
           and deleted_at < v_cutoff
        returning profile_picture_url
    ),
    queued as (
        insert into public.storage_purge_queue (public_url)
        select profile_picture_url
          from purged
         where profile_picture_url is not null
        returning id
    )
    select count(*)::integer into v_workers from purged;

    with purged as (
        delete from public.projects
         where deleted_at is not null
           and deleted_at < v_cutoff
        returning id
    )
    select count(*)::integer into v_projects from purged;

    v_workers  := coalesce(v_workers, 0);
    v_projects := coalesce(v_projects, 0);

    if v_workers + v_projects > 0 then
        raise log 'purge_expired_trash: workers=% projects=% cutoff=%',
            v_workers, v_projects, v_cutoff;
    end if;

    return v_workers + v_projects;
end;
$fn$;

comment on function kit.purge_expired_trash() is
    'Papperskorgens gallring: raderar permanent de arbetare och project vars deleted_at ar aldre an tre veckor, och koar deras profilbilder i public.storage_purge_queue. Idempotent. Returnerar antalet raderade rader.';

revoke all on function kit.purge_expired_trash() from public, anon, authenticated, service_role;

-- Smal publik wrapper, sa PostgREST (och darmed appen) kan na logiken.
create or replace function public.purge_expired_trash()
    returns integer
    language plpgsql
    security definer
    set search_path = ''
as
$fn$
begin
    return kit.purge_expired_trash();
end;
$fn$;

comment on function public.purge_expired_trash() is
    'PostgREST-anropbar wrapper runt kit.purge_expired_trash(). Bara service_role far kora den.';

revoke all on function public.purge_expired_trash() from public, anon, authenticated;
grant execute on function public.purge_expired_trash() to service_role;

-- ---------------------------------------------------------------------------
-- 5. Den nattliga avaktiveringen far inte rora papperskorgen.
--
--    Ordagrant migration #11:s funktion, med ett enda tillagg: `deleted_at is
--    null`. Utan det skulle ett aktivt project som slangdes utan pass hinna bli
--    inaktivt medan det lag i korgen, och aterstallningen skulle ge tillbaka
--    nagot annat an det som slangdes.
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
    if not pg_try_advisory_xact_lock(4815162342) then
        raise log 'deactivate_stale_projects: skipped, another run holds the advisory lock';
        return 0;
    end if;

    v_cutoff := now() - interval '2 weeks';

    with deactivated as (
        update public.projects p
        set status         = 'inactive',
            deactivated_at = now()
        where p.status = 'active'
          and p.deleted_at is null
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
    'Auto-deactivation sweep (spec section 3): sets status=inactive, deactivated_at=now() on active projects activated more than two weeks ago that have never had a shift logged. Skips rows in the papperskorg (deleted_at is not null). Idempotent. Returns the number of rows deactivated.';

revoke all on function kit.deactivate_stale_projects() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Schemalaggning -- fail-soft, precis som #11.
--
--    Cron ar garantin for att tre veckor ar tre veckor aven om ingen oppnar
--    appen. Den kan bara ta bort rader; profilbilderna ligger da kvar i kon
--    ovan tills appen nasta gang oppnar Papperskorgen.
--
--    '45 2 * * *' = 02:45 dagligen i serverns tidszon (UTC pa Supabase). Timmen
--    ar inte lastbarande: fristen ar rullande 504 timmar, ingen kalendergrans.
-- ---------------------------------------------------------------------------

do $outer$
begin
    if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
        execute 'create extension if not exists pg_cron';
        execute 'grant usage on schema cron to postgres';

        execute $unsched$
            select cron.unschedule(jobid)
            from cron.job
            where jobname = 'purge-expired-trash'
        $unsched$;

        execute $sched$
            select cron.schedule(
                'purge-expired-trash',
                '45 2 * * *',
                $job$select kit.purge_expired_trash();$job$)
        $sched$;
    else
        raise warning 'pg_cron unavailable: kit.purge_expired_trash() installed but NOT scheduled.';
    end if;
end
$outer$;
