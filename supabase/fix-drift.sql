-- Sync the live throwaway DB with what the code already expects.
-- Not a migration (supabase/migrations/ is owned by the planned rebuild in
-- shift-setting-system-spec.expanded.md §7) — a one-off catch-up script.
-- Run: npx supabase db query --linked -f supabase/fix-drift.sql

-- 1. The reported error: queries.ts selects projects.name, live table has no
--    such column. Nullable — old rows fall back to address in the UI.
alter table public.projects add column if not exists name text;

-- 2. Same drift, one page over: ny-arbetare/actions.ts writes three emergency
--    contact columns, live workers still has the single free-text
--    `emergency_contact`. Saving a worker fails today for the same reason the
--    Home page did. This section is destructive — it drops a column holding one
--    row of data — so run it only once you accept that.
alter table public.workers add column if not exists emergency_contact_name text;
alter table public.workers add column if not exists emergency_contact_phone text;
alter table public.workers add column if not exists emergency_contact_email text;

-- The old free text is a name-shaped blob with no separate phone or email, so
-- it lands in the name slot and stays unreachable.
update public.workers
set emergency_contact_name = nullif(btrim(emergency_contact), '')
where emergency_contact_name is null;

alter table public.workers drop column if exists emergency_contact;

-- NOT VALID: new and updated rows must satisfy "a name always comes with a way
-- to reach it", but the backfilled legacy row is grandfathered instead of the
-- statement failing outright. Fresh installs from schema.sql get it valid.
alter table public.workers
  add constraint workers_emergency_contact_reachable check (
    (emergency_contact_name is null
      and emergency_contact_phone is null
      and emergency_contact_email is null)
    or (emergency_contact_name is not null
      and (emergency_contact_phone is not null or emergency_contact_email is not null))
  ) not valid;
