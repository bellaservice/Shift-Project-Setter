-- supabase/migrations/20260821120000_arenden.sql
-- Kalendern: public.arenden — de bokade ärendena, och vem som får se dem.
--
-- Vad ett ärende ÄR, och vad det inte är
-- --------------------------------------
-- Ett ärende är en avtalad tid i kalendern: en rubrik, en dag, eventuellt ett
-- klockslagsspann, och var det ska hända. Ett möte med en beställare, en
-- besiktning, en nyckelöverlämning. Google Calendars modell, med appens ord.
--
-- Det är uttryckligen INTE ett pass. Ett pass (public.shifts) är arbetad tid
-- som redan hänt och som betalas ut och skrivs in i Arbetsdagboken; ett ärende
-- är något som ska hända och som ingen summa i appen räknar med. Därför är det
-- en egen tabell och inte en kolumn på shifts: den dagen någon summerar
-- shifts.hours ska ett inbokat möte inte kunna glida in i lönen.
--
-- Ingen deleted_at: ärenden ligger inte i Papperskorgen. Papperskorgen finns
-- för det som är dyrt att förlora — en arbetare med sitt personnummer, ett
-- project med sina pass under sig. Ett ärende är en rad med en rubrik och ett
-- klockslag, och en raderingsdialog som säger vad som försvinner är rätt
-- avvägning för den. Se ConfirmDeleteButton på /kalender/arende.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Privat hjälpschema. Upprepar privilegie-preamblen från migration #01, och
--    är idempotent. Nedstängningen sker per funktion och inte per schema: att
--    ta USAGE på kit från authenticated skulle slå sönder varje RLS-policy som
--    anropar en kit-hjälpare — inklusive de två längst ner i den här filen.
-- ---------------------------------------------------------------------------

create schema if not exists kit;

alter default privileges in schema kit
    revoke execute on functions from public, anon, authenticated;

revoke all on schema kit from public, anon;
grant usage on schema kit to postgres, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Tabellen
-- ---------------------------------------------------------------------------

create table if not exists public.arenden (
    id           uuid primary key default gen_random_uuid(),
    -- Rubriken i kalendern. Det enda obligatoriska utöver dagen: ett ärende som
    -- varken har en rubrik eller ett klockslag är inte en bokning, det är en rad.
    titel        text not null,
    anteckning   text,
    arende_date  date not null,
    -- Klockslagen. Båda null = heldag, precis som en heldagshändelse i en
    -- vanlig kalender. Formuläret döljer tidsfältet bakom en kryssruta, så
    -- heldag är det man får om man inte ber om något annat. Paret hålls ihop av
    -- arenden_times_paired nedan.
    start_time   time,
    end_time     time,
    plats        text,
    -- Färgen ärendet bär i kalendern. En slug och inte en hex-kod: appen har
    -- två teman, och vilken faktisk kulör en slug ritas i hör hemma i
    -- src/lib/arendeFarger.ts där resten av färgvalen bor. Ett fritt hex-fält
    -- hade dessutom låtit användaren välja svart på svart.
    farg         text not null default 'amber',
    -- Vem som får se ärendet: 'alla', 'egen' (bara den som skapade det) eller
    -- 'valda' (de konton som står i public.arende_tittare). Bärs på riktigt av
    -- RLS längst ner i filen — se resonemanget där.
    synlighet    text not null default 'alla',
    -- Den som skapade ärendet. Sätts av triggern nedan och går inte att ändra;
    -- 'egen' och 'valda' vore annars bara ett påstående.
    skapad_av    uuid references auth.users(id) on delete set null,
    created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2b. Uppgradering av en tabell som redan finns.
--
--     `create table if not exists` ovan är ett no-op mot en databas som redan
--     har tabellen — ÄVEN när den har en äldre uppsättning kolumner. En tidig
--     version av precis den här filen saknade farg, synlighet och skapad_av och
--     hade i stället en project_id, och den hann köras skarpt. Utan blocket
--     nedan stannar filen på första raden som nämner en kolumn som inte finns
--     ("column farg of relation public.arenden does not exist"), och allt efter
--     den — join-tabellen, triggern, hela synlighetsmodellen — blir aldrig till.
--
--     Det här är också varför blocket inte går att "städa bort" som en
--     upprepning av create-satsen ovan. De två svarar på olika frågor: create
--     bygger tabellen på en tom databas, det här för en befintlig tabell fram
--     till samma form. Samma hållning som migration #04, och av samma skäl.
-- ---------------------------------------------------------------------------

alter table public.arenden
    add column if not exists anteckning text,
    add column if not exists plats      text,
    add column if not exists farg       text not null default 'amber',
    add column if not exists synlighet  text not null default 'alla',
    add column if not exists skapad_av  uuid references auth.users(id) on delete set null;

-- "Hör till project" finns inte längre i ärendeformuläret, så ingenting skriver
-- till kolumnen och ingenting läser den. En kolumn som appen varken fyller
-- eller tittar på är precis den sortens drift som gör ett schema opålitligt att
-- läsa, så den går hellre nu än aldrig. Främmandenyckeln och indexet på den
-- försvinner med kolumnen.
alter table public.arenden
    drop column if exists project_id;

comment on table public.arenden is
  'Kalenderns bokade ärenden: en avtalad tid, inte arbetad tid. Summeras aldrig som timmar — se public.shifts för det.';
comment on column public.arenden.start_time is
  'Ärendets starttid. Null tillsammans med end_time = heldag.';
comment on column public.arenden.farg is
  'Färgslug, inte en hex-kod. Kulörerna bor i src/lib/arendeFarger.ts eftersom appen har två teman.';
comment on column public.arenden.synlighet is
  'alla | egen | valda. Genomdrivs av RLS-policyn arenden_select_synliga, inte av UI:t.';
comment on column public.arenden.skapad_av is
  'auth.users.id för den som skapade ärendet. Sätts av kit.arenden_set_skapad_av() och är oföränderlig.';

-- ---------------------------------------------------------------------------
-- 3. Vilka konton ett 'valda'-ärende är synligt för.
--
--    Egen tabell och inte en uuid[]-kolumn: en array kan inte ha en
--    främmandenyckel, så ett borttaget konto hade lämnat kvar sitt id i varje
--    ärende det någonsin bjudits in till. `on delete cascade` städar i stället
--    upp sig självt den dagen kontot försvinner.
--
--    konto_id pekar på public.accounts, vars id ÄR auth-användarens id (se
--    migration 20260820120000_konton.sql). Det är därför auth.uid() går att
--    jämföra rakt mot kolumnen längre ner.
-- ---------------------------------------------------------------------------

create table if not exists public.arende_tittare (
    arende_id uuid not null references public.arenden(id) on delete cascade,
    konto_id  uuid not null references public.accounts(id) on delete cascade,
    primary key (arende_id, konto_id)
);

comment on table public.arende_tittare is
  'Kontona ett ärende med synlighet = ''valda'' visas för. Skrivs bara om av ärendets skapare.';

-- ---------------------------------------------------------------------------
-- 4. Invarianter
--
--    Ingen `end_time > start_time`-check, av samma skäl som Pass Tider inte har
--    en: ett spann som vänder vid midnatt (22:00–01:00) är ett giltigt spann,
--    och passSpanHours i src/lib/format.ts läser det så.
-- ---------------------------------------------------------------------------

do $inv$
begin
    if not exists (select 1 from pg_constraint
                    where conrelid = 'public.arenden'::regclass
                      and conname  = 'arenden_titel_not_blank') then
        alter table public.arenden
            add constraint arenden_titel_not_blank
            check (btrim(titel) <> '');
    end if;

    -- Antingen båda tiderna eller ingen. Ett halvifyllt spann går inte att
    -- skriva som '09:00-10:00' och skulle tyst ge en skev rad i kalendern.
    -- Samma regel som shifts_pass_times_paired.
    if not exists (select 1 from pg_constraint
                    where conrelid = 'public.arenden'::regclass
                      and conname  = 'arenden_times_paired') then
        alter table public.arenden
            add constraint arenden_times_paired
            check (
                 (start_time is null and end_time is null)
              or (start_time is not null and end_time is not null)
            );
    end if;

    -- Samma fönster som projects_start_date_sane: ett feltryck ska inte kunna
    -- lägga ett möte år 4035 och därmed en tom sida i kalendern att bläddra
    -- förbi.
    if not exists (select 1 from pg_constraint
                    where conrelid = 'public.arenden'::regclass
                      and conname  = 'arenden_date_sane') then
        alter table public.arenden
            add constraint arenden_date_sane
            check (arende_date >= date '2000-01-01' and arende_date <= date '2100-01-01');
    end if;

    -- Listan speglar ARENDE_FARGER i src/lib/arendeFarger.ts. Den står här och
    -- inte bara i TypeScript därför att appen talar med PostgREST direkt: utan
    -- constraintet är fältet ett fritt textfält för vem som helst med en
    -- inloggning, och kalendern skulle rita rutor i en färg den inte har.
    if not exists (select 1 from pg_constraint
                    where conrelid = 'public.arenden'::regclass
                      and conname  = 'arenden_farg_check') then
        alter table public.arenden
            add constraint arenden_farg_check
            check (farg in ('amber', 'blue', 'green', 'red', 'purple', 'pink'));
    end if;

    if not exists (select 1 from pg_constraint
                    where conrelid = 'public.arenden'::regclass
                      and conname  = 'arenden_synlighet_check') then
        alter table public.arenden
            add constraint arenden_synlighet_check
            check (synlighet in ('alla', 'egen', 'valda'));
    end if;
end
$inv$;

-- Kalendern läser alltid en månad i taget: ett halvöppet spann på arende_date,
-- vilket är precis vad det här indexet serverar.
create index if not exists arenden_arende_date_idx
    on public.arenden (arende_date);

-- Serverar EXISTS-frågan i kit.arende_synligt(), som körs en gång per rad varje
-- gång kalendern läser en månad.
create index if not exists arende_tittare_konto_id_idx
    on public.arende_tittare (konto_id);

-- ---------------------------------------------------------------------------
-- 5. Skaparen sätts av databasen, aldrig av klienten.
--
--    Utan den här triggern vore 'egen' och 'valda' bara påståenden: webbläsaren
--    skriver raden själv och kunde lika gärna skicka någon annans id, eller
--    ingen alls. Samma hållning som kit.projects_set_activation_defaults() —
--    ett privilegierat fält fylls i av databasen och klientens värde slängs.
-- ---------------------------------------------------------------------------

create or replace function kit.arenden_set_skapad_av() returns trigger
    language plpgsql
    security definer
    set search_path = ''
as
$fn$
begin
    if tg_op = 'INSERT' then
        new.skapad_av := auth.uid();
    else
        -- Oföränderlig. Ett ärende som byter ägare byter också vilka som ser
        -- det, och det ska inte gå att göra i förbifarten med en UPDATE.
        new.skapad_av := old.skapad_av;
    end if;

    return new;
end;
$fn$;

comment on function kit.arenden_set_skapad_av() is 'BEFORE INSERT/UPDATE on public.arenden: skapad_av = auth.uid() vid insert, oförändrad vid update. Klientens värde slängs.';

revoke all on function kit.arenden_set_skapad_av() from public;

drop trigger if exists arenden_set_skapad_av on public.arenden;

create trigger arenden_set_skapad_av
    before insert or update
    on public.arenden
    for each row
execute function kit.arenden_set_skapad_av();

-- ---------------------------------------------------------------------------
-- 6. RLS
--
--    Här skiljer sig arenden från varenda annan tabell i appen, och det är
--    avsiktligt. Migration 20260820180000 gav `authenticated` `using (true)` på
--    allt, med motiveringen att alla med ett konto är personal och att varje
--    skärm ändå visar varje rad. Ett ärende med synlighet 'egen' är precis
--    motexemplet: appen har nu en rad som INTE ska visas för alla.
--
--    Och då måste filtret sitta här. Det finns ingen server kvar att filtrera i
--    — webbläsaren talar direkt med PostgREST — så ett filter i queries.ts vore
--    inte en spärr utan en artighet: vem som helst med en inloggning och
--    webbläsarens nätverksflik kan be om tabellen utan det. "Bara jag" måste
--    vara sant i Postgres eller inte alls.
--
--    `anon` nämns fortfarande av ingen policy och behåller därmed deny-all.
--    Lägg INTE till en anon-policy; sajten är publikt nåbar.
-- ---------------------------------------------------------------------------

alter table public.arenden enable row level security;
alter table public.arende_tittare enable row level security;

-- SECURITY DEFINER, och det är inte en genväg: en policy på public.arenden som
-- själv läser public.arende_tittare får den tabellens RLS pålagd inuti
-- policyuttrycket, vilket antingen filtrerar bort svaret eller går i cirkel.
-- Definer-funktionen läser join-tabellen utan RLS och svarar med ett rent ja
-- eller nej. `stable` för att planeraren ska få anropa den en gång per rad i
-- stället för en gång per referens.
create or replace function kit.arende_synligt(
    p_arende    uuid,
    p_synlighet text,
    p_skapare   uuid
) returns boolean
    language sql
    stable
    security definer
    set search_path = ''
as
$fn$
    select p_synlighet = 'alla'
        -- Skaparen ser alltid sitt eget, oavsett synlighet. Annars vore
        -- "bara jag" en rad man låser sig själv ute från.
        or (p_skapare is not null and p_skapare = auth.uid())
        or (p_synlighet = 'valda'
            and exists (select 1
                          from public.arende_tittare t
                         where t.arende_id = p_arende
                           and t.konto_id  = auth.uid()));
$fn$;

comment on function kit.arende_synligt(uuid, text, uuid) is 'Får den inloggade se det här ärendet? Läser public.arende_tittare förbi dess RLS, vilket är varför den är SECURITY DEFINER.';

-- Ett EXECUTE-grant och inte bara en policy. De två är olika mekanismer, och
-- att blanda ihop dem är exakt vad som sänkte purge_expired_trash() i
-- migration 20260820190000: SECURITY DEFINER styr vad en funktion får göra när
-- den väl kör, aldrig vem som får starta den.
revoke all on function kit.arende_synligt(uuid, text, uuid) from public, anon;
grant execute on function kit.arende_synligt(uuid, text, uuid) to authenticated;

-- Ersätter den öppna policy en tidigare version av den här filen hade.
drop policy if exists arenden_authenticated_all on public.arenden;

drop policy if exists arenden_select_synliga on public.arenden;
create policy arenden_select_synliga on public.arenden
    for select to authenticated
    using (kit.arende_synligt(id, synlighet, skapad_av));

-- Insert kollar bara att raden görs i eget namn. Triggern har redan satt
-- skapad_av; with check är det som gör att den inte går att kringgå genom att
-- stänga av triggern på något annat sätt än som superuser.
drop policy if exists arenden_insert_egna on public.arenden;
create policy arenden_insert_egna on public.arenden
    for insert to authenticated
    with check (skapad_av = auth.uid());

-- Ser man ärendet får man ändra det. Det är appens vanliga hållning — alla med
-- ett konto är personal — och den enda skärpningen är att man inte kan göra
-- NÅGON ANNANS ärende privat: with check läser den nya raden, och 'egen' på en
-- rad man inte skapat går inte igenom.
drop policy if exists arenden_update_synliga on public.arenden;
create policy arenden_update_synliga on public.arenden
    for update to authenticated
    using (kit.arende_synligt(id, synlighet, skapad_av))
    with check (kit.arende_synligt(id, synlighet, skapad_av));

drop policy if exists arenden_delete_synliga on public.arenden;
create policy arenden_delete_synliga on public.arenden
    for delete to authenticated
    using (kit.arende_synligt(id, synlighet, skapad_av));

-- arende_tittare -------------------------------------------------------------
--
-- Läsning är öppen: raden är två uuid:n och avslöjar ingenting om ärendet, och
-- formuläret behöver kunna läsa tillbaka vilka som är ikryssade.
--
-- SKRIVNING är däremot låst till ärendets skapare, och det är hela poängen.
-- Vore den öppen kunde vem som helst skriva in sig själv som tittare på ett id
-- och därmed låsa upp ett 'valda'-ärende åt sig själv — filtret ovan hade varit
-- ett filter man får skriva sitt eget undantag från.

create or replace function kit.arende_agare(p_arende uuid) returns boolean
    language sql
    stable
    security definer
    set search_path = ''
as
$fn$
    select exists (select 1
                     from public.arenden a
                    where a.id = p_arende
                      and a.skapad_av = auth.uid());
$fn$;

comment on function kit.arende_agare(uuid) is 'Skapade den inloggade det här ärendet? Vaktar skrivningar mot public.arende_tittare.';

revoke all on function kit.arende_agare(uuid) from public, anon;
grant execute on function kit.arende_agare(uuid) to authenticated;

drop policy if exists arende_tittare_select on public.arende_tittare;
create policy arende_tittare_select on public.arende_tittare
    for select to authenticated
    using (true);

drop policy if exists arende_tittare_insert_agare on public.arende_tittare;
create policy arende_tittare_insert_agare on public.arende_tittare
    for insert to authenticated
    with check (kit.arende_agare(arende_id));

drop policy if exists arende_tittare_delete_agare on public.arende_tittare;
create policy arende_tittare_delete_agare on public.arende_tittare
    for delete to authenticated
    using (kit.arende_agare(arende_id));
