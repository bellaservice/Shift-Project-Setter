-- supabase/migrations/20260827090000_harled_calculated_hours.sql
-- calculated_hours raknas ut av databasen, inte av den som skriver.
--
-- Felet som gjorde det nodvandigt
-- ------------------------------
-- Stamplingen skickar `"now"` och later servern satta klockslaget — annars
-- hade en telefon med fel klocka skrivit fel in i underlaget. Priset var att
-- appen inte KAN rakna ut spannet i samma anrop: den vet inte vilken sekund
-- servern kommer att stampla.
--
-- Foljden blev att varje pass som stamplats ut via /stampla fick
-- calculated_hours = null, och arbetsledaren mottes av "Klockan sager –" i
-- bekraftelsekon — alltsa tom just for de pass hela stamplingen finns for.
-- Upptackt av kedjetestet Skapa Pass -> Stampla -> Bekrafta, inte av
-- kompilatorn.
--
-- Losningen
-- ---------
-- Kolumnen ar per definition harledd: den ar spannet mellan de tva
-- klockslagen, ingenting annat. Da ska den heller inte vara nagot en klient
-- kan ha en asikt om. Triggern raknar om den vid varje insert och update, sa
-- den ar korrekt oavsett vag in — stamplingen, arbetsledarens justering, eller
-- en rad skriven fran SQL-konsolen.
--
-- Varfor inte en generated column: en `generated always as` gar inte att
-- kombinera med att kolumnen redan finns med data, och den hade dessutom last
-- ute varje framtida undantag. Triggern gor samma sak och gar att lasa.
--
-- Ordningen mot de andra triggarna spelar ingen roll har — kolumnvakten laser
-- `hours` och `status`, spartriggern laser `clock_*_original`, och ingen av dem
-- ror calculated_hours. Namnet sorterar anda forst (d < g < p), vilket ar
-- trevligt i en felsokning.

create or replace function kit.shifts_derive_calculated_hours() returns trigger
    language plpgsql
    set search_path = ''
as
$fn$
begin
    if new.clock_in_time is not null and new.clock_out_time is not null then
        -- Avrundat till hundradelar: samma upplosning som roundHours() i
        -- appen, sa att siffran pa skarmen och siffran i databasen ar samma
        -- siffra. Utan avrundning blir spannet ett flyttal med sjutton
        -- decimaler som ingen bad om.
        new.calculated_hours := round(
            (extract(epoch from (new.clock_out_time - new.clock_in_time)) / 3600.0)::numeric,
            2
        );
    else
        -- Inget spann, inget varde. Galler bade ett pass som annu inte stamplats
        -- ut och ett som loggats via Logga Pass utan stampling alls.
        new.calculated_hours := null;
    end if;

    return new;
end;
$fn$;

comment on function kit.shifts_derive_calculated_hours() is
    'Raknar calculated_hours ur clock_in_time och clock_out_time vid varje skrivning. Kolumnen ar harledd och far darfor inte sattas av en klient -- stamplingen kan inte rakna ut den sjalv, eftersom servern satter klockslaget.';

drop trigger if exists shifts_derive_calculated_hours on public.shifts;
create trigger shifts_derive_calculated_hours
    before insert or update on public.shifts
    for each row execute function kit.shifts_derive_calculated_hours();

-- Befintliga rader: rakna om en gang, sa att tabellen och regeln sager samma
-- sak fran och med nu. Vid skrivande stund ar tabellen tom, men migrationen ska
-- vara korrekt aven kord mot en tabell som inte ar det.
update public.shifts
   set calculated_hours = calculated_hours
 where clock_in_time is not null or clock_out_time is not null
    or calculated_hours is not null;
