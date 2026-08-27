-- supabase/tests/sista_arbetsledaren_tests.sql
-- Testsvit for kit.accounts_behall_en_arbetsledare().
--
-- KOR ALLTID I EN TRANSAKTION SOM RULLAS TILLBAKA. Sviten skapar konton i
-- produktionsdatabasen; det enda som gor det ofarligt ar rollbacken.
--
--     supabase db query --linked --file supabase/tests/sista_arbetsledaren_tests.sql
--
-- ⚠️ Sviten stanger av de BEFINTLIGA arbetsledarna inuti transaktionen, for att
-- kunna prova "sist kvar"-fallet pa riktigt. Det ar ocksa ett test i sig: hade
-- den kunnat stanga av allihop utan att triggern sagt ifran vore vakten trasig.

begin;

do $$
declare
    v_a uuid := gen_random_uuid();
    v_b uuid := gen_random_uuid();
    v_arbetare uuid := gen_random_uuid();
    v_fel boolean;
    v_kvar int;
begin
    -- Tre konton: tva arbetsledare och en arbetare, alla utan arbetarrad.
    insert into auth.users (id, instance_id, aud, role, email,
                            encrypted_password, created_at, updated_at)
    values (v_a,        '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', 'test-a@exempel.invalid', '', now(), now()),
           (v_b,        '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', 'test-b@exempel.invalid', '', now(), now()),
           (v_arbetare, '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', 'test-c@exempel.invalid', '', now(), now());

    insert into public.accounts (id, worker_id, email, status, role) values
        (v_a,        null, 'test-a@exempel.invalid', 'aktiv', 'arbetsledare'),
        (v_b,        null, 'test-b@exempel.invalid', 'aktiv', 'arbetsledare'),
        (v_arbetare, null, 'test-c@exempel.invalid', 'aktiv', 'arbetare');

    -- Rensa bort de riktiga arbetsledarna ur skaran, sa att v_a och v_b ar de
    -- enda tva kvar. Gors en i taget: den sista av dem skyddas av triggern
    -- sjalv, vilket ar test A.
    update public.accounts set role = 'arbetare'
     where id not in (v_a, v_b, v_arbetare) and role = 'arbetsledare';

    select count(*) into v_kvar from public.accounts
     where role = 'arbetsledare' and status = 'aktiv';
    if v_kvar <> 2 then
        raise exception 'FAIL uppsattning: % aktiva ledare, vantade 2', v_kvar;
    end if;

    -- =====================================================================
    -- A. Degradera EN av tva -> ska ga
    -- =====================================================================
    update public.accounts set role = 'arbetare' where id = v_b;
    raise notice 'OK A: en av tva gar att degradera';

    -- =====================================================================
    -- B. Degradera den SISTA -> ska AVVISAS
    -- =====================================================================
    v_fel := false;
    begin
        update public.accounts set role = 'arbetare' where id = v_a;
    exception when restrict_violation then v_fel := true;
    end;
    if not v_fel then raise exception 'FAIL B: sista arbetsledaren degraderades'; end if;
    raise notice 'OK B: sista arbetsledaren gar inte att degradera';

    -- =====================================================================
    -- C. Pausa den sista -> ska AVVISAS (ett pausat konto ar inte arbetsledare)
    -- =====================================================================
    v_fel := false;
    begin
        update public.accounts set status = 'pausad' where id = v_a;
    exception when restrict_violation then v_fel := true;
    end;
    if not v_fel then raise exception 'FAIL C: sista arbetsledaren pausades'; end if;

    v_fel := false;
    begin
        update public.accounts set status = 'avstangd' where id = v_a;
    exception when restrict_violation then v_fel := true;
    end;
    if not v_fel then raise exception 'FAIL C2: sista arbetsledaren stangdes av'; end if;
    raise notice 'OK C: sista arbetsledaren gar varken att pausa eller stanga av';

    -- =====================================================================
    -- D. Radera den sista -> ska AVVISAS
    -- =====================================================================
    v_fel := false;
    begin
        delete from public.accounts where id = v_a;
    exception when restrict_violation then v_fel := true;
    end;
    if not v_fel then raise exception 'FAIL D: sista arbetsledaren raderades'; end if;
    raise notice 'OK D: sista arbetsledaren gar inte att radera';

    -- =====================================================================
    -- E. En arbetare gar att radera och andra fritt
    -- =====================================================================
    update public.accounts set status = 'pausad' where id = v_arbetare;
    delete from public.accounts where id = v_b;
    raise notice 'OK E: andra konton ror triggern inte';

    -- =====================================================================
    -- F. Befordran gar ALLTID igenom, aven nar den sista ar ensam kvar
    -- =====================================================================
    update public.accounts set role = 'arbetsledare', status = 'aktiv'
     where id = v_arbetare;
    select count(*) into v_kvar from public.accounts
     where role = 'arbetsledare' and status = 'aktiv';
    if v_kvar <> 2 then
        raise exception 'FAIL F: befordran gav % aktiva ledare, vantade 2', v_kvar;
    end if;
    raise notice 'OK F: befordran hindras aldrig';

    -- =====================================================================
    -- G. Nar det finns tva igen gar den forsta att degradera
    -- =====================================================================
    update public.accounts set role = 'arbetare' where id = v_a;
    raise notice 'OK G: vakten slapper sa fort det finns en ersattare';

    -- =====================================================================
    -- H. ...och da ar den nya den sista, som i sin tur ar skyddad
    -- =====================================================================
    v_fel := false;
    begin
        update public.accounts set role = 'arbetare' where id = v_arbetare;
    exception when restrict_violation then v_fel := true;
    end;
    if not v_fel then raise exception 'FAIL H: den nya sista degraderades'; end if;
    raise notice 'OK H: skyddet foljer med till den som blivit sist';

    raise notice 'ALLA TESTER FOR SISTA ARBETSLEDAREN PASSERADE';
end
$$;

rollback;
