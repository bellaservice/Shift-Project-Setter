-- Replace the deny-all RLS posture with per-role policies for `authenticated`.
--
-- Why this changes now
-- --------------------
-- v1 ran every query server-side under the service role, which bypasses RLS, so
-- the safe posture was "RLS on, zero policies" — that denies anon and
-- authenticated outright (see the Row Level Security block in schema.sql).
--
-- The app is now a static export on GitHub Pages. There is no server, so there
-- is no service role: the browser talks to PostgREST directly with the anon key
-- and the signed-in user's JWT. With zero policies that browser can read
-- nothing, so the app needs policies to function at all.
--
-- The trust boundary therefore moves from "only our server may touch these
-- tables" to "only a signed-in user may, and Postgres enforces it". That is the
-- supported Supabase pattern, but it is a real change in posture and worth
-- stating plainly: these tables hold workers.personal_number (personnummer) and
-- workers.account_number, and the site they now back is publicly reachable.
--
-- Who gets what
-- -------------
-- `authenticated` gets full access to every table. This is an internal tool for
-- one company: everyone issued a konto is staff, and every screen (Alla
-- Arbetare, Papperskorg, Arbetsdagbok) already shows every row to whoever is at
-- the keyboard. Per-user scoping would be inventing a permission model the app
-- does not have.
--
-- `anon` is named by no policy below, so it keeps the v1 deny-all. A visitor who
-- loads the site and never logs in cannot read a single row. That is the
-- property the whole design rests on — do not add an `anon` policy to any of
-- these tables.

-- workers, projects and their join tables ------------------------------------

drop policy if exists workers_authenticated_all on workers;
create policy workers_authenticated_all on workers
  for all to authenticated using (true) with check (true);

drop policy if exists projects_authenticated_all on projects;
create policy projects_authenticated_all on projects
  for all to authenticated using (true) with check (true);

drop policy if exists project_services_authenticated_all on project_services;
create policy project_services_authenticated_all on project_services
  for all to authenticated using (true) with check (true);

drop policy if exists project_workers_authenticated_all on project_workers;
create policy project_workers_authenticated_all on project_workers
  for all to authenticated using (true) with check (true);

drop policy if exists shifts_authenticated_all on shifts;
create policy shifts_authenticated_all on shifts
  for all to authenticated using (true) with check (true);

drop policy if exists accounts_authenticated_all on accounts;
create policy accounts_authenticated_all on accounts
  for all to authenticated using (true) with check (true);

-- storage_purge_queue ---------------------------------------------------------
-- The 21-day purge used to run server-side on a timer. Without a server the
-- client drains this queue instead, so authenticated needs to read and delete
-- from it.

drop policy if exists storage_purge_queue_authenticated_all on storage_purge_queue;
create policy storage_purge_queue_authenticated_all on storage_purge_queue
  for all to authenticated using (true) with check (true);

-- profile-pictures bucket -----------------------------------------------------
-- Uploads moved from the server (service role, which bypassed storage RLS) into
-- the browser, so storage.objects needs the same treatment. Scoped to the one
-- bucket rather than all of storage.

drop policy if exists profile_pictures_authenticated_all on storage.objects;
create policy profile_pictures_authenticated_all on storage.objects
  for all to authenticated
  using (bucket_id = 'profile-pictures')
  with check (bucket_id = 'profile-pictures');
