-- supabase/migrations/20260901090000_egna_uppgifter.sql
--
-- Arbetaren far fylla i sina EGNA uppgifter — men inte rora sitt namn, sin
-- e-post eller sin existens.
--
-- ⚠️ INTE APPLICERAD OCH INTE TESTAD NAR DEN SKREVS. Testsviten ligger i
-- supabase/tests/egna_uppgifter_tests.sql.
--
-- LAGET INNAN
-- -----------
-- workers_update_arbetsledare ar den ENDA update-policyn pa public.workers, och
-- den kraver kit.ar_arbetsledare(). En arbetare kunde alltsa LASA sin egen rad
-- (workers_select_egen) men inte andra en bokstav i den. Telefonnummer, adress,
-- kontonummer och narmaste anhorig fick administratoren skriva in at henne, av
-- uppgifter hon lamnat muntligt — vilket ar bade omvagen och det stalle dar
-- felstavade kontonummer uppstar.
--
-- VARFOR EN TRIGGER OCH INTE KOLUMNRATTIGHETER
-- --------------------------------------------
-- Namnet och e-posten ska hon INTE fa andra. Det gar inte att losa med
-- `grant update (kolumn)`, av samma skal som star i 20260826000000: varje
-- inloggad ar samma Postgres-roll, `authenticated`, sa en rattighet som ges at
-- arbetaren ges at arbetsledaren i samma andetag. Skiljelinjen maste dras nagon
-- annanstans, och det blir en before update-trigger — precis som
-- kit.shifts_guard_leader_columns() gor for hours, sen och status.
--
-- E-POSTEN ar dessutom inloggningen. Den star bade i auth.users och i
-- public.workers, och de tva maste vara samma strang for alltid: aker de isar
-- gar kontot inte langre att logga in i. Det ar darfor den ar last for alla
-- utom den vag som andrar bada — se assertLoginEmailUnchanged i appen.

create schema if not exists kit;

alter default privileges in schema kit
    revoke execute on functions from public, anon, authenticated;

revoke all on schema kit from public, anon;
grant usage on schema kit to postgres, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. Arbetaren far uppdatera sin egen rad
--
--    Bada leden kravs. `using` avgor vilka rader hon far RORA, `with check`
--    hur de far se ut EFTERAT — utan det andra kunde hon skriva om raden sa att
--    den pekar pa nagon annan och darmed lamna sitt eget revir i samma skrivning.
-- ---------------------------------------------------------------------------

drop policy if exists workers_update_egen on public.workers;
create policy workers_update_egen on public.workers
    for update to authenticated
    using (id = kit.min_arbetare_id())
    with check (id = kit.min_arbetare_id());

-- Ingen delete-policy. Den som inte far ta bort sig sjalv far det genom att
-- ingen policy slapper igenom det -- workers_delete_arbetsledare ar fortfarande
-- den enda, och den kraver att man leder arbetet.

-- ---------------------------------------------------------------------------
-- 2. Vakten: vad hon INTE far rora
--
--    Trippeln namn / e-post / borttagning, plus id:t sjalvt.
--
--    `deleted_at` ar med i listan for att det ar sa borttagning GORS i den har
--    appen — Papperskorgen ar en tidsstampel och inte en delete. Utan raden hade
--    "arbetaren far inte ta bort sitt konto" varit sant om delete och falskt om
--    det enda satt appen faktiskt anvander.
-- ---------------------------------------------------------------------------

create or replace function kit.workers_guard_egna_uppgifter() returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$fn$
begin
    -- Arbetsledaren och adminen gar fria. De far andra namn och adress, och
    -- e-posten andrar de genom appens egen vag som halller auth.users i takt.
    if kit.ar_arbetsledare() then
        return new;
    end if;

    if new.id is distinct from old.id then
        raise exception 'Raden kan inte byta identitet'
            using errcode = 'insufficient_privilege';
    end if;

    if new.name is distinct from old.name then
        raise exception 'Du kan inte andra ditt namn. Be din arbetsledare gora det.'
            using errcode = 'insufficient_privilege';
    end if;

    if new.email is distinct from old.email then
        raise exception 'Du kan inte andra din e-post — den ar din inloggning. Be din arbetsledare gora det.'
            using errcode = 'insufficient_privilege';
    end if;

    if new.deleted_at is distinct from old.deleted_at then
        raise exception 'Du kan inte ta bort ditt eget konto'
            using errcode = 'insufficient_privilege';
    end if;

    return new;
end;
$fn$;

comment on function kit.workers_guard_egna_uppgifter() is
    'Halller namn, e-post, id och deleted_at utanfor arbetarens rackhall nar hon fyller i sina egna uppgifter. Kolumnrattigheter duger inte: varje inloggad ar samma Postgres-roll.';

drop trigger if exists workers_guard_egna_uppgifter on public.workers;
create trigger workers_guard_egna_uppgifter
    before update on public.workers
    for each row execute function kit.workers_guard_egna_uppgifter();
