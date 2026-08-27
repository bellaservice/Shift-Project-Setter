-- supabase/tests/role_separation_tests.sql
-- Testsvit for rollseparationen i migration 20260826000000_role_separation.sql.
--
-- Sa har imiterar den en inloggning
-- ---------------------------------
-- PostgREST gor tva saker for varje anrop: `set role authenticated`, och
-- `set request.jwt.claims` till tokenens innehall. auth.uid() ar inget annat an
-- ett uppslag i den andra. Sviten gor darfor exakt samma sak, vilket ar det som
-- gor att den testar de RIKTIGA policyerna och inte en efterhandskonstruktion:
--
--     set local role authenticated;
--     set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
--
-- `set local` sa att allt gar tillbaka vid rollback, och `reset role` innan
-- varje uppstadning som behover se hela tabellen.
--
-- KOR ALLTID I EN TRANSAKTION SOM RULLAS TILLBAKA. Sviten skapar en
-- testarbetare, ett testkonto och ett testpass i produktionsdatabasen; det enda
-- som gor det ofarligt ar att ingenting av det committas.
--
--     supabase db query --linked --file supabase/tests/role_separation_tests.sql

begin;

do $$
declare
    v_ledare_id   uuid;
    v_arbetare_id uuid;
    v_worker_id   uuid;
    v_project_id  uuid;
    v_shift_id    uuid;
    v_traff       int;
    v_fel         boolean;
    v_hours       numeric;
begin
    -- =====================================================================
    -- Uppsattning: en arbetsledare, en arbetare, en arbetarrad, ett pass.
    -- auth.users-raderna behovs for att accounts.id har en FK dit.
    -- =====================================================================
    v_ledare_id   := gen_random_uuid();
    v_arbetare_id := gen_random_uuid();

    insert into auth.users (id, instance_id, aud, role, email,
                            encrypted_password, created_at, updated_at)
    values (v_ledare_id,   '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', 'test-ledare@exempel.invalid',   '', now(), now()),
           (v_arbetare_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', 'test-arbetare@exempel.invalid', '', now(), now());

    -- E-posten kravs: kit.accounts_require_worker_email() avvisar ett konto pa
    -- en arbetare utan adress, eftersom adressen ar inloggningen.
    -- personal_number och account_number ar det som test F sedan kontrollerar
    -- att en kollega INTE kan lasa.
    insert into public.workers (name, email, personal_number, account_number)
    values ('Testarbetare Svensson', 'test-arbetare@exempel.invalid',
            '19900101-1234', '1234-5678')
    returning id into v_worker_id;

    -- accounts_worker_xor_email: antingen en arbetare ELLER en e-post, aldrig
    -- bada och aldrig ingen. Ledaren ar ett konto utan arbetare och bar darfor
    -- sin adress sjalv; arbetarkontot pekar pa workers-raden och lamnar e-posten
    -- tom, eftersom workers.email da ar sanningen.
    insert into public.accounts (id, worker_id, email, status, role) values
        (v_ledare_id,   null,        'test-ledare@exempel.invalid', 'aktiv', 'arbetsledare'),
        (v_arbetare_id, v_worker_id, null,                          'aktiv', 'arbetare');

    select id into v_project_id from public.projects where deleted_at is null limit 1;

    insert into public.shifts (project_id, worker_id, shift_date, status, clock_in_time)
    values (v_project_id, v_worker_id, current_date - 1, 'open', now() - interval '8 hours')
    returning id into v_shift_id;

    -- =====================================================================
    -- A. Funktionerna svarar ratt for respektive konto
    -- =====================================================================
    set local role authenticated;

    perform set_config('request.jwt.claims',
        json_build_object('sub', v_ledare_id, 'role', 'authenticated')::text, true);
    if not kit.ar_arbetsledare() then
        raise exception 'FAIL A1: ledaren kandes inte igen som arbetsledare';
    end if;

    perform set_config('request.jwt.claims',
        json_build_object('sub', v_arbetare_id, 'role', 'authenticated')::text, true);
    if kit.ar_arbetsledare() then
        raise exception 'FAIL A2: arbetaren kandes igen som arbetsledare';
    end if;
    if kit.min_arbetare_id() is distinct from v_worker_id then
        raise exception 'FAIL A3: min_arbetare_id() pekade fel';
    end if;
    raise notice 'OK A: rollfunktionerna svarar ratt for bada kontona';

    -- =====================================================================
    -- B. ARBETAREN far INTE andra hours  (kolumnvakten)
    -- =====================================================================
    v_fel := false;
    begin
        update public.shifts set hours = 8 where id = v_shift_id;
    exception when insufficient_privilege then v_fel := true;
    end;
    if not v_fel then
        raise exception 'FAIL B: arbetaren kunde satta sina egna timmar';
    end if;
    raise notice 'OK B: arbetaren avvisas fran hours';

    -- =====================================================================
    -- C. ARBETAREN far INTE andra status  (ingen sjalvbekraftelse)
    -- =====================================================================
    v_fel := false;
    begin
        update public.shifts set status = 'confirmed' where id = v_shift_id;
    exception when insufficient_privilege then v_fel := true;
    end;
    if not v_fel then
        raise exception 'FAIL C: arbetaren kunde bekrafta sitt eget pass';
    end if;
    raise notice 'OK C: arbetaren avvisas fran status';

    -- =====================================================================
    -- D. ARBETAREN FAR stampla ut pa sitt EGET pass
    -- =====================================================================
    update public.shifts
       set clock_out_time = now(), calculated_hours = 8
     where id = v_shift_id;
    get diagnostics v_traff = row_count;
    if v_traff <> 1 then
        raise exception 'FAIL D: arbetaren kunde inte stampla ut pa sitt eget pass (% rader)', v_traff;
    end if;
    raise notice 'OK D: arbetaren kan stampla pa sitt eget pass';

    -- =====================================================================
    -- E. ARBETAREN far INTE rora nagon annans pass
    -- =====================================================================
    reset role;
    insert into public.shifts (project_id, worker_id, shift_date, status, clock_in_time)
    select v_project_id, w.id, current_date - 1, 'open', now() - interval '8 hours'
      from public.workers w
     where w.id <> v_worker_id and w.deleted_at is null
     limit 1;
    set local role authenticated;
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_arbetare_id, 'role', 'authenticated')::text, true);

    update public.shifts set clock_out_time = now()
     where worker_id <> v_worker_id;
    get diagnostics v_traff = row_count;
    if v_traff <> 0 then
        raise exception 'FAIL E: arbetaren nadde nagon annans pass (% rader)', v_traff;
    end if;
    raise notice 'OK E: arbetaren nar inte andras pass';

    -- =====================================================================
    -- F. ARBETAREN far INTE lasa kollegors personnummer
    -- =====================================================================
    select count(*) into v_traff from public.workers;
    if v_traff <> 1 then
        raise exception 'FAIL F1: arbetaren sag % arbetarrader, skulle se exakt sin egen', v_traff;
    end if;
    select count(*) into v_traff
      from public.workers where id <> v_worker_id and personal_number is not null;
    if v_traff <> 0 then
        raise exception 'FAIL F2: arbetaren nadde en kollegas personnummer';
    end if;
    raise notice 'OK F: arbetaren ser bara sin egen arbetarrad';

    -- =====================================================================
    -- G. ARBETAREN far INTE befordra sig sjalv  (nyckelskapet)
    -- =====================================================================
    update public.accounts set role = 'arbetsledare' where id = v_arbetare_id;
    get diagnostics v_traff = row_count;
    if v_traff <> 0 then
        raise exception 'FAIL G1: arbetaren befordrade sig sjalv';
    end if;
    if kit.ar_arbetsledare() then
        raise exception 'FAIL G2: arbetaren ar arbetsledare efter forsoket';
    end if;
    raise notice 'OK G: arbetaren kan inte befordra sig sjalv';

    -- =====================================================================
    -- H. ARBETAREN far INTE skapa eller radera pass
    -- =====================================================================
    v_fel := false;
    begin
        insert into public.shifts (project_id, worker_id, shift_date, hours, status)
        values (v_project_id, v_worker_id, current_date, 8, 'confirmed');
    exception when insufficient_privilege then v_fel := true;
    end;
    if not v_fel then
        raise exception 'FAIL H1: arbetaren kunde skapa ett pass at sig sjalv';
    end if;

    delete from public.shifts where id = v_shift_id;
    get diagnostics v_traff = row_count;
    if v_traff <> 0 then
        raise exception 'FAIL H2: arbetaren kunde radera ett pass';
    end if;
    raise notice 'OK H: arbetaren kan varken skapa eller radera pass';

    -- =====================================================================
    -- K. UTSTAMPLING: arbetaren far fora sitt EGET pass open -> closed,
    --    men hålet ar sa smalt som overgangen (migration #11).
    -- =====================================================================
    -- Ett FARSKT pass: test D stamplade redan ut pa det forra, och vakten
    -- kraver att utstamplingen ar passets forsta. Att aterkomma till samma rad
    -- hade testat "andra en befintlig utstampling", vilket ar en annan sak och
    -- som K2/K3 tacker.
    reset role;
    insert into public.shifts (project_id, worker_id, shift_date, status, clock_in_time)
    values (v_project_id, v_worker_id, current_date, 'open', now() - interval '8 hours')
    returning id into v_shift_id;
    set local role authenticated;
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_arbetare_id, 'role', 'authenticated')::text, true);

    -- K1. Sjalva utstamplingen ska fungera.
    update public.shifts
       set clock_out_time = now(), status = 'closed', calculated_hours = 8
     where id = v_shift_id;
    get diagnostics v_traff = row_count;
    if v_traff <> 1 then
        raise exception 'FAIL K1: arbetaren kunde inte stampla ut (% rader)', v_traff;
    end if;
    if (select status from public.shifts where id = v_shift_id) <> 'closed' then
        raise exception 'FAIL K1b: status blev inte closed';
    end if;

    -- K2. Ateroppna ett stangt pass ska INTE ga.
    v_fel := false;
    begin
        update public.shifts set status = 'open' where id = v_shift_id;
    exception when insufficient_privilege then v_fel := true;
    end;
    if not v_fel then
        raise exception 'FAIL K2: arbetaren kunde ateroppna ett stangt pass';
    end if;

    -- K3. Bekrafta via utstamplingshalet ska INTE ga.
    v_fel := false;
    begin
        update public.shifts set status = 'confirmed' where id = v_shift_id;
    exception when insufficient_privilege then v_fel := true;
    end;
    if not v_fel then
        raise exception 'FAIL K3: arbetaren bekraftade sitt pass via utstamplingen';
    end if;

    -- K4. Stanga ett pass UTAN att stampla ut ska INTE ga. Nytt pass, ingen
    --     utstampling, bara status.
    reset role;
    insert into public.shifts (project_id, worker_id, shift_date, status, clock_in_time)
    values (v_project_id, v_worker_id, current_date, 'open', now() - interval '2 hours')
    returning id into v_shift_id;
    set local role authenticated;
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_arbetare_id, 'role', 'authenticated')::text, true);

    v_fel := false;
    begin
        update public.shifts set status = 'closed' where id = v_shift_id;
    exception when insufficient_privilege then v_fel := true;
    end;
    if not v_fel then
        raise exception 'FAIL K4: arbetaren stangde ett pass utan att stampla ut';
    end if;

    -- K5. Utstampling far fortfarande INTE smuggla med hours.
    v_fel := false;
    begin
        update public.shifts
           set clock_out_time = now(), status = 'closed', hours = 12
         where id = v_shift_id;
    exception when insufficient_privilege then v_fel := true;
    end;
    if not v_fel then
        raise exception 'FAIL K5: arbetaren satte hours via utstamplingen';
    end if;
    raise notice 'OK K: utstamplingen fungerar och halet ar smalt';

    -- =====================================================================
    -- I. ARBETSLEDAREN far allt hen behover
    -- =====================================================================
    -- Passet fran K4 ar fortfarande 'open' utan utstampling; ledaren tar over.
    v_shift_id := (select id from public.shifts
                    where worker_id = v_worker_id and status = 'open' limit 1);
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_ledare_id, 'role', 'authenticated')::text, true);

    update public.shifts set hours = 7.5, status = 'confirmed' where id = v_shift_id;
    get diagnostics v_traff = row_count;
    if v_traff <> 1 then
        raise exception 'FAIL I1: arbetsledaren kunde inte bekrafta passet (% rader)', v_traff;
    end if;

    select hours into v_hours from public.shifts where id = v_shift_id;
    if v_hours is distinct from 7.5 then
        raise exception 'FAIL I2: timmarna skrevs inte (%)', v_hours;
    end if;

    select count(*) into v_traff from public.workers;
    if v_traff < 2 then
        raise exception 'FAIL I3: arbetsledaren sag bara % arbetarrader', v_traff;
    end if;

    insert into public.shifts (project_id, worker_id, shift_date, hours, status)
    values (v_project_id, v_worker_id, current_date, 8, 'confirmed');

    update public.accounts set status = 'aktiv' where id = v_arbetare_id;
    get diagnostics v_traff = row_count;
    if v_traff <> 1 then
        raise exception 'FAIL I4: arbetsledaren kunde inte skriva i accounts';
    end if;
    raise notice 'OK I: arbetsledaren kan bekrafta, lasa rostern, skapa pass och skota konton';

    -- =====================================================================
    -- J. Ett PAUSAT ledarkonto tappar sina befogenheter
    -- =====================================================================
    reset role;
    update public.accounts set status = 'pausad' where id = v_ledare_id;
    set local role authenticated;
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_ledare_id, 'role', 'authenticated')::text, true);

    if kit.ar_arbetsledare() then
        raise exception 'FAIL J: ett pausat konto ar fortfarande arbetsledare';
    end if;
    raise notice 'OK J: pausat ledarkonto tappar befogenheterna';

    reset role;
    raise notice 'ALLA ROLLTESTER PASSERADE';
end
$$;

rollback;
