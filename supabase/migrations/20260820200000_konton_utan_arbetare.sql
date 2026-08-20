-- Konton som inte tillhor en arbetare.
--
-- Vad som andras
-- --------------
-- 20260820120000 lade public.accounts med
--
--     worker_id uuid not null unique references public.workers(id)
--
-- och den raden sa tva saker pa en gang: "en arbetare har hogst en inloggning"
-- (unique) och "en inloggning ar alltid en arbetare" (not null). Det forsta
-- star kvar. Det andra faller: appen ska kunna tillverka ett konto at nagon som
-- inte finns i rostern -- en administrator, en ekonomiansvarig, nagon som ska in
-- i appen men aldrig loggar ett pass.
--
-- `unique` overlever att kolumnen blir nullable utan att andras. Postgres later
-- flera NULL i ett unikt index, eftersom NULL inte ar lika med NULL, sa
-- villkoret fortsatter betyda exakt det det alltid betydde: hogst ett konto per
-- arbetare, och ingen begransning alls pa konton utan arbetare.
--
-- Varfor en e-postkolumn ocksa
-- ----------------------------
-- Kontolistan har alltid hamtat namn, adress och bild ur workers -- kontot agde
-- bara kopplingen och statusen. Ett konto utan arbetare har ingen sadan rad att
-- hamta ur, och adressen sjalv ligger i auth.users, som PostgREST inte
-- exponerar. Utan nagonstans att skriva den skulle ett sadant konto bli en tom
-- rad i listan: ratt antal, inget innehall.
--
-- Darfor `email`, och darfor bara for de kontona. For ett arbetarkonto ar
-- workers.email fortfarande sanningen och kolumnen lamnas tom -- tva kopior av
-- samma adress ar tva adresser som kan sara pa sig, och det ar precis den
-- glidningen assertLoginEmailUnchanged() i src/lib/accounts.ts finns for att
-- hindra. Villkoret nedan sager samma sak i databasen: exakt en av de tva
-- kallorna ska vara ifylld.

alter table public.accounts
    alter column worker_id drop not null;

alter table public.accounts
    add column if not exists email text;

comment on column public.accounts.worker_id is
    'Arbetaren kontot ar, eller NULL for ett konto utan arbetare. Unik: en arbetare har hogst en inloggning (flera NULL tillats).';
comment on column public.accounts.email is
    'Adressen kontot loggar in med, men BARA nar worker_id ar NULL. For ett arbetarkonto star adressen i workers.email och den har ar tom.';

-- Exakt en kalla till adressen, aldrig tva och aldrig noll.
alter table public.accounts
    drop constraint if exists accounts_worker_xor_email;
alter table public.accounts
    add constraint accounts_worker_xor_email check (
        (worker_id is not null and email is null)
     or (worker_id is null and email is not null and length(btrim(email)) > 0)
    );

-- ---------------------------------------------------------------------------
-- Triggern slapper igenom raderna som inte har nagon arbetare att kontrollera.
--
-- Den gamla kroppen fragar "finns det en arbetare med det har id:t som har en
-- e-post". For worker_id = NULL ar svaret nej, och den skulle darfor avvisa
-- precis de rader den har migrationen infor. Vakten galler fortfarande allt den
-- alltid gallt: har raden en arbetare maste arbetaren ha en adress.
-- ---------------------------------------------------------------------------

create or replace function kit.accounts_require_worker_email()
    returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$fn$
begin
    -- Konto utan arbetare: accounts_worker_xor_email har redan kravt en adress
    -- pa raden sjalv, och det finns ingen arbetare att stalla kravet pa.
    if new.worker_id is null then
        return new;
    end if;

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
    'Vaktar public.accounts: pekar raden pa en arbetare maste arbetaren ha en e-postadress, eftersom adressen ar inloggningen. Rader utan arbetare slapps igenom -- deras adress star i accounts.email.';

revoke all on function kit.accounts_require_worker_email()
    from public, anon, authenticated;

-- Triggern lyssnade pa `update of worker_id`. Den behover lyssna pa email med,
-- annars gar det att tomma adressen pa ett arbetarlost konto i efterhand.
drop trigger if exists accounts_require_worker_email on public.accounts;
create trigger accounts_require_worker_email
    before insert or update of worker_id, email on public.accounts
    for each row
    execute function kit.accounts_require_worker_email();
