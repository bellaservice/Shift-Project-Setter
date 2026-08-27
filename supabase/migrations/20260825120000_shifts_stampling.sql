-- supabase/migrations/20260825120000_shifts_stampling.sql
-- Stämpling: public.shifts får en livscykel och två klockslag i realtid.
--
-- Vad den här migrationen gör
-- ---------------------------
-- Den lägger till fyra kolumner och fem villkor på en befintlig tabell, och
-- släpper `not null` från `hours`. Den rör inte `start_time` / `end_time`.
--
-- Rollfördelningen mellan de tre tidsbegreppen efter den här migrationen:
--
--   start_time / end_time  Det PLANERADE spannet. "Pass Tider" i
--                          Arbetsdagboken. time without time zone, för att en
--                          planerad tid är ett klockslag på en tavla och inte
--                          ett ögonblick.
--   clock_in_time /        Det FAKTISKT stämplade ögonblicket. timestamptz,
--   clock_out_time         för att en stämpling är en händelse: den inträffar
--                          en gång, i en tidszon, och ska gå att jämföra över
--                          en sommartidsövergång utan att tappa en timme.
--   calculated_hours       Vad klockan säger att passet blev.
--   hours                  Vad arbetsledaren säger att passet blev. Vinner
--                          alltid. Nullbar efter den här migrationen, se
--                          punkt 5 nedan.
--
-- Bakåtkompatibilitet
-- -------------------
-- Varje tillägg är additivt och varje ny kolumn är antingen nullbar eller har
-- ett default. Ingen befintlig insert i src/lib/ nämner någon av de nya
-- kolumnerna, och ingen befintlig select läser dem: samtliga anrop mot shifts
-- i queries.ts listar sina kolumner explicit, och det enda `select("*")` är en
-- count-fråga där extra kolumner är ofarliga. Tabellen innehåller noll rader
-- vid skrivande stund, så backfillen är i praktiken en formalitet — men
-- defaultvärdet är ändå valt så att den vore korrekt även med data i botten.

-- ---------------------------------------------------------------------------
-- 1. status — passets läge i livscykeln
--
--    Default är 'confirmed', inte 'open'. Det är avsiktligt och det är hela
--    bakåtkompatibiliteten i den här kolumnen: appens nuvarande väg in i
--    tabellen (Logga Pass) skriver en färdig rad med ett färdigt timtal och
--    känner inte till någon stämpling. En sådan rad ÄR slutgiltig. Med default
--    'open' hade varje befintlig och varje framtida Logga-Pass-rad sett ut som
--    att någon står instämplad just nu, och dykt upp i en pågående-vy.
--    Stämplingsflödet skriver 'open' explicit vid instämpling.
--
--    text med check-villkor, inte enum — samma avvägning som
--    projects_status_check i migration #04: att vidga ett check-villkor är en
--    vanlig transaktion, att vidga en enum är det inte.
-- ---------------------------------------------------------------------------

alter table public.shifts
    add column if not exists status text not null default 'confirmed';

alter table public.shifts drop constraint if exists shifts_status_check;
alter table public.shifts add constraint shifts_status_check
    check (status in ('open', 'closed', 'confirmed'));

comment on column public.shifts.status is
    'Passets läge: open = instämplad, ej utstämplad. closed = utstämplad, väntar på arbetsledarens bekräftelse. confirmed = bekräftad och låst. Default confirmed så att den befintliga Logga Pass-vägen behåller sin nuvarande innebörd.';

-- ---------------------------------------------------------------------------
-- 2. clock_in_time / clock_out_time — de faktiska stämplingarna
--
--    Båda nullbara, och nullbarheten bär mening här till skillnad från
--    start_time/end_time-paret: ett pass med clock_in_time men utan
--    clock_out_time är precis det som pågår just nu. Därför paras de INTE ihop
--    av ett shifts_pass_times_paired-liknande villkor — ett sådant villkor
--    skulle göra det omöjligt att stämpla in.
-- ---------------------------------------------------------------------------

alter table public.shifts
    add column if not exists clock_in_time  timestamptz,
    add column if not exists clock_out_time timestamptz;

comment on column public.shifts.clock_in_time is
    'Ögonblicket arbetaren stämplade in. Null på rader som aldrig stämplats, vilket är allt som loggats via Logga Pass.';
comment on column public.shifts.clock_out_time is
    'Ögonblicket arbetaren stämplade ut. Null medan passet pågår — det är så ett pågående pass känns igen.';

-- ---------------------------------------------------------------------------
-- 3. calculated_hours — vad klockan säger
--
--    Nullbar och vanlig kolumn, inte `generated always as`. Två skäl: en
--    genererad kolumn kan inte skrivas av appen, och spannet mellan två
--    stämplingar är inte samma sak som arbetad tid — ett pass med obetald rast
--    har ett längre spann än de timmar som faktiskt arbetats. Samma anmärkning
--    står redan på `hours` i schema.sql.
--
--    `hours` förblir sanningen för varje timsumma i appen och för "Ordinarie
--    tid" i Arbetsdagboken. calculated_hours är underlaget arbetsledaren tittar
--    på när hen fyller i `hours` — aldrig det som betalas ut och aldrig det som
--    når Arbetsdagboken.
-- ---------------------------------------------------------------------------

alter table public.shifts
    add column if not exists calculated_hours numeric;

alter table public.shifts drop constraint if exists shifts_calculated_hours_non_negative;
alter table public.shifts add constraint shifts_calculated_hours_non_negative
    check (calculated_hours is null or calculated_hours >= 0);

comment on column public.shifts.calculated_hours is
    'Timmar härledda ur clock_in_time/clock_out_time. Underlag, inte lön: shifts.hours är arbetsledarens bekräftade värde och åsidosätter alltid det här.';

-- ---------------------------------------------------------------------------
-- 4. Villkoren på stämplingsparet
--
--    shifts_clock_order är det efterfrågade villkoret. Det är skrivet med sina
--    null-fall utskrivna trots att ett check-villkor som utvärderas till null
--    redan passerar i Postgres — den som läser raden ska kunna se att ett
--    pågående pass är tillåtet, inte behöva räkna ut det.
--
--    shifts_clock_out_requires_in finns för att villkoret ovan annars vore
--    tandlöst åt ena hållet: utan det passerar en rad med clock_out_time men
--    utan clock_in_time tyst igenom, och en utstämpling utan instämpling är
--    inte ett pass.
-- ---------------------------------------------------------------------------

alter table public.shifts drop constraint if exists shifts_clock_order;
alter table public.shifts add constraint shifts_clock_order
    check (
        clock_in_time is null
        or clock_out_time is null
        or clock_in_time <= clock_out_time
    );

alter table public.shifts drop constraint if exists shifts_clock_out_requires_in;
alter table public.shifts add constraint shifts_clock_out_requires_in
    check (clock_out_time is null or clock_in_time is not null);

-- ---------------------------------------------------------------------------
-- 5. `hours` blir nullbar — och villkoret som gör det ofarligt
--
--    Ett pass som är 'open' eller 'closed' har ännu inget bekräftat timtal.
--    Alternativet, en platshållare på 0, valdes bort: den gick inte att skilja
--    från ett pass som faktiskt bekräftats till noll timmar, och det är en
--    skillnad som spelar roll i ett dokument som gör anspråk på att vara ett
--    juridiskt underlag.
--
--    shifts_confirmed_has_hours är motvikten, och den är hela skälet till att
--    nullbarheten är försvarbar: ett pass kan inte bli 'confirmed' utan ett
--    timtal. Eftersom Arbetsdagboken bara får genereras när allt i intervallet
--    är bekräftat, kan alltså varken lönen eller dokumentet någonsin nå en
--    null. Null betyder exakt "ännu inte bekräftat", ingenting annat.
--
--    ⚠️ Kvarstående risk, medvetet accepterad: appens Supabase-klient är
--    otypad (SupabaseClient utan Database-generic, inga genererade typer), och
--    Number(null) är 0 i JavaScript — inte NaN. En null ger därför varken
--    kompileringsfel eller körningsfel, den blir tyst en nolla. Varje läsning
--    av `hours` måste granskas för hand; kompilatorn hittar dem inte. Se
--    avsnitt 8.3 i shift-system-spec.md för checklistan.
--
--    Ordningen spelar roll: villkoret nedan läser både `status` och `hours`,
--    så det måste ligga efter punkt 1.
-- ---------------------------------------------------------------------------

alter table public.shifts alter column hours drop not null;

alter table public.shifts drop constraint if exists shifts_confirmed_has_hours;
alter table public.shifts add constraint shifts_confirmed_has_hours
    check (status <> 'confirmed' or hours is not null);

comment on column public.shifts.hours is
    'Arbetsledarens bekräftade timtal, och sanningen för varje timsumma i appen. Null tills passet bekräftas — shifts_confirmed_has_hours garanterar att ett bekräftat pass alltid har ett värde. Härleds INTE ur tiderna: ett pass med obetald rast har ett längre spann än de timmar som faktiskt arbetats.';

-- ---------------------------------------------------------------------------
-- 6. Index för bekräftelsekön
--
--    Arbetsledarens kö läser bara det som ännu inte är bekräftat, och det är en
--    krympande svans i en tabell som växer med varje loggat pass. Partiellt
--    index, av samma skäl som Papperskorgens index i migration #06: bara den
--    mängd frågan faktiskt läser hamnar i indexet. shift_date först, för att
--    kön sorteras äldsta passerade pass överst.
-- ---------------------------------------------------------------------------

create index if not exists shifts_open_status_idx
    on public.shifts (shift_date, status)
    where status <> 'confirmed';

-- ---------------------------------------------------------------------------
-- 7. Spåret efter den ursprungliga stämplingen
--
--    Arbetsledaren får skriva över ett klockslag. Det som INTE får hända är att
--    arbetarens egen stämpling försvinner när hen gör det — då hade
--    Arbetsdagboken rapporterat tider som ingen längre kan härleda.
--
--    Uppdelningen:
--      clock_in_time  / clock_out_time   Gällande tid. Den som rapporteras.
--                                        Arbetsledaren får ändra den.
--      clock_in_original / clock_out_original
--                                        Första värdet kolumnen någonsin haft.
--                                        Sätts av triggern, aldrig av appen,
--                                        och kan därefter inte ändras.
--      clock_edited_at                   När en gällande tid först avvek från
--                                        sitt original. Null = orörd.
--
--    "Ändrad?" behöver ingen egen kolumn: clock_in_time is distinct from
--    clock_in_original svarar på det.
--
--    ⚠️ Vad `original` betyder, exakt: det FÖRSTA värde kolumnen fick, inte
--    "arbetarens stämpling". Triggern kan inte se vem som skriver. Fyller
--    arbetsledaren i ett klockslag för en arbetare som glömt stämpla ut
--    (avsnitt 5.4), blir arbetsledarens värde originalet — det fanns ingen
--    arbetarstämpling att bevara. Det är den ärliga innebörden av kolumnen och
--    den som ska stå i felsökningen.
--
--    Triggern och inte applikationen, av två skäl: den kan inte glömmas bort,
--    och den gäller även för en rad som skrivs från SQL-konsolen.
-- ---------------------------------------------------------------------------

create schema if not exists kit;

alter default privileges in schema kit
    revoke execute on functions from public, anon, authenticated;

revoke all on schema kit from public, anon;
grant usage on schema kit to postgres, authenticated, service_role;

alter table public.shifts
    add column if not exists clock_in_original  timestamptz,
    add column if not exists clock_out_original timestamptz,
    add column if not exists clock_edited_at    timestamptz,
    add column if not exists clock_edited_by    uuid;

comment on column public.shifts.clock_in_original is
    'Första värdet clock_in_time någonsin fick. Sätts av kit.shifts_preserve_clock_originals() och kan inte ändras därefter. OBS: betyder "första registrerade värdet", inte nödvändigtvis arbetarens egen stämpling.';
comment on column public.shifts.clock_out_original is
    'Första värdet clock_out_time någonsin fick. Samma regler som clock_in_original.';
comment on column public.shifts.clock_edited_at is
    'När en gällande stämplingstid först skrevs över med ett annat värde än sitt original. Null betyder att ingen tid har ändrats.';
comment on column public.shifts.clock_edited_by is
    'auth.uid() för den som gjorde den första överskrivningen. Null när ingen ändring skett, eller när ändringen gjordes utan JWT (SQL-konsol, service_role, cron). Ingen foreign key mot auth.users: en raderad inloggning ska inte kunna ta med sig spåret efter vad den gjorde.';

create or replace function kit.shifts_preserve_clock_originals()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'INSERT' then
        -- Raden föds med sina original. En rad utan stämplingar (Logga Pass)
        -- får null i båda, vilket är rätt: det finns inget att bevara.
        new.clock_in_original  := new.clock_in_time;
        new.clock_out_original := new.clock_out_time;
        new.clock_edited_at    := null;
        new.clock_edited_by    := null;
        return new;
    end if;

    -- coalesce och inte ett if: är originalet redan satt vinner det alltid,
    -- är det tomt fångar vi det värde kolumnen får nu. Att skriva om
    -- new.*_original ovillkorligt är hela poängen — det gör kolumnen omöjlig
    -- att ändra utifrån, även för den som försöker sätta den explicit.
    new.clock_in_original  := coalesce(old.clock_in_original,  new.clock_in_time);
    new.clock_out_original := coalesce(old.clock_out_original, new.clock_out_time);

    -- is distinct from och inte <>: ett null på endera sidan ska jämföras, inte
    -- smitta resultatet. Stämplet sätts en gång, vid första avvikelsen, och
    -- rörs inte av senare ändringar — det är "har den här raden blivit
    -- redigerad", inte "när senast".
    if old.clock_edited_at is null
       and (new.clock_in_time  is distinct from new.clock_in_original
         or new.clock_out_time is distinct from new.clock_out_original)
    then
        new.clock_edited_at := now();
        -- auth.uid() är null utanför ett PostgREST-anrop: SQL-konsolen,
        -- service_role och cron har ingen JWT att hämta ett sub ur. Null
        -- betyder därför "ingen inloggad identitet", inte "okänd person" —
        -- och tidsstämpeln står kvar även då, så spåret försvinner inte.
        new.clock_edited_by := auth.uid();
    else
        new.clock_edited_at := old.clock_edited_at;
        new.clock_edited_by := old.clock_edited_by;
    end if;

    return new;
end;
$$;

comment on function kit.shifts_preserve_clock_originals() is
    'Håller clock_in_original/clock_out_original append-only och stämplar clock_edited_at vid första avvikelsen. Se avsnitt 5.5 i shift-system-spec.md.';

drop trigger if exists shifts_preserve_clock_originals on public.shifts;
create trigger shifts_preserve_clock_originals
    before insert or update on public.shifts
    for each row execute function kit.shifts_preserve_clock_originals();

-- Samma ordningsvillkor för originalen som för de gällande tiderna. Ett
-- original som är bakvänt vore ett bevis som motsäger sig självt.
alter table public.shifts drop constraint if exists shifts_clock_original_order;
alter table public.shifts add constraint shifts_clock_original_order
    check (
        clock_in_original is null
        or clock_out_original is null
        or clock_in_original <= clock_out_original
    );
