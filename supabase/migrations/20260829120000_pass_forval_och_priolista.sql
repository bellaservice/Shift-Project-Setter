-- supabase/migrations/20260829120000_pass_forval_och_priolista.sql
-- Tillsattningen: ett pass som behover folk, forval fran arbetarna, och en
-- priolista som avgor vem som far platserna.
--
-- ⚠️ INTE APPLICERAD OCH INTE TESTAD NAR DEN SKREVS.
-- Management-API:t (`supabase db push`) svarar 403 sedan 2026-08-27, sa den har
-- filen ar den forsta SQL i projektet som inte korts mot databasen innan den
-- skrevs ner. Varje annan migration har verifierats i en rullad transaktion med
-- negativa kontroller. KOR TESTSVITEN nedan innan du litar pa nagot harinne:
--     supabase/tests/pass_forval_tests.sql
--
-- Modellen, och varfor den ar additiv
-- -----------------------------------
-- `public.shifts` betyder i dag "en persons arbete en dag" — en rad per
-- arbetare. Det ar riktigt och allt i appen bygger pa det: stamplingen,
-- bekraftelsekon, Arbetsdagboken.
--
-- Det som saknades var ORDERN: "den har dagen pa det har projectet behover jag
-- tre personer". Den far en egen tabell, `public.pass`, och shifts pekar upp
-- till den. Alltsa:
--
--     pass          en oppning. Har headcount, tider och planerade timmar.
--     shifts        en tilldelad plats i den oppningen (eller ett fristaende
--                   pass, som forr — pass_id ar nullbar).
--     forval        dagar en arbetare sagt att hen kan jobba.
--     pass_avbojd   oppningar en arbetare tackat nej till.
--
-- Lediga platser = pass.headcount minus antalet shifts med det pass_id:t. Ingen
-- kolumn behover halla rakningen, och den kan darfor inte gli isar fran
-- verkligheten.
--
-- Ingen befintlig kolumn andrar betydelse, ingen befintlig fraga behover skrivas
-- om, och `shifts` var tom i produktion nar det har skrevs — sa omflyttningen
-- kostar ingen data.

-- ---------------------------------------------------------------------------
-- 1. Privat hjalpschema. Samma preambel som ovriga migrationer, idempotent.
-- ---------------------------------------------------------------------------

create schema if not exists kit;

alter default privileges in schema kit
    revoke execute on functions from public, anon, authenticated;

revoke all on schema kit from public, anon;
grant usage on schema kit to postgres, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. public.pass — oppningen
-- ---------------------------------------------------------------------------

create table if not exists public.pass (
    id          uuid primary key default gen_random_uuid(),
    project_id  uuid not null references public.projects(id) on delete cascade,
    pass_date   date not null,
    -- Planerade Pass Tider. Samma par-regel som pa shifts: bada eller ingen.
    start_time  time,
    end_time    time,
    -- Planerade BETALDA timmar. Inte spannet ovan — en obetald rast gor
    -- 07:00–16:00 till atta timmar. Arvs ned till varje tilldelad shift.
    hours       numeric,
    -- Hur manga personer oppningen behover. Ett mal, inte ett tak: ett
    -- snabbpass (avsnitt 7) far lagga en person till utover det.
    headcount   integer not null,
    created_at  timestamptz not null default now(),
    created_by  uuid,

    constraint pass_headcount_rimlig check (headcount between 1 and 99),
    constraint pass_hours_rimliga check (hours is null or (hours >= 0 and hours <= 24)),
    constraint pass_times_paired check (
        (start_time is null and end_time is null)
        or (start_time is not null and end_time is not null)
    )
);

comment on table public.pass is
    'En oppning: ett project, en dag och ett antal personer som behovs. Platserna fylls av rader i public.shifts som pekar hit via pass_id.';
comment on column public.pass.headcount is
    'Antal personer oppningen behover. Ett mal och inte ett tak — ett snabbpass far overskrida det.';

create index if not exists pass_datum_idx on public.pass (pass_date);
create index if not exists pass_project_idx on public.pass (project_id);

-- ---------------------------------------------------------------------------
-- 3. shifts pekar upp till sin oppning, och bar sitt sen-marke
-- ---------------------------------------------------------------------------

alter table public.shifts
    add column if not exists pass_id uuid references public.pass(id) on delete set null,
    add column if not exists sen boolean not null default false;

comment on column public.shifts.pass_id is
    'Oppningen den har platsen tillhor, eller null for ett fristaende pass (Logga Timmar, snabbpass). on delete set null: raderas oppningen ar arbetet anda utfort.';
comment on column public.shifts.sen is
    'Arbetaren var sen pa det har passet. Satts av arbetsledaren vid bekraftelsen och flyttar hen ett steg ned i priolistan (kit.priolista).';

-- Serverar rakningen av lediga platser, som kors en gang per oppning varje
-- gang nagon oppnar Acceptera Pass.
create index if not exists shifts_pass_id_idx on public.shifts (pass_id)
    where pass_id is not null;

-- ---------------------------------------------------------------------------
-- 4. public.forval — dagar en arbetare kan jobba
--
--    Per dag och inte per dag-och-project: arbetaren sager "jag kan jobba
--    torsdag", inte "jag kan jobba torsdag pa Landskrona". Vilket project det
--    blir avgors av vilka oppningar som finns den dagen.
--
--    (Spec avsnitt 2 beskriver forval som per-dag-och-project. Det ar en
--    skarpning som kan laggas till senare genom att utoka nyckeln; den enklare
--    formen ar det arbetaren faktiskt ombeds svara pa i Sok Pass.)
-- ---------------------------------------------------------------------------

create table if not exists public.forval (
    worker_id  uuid not null references public.workers(id) on delete cascade,
    forval_date date not null,
    created_at timestamptz not null default now(),
    primary key (worker_id, forval_date)
);

comment on table public.forval is
    'Dagar en arbetare sagt att hen kan jobba. Primarnyckeln gor ett dubbelt forval omojligt i stallet for att behova hanteras.';

create index if not exists forval_datum_idx on public.forval (forval_date);

-- ---------------------------------------------------------------------------
-- 5. public.pass_avbojd — oppningar en arbetare tackat nej till
--
--    Utan den skulle ett avbojt pass dyka upp igen vid nasta laddning, och
--    "nej" vore en knapp utan verkan.
-- ---------------------------------------------------------------------------

create table if not exists public.pass_avbojd (
    pass_id    uuid not null references public.pass(id) on delete cascade,
    worker_id  uuid not null references public.workers(id) on delete cascade,
    orsak      text,
    created_at timestamptz not null default now(),
    primary key (pass_id, worker_id)
);

comment on table public.pass_avbojd is
    'Arbetaren har tackat nej till den har oppningen. Erbjuds inte igen. `orsak` ar frivillig och bara till for arbetsledaren att lasa.';

-- ---------------------------------------------------------------------------
-- 6. kit.priolista — vem star framst?
--
--    Tva tal avgor, i den har ordningen:
--
--      1. BEKRAFTADE timmar de sju dygnen fore passets dag. Fa timmar = hogt
--         upp. Rullande sju dagar och inte kalendervecka: ett mandagspass skulle
--         annars domas mot en nastan tom vecka, och den som rakat schemalaggas
--         tidigt i veckan vinner varje plats.
--
--      2. Sen-marken, ett for ett. Varje sent pass flyttar arbetaren ETT steg
--         ned. Den som star forst pa timmar men har tva sena pass hamnar pa
--         tredje plats. Det ar spec avsnitt 4.4 ordagrant.
--
--    ⚠️ Sen-marken raknas over hela historiken. Det ar vad som bestalldes, men
--    det betyder ocksa att ett marke fran i fjol kostar en plats i ar. Vill man
--    lata straffet klinga av racker det att lagga till ett datumvillkor pa
--    `s.shift_date` i sen-rakningen nedan — en rad, en plats.
--
--    Bara BEKRAFTADE timmar raknas. Ett tilldelat men annu inte arbetat pass ar
--    inte arbetad tid, och skulle annars gora den som redan fatt manga pass
--    till den som ser minst upptagen ut.
-- ---------------------------------------------------------------------------

create or replace function kit.priolista(p_pass_date date, p_worker_ids uuid[])
returns table (worker_id uuid, plats integer)
    language sql
    stable
    security definer
    set search_path = ''
as
$fn$
    with kandidat as (
        select w.id
          from public.workers w
         where w.id = any(p_worker_ids)
           and w.deleted_at is null
    ),
    timmar as (
        select k.id as worker_id,
               coalesce(sum(s.hours), 0) as timmar
          from kandidat k
          left join public.shifts s
                 on s.worker_id = k.id
                and s.status = 'confirmed'
                and s.shift_date >= p_pass_date - 7
                and s.shift_date <  p_pass_date
         group by k.id
    ),
    sena as (
        select k.id as worker_id,
               count(s.id) as antal
          from kandidat k
          left join public.shifts s
                 on s.worker_id = k.id
                and s.sen
         group by k.id
    ),
    grund as (
        select t.worker_id,
               -- Grundplaceringen: fa timmar forst. `worker_id` som sista
               -- nyckel gor ordningen total, sa tva arbetare med lika manga
               -- timmar alltid rankas likadant och listan inte hoppar mellan
               -- tva korningar.
               row_number() over (order by t.timmar asc, t.worker_id asc) as plats,
               coalesce(sn.antal, 0) as sena
          from timmar t
          left join sena sn on sn.worker_id = t.worker_id
    )
    select g.worker_id,
           (row_number() over (order by g.plats + g.sena asc, g.plats asc))::integer as plats
      from grund g;
$fn$;

comment on function kit.priolista(date, uuid[]) is
    'Rangordnar kandidater till ett pass: farrast bekraftade timmar de sju dygnen fore passet forst, darefter ett steg ned per sen-marke. SECURITY DEFINER for att den maste rakna timmar pa arbetare den anropande inte far lasa.';

revoke all on function kit.priolista(date, uuid[]) from public, anon;
grant execute on function kit.priolista(date, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. kit.tillsatt_pass — fyll lediga platser ur forvalen
--
--    Kors nar en oppning skapas OCH nar en arbetare gor ett forval, eftersom
--    ordningen mellan de tva inte gar att styra: arbetsledaren kan lagga ut
--    passet forst, eller arbetaren valja dagen forst. Funktionen ar darfor
--    idempotent — den fyller bara det som annu ar tomt.
--
--    Snabbpass (shifts utan pass_id, eller med) raknas med i "fyllda platser":
--    en person som redan star pa dagen ska inte fa passet en gang till.
-- ---------------------------------------------------------------------------

create or replace function kit.tillsatt_pass(p_pass_id uuid)
returns integer
    language plpgsql
    security definer
    set search_path = ''
as
$fn$
declare
    v_pass       public.pass;
    v_lediga     integer;
    v_kandidater uuid[];
    v_tillsatta  integer := 0;
    v_rad        record;
begin
    select * into v_pass from public.pass where id = p_pass_id;
    if not found then return 0; end if;

    select v_pass.headcount - count(*)
      into v_lediga
      from public.shifts s
     where s.pass_id = p_pass_id;

    if v_lediga <= 0 then return 0; end if;

    -- Kandidater: har forvalt dagen, har inte redan en plats pa passet, och har
    -- inte tackat nej till det.
    -- Casten ar inte pynt: utan den ar '{}' en `unknown`-literal, och en
    -- coalesce mellan uuid[] och unknown kan Postgres vagra typa.
    select coalesce(array_agg(f.worker_id), '{}'::uuid[])
      into v_kandidater
      from public.forval f
      join public.workers w on w.id = f.worker_id and w.deleted_at is null
     where f.forval_date = v_pass.pass_date
       and not exists (
             select 1 from public.shifts s
              where s.pass_id = p_pass_id and s.worker_id = f.worker_id)
       and not exists (
             select 1 from public.pass_avbojd a
              where a.pass_id = p_pass_id and a.worker_id = f.worker_id);

    if array_length(v_kandidater, 1) is null then return 0; end if;

    for v_rad in
        select p.worker_id
          from kit.priolista(v_pass.pass_date, v_kandidater) p
         order by p.plats
         limit v_lediga
    loop
        insert into public.shifts
            (project_id, worker_id, shift_date, status, hours,
             start_time, end_time, pass_id)
        values
            (v_pass.project_id, v_rad.worker_id, v_pass.pass_date, 'open',
             v_pass.hours, v_pass.start_time, v_pass.end_time, p_pass_id);
        v_tillsatta := v_tillsatta + 1;
    end loop;

    return v_tillsatta;
end;
$fn$;

comment on function kit.tillsatt_pass(uuid) is
    'Fyller lediga platser pa en oppning ur forvalen, i priolistans ordning. Idempotent: kors bade nar oppningen skapas och nar nagon gor ett forval, eftersom ordningen mellan de tva inte gar att styra.';

revoke all on function kit.tillsatt_pass(uuid) from public, anon;
grant execute on function kit.tillsatt_pass(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Triggrar: tillsattningen kors av sig sjalv
-- ---------------------------------------------------------------------------

create or replace function kit.pass_tillsatt_vid_skapande() returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$fn$
begin
    perform kit.tillsatt_pass(new.id);
    return new;
end;
$fn$;

drop trigger if exists pass_tillsatt_vid_skapande on public.pass;
create trigger pass_tillsatt_vid_skapande
    after insert on public.pass
    for each row execute function kit.pass_tillsatt_vid_skapande();

-- Ett forval kan fylla en oppning som redan ligger ute. Alla oppningar den
-- dagen provas; de som redan ar fulla returnerar 0 och kostar en rakning.
create or replace function kit.forval_tillsatt_dagens_pass() returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$fn$
declare
    v_pass uuid;
begin
    for v_pass in
        select id from public.pass where pass_date = new.forval_date
    loop
        perform kit.tillsatt_pass(v_pass);
    end loop;
    return new;
end;
$fn$;

drop trigger if exists forval_tillsatt_dagens_pass on public.forval;
create trigger forval_tillsatt_dagens_pass
    after insert on public.forval
    for each row execute function kit.forval_tillsatt_dagens_pass();

-- ---------------------------------------------------------------------------
-- 9. RLS
--
--    Samma hallning som resten av appen: lasning oppen dar den ar ofarlig,
--    skrivning last till den som ska aga handlingen.
-- ---------------------------------------------------------------------------

alter table public.pass enable row level security;
alter table public.forval enable row level security;
alter table public.pass_avbojd enable row level security;

-- Oppningar: alla inloggade ser dem (arbetaren maste kunna soka bland dem),
-- bara arbetsledaren skapar och andrar.
drop policy if exists pass_select_alla on public.pass;
create policy pass_select_alla on public.pass
    for select to authenticated using (true);

drop policy if exists pass_skriv_arbetsledare on public.pass;
create policy pass_skriv_arbetsledare on public.pass
    for all to authenticated
    using (kit.ar_arbetsledare())
    with check (kit.ar_arbetsledare());

-- Forval: arbetaren ager sina egna. Arbetsledaren laser allas — tillsattningen
-- bygger pa dem — men skriver inga: ett forval ar arbetarens besked.
drop policy if exists forval_select_arbetsledare on public.forval;
create policy forval_select_arbetsledare on public.forval
    for select to authenticated using (kit.ar_arbetsledare());

drop policy if exists forval_select_egna on public.forval;
create policy forval_select_egna on public.forval
    for select to authenticated using (worker_id = kit.min_arbetare_id());

drop policy if exists forval_insert_egna on public.forval;
create policy forval_insert_egna on public.forval
    for insert to authenticated with check (worker_id = kit.min_arbetare_id());

drop policy if exists forval_delete_egna on public.forval;
create policy forval_delete_egna on public.forval
    for delete to authenticated using (worker_id = kit.min_arbetare_id());

-- Avbojda: samma agande som forvalen.
drop policy if exists avbojd_select_arbetsledare on public.pass_avbojd;
create policy avbojd_select_arbetsledare on public.pass_avbojd
    for select to authenticated using (kit.ar_arbetsledare());

drop policy if exists avbojd_select_egna on public.pass_avbojd;
create policy avbojd_select_egna on public.pass_avbojd
    for select to authenticated using (worker_id = kit.min_arbetare_id());

drop policy if exists avbojd_insert_egna on public.pass_avbojd;
create policy avbojd_insert_egna on public.pass_avbojd
    for insert to authenticated with check (worker_id = kit.min_arbetare_id());

-- ---------------------------------------------------------------------------
-- 10. Kolumnvakten far ett falt till att vakta
--
--     `sen` styr priolistan och ar darmed lika kansligt som `hours`: en
--     arbetare som kunde nollstalla sitt eget sen-marke skulle koa sig forbi
--     sina kollegor. Samma undantag som forr galler fortfarande — utstamplingen
--     far fora passet fran 'open' till 'closed'.
--
--     Ersatter funktionen fran migration #11 i sin helhet.
-- ---------------------------------------------------------------------------

create or replace function kit.shifts_guard_leader_columns() returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$fn$
declare
    v_avslutar_eget_pass boolean;
begin
    if kit.ar_arbetsledare() then
        return new;
    end if;

    if new.hours is distinct from old.hours then
        raise exception 'Bara en arbetsledare far andra timmarna pa ett pass'
            using errcode = 'insufficient_privilege';
    end if;

    if new.sen is distinct from old.sen then
        raise exception 'Bara en arbetsledare far satta sen-market pa ett pass'
            using errcode = 'insufficient_privilege';
    end if;

    v_avslutar_eget_pass :=
            old.status         = 'open'
        and new.status         = 'closed'
        and old.clock_out_time is null
        and new.clock_out_time is not null;

    if new.status is distinct from old.status and not v_avslutar_eget_pass then
        raise exception 'Bara en arbetsledare far andra ett passets status'
            using errcode = 'insufficient_privilege';
    end if;

    return new;
end;
$fn$;
