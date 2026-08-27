-- supabase/migrations/20260827150000_sista_arbetsledaren.sql
-- Det maste alltid finnas minst en aktiv arbetsledare.
--
-- Vad som annars kan handa
-- ------------------------
-- Rollen gar snart att andra inifran appen. I samma stund finns ett tryck som
-- last ut hela foretaget ur sitt eget system: den sista arbetsledaren
-- degraderar sig sjalv till arbetare — av misstag, eller for att prova hur
-- arbetarvyn ser ut — och darefter finns det ingen kvar som far skriva i
-- public.accounts. Ingen kan befordra nagon, eftersom befordran kraver just den
-- roll som nyss forsvann.
--
-- Det gar inte att reparera inifran appen. Det kraver databasatkomst, alltsa
-- den har filens forfattare eller nagon med service_role-nyckeln, en fredag
-- eftermiddag nar lonen ska ut.
--
-- Tre vagar in i samma dike, och alla tre stangs har:
--   * role  'arbetsledare' -> 'arbetare'
--   * status 'aktiv' -> 'pausad' eller 'avstangd'  (kit.ar_arbetsledare()
--     kraver bada, sa ett pausat ledarkonto ar lika maktlost som ett degraderat)
--   * raden raderas helt
--
-- Varfor i databasen och inte i knappen
-- -------------------------------------
-- Samma skal som resten av rollseparationen: webblasaren haller sin egen JWT
-- och kan tala med PostgREST direkt. En kontroll i React ar en kontroll man kan
-- ga runt, och den har ar for dyr att ga runt av misstag.
--
-- SECURITY DEFINER for att funktionen maste rakna ALLA konton, aven de som den
-- anropandes egna policies inte visar. Utan det hade en radning kunnat se ut
-- som "sist kvar" for att resten var osynliga.

create or replace function kit.accounts_behall_en_arbetsledare() returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$fn$
declare
    -- Raden som ar pa vag bort ur skaran aktiva arbetsledare. Vid delete finns
    -- bara `old`; vid update ar det `old` som avgor om raden VAR med i skaran.
    v_var_ledare boolean;
    v_ar_ledare  boolean;
begin
    v_var_ledare := old.role = 'arbetsledare' and old.status = 'aktiv';

    if tg_op = 'DELETE' then
        v_ar_ledare := false;
    else
        v_ar_ledare := new.role = 'arbetsledare' and new.status = 'aktiv';
    end if;

    -- Ingenting att vakta: raden var inte en aktiv arbetsledare, eller ar det
    -- fortfarande. Att befordra nagon gar alltid igenom.
    if not v_var_ledare or v_ar_ledare then
        if tg_op = 'DELETE' then return old; end if;
        return new;
    end if;

    if not exists (
        select 1
          from public.accounts a
         where a.id     <> old.id
           and a.role   = 'arbetsledare'
           and a.status = 'aktiv'
    ) then
        raise exception
            'Det maste finnas minst en aktiv arbetsledare. Utse en annan forst — annars kan ingen langre andra roller, och appen gar bara att laga i databasen.'
            using errcode = 'restrict_violation';
    end if;

    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$fn$;

comment on function kit.accounts_behall_en_arbetsledare() is
    'Hindrar att den sista aktiva arbetsledaren degraderas, pausas, stangs av eller raderas. Utan den kan foretaget lasa ut sig ur sitt eget system med ett tryck, och bara databasatkomst tar dem in igen.';

drop trigger if exists accounts_behall_en_arbetsledare on public.accounts;
create trigger accounts_behall_en_arbetsledare
    before update or delete on public.accounts
    for each row execute function kit.accounts_behall_en_arbetsledare();
