-- supabase/tests/admin_roll_tests.sql
--
-- Testsvit for 20260830090000_admin_roll.sql.
--
--     supabase db query --linked --file supabase/tests/admin_roll_tests.sql
--
-- Samma monster som role_separation_tests.sql: allt i en transaktion som rullas
-- tillbaka pa sista raden, en `raise exception` per misslyckat pastaende, och en
-- NEGATIV KONTROLL overallt dar en sadan gar att gora.
--
-- Det viktigaste sviten bevisar star i test B och C: att adminen fick
-- arbetsledarens alla befogenheter, och att arbetaren INTE fick nagot av dem
-- pa kopet. Migrationen breddar en funktion som varenda RLS-policy i appen
-- fragar, sa ett fel at det hallet hade oppnat databasen for alla inloggade.

begin;

do $$
declare
    v_admin_id    uuid;
    v_ledare_id   uuid;
    v_arbetare_id uuid;
    v_worker_id   uuid;
    v_project_id  uuid;
    v_fel         boolean;
begin
    -- =====================================================================
    -- Uppsattning: en admin, en arbetsledare, en arbetare.
    -- =====================================================================
    v_admin_id    := gen_random_uuid();
    v_ledare_id   := gen_random_uuid();
    v_arbetare_id := gen_random_uuid();

    insert into auth.users (id, instance_id, aud, role, email,
                            encrypted_password, created_at, updated_at)
    values (v_admin_id,    '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', 'zz-admin@exempel.invalid',    '', now(), now()),
           (v_ledare_id,   '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', 'zz-ledare@exempel.invalid',   '', now(), now()),
           (v_arbetare_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', 'zz-arbetare@exempel.invalid', '', now(), now());

    insert into public.workers (name, email)
    values ('Zz Testarbetare', 'zz-arbetare@exempel.invalid')
    returning id into v_worker_id;

    insert into public.accounts (id, worker_id, email, status, role) values
        (v_admin_id,    null,        'zz-admin@exempel.invalid',  'aktiv', 'admin'),
        (v_ledare_id,   null,        'zz-ledare@exempel.invalid', 'aktiv', 'arbetsledare'),
        (v_arbetare_id, v_worker_id, null,                        'aktiv', 'arbetare');

    raise notice 'OK 0: rollen admin accepteras av accounts_role_check';

    -- =====================================================================
    -- A. Check-villkoret slapper igenom de tre och ingenting annat
    -- =====================================================================
    begin
        update public.accounts set role = 'chef' where id = v_admin_id;
        v_fel := false;
    exception when check_violation then
        v_fel := true;
    end;
    if not v_fel then
        raise exception 'FAIL A: en pahittad roll slapptes igenom av check-villkoret';
    end if;
    raise notice 'OK A: NEG en okand roll avvisas fortfarande';

    -- =====================================================================
    -- B. Adminen HAR arbetsledarens befogenheter
    --
    --    Migrationens karna. Nastan varje policy i appen fragar
    --    kit.ar_arbetsledare(); svarar den nej for adminen ar rollen vardelos.
    -- =====================================================================
    set local role authenticated;

    perform set_config('request.jwt.claims',
        json_build_object('sub', v_admin_id, 'role', 'authenticated')::text, true);
    if not kit.ar_arbetsledare() then
        raise exception 'FAIL B1: adminen far inte leda arbetet';
    end if;
    if not kit.ar_admin() then
        raise exception 'FAIL B2: adminen kandes inte igen som admin';
    end if;

    perform set_config('request.jwt.claims',
        json_build_object('sub', v_ledare_id, 'role', 'authenticated')::text, true);
    if not kit.ar_arbetsledare() then
        raise exception 'FAIL B3: arbetsledaren tappade sina befogenheter';
    end if;
    if kit.ar_admin() then
        raise exception 'FAIL B4: arbetsledaren rakas som admin';
    end if;
    raise notice 'OK B: admin far leda; arbetsledaren ar kvar och ar inte admin';

    -- =====================================================================
    -- C. NEG Arbetaren fick ingenting pa kopet
    --
    --    Den bredare funktionen ar en risk at det har hallet: hade `in (...)`
    --    skrivits fel kunde varje inloggad blivit ledare.
    -- =====================================================================
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_arbetare_id, 'role', 'authenticated')::text, true);
    if kit.ar_arbetsledare() then
        raise exception 'FAIL C1: arbetaren far leda arbetet';
    end if;
    if kit.ar_admin() then
        raise exception 'FAIL C2: arbetaren rakas som admin';
    end if;
    raise notice 'OK C: NEG arbetaren far fortfarande ingenting';

    -- =====================================================================
    -- D. Ett PAUSAT adminkonto tappar allt
    -- =====================================================================
    reset role;
    update public.accounts set status = 'pausad' where id = v_admin_id;
    set local role authenticated;
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_admin_id, 'role', 'authenticated')::text, true);

    if kit.ar_arbetsledare() or kit.ar_admin() then
        raise exception 'FAIL D: ett pausat adminkonto har kvar sina befogenheter';
    end if;
    raise notice 'OK D: pausad admin tappar bade ar_admin och ar_arbetsledare';

    reset role;
    update public.accounts set status = 'aktiv' where id = v_admin_id;

    -- =====================================================================
    -- E. Utelasningsskyddet raknar adminen som en ledare
    --
    --    Med en aktiv admin kvar SKA den sista arbetsledaren kunna bli
    --    arbetare: adminen kan satta tillbaka rollen, sa ingen ar utelast.
    -- =====================================================================
    -- Alla andra ledare ur vagen, sa v_ledare_id ar den sista arbetsledaren.
    update public.accounts set status = 'pausad'
     where role = 'arbetsledare' and id <> v_ledare_id;

    begin
        update public.accounts set role = 'arbetare' where id = v_ledare_id;
        v_fel := false;
    exception when others then
        v_fel := true;
    end;
    if v_fel then
        raise exception 'FAIL E: sista arbetsledaren kunde inte degraderas trots att en admin finns';
    end if;
    raise notice 'OK E: en aktiv admin racker som kvarvarande ledare';

    -- =====================================================================
    -- F. NEG ... men den SISTA ledaren av nagot slag star fast
    --
    --    Nu ar adminen ensam kvar. Att gora hen till arbetare ska avvisas,
    --    annars vore vakten verkningslos och test E bevisade ingenting.
    -- =====================================================================
    begin
        update public.accounts set role = 'arbetare' where id = v_admin_id;
        v_fel := false;
    exception when others then
        v_fel := true;
    end;
    if not v_fel then
        raise exception 'FAIL F: den sista adminen kunde degradera sig sjalv';
    end if;
    raise notice 'OK F: NEG sista ledaren -- admin eller ej -- star fast';

    -- =====================================================================
    -- G. arbetsdagbok_perioder
    -- =====================================================================
    select id into v_project_id from public.projects where deleted_at is null limit 1;

    if v_project_id is null then
        insert into public.projects (name, address, status)
        values ('Zz Testprojekt', 'Zz Testgatan 1', 'active')
        returning id into v_project_id;
    end if;

    insert into public.arbetsdagbok_perioder (project_id, fran, till, skapad_av)
    values (v_project_id, current_date - 30, current_date, v_admin_id);

    begin
        insert into public.arbetsdagbok_perioder (project_id, fran, till)
        values (v_project_id, current_date, current_date - 1);
        v_fel := false;
    exception when check_violation then
        v_fel := true;
    end;
    if not v_fel then
        raise exception 'FAIL G: en bakvand period slapptes igenom';
    end if;
    raise notice 'OK G: perioder sparas, och en bakvand ram avvisas';

    raise notice 'ALLA ADMINTESTER PASSERADE';
end
$$;

rollback;
