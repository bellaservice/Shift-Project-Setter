-- supabase/migrations/20260826000000_role_separation.sql
-- Rollseparation: arbetsledare och arbetare blir två olika saker i databasen.
--
-- Vad som var fel innan
-- ---------------------
-- Varje policy på shifts, workers och accounts var `for all ... using (true)`
-- till authenticated. Alltså: den som kunde logga in kunde allt. Så länge varje
-- konto tillhörde kontorspersonal var det en avvägning. I samma stund en
-- arbetare får en inloggning är det ett hål: hen kan sätta sina egna `hours`,
-- vippa sitt eget pass till 'confirmed', och läsa varje kollegas personnummer
-- och kontonummer. Se avsnitt 8.5 i shift-system-spec.md.
--
-- Varför en trigger och inte kolumnrättigheter
-- -------------------------------------------
-- Planen var först `grant update (clock_in_time, ...) on shifts to
-- authenticated`. Det fungerar inte, och det är värt att skriva ner varför så
-- att ingen försöker igen: PostgREST gör `set role authenticated` för VARJE
-- inloggad, oavsett approll. Arbetsledare och arbetare är alltså samma
-- Postgres-roll, och ett kolumnrättighet hade strypt båda lika hårt.
-- `information_schema.role_table_grants` på public.shifts listar bara fyra
-- mottagare — anon, authenticated, postgres, service_role — och ingen av dem
-- motsvarar approllen.
--
-- RLS `with check` duger inte heller: det beskriver hur den NYA raden ska se
-- ut, och kan inte säga "den här kolumnen måste vara kvar på sitt gamla värde".
-- Det som kan jämföra gammalt mot nytt är en `before update`-trigger, och det
-- är därför punkt 6 nedan finns.
--
-- Roller som text och inte enum
-- -----------------------------
-- Samma avvägning som projects_status_check och shifts_status_check: att vidga
-- ett check-villkor är en vanlig transaktion, att vidga en enum är det inte.
-- Den dagen en tredje roll behövs ska den kosta en rad, inte ett underhållsstopp.

-- ---------------------------------------------------------------------------
-- 1. Privat hjälpschema. Samma preambel som migration #01 och #08, idempotent.
-- ---------------------------------------------------------------------------

create schema if not exists kit;

alter default privileges in schema kit
    revoke execute on functions from public, anon, authenticated;

revoke all on schema kit from public, anon;
grant usage on schema kit to postgres, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Rollkolumnen, och de två backfills som måste ske i samma andetag
--
--    Allt ligger i ett DO-block som bara kör om kolumnen saknas. Det är inte
--    stilgrepp utan säkerhet: båda backfillsen SÄTTER 'arbetsledare', och en
--    andra körning skulle befordra varje konto som med avsikt gjorts till
--    arbetare sedan dess. Grinden gör migrationen idempotent i den enda
--    betydelse som spelar roll här — att köra den igen får inte ge någon mer
--    makt än första gången.
--
--    ⚠️ Den andra backfillen är den som hindrar en utelåsning. `auth.users`
--    innehöll 5 rader och `public.accounts` bara 3: två inloggningar fanns helt
--    utanför kontotabellen. kit.ar_arbetsledare() nedan svarar nej på ett konto
--    den inte hittar — den faller stängt med flit — så utan den här raden hade
--    de två blivit arbetare i samma sekund migrationen kördes, och tappat
--    tillgången till sin egen app. De får konton utan arbetare, vilket är
--    precis vad migration 20260820200000 gjorde möjligt och beskriver som
--    "en administrator, en ekonomiansvarig, nagon som ska in i appen men aldrig
--    loggar ett pass".
-- ---------------------------------------------------------------------------

do $$
begin
    if not exists (
        select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name   = 'accounts'
           and column_name  = 'role'
    ) then
        alter table public.accounts
            add column role text not null default 'arbetare';

        -- Varje konto som fanns när rollen infördes är kontorspersonal.
        update public.accounts set role = 'arbetsledare';

        -- Inloggningar utan kontorad. Se varningen ovan.
        --
        -- worker_id null och e-posten med: accounts_worker_xor_email kraver
        -- exakt det ena eller det andra, och de har kontona hor inte till nagon
        -- arbetare. Kravet gor ocksa att en auth-anvandare utan e-post skulle
        -- fa migrationen att FALLA har -- vilket ar med avsikt. Att tyst hoppa
        -- over raden vore att tyst lasa ute nagon, och ett hogljutt fel vid
        -- push ar det billigaste stallet att upptacka det pa. Vid skrivande
        -- stund har alla fem auth.users en adress.
        insert into public.accounts (id, worker_id, email, status, role)
        select u.id, null, u.email, 'aktiv', 'arbetsledare'
          from auth.users u
         where not exists (select 1 from public.accounts a where a.id = u.id);
    end if;
end
$$;

alter table public.accounts drop constraint if exists accounts_role_check;
alter table public.accounts add constraint accounts_role_check
    check (role in ('arbetsledare', 'arbetare'));

comment on column public.accounts.role is
    'arbetsledare | arbetare. Default arbetare: ett nytt konto ska aldrig födas privilegierat, utan befordras med avsikt. Läses av kit.ar_arbetsledare().';

-- ---------------------------------------------------------------------------
-- 3. Vem är arbetsledare?
--
--    SECURITY DEFINER av exakt samma skäl som kit.arende_synligt(): funktionen
--    läser public.accounts, och accounts har egna policies. En vanlig funktion
--    hade läst tabellen genom den anropandes glasögon — alltså genom policyn
--    som just ska avgöras — och antingen filtrerat bort svaret eller gått i
--    cirkel. Definer-funktionen läser förbi RLS och svarar rent ja eller nej.
--
--    `stable` så att planeraren får anropa den en gång per rad i stället för en
--    gång per referens.
--
--    Statuskravet är med flit: ett pausat eller avstängt konto ska inte behålla
--    sina befogenheter. Faller man ur 'aktiv' faller man tillbaka till samma
--    rättigheter som en arbetare, inte till inga alls — inloggningen stoppas
--    ändå på vägen in.
-- ---------------------------------------------------------------------------

create or replace function kit.ar_arbetsledare() returns boolean
    language sql
    stable
    security definer
    set search_path = ''
as
$fn$
    select exists (
        select 1
          from public.accounts a
         where a.id     = auth.uid()
           and a.role   = 'arbetsledare'
           and a.status = 'aktiv'
    );
$fn$;

comment on function kit.ar_arbetsledare() is
    'Ar den inloggade en aktiv arbetsledare? Laser public.accounts forbi dess RLS, vilket ar varfor den ar SECURITY DEFINER. Faller stangt: ett konto som inte finns ar inte arbetsledare.';

-- ---------------------------------------------------------------------------
-- 4. Vilken arbetare ÄR den inloggade?
--
--    Null för ett konto utan arbetare, och det är meningen. Varje policy nedan
--    jämför `worker_id = kit.min_arbetare_id()`, och en jämförelse mot null blir
--    null blir falskt — kontorspersonalens konton får alltså ingenting genom
--    "egen rad"-vägen, bara genom arbetsledarvägen.
-- ---------------------------------------------------------------------------

create or replace function kit.min_arbetare_id() returns uuid
    language sql
    stable
    security definer
    set search_path = ''
as
$fn$
    select a.worker_id
      from public.accounts a
     where a.id = auth.uid()
       and a.status = 'aktiv';
$fn$;

comment on function kit.min_arbetare_id() is
    'Vilken public.workers-rad den inloggade ar, eller null for ett konto utan arbetare. SECURITY DEFINER av samma skal som kit.ar_arbetsledare().';

-- Ett EXECUTE-grant och inte bara en policy: SECURITY DEFINER styr vad en
-- funktion får göra när den kör, aldrig vem som får starta den. Att blanda ihop
-- de två är vad som sänkte purge_expired_trash() i migration #06.
revoke all on function kit.ar_arbetsledare()  from public, anon;
revoke all on function kit.min_arbetare_id()  from public, anon;
grant execute on function kit.ar_arbetsledare() to authenticated;
grant execute on function kit.min_arbetare_id() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Policies på public.shifts
--
--    SELECT är öppet för alla inloggade. Det är ett medvetet val och inte en
--    slarvig rest: schemat är arbetslagets gemensamma information, och en
--    arbetare som inte ser passen har ingen app att använda. Det som skyddas
--    här är skrivningarna.
--
--    UPDATE har TVÅ policies, och de är OR:ade — så fungerar flera permissiva
--    policies på samma kommando. Arbetsledaren når varje rad; arbetaren når
--    bara sin egen. Vad arbetaren sedan får ändra PÅ den raden avgörs inte här
--    utan av triggern i punkt 6, eftersom RLS inte kan jämföra mot gamla värden.
--
--    INSERT och DELETE är arbetsledarens ensamma. Att stämpla in är ett UPDATE
--    på ett pass som redan schemalagts (spec Fas 1), inte ett INSERT — så
--    arbetaren behöver ingen INSERT-väg, och att inte ge den är ett hål mindre.
-- ---------------------------------------------------------------------------

drop policy if exists shifts_authenticated_all on public.shifts;

drop policy if exists shifts_select_alla on public.shifts;
create policy shifts_select_alla on public.shifts
    for select to authenticated
    using (true);

drop policy if exists shifts_insert_arbetsledare on public.shifts;
create policy shifts_insert_arbetsledare on public.shifts
    for insert to authenticated
    with check (kit.ar_arbetsledare());

drop policy if exists shifts_update_arbetsledare on public.shifts;
create policy shifts_update_arbetsledare on public.shifts
    for update to authenticated
    using (kit.ar_arbetsledare())
    with check (kit.ar_arbetsledare());

drop policy if exists shifts_update_egen_stampling on public.shifts;
create policy shifts_update_egen_stampling on public.shifts
    for update to authenticated
    -- Både using och with check: using väljer vilka rader som får röras, with
    -- check hindrar att raden skrivs över till någon annans i samma UPDATE.
    using (worker_id = kit.min_arbetare_id())
    with check (worker_id = kit.min_arbetare_id());

drop policy if exists shifts_delete_arbetsledare on public.shifts;
create policy shifts_delete_arbetsledare on public.shifts
    for delete to authenticated
    using (kit.ar_arbetsledare());

-- ---------------------------------------------------------------------------
-- 6. Kolumnvakten — det som faktiskt hindrar en arbetare från att sätta sin lön
--
--    Se filhuvudet för varför det inte går att göra med kolumnrättigheter.
--
--    Triggern heter shifts_guard_leader_columns och den andra before-update-
--    triggern heter shifts_preserve_clock_originals. Postgres kör flera
--    triggers på samma händelse i bokstavsordning, och g kommer före p: vakten
--    hinner avvisa innan spårtriggern gör något arbete. Ordningen är inte
--    kritisk för korrektheten, men den är trevligare att felsöka.
--
--    SECURITY DEFINER för att den anropar kit.ar_arbetsledare(), som läser
--    accounts förbi RLS.
-- ---------------------------------------------------------------------------

create or replace function kit.shifts_guard_leader_columns() returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$fn$
begin
    if kit.ar_arbetsledare() then
        return new;
    end if;

    -- is distinct from och inte <>: hours är nullbar, och en ändring från null
    -- till ett tal är precis den ändring som ska stoppas.
    if new.hours is distinct from old.hours then
        raise exception 'Bara en arbetsledare far andra timmarna pa ett pass'
            using errcode = 'insufficient_privilege';
    end if;

    if new.status is distinct from old.status then
        raise exception 'Bara en arbetsledare far andra ett passets status'
            using errcode = 'insufficient_privilege';
    end if;

    return new;
end;
$fn$;

comment on function kit.shifts_guard_leader_columns() is
    'Avvisar andringar av hours och status fran alla utom arbetsledare. Finns for att kolumnrattigheter inte kan skilja approllerna at -- varje inloggad ar samma Postgres-roll (authenticated).';

drop trigger if exists shifts_guard_leader_columns on public.shifts;
create trigger shifts_guard_leader_columns
    before update on public.shifts
    for each row execute function kit.shifts_guard_leader_columns();

-- ---------------------------------------------------------------------------
-- 7. Policies på public.accounts
--
--    Den här är hela husets nyckelskåp. Utan den vore allt ovanför teater: en
--    arbetare som får skriva i accounts sätter helt enkelt sin egen role till
--    'arbetsledare' och har därmed gett sig själv allt annat också.
--
--    SELECT är öppet — vilka som har konton är inte hemligt, och kontolistan
--    behöver det.
-- ---------------------------------------------------------------------------

drop policy if exists accounts_authenticated_all on public.accounts;

drop policy if exists accounts_select_alla on public.accounts;
create policy accounts_select_alla on public.accounts
    for select to authenticated
    using (true);

drop policy if exists accounts_insert_arbetsledare on public.accounts;
create policy accounts_insert_arbetsledare on public.accounts
    for insert to authenticated
    with check (kit.ar_arbetsledare());

drop policy if exists accounts_update_arbetsledare on public.accounts;
create policy accounts_update_arbetsledare on public.accounts
    for update to authenticated
    using (kit.ar_arbetsledare())
    with check (kit.ar_arbetsledare());

drop policy if exists accounts_delete_arbetsledare on public.accounts;
create policy accounts_delete_arbetsledare on public.accounts
    for delete to authenticated
    using (kit.ar_arbetsledare());

-- ---------------------------------------------------------------------------
-- 8. Policies på public.workers
--
--    Inte med i den ursprungliga planen, men den efterfrågade testsviten kräver
--    den: "arbetare kan inte läsa kollegors personnummer". Med
--    workers_authenticated_all kvar hade det testet fallit, och det hade fallit
--    på riktigt — workers bär personnummer, kontonummer, adress och anhöriga.
--
--    Arbetaren ser exakt en rad: sin egen. Arbetsledaren ser rostern.
-- ---------------------------------------------------------------------------

drop policy if exists workers_authenticated_all on public.workers;

drop policy if exists workers_select_arbetsledare on public.workers;
create policy workers_select_arbetsledare on public.workers
    for select to authenticated
    using (kit.ar_arbetsledare());

drop policy if exists workers_select_egen on public.workers;
create policy workers_select_egen on public.workers
    for select to authenticated
    using (id = kit.min_arbetare_id());

drop policy if exists workers_insert_arbetsledare on public.workers;
create policy workers_insert_arbetsledare on public.workers
    for insert to authenticated
    with check (kit.ar_arbetsledare());

drop policy if exists workers_update_arbetsledare on public.workers;
create policy workers_update_arbetsledare on public.workers
    for update to authenticated
    using (kit.ar_arbetsledare())
    with check (kit.ar_arbetsledare());

drop policy if exists workers_delete_arbetsledare on public.workers;
create policy workers_delete_arbetsledare on public.workers
    for delete to authenticated
    using (kit.ar_arbetsledare());
