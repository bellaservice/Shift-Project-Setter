-- supabase/migrations/20260826130000_utstampling.sql
-- Arbetaren far avsluta sitt eget pass — och ingenting mer.
--
-- Problemet migration #10 lamnade efter sig
-- ----------------------------------------
-- kit.shifts_guard_leader_columns() avvisar varje andring av `status` fran
-- alla utom arbetsledare. Det ar ratt for 'confirmed', och det var precis
-- poangen: en arbetare ska inte kunna bekrafta sitt eget pass.
--
-- Men en utstampling ar tva kolumner i samma UPDATE: clock_out_time OCH
-- status 'open' -> 'closed'. Vakten stoppade den andra halvan, sa arbetaren
-- kunde stampla in men aldrig ut. Verifierat mot den applicerade databasen:
-- enbart clock_out_time gick igenom, samma UPDATE med status = 'closed'
-- avvisades med "Bara en arbetsledare far andra ett passets status".
--
-- Vad som andras
-- --------------
-- Exakt ETT hal oppnas, och det ar sa smalt som overgangen ar:
--
--     'open' -> 'closed', och bara i samma UPDATE som satter passets FORSTA
--     clock_out_time.
--
-- Allt annat star kvar. En arbetare kan fortfarande inte:
--   * rora `hours` — vare sig vid utstampling eller nagon annan gang
--   * satta 'confirmed' — bekraftelsen ar och forblir arbetsledarens
--   * ateroppna ett stangt pass ('closed' -> 'open')
--   * stanga ett pass utan att faktiskt stampla ut
--   * stampla ut en gang till pa ett pass som redan har en utstampling, och
--     darigenom flytta status
--
-- Villkoret ar formulerat pa den FORSTA utstamplingen (old.clock_out_time is
-- null) med flit. Annars vore "andra clock_out_time och satt closed" en giltig
-- kombination aven pa ett pass som redan stangts, och da hade regeln handlat om
-- kolumnernas varden i stallet for om handelsen "arbetaren slutade nu".
--
-- Varfor inte harleda status automatiskt i stallet
-- ------------------------------------------------
-- Ett alternativ var en trigger som satter status = 'closed' av sig sjalv nar
-- clock_out_time fylls i, sa att appen bara skriver en kolumn. Bortvalt: tva
-- before update-triggers pa samma tabell kors i bokstavsordning, och en harledd
-- status hade blivit satt av den ena och sedan avvisad av den andra. Att lata
-- appen skriva bada kolumnerna och lata vakten forsta kombinationen ar
-- lattare att lasa, och framforallt lattare att testa.

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

    -- `hours` ar lonen. Den ar arbetsledarens under alla omstandigheter, och
    -- undantaget nedan galler den aldrig.
    if new.hours is distinct from old.hours then
        raise exception 'Bara en arbetsledare far andra timmarna pa ett pass'
            using errcode = 'insufficient_privilege';
    end if;

    -- Utstamplingen: passet gar fran pagaende till avslutat, i samma andetag
    -- som det far sin forsta utstamplingstid. RLS har redan avgjort att raden
    -- ar den inloggades egen — shifts_update_egen_stampling slapper bara
    -- igenom worker_id = kit.min_arbetare_id() — sa det behover inte kollas
    -- en gang till har.
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

comment on function kit.shifts_guard_leader_columns() is
    'Avvisar andringar av hours och status fran alla utom arbetsledare, med ETT undantag: arbetaren far fora sitt eget pass fran open till closed i samma UPDATE som satter dess forsta clock_out_time. Finns for att kolumnrattigheter inte kan skilja approllerna at -- varje inloggad ar samma Postgres-roll (authenticated).';
