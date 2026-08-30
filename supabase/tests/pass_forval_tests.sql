-- supabase/tests/pass_forval_tests.sql
--
-- Testsvit for 20260829120000_pass_forval_och_priolista.sql.
--
--     supabase db query --linked --file supabase/tests/pass_forval_tests.sql
--
-- Hela sviten ligger i en transaktion som rullas tillbaka pa sista raden, sa
-- den gar att kora mot produktion utan att lamna nagot efter sig. Den skapar
-- sina egna arbetare och project med igenkannbara namn ('zz-test-...') och ror
-- ingen befintlig rad.
--
-- Varje pastaende har en NEGATIV KONTROLL dar det gar att gora en: ett test som
-- inte kan misslyckas bevisar ingenting, och den sortens test har lurat oss i
-- det har projektet forut. Samma monster som role_separation_tests.sql.
--
-- ⚠️ SVITEN GOR ALDRIG `update` PA public.shifts.
--
-- kit.shifts_guard_leader_columns() ar en before update-trigger som avvisar
-- andringar av `hours`, `sen` och `status` fran alla som inte ar arbetsledare —
-- och en direktkopplad session ar ingen: den har ingen JWT, sa
-- kit.ar_arbetsledare() svarar false aven nar man kor som postgres. Triggern
-- fyrar for alla roller, sa det gar inte att smyga forbi den.
--
-- Att satta `set local role` med en arbetsledares sub hade gatt, men da testar
-- man tillsattningen genom RLS i stallet for tillsattningen, och ett fel i det
-- ena hade sett ut som ett fel i det andra. Riggen skriver darfor raderna i det
-- skick de ska ha fran borjan, och byter skick genom delete + insert.
-- Slutlaget i tabellen blir detsamma, och triggern behover aldrig kringgas.

begin;

create temporary table resultat (
    nr      serial,
    grupp   text,
    fall    text,
    ok      boolean,
    detalj  text
) on commit drop;

create or replace function pg_temp.pastaende(
    p_grupp text, p_fall text, p_ok boolean, p_detalj text default null
) returns void language sql as $$
    insert into resultat (grupp, fall, ok, detalj)
    values (p_grupp, p_fall, p_ok, p_detalj);
$$;

-- ---------------------------------------------------------------------------
-- Riggen
--
-- `projects.address` ar not null och det finns INGEN project_number-kolumn --
-- kollat mot det levande schemat, inte mot specen, som listar bada fel.
-- ---------------------------------------------------------------------------

create temporary table rigg (
    project uuid, anna uuid, bjorn uuid, carl uuid, dag date
) on commit drop;

do $rigg$
declare
    v_project uuid;
    v_anna    uuid;
    v_bjorn   uuid;
    v_carl    uuid;
    v_dag     date := current_date + 14;
begin
    insert into public.projects (name, address, status)
    values ('zz-test-tillsattning', 'zz-testadressen 1', 'active')
    returning id into v_project;

    insert into public.workers (name) values ('zz-test Anna')  returning id into v_anna;
    insert into public.workers (name) values ('zz-test Bjorn') returning id into v_bjorn;
    insert into public.workers (name) values ('zz-test Carl')  returning id into v_carl;

    insert into rigg values (v_project, v_anna, v_bjorn, v_carl, v_dag);
end;
$rigg$;

-- ---------------------------------------------------------------------------
-- Grupp 1: priolistan rangordnar pa timmar, farrast forst
-- ---------------------------------------------------------------------------

do $g1$
declare
    r rigg%rowtype;
    v_anna int;
    v_carl int;
begin
    select * into r from rigg;

    -- Anna 6 bekraftade timmar i fonstret, Bjorn 12, Carl 24.
    insert into public.shifts (project_id, worker_id, shift_date, status, hours)
    values (r.project, r.anna,  r.dag - 2, 'confirmed', 6),
           (r.project, r.bjorn, r.dag - 2, 'confirmed', 12),
           (r.project, r.carl,  r.dag - 2, 'confirmed', 24);

    select plats into v_anna from kit.priolista(r.dag, array[r.anna, r.bjorn, r.carl])
     where worker_id = r.anna;
    select plats into v_carl from kit.priolista(r.dag, array[r.anna, r.bjorn, r.carl])
     where worker_id = r.carl;

    perform pg_temp.pastaende('1 priolista', 'farrast timmar star forst',
        v_anna = 1, format('Anna fick plats %s', v_anna));

    -- Negativ kontroll: den med FLEST timmar star sist. Utan den skulle en
    -- lista sorterad at fel hall passera pastaendet ovan om Anna rakade sta
    -- forst av nagot annat skal.
    perform pg_temp.pastaende('1 priolista', 'NEG flest timmar star sist',
        v_carl = 3, format('Carl fick plats %s', v_carl));
end;
$g1$;

-- ---------------------------------------------------------------------------
-- Grupp 2: bara BEKRAFTADE timmar raknas
--
-- Det har ar samma skiljelinje som tvingade fram status-filtret i queries.ts:
-- planerad tid ar inte arbetad tid.
-- ---------------------------------------------------------------------------

do $g2$
declare
    r rigg%rowtype;
    v_fore int;
    v_efter int;
begin
    select * into r from rigg;

    select plats into v_fore from kit.priolista(r.dag, array[r.anna, r.bjorn])
     where worker_id = r.anna;

    -- 40 OPPNA timmar pa Anna. Oppet arbete ar inte utfort arbete.
    insert into public.shifts (project_id, worker_id, shift_date, status, hours)
    values (r.project, r.anna, r.dag - 3, 'open', 40);

    select plats into v_efter from kit.priolista(r.dag, array[r.anna, r.bjorn])
     where worker_id = r.anna;

    perform pg_temp.pastaende('2 bekraftade', 'oppna timmar paverkar inte listan',
        v_fore = v_efter, format('%s -> %s', v_fore, v_efter));

    -- Negativ kontroll: samma timmar som bekraftade flyttar henne. Visar att
    -- fragan overhuvudtaget reagerar pa timmar i det har fonstret.
    -- Delete + insert och inte update, se preambeln om kolumnvakten.
    delete from public.shifts where worker_id = r.anna and shift_date = r.dag - 3;
    insert into public.shifts (project_id, worker_id, shift_date, status, hours)
    values (r.project, r.anna, r.dag - 3, 'confirmed', 40);

    select plats into v_efter from kit.priolista(r.dag, array[r.anna, r.bjorn])
     where worker_id = r.anna;

    perform pg_temp.pastaende('2 bekraftade', 'NEG bekraftade timmar flyttar ned',
        v_efter = 2, format('Anna fick plats %s', v_efter));

    delete from public.shifts where worker_id = r.anna and shift_date = r.dag - 3;
end;
$g2$;

-- ---------------------------------------------------------------------------
-- Grupp 3: fonstret ar sju rullande dygn fore passet
-- ---------------------------------------------------------------------------

do $g3$
declare
    r rigg%rowtype;
    v_plats int;
begin
    select * into r from rigg;

    -- 100 timmar atta dygn fore passet: utanfor fonstret.
    insert into public.shifts (project_id, worker_id, shift_date, status, hours)
    values (r.project, r.anna, r.dag - 8, 'confirmed', 100);

    select plats into v_plats from kit.priolista(r.dag, array[r.anna, r.bjorn])
     where worker_id = r.anna;

    perform pg_temp.pastaende('3 fonster', 'dag 8 ligger utanfor fonstret',
        v_plats = 1, format('Anna fick plats %s', v_plats));

    -- Negativ kontroll: samma timmar sju dygn fore ligger innanfor.
    delete from public.shifts where worker_id = r.anna and shift_date = r.dag - 8;
    insert into public.shifts (project_id, worker_id, shift_date, status, hours)
    values (r.project, r.anna, r.dag - 7, 'confirmed', 100);

    select plats into v_plats from kit.priolista(r.dag, array[r.anna, r.bjorn])
     where worker_id = r.anna;

    perform pg_temp.pastaende('3 fonster', 'NEG dag 7 ligger innanfor',
        v_plats = 2, format('Anna fick plats %s', v_plats));

    delete from public.shifts where worker_id = r.anna and shift_date = r.dag - 7;
end;
$g3$;

-- ---------------------------------------------------------------------------
-- Grupp 4: sen-market flyttar ett steg, ett for ett
-- ---------------------------------------------------------------------------

do $g4$
declare
    r rigg%rowtype;
    v_plats int;
begin
    select * into r from rigg;

    -- Anna star forst pa timmar (6 mot Bjorns 12). Ett sen-marke ska lagga
    -- henne precis ett steg ned, alltsa efter Bjorn.
    insert into public.shifts (project_id, worker_id, shift_date, status, hours, sen)
    values (r.project, r.anna, r.dag - 30, 'confirmed', 0, true);

    select plats into v_plats from kit.priolista(r.dag, array[r.anna, r.bjorn])
     where worker_id = r.anna;

    perform pg_temp.pastaende('4 sen', 'ett sen-marke = ett steg ned',
        v_plats = 2, format('Anna fick plats %s', v_plats));

    -- Negativ kontroll: utan market star hon forst. Bevisar att det var market
    -- som flyttade henne och inte nagot annat i riggen.
    delete from public.shifts where worker_id = r.anna and shift_date = r.dag - 30;
    insert into public.shifts (project_id, worker_id, shift_date, status, hours, sen)
    values (r.project, r.anna, r.dag - 30, 'confirmed', 0, false);

    select plats into v_plats from kit.priolista(r.dag, array[r.anna, r.bjorn])
     where worker_id = r.anna;

    perform pg_temp.pastaende('4 sen', 'NEG utan marke star hon forst',
        v_plats = 1, format('Anna fick plats %s', v_plats));

    delete from public.shifts where worker_id = r.anna and shift_date = r.dag - 30;
end;
$g4$;

-- ---------------------------------------------------------------------------
-- Grupp 5: tillsattningen fyller upp till headcount, inte over
-- ---------------------------------------------------------------------------

do $g5$
declare
    r rigg%rowtype;
    v_pass uuid;
    v_antal int;
begin
    select * into r from rigg;

    -- Alla tre forvaljer dagen. Passet behover tva.
    insert into public.forval (worker_id, forval_date)
    values (r.anna, r.dag), (r.bjorn, r.dag), (r.carl, r.dag);

    insert into public.pass (project_id, pass_date, headcount, hours)
    values (r.project, r.dag, 2, 8)
    returning id into v_pass;

    select count(*) into v_antal from public.shifts where pass_id = v_pass;
    perform pg_temp.pastaende('5 tillsattning', 'fyller exakt headcount',
        v_antal = 2, format('%s tillsatta, headcount 2', v_antal));

    -- Den med flest timmar (Carl, 24) ska vara den som blev utan.
    select count(*) into v_antal
      from public.shifts where pass_id = v_pass and worker_id = r.carl;
    perform pg_temp.pastaende('5 tillsattning', 'den med flest timmar blir utan',
        v_antal = 0, format('Carl har %s platser', v_antal));

    -- Idempotens: en andra korning far inte lagga till nagot.
    perform kit.tillsatt_pass(v_pass);
    select count(*) into v_antal from public.shifts where pass_id = v_pass;
    perform pg_temp.pastaende('5 tillsattning', 'andra korningen lagger inget',
        v_antal = 2, format('%s tillsatta efter omkorning', v_antal));

    -- Passets timmar arvs ned till platsen.
    select count(*) into v_antal
      from public.shifts where pass_id = v_pass and hours = 8;
    perform pg_temp.pastaende('5 tillsattning', 'passets timmar arvs till platsen',
        v_antal = 2, format('%s rader med hours=8', v_antal));

    delete from public.shifts where pass_id = v_pass;
    delete from public.pass where id = v_pass;
    delete from public.forval where forval_date = r.dag;
end;
$g5$;

-- ---------------------------------------------------------------------------
-- Grupp 6: ett forval som kommer EFTER passet fyller det anda
--
-- Ordningen mellan de tva gar inte att styra: arbetsledaren kan lagga ut passet
-- forst, eller arbetaren valja dagen forst. Bada vagarna maste leda fram.
-- ---------------------------------------------------------------------------

do $g6$
declare
    r rigg%rowtype;
    v_pass uuid;
    v_antal int;
begin
    select * into r from rigg;

    insert into public.pass (project_id, pass_date, headcount)
    values (r.project, r.dag, 1)
    returning id into v_pass;

    select count(*) into v_antal from public.shifts where pass_id = v_pass;
    perform pg_temp.pastaende('6 ordning', 'tomt pass utan forval',
        v_antal = 0, format('%s tillsatta', v_antal));

    insert into public.forval (worker_id, forval_date) values (r.anna, r.dag);

    select count(*) into v_antal from public.shifts where pass_id = v_pass;
    perform pg_temp.pastaende('6 ordning', 'forval efterat fyller passet',
        v_antal = 1, format('%s tillsatta', v_antal));

    delete from public.shifts where pass_id = v_pass;
    delete from public.pass where id = v_pass;
    delete from public.forval where forval_date = r.dag;
end;
$g6$;

-- ---------------------------------------------------------------------------
-- Grupp 7: den som tackat nej far inte passet igen
-- ---------------------------------------------------------------------------

do $g7$
declare
    r rigg%rowtype;
    v_pass uuid;
    v_annas int;
begin
    select * into r from rigg;

    insert into public.pass (project_id, pass_date, headcount)
    values (r.project, r.dag, 1)
    returning id into v_pass;

    insert into public.pass_avbojd (pass_id, worker_id) values (v_pass, r.anna);
    insert into public.forval (worker_id, forval_date) values (r.anna, r.dag);

    select count(*) into v_annas
      from public.shifts where pass_id = v_pass and worker_id = r.anna;
    perform pg_temp.pastaende('7 avbojt', 'avbojt pass tilldelas inte igen',
        v_annas = 0, format('Anna har %s platser', v_annas));

    -- Negativ kontroll: utan avbojningen hade hon fatt det.
    delete from public.pass_avbojd where pass_id = v_pass;
    perform kit.tillsatt_pass(v_pass);

    select count(*) into v_annas
      from public.shifts where pass_id = v_pass and worker_id = r.anna;
    perform pg_temp.pastaende('7 avbojt', 'NEG utan avbojning far hon passet',
        v_annas = 1, format('Anna har %s platser', v_annas));

    delete from public.shifts where pass_id = v_pass;
    delete from public.pass where id = v_pass;
    delete from public.forval where forval_date = r.dag;
end;
$g7$;

-- ---------------------------------------------------------------------------
-- Grupp 8: en raderad arbetare ar ingen kandidat
--
-- Papperskorgen far inte lacka tillbaka in i schemat: en arbetare som lagts
-- undan ska inte plotsligt sta pa ett pass om hen rakat forvalja dagen forst.
-- ---------------------------------------------------------------------------

do $g8$
declare
    r rigg%rowtype;
    v_pass uuid;
    v_antal int;
begin
    select * into r from rigg;

    update public.workers set deleted_at = now() where id = r.anna;
    insert into public.forval (worker_id, forval_date) values (r.anna, r.dag);

    insert into public.pass (project_id, pass_date, headcount)
    values (r.project, r.dag, 1)
    returning id into v_pass;

    select count(*) into v_antal
      from public.shifts where pass_id = v_pass and worker_id = r.anna;
    perform pg_temp.pastaende('8 papperskorg', 'raderad arbetare tillsatts inte',
        v_antal = 0, format('%s platser till raderad arbetare', v_antal));

    update public.workers set deleted_at = null where id = r.anna;
    delete from public.shifts where pass_id = v_pass;
    delete from public.pass where id = v_pass;
    delete from public.forval where forval_date = r.dag;
end;
$g8$;

-- ---------------------------------------------------------------------------
-- Grupp 9: constraints
-- ---------------------------------------------------------------------------

do $g9$
declare
    r rigg%rowtype;
    v_fel text;
begin
    select * into r from rigg;

    begin
        insert into public.pass (project_id, pass_date, headcount)
        values (r.project, r.dag, 0);
        v_fel := null;
    exception when check_violation then v_fel := 'avvisad';
    end;
    perform pg_temp.pastaende('9 constraints', 'headcount 0 avvisas',
        v_fel = 'avvisad', coalesce(v_fel, 'slapptes igenom'));

    begin
        insert into public.pass (project_id, pass_date, headcount, start_time)
        values (r.project, r.dag, 1, '07:00');
        v_fel := null;
    exception when check_violation then v_fel := 'avvisad';
    end;
    perform pg_temp.pastaende('9 constraints', 'halvt tidsspann avvisas',
        v_fel = 'avvisad', coalesce(v_fel, 'slapptes igenom'));

    begin
        insert into public.forval (worker_id, forval_date) values (r.anna, r.dag);
        insert into public.forval (worker_id, forval_date) values (r.anna, r.dag);
        v_fel := null;
    exception when unique_violation then v_fel := 'avvisad';
    end;
    perform pg_temp.pastaende('9 constraints', 'dubbelt forval avvisas',
        v_fel = 'avvisad', coalesce(v_fel, 'slapptes igenom'));

    delete from public.forval where forval_date = r.dag;
end;
$g9$;

-- ---------------------------------------------------------------------------
-- Resultat
-- ---------------------------------------------------------------------------

select nr, grupp, fall,
       case when ok then 'OK' else 'MISSLYCKADES' end as utfall,
       detalj
  from resultat
 order by nr;

select count(*) filter (where not ok) as misslyckade,
       count(*)                       as totalt
  from resultat;

rollback;
