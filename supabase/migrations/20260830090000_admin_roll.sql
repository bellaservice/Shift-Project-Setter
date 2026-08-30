-- supabase/migrations/20260830090000_admin_roll.sql
--
-- En tredje roll: admin. Plus minnet av vilken period en Arbetsdagbok senast
-- tackte, sa nasta dokument kan borja dar det forra slutade.
--
-- ⚠️ INTE APPLICERAD OCH INTE TESTAD NAR DEN SKREVS — samma forbehall som
-- 20260829120000. Testsviten ligger i supabase/tests/admin_roll_tests.sql.
--
-- ADMIN AR EN OVERMANGD, INTE EN SIDOROLL
-- ---------------------------------------
-- Det ar migrationens enda verkligt farliga beslut, sa det star forst.
--
-- Appens skrivrattigheter hanger nastan helt pa kit.ar_arbetsledare(): RLS-
-- policyerna pa shifts, projects, workers, accounts och pass fragar den, och sa
-- gor kolumnvakten som skyddar hours/sen/status. En ny roll som bara lades till
-- i check-villkoret hade darfor blivit appens MINST behoriga roll — en admin
-- hade inte kunnat bekrafta ett pass, inte redigera ett project, inte ens satta
-- timmar. Namnet hade lovat allt och rollen gett mindre an arbetarens.
--
-- Darfor svarar kit.ar_arbetsledare() ja for bade 'arbetsledare' och 'admin'.
-- Funktionen betyder fran och med nu "far leda arbetet", inte "har rollen
-- arbetsledare". Allt som redan ar byggt fortsatter fungera oforandrat, och
-- admin far allt arbetsledaren har utan att en enda policy skrivs om.
--
-- Det som ar ENBART adminens fragar kit.ar_admin() i stallet.

create schema if not exists kit;

alter default privileges in schema kit
    revoke execute on functions from public, anon, authenticated;

revoke all on schema kit from public, anon;
grant usage on schema kit to postgres, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. Rollen slapps in i check-villkoret
-- ---------------------------------------------------------------------------

alter table public.accounts drop constraint if exists accounts_role_check;
alter table public.accounts add constraint accounts_role_check
    check (role in ('admin', 'arbetsledare', 'arbetare'));

comment on column public.accounts.role is
    'admin | arbetsledare | arbetare. Admin ar en overmangd av arbetsledare — se kit.ar_arbetsledare(), som svarar ja for bada.';

-- ---------------------------------------------------------------------------
-- 2. "Far leda arbetet" omfattar nu adminen
--
--    Ersatter funktionen fran migration #10 i sin helhet. Kroppen ar identisk
--    sa nar som pa `in (...)`.
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
           and a.role   in ('arbetsledare', 'admin')
           and a.status = 'aktiv'
    );
$fn$;

comment on function kit.ar_arbetsledare() is
    'Far den inloggade leda arbetet? Sant for bade arbetsledare och admin. Heter fortfarande ar_arbetsledare eftersom varje policy och vakt i databasen anropar den vid det namnet — betydelsen ar "far leda", inte "har rollen".';

revoke all on function kit.ar_arbetsledare() from public, anon;
grant execute on function kit.ar_arbetsledare() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. kit.ar_admin() — det som ar enbart adminens
-- ---------------------------------------------------------------------------

create or replace function kit.ar_admin() returns boolean
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
           and a.role   = 'admin'
           and a.status = 'aktiv'
    );
$fn$;

comment on function kit.ar_admin() is
    'Ar den inloggade admin? Smalare an ar_arbetsledare(), for det fatal som bara adminen ska rada over.';

revoke all on function kit.ar_admin() from public, anon;
grant execute on function kit.ar_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Utelasningsskyddet raknar adminen som en ledare
--
--    Vakten fran migration #14 vagrar varje andring som lamnar noll aktiva
--    arbetsledare. Med en tredje roll blir fragan: raddar en admin laget?
--
--    Ja. Poangen med vakten ar att det alltid ska finnas NAGON kvar som kan
--    dela ut roller igen, och en admin kan det. Rakhade den inte adminen skulle
--    en organisation med en admin och en arbetsledare inte kunna gora ledaren
--    till arbetare — trots att adminen kunde satt tillbaka rollen direkt.
--
--    Ersatter funktionen fran migration #14 i sin helhet.
-- ---------------------------------------------------------------------------

create or replace function kit.accounts_behall_en_arbetsledare() returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$fn$
declare
    v_var_ledare boolean;
    v_ar_ledare  boolean;
begin
    v_var_ledare := old.role in ('arbetsledare', 'admin') and old.status = 'aktiv';

    if tg_op = 'DELETE' then
        v_ar_ledare := false;
    else
        v_ar_ledare := new.role in ('arbetsledare', 'admin') and new.status = 'aktiv';
    end if;

    if not v_var_ledare or v_ar_ledare then
        if tg_op = 'DELETE' then return old; end if;
        return new;
    end if;

    if not exists (
        select 1
          from public.accounts a
         where a.id     <> old.id
           and a.role   in ('arbetsledare', 'admin')
           and a.status = 'aktiv'
    ) then
        raise exception
            'Det maste finnas minst en aktiv arbetsledare eller admin kvar'
            using errcode = 'raise_exception';
    end if;

    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 5. public.arbetsdagbok_perioder — vilken ram ett dokument senast tackte
--
--    En Arbetsdagbok skrivs ut for ett spann av dagar, och nasta ska borja dar
--    den forra slutade. Utan ett minne av det ar det den som skriver ut som
--    maste komma ihag vilket datum forra dokumentet gick fram till — och det ar
--    precis den sortens sak man har fel om en gang i kvartalet, med en dag som
--    aldrig fakturerades som foljd.
--
--    Raden skrivs nar dokumentet skapas. Den ar en LOGG och inte en
--    installning: en ny rad per utskrift, aldrig en uppdaterad. Skrevs samma
--    period ut tva ganger star den tva ganger, vilket ar sant och ibland
--    upplysande.
-- ---------------------------------------------------------------------------

create table if not exists public.arbetsdagbok_perioder (
    id         uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    fran       date not null,
    till       date not null,
    skapad_av  uuid,
    created_at timestamptz not null default now(),

    constraint arbetsdagbok_perioder_ordning check (till >= fran)
);

comment on table public.arbetsdagbok_perioder is
    'En logg over vilka dagar varje utskriven Arbetsdagbok tackte, sa nasta kan borja dar den forra slutade. En rad per utskrift — aldrig uppdaterad.';

create index if not exists arbetsdagbok_perioder_project_idx
    on public.arbetsdagbok_perioder (project_id, till desc);

alter table public.arbetsdagbok_perioder enable row level security;

-- Alla inloggade far lasa: arbetaren ser inte skarmen, men en tom lista och ett
-- nekat svar ar olika saker, och det forsta ar lattare att felsoka.
drop policy if exists perioder_select_alla on public.arbetsdagbok_perioder;
create policy perioder_select_alla on public.arbetsdagbok_perioder
    for select to authenticated using (true);

-- Skrivning hor till den som far leda arbetet, alltsa arbetsledare och admin.
drop policy if exists perioder_skriv_ledare on public.arbetsdagbok_perioder;
create policy perioder_skriv_ledare on public.arbetsdagbok_perioder
    for all to authenticated
    using (kit.ar_arbetsledare())
    with check (kit.ar_arbetsledare());
