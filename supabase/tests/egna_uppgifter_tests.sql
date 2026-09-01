-- supabase/tests/egna_uppgifter_tests.sql
--
-- Testsvit for 20260901090000_egna_uppgifter.sql.
--
--     supabase db query --linked --file supabase/tests/egna_uppgifter_tests.sql
--
-- Allt i en transaktion som rullas tillbaka, samma monster som ovriga sviter.
--
-- Det sviten framfor allt ska fanga ar det som inte far ga: att arbetaren
-- skriver om sitt namn, sin e-post eller sitt deleted_at. E-posten ar
-- inloggningen och star i tva tabeller; ett namn ar arbetsledarens uppgift om
-- vem hon ar; och `deleted_at` ar hur borttagning GORS har, sa en vakt som bara
-- tackte DELETE hade last ytterdorren och lamnat fonstret oppet.

begin;

do $$
declare
    v_arbetare_id uuid;
    v_ledare_id   uuid;
    v_worker_id   uuid;
    v_fel         boolean;
    v_varde       text;
begin
    -- =====================================================================
    -- Uppsattning: en arbetare med sin rad, och en arbetsledare.
    -- =====================================================================
    v_arbetare_id := gen_random_uuid();
    v_ledare_id   := gen_random_uuid();

    insert into auth.users (id, instance_id, aud, role, email,
                            encrypted_password, created_at, updated_at)
    values (v_arbetare_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', 'zz-eu-arbetare@exempel.invalid', '', now(), now()),
           (v_ledare_id,   '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', 'zz-eu-ledare@exempel.invalid',   '', now(), now());

    insert into public.workers (name, email)
    values ('Zz Eu Arbetare', 'zz-eu-arbetare@exempel.invalid')
    returning id into v_worker_id;

    insert into public.accounts (id, worker_id, email, status, role) values
        (v_arbetare_id, v_worker_id, null,                           'aktiv', 'arbetare'),
        (v_ledare_id,   null,        'zz-eu-ledare@exempel.invalid', 'aktiv', 'arbetsledare');

    -- =====================================================================
    -- A. Arbetaren FAR fylla i sina egna uppgifter
    -- =====================================================================
    set local role authenticated;
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_arbetare_id, 'role', 'authenticated')::text, true);

    update public.workers
       set phone = '070-1234567',
           address = 'Zz Testgatan 5',
           account_number = '1234-5678',
           emergency_contact_name = 'Zz Anhorig',
           emergency_contact_phone = '070-7654321'
     where id = v_worker_id;

    select phone into v_varde from public.workers where id = v_worker_id;
    if v_varde is distinct from '070-1234567' then
        raise exception 'FAIL A: arbetaren kunde inte spara sitt telefonnummer (blev %)', v_varde;
    end if;
    raise notice 'OK A: arbetaren far fylla i telefon, adress, konto och anhorig';

    -- =====================================================================
    -- B. NEG ... men inte sitt NAMN
    -- =====================================================================
    begin
        update public.workers set name = 'Nytt Namn' where id = v_worker_id;
        v_fel := false;
    exception when insufficient_privilege then
        v_fel := true;
    end;
    if not v_fel then
        raise exception 'FAIL B: arbetaren kunde skriva om sitt namn';
    end if;
    raise notice 'OK B: NEG namnet gar inte att andra';

    -- =====================================================================
    -- C. NEG ... och inte sin E-POST, som ar inloggningen
    -- =====================================================================
    begin
        update public.workers set email = 'annan@exempel.invalid' where id = v_worker_id;
        v_fel := false;
    exception when insufficient_privilege then
        v_fel := true;
    end;
    if not v_fel then
        raise exception 'FAIL C: arbetaren kunde andra sin inloggningsadress';
    end if;
    raise notice 'OK C: NEG e-posten gar inte att andra';

    -- =====================================================================
    -- D. NEG ... och inte ta bort sig sjalv
    --
    --    Bada vagarna: soft delete ar hur appen gor det, hard delete ar vad
    --    ordet betyder. Ingen av dem far ga.
    -- =====================================================================
    begin
        update public.workers set deleted_at = now() where id = v_worker_id;
        v_fel := false;
    exception when insufficient_privilege then
        v_fel := true;
    end;
    if not v_fel then
        raise exception 'FAIL D1: arbetaren kunde lagga sig sjalv i papperskorgen';
    end if;

    delete from public.workers where id = v_worker_id;
    if not exists (select 1 from public.workers where id = v_worker_id) then
        raise exception 'FAIL D2: arbetaren kunde radera sin egen rad';
    end if;
    raise notice 'OK D: NEG varken soft eller hard delete gar igenom';

    -- =====================================================================
    -- E. NEG Arbetaren kommer inte at NAGON ANNANS rad
    --
    --    Utan det har beviset sager test A bara att hon far skriva -- inte att
    --    hon far skriva bara sin egen.
    -- =====================================================================
    reset role;
    declare
        v_annan uuid;
    begin
        insert into public.workers (name, email)
        values ('Zz Eu Kollega', 'zz-eu-kollega@exempel.invalid')
        returning id into v_annan;

        set local role authenticated;
        perform set_config('request.jwt.claims',
            json_build_object('sub', v_arbetare_id, 'role', 'authenticated')::text, true);

        update public.workers set phone = '070-0000000' where id = v_annan;

        reset role;
        select phone into v_varde from public.workers where id = v_annan;
        if v_varde is not null then
            raise exception 'FAIL E: arbetaren skrev i en kollegas rad';
        end if;
        raise notice 'OK E: NEG kollegans rad ar oatkomlig';
    end;

    -- =====================================================================
    -- F. Arbetsledaren far fortfarande andra namn och e-post
    --
    --    Vakten slapper igenom den som leder arbetet. Gjorde den inte det vore
    --    hela arbetarregistret last for alla.
    -- =====================================================================
    set local role authenticated;
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_ledare_id, 'role', 'authenticated')::text, true);

    update public.workers set name = 'Zz Eu Omdopt' where id = v_worker_id;

    reset role;
    select name into v_varde from public.workers where id = v_worker_id;
    if v_varde is distinct from 'Zz Eu Omdopt' then
        raise exception 'FAIL F: arbetsledaren kunde inte andra namnet (blev %)', v_varde;
    end if;
    raise notice 'OK F: arbetsledaren gar fri genom vakten';

    raise notice 'ALLA TESTER FOR EGNA UPPGIFTER PASSERADE';
end
$$;

rollback;
