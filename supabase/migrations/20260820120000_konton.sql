-- supabase/migrations/20260820120000_konton.sql
-- Konton: vilka som kan logga in i appen, och vem var och en av dem AR.
--
-- Ett konto ar inte en egen person. Det ar en inloggning som pekar pa en rad i
-- public.workers, och det ar hela poangen med tabellen: nar nagon loggar in ska
-- appen kunna svara "det har ar Anna, arbetare 0d4f...", inte bara "det har ar
-- anna@bellaservice.se". Utan kopplingen vore ett konto en e-postadress utan
-- arbetare, och alla pass, timmar och Arbetsdagbocker i appen hanger pa
-- arbetaren.
--
-- DE TRE HALVORNA
--
--   auth.users      -- e-post och losenord. Supabase Auth ager dem; appen skapar
--                      raden med admin-API:et och ror den aldrig direkt.
--   public.accounts -- den har tabellen: kopplingen och statusen. Raden HAR
--                      samma id som auth-anvandaren, sa det finns inget tredje
--                      id att halla reda pa.
--   public.workers  -- personen. Namn, bild, telefon, pass. E-posten som
--                      inloggningen anvander ar workers.email: den skrivs i
--                      Redigera Arbetare och ar samma adress i bada halvorna.
--
-- Att e-posten bor i workers och inte har ar avsiktligt. Tva kolumner som ska
-- vara samma adress ar tva kolumner som forr eller senare sager olika saker;
-- den enda som far anda sig ar arbetarens, och `saveWorker` skickar andringen
-- vidare till auth.users i samma anrop.
--
-- Beror pa: public.workers (supabase/schema.sql), auth.users (Supabase Auth)
--           och schemat kit (migration #01, aterupprepat nedan).

-- ---------------------------------------------------------------------------
-- 1. Privat hjalpschema (restates the #01 privilege preamble; idempotent).
-- ---------------------------------------------------------------------------

create schema if not exists kit;

alter default privileges in schema kit
    revoke execute on functions from public, anon, authenticated;

revoke all on schema kit from public, anon;
grant usage on schema kit to postgres, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Kopplingen.
--
--    `id` ar auth-anvandarens id och inte ett eget: ett konto utan inloggning
--    ar inget konto, och en cascade fran auth.users tar raden med sig.
--
--    `worker_id` ar unik. En arbetare har hogst ett konto -- tva inloggningar
--    till samma person ar tva vagar in som ingen kan halla isar, och den som
--    ska sluta ska sluta pa ett stalle.
--
--    `status` ar appens ord, inte Supabase Auths. Auth kanner bara "bannad
--    eller inte"; skarmen skiljer pa en som ar borta ett tag och en som ar
--    borta for gott, och det ar den skillnaden som lagras har. Bada hindrar
--    inloggning -- se `banDuration` i installningar/konto/actions.ts.
-- ---------------------------------------------------------------------------

create table if not exists public.accounts (
    id         uuid primary key references auth.users(id) on delete cascade,
    worker_id  uuid not null unique references public.workers(id) on delete cascade,
    status     text not null default 'aktiv',
    created_at timestamptz not null default now(),
    constraint accounts_status_check check (status in ('aktiv', 'pausad', 'avstangd'))
);

comment on table public.accounts is
    'En inloggning per arbetare: kopplar auth.users till public.workers. E-post och losenord ligger i auth.users, personen i workers.';
comment on column public.accounts.id is
    'Samma id som auth.users. Raderas auth-anvandaren forsvinner kontot med den.';
comment on column public.accounts.worker_id is
    'Arbetaren kontot ar. Unik: en arbetare har hogst en inloggning.';
comment on column public.accounts.status is
    'aktiv | pausad | avstangd. Bada de senare hindrar inloggning; skillnaden ar om stoppet ar tillfalligt.';

-- ---------------------------------------------------------------------------
-- 3. En arbetare utan e-post kan inte fa ett konto.
--
--    E-posten ar inloggningen. Ett konto pa en arbetare utan adress vore ett
--    konto ingen kan logga in i. En check-constraint duger inte -- den far inte
--    lasa i en annan tabell -- sa det blir en trigger.
-- ---------------------------------------------------------------------------

create or replace function kit.accounts_require_worker_email()
    returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$fn$
begin
    if not exists (
        select 1
          from public.workers w
         where w.id = new.worker_id
           and w.email is not null
           and length(btrim(w.email)) > 0
    ) then
        raise exception 'Arbetaren saknar e-post och kan darfor inte fa ett konto'
            using errcode = 'check_violation';
    end if;
    return new;
end;
$fn$;

comment on function kit.accounts_require_worker_email() is
    'Vaktar public.accounts: kontot maste peka pa en arbetare som har en e-postadress, eftersom adressen ar inloggningen.';

revoke all on function kit.accounts_require_worker_email()
    from public, anon, authenticated, service_role;

drop trigger if exists accounts_require_worker_email on public.accounts;
create trigger accounts_require_worker_email
    before insert or update of worker_id on public.accounts
    for each row execute function kit.accounts_require_worker_email();

-- ---------------------------------------------------------------------------
-- 4. Ett borttaget konto tar sin inloggning med sig.
--
--    Kaskaden gar bara at ena hallet: raderas auth-anvandaren forsvinner
--    kontoraden, men raderas kontoraden star auth-anvandaren kvar och kan
--    fortfarande logga in. Det hander pa riktigt -- Papperskorgens gallring
--    raderar en arbetare permanent efter tre veckor, kaskaden tar kontoraden,
--    och utan den har triggern skulle en person som slutat behalla en giltig
--    inloggning i all evighet.
--
--    Ingen rekursion: nar deleten KOM fran auth.users ar den raden redan borta
--    i samma sats, och `delete` traffar noll rader.
-- ---------------------------------------------------------------------------

create or replace function kit.accounts_delete_auth_user()
    returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$fn$
begin
    delete from auth.users where id = old.id;
    return old;
end;
$fn$;

comment on function kit.accounts_delete_auth_user() is
    'Raderar auth.users-raden nar kontot forsvinner, sa att en gallrad arbetare inte behaller en giltig inloggning.';

revoke all on function kit.accounts_delete_auth_user()
    from public, anon, authenticated, service_role;

drop trigger if exists accounts_delete_auth_user on public.accounts;
create trigger accounts_delete_auth_user
    after delete on public.accounts
    for each row execute function kit.accounts_delete_auth_user();

-- ---------------------------------------------------------------------------
-- 5. RLS: samma deny-all som varje annan tabell i schemat.
--
--    Inga policies for anon/authenticated. Med RLS pa och noll policies nekar
--    Postgres bada rollerna allt, och service_role -- appens serverkod -- ar
--    det enda som ser tabellen. Kopplingen mellan en inloggning och en person
--    ar inget en webblasare ska kunna lasa.
--
--    Nar inloggningen kopplas pa pa riktigt ar det HAR den forsta policyn hor
--    hemma: `authenticated` far se sin egen rad, dvs `id = auth.uid()`.
-- ---------------------------------------------------------------------------

alter table public.accounts enable row level security;
