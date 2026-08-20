-- Arbetsdagbok — additive schema patch
--
-- Run this against the linked project (Supabase SQL editor, or `supabase db query`)
-- on top of the existing schema. Every statement is idempotent, so re-running it
-- is a no-op.
--
-- What it adds, and why:
--
-- 1. projects.client_address / projects.client_org_number
--    The generated Arbetsdagbok's cover page has a "Bestallare" block with three
--    lines: Adress, Bolag, Org nummer. "Bolag" is the existing projects.client_name
--    (relabelled "Bestallare" in Logga Project). The other two had no home. The
--    address is deliberately NOT projects.address: that column is the work site,
--    while this one is the ordering company's own address, and on most jobs they
--    differ.
--
-- 2. shifts.start_time / shifts.end_time
--    The "Pass Tider" column on every day table. Nullable, because rows logged
--    before this patch have no times to backfill with; the document renders those
--    cells empty rather than inventing a span.
--
-- shifts.hours stays the source of truth for "Ordinarie tid" and every hours total
-- in the app. It is not derived from these two columns: a pass with an unpaid
-- break has an end-minus-start that is larger than the hours actually worked.

alter table projects add column if not exists client_address text;
alter table projects add column if not exists client_org_number text;

comment on column projects.client_address is
  'Bestallarens (client company) own address, shown on the Arbetsdagbok cover. Distinct from projects.address, which is the work site.';
comment on column projects.client_org_number is
  'Bestallarens organisationsnummer, shown on the Arbetsdagbok cover.';

alter table shifts add column if not exists start_time time;
alter table shifts add column if not exists end_time time;

comment on column shifts.start_time is
  'Pass start (Pass Tider on the Arbetsdagbok). Nullable for rows logged before the column existed.';
comment on column shifts.end_time is
  'Pass slut (Pass Tider on the Arbetsdagbok). Nullable for rows logged before the column existed.';

-- Either both times are given or neither. A half-filled span cannot be rendered
-- as "07:00-16:00" and would silently print a lopsided cell.
alter table shifts drop constraint if exists shifts_pass_times_paired;
alter table shifts add constraint shifts_pass_times_paired check (
  (start_time is null and end_time is null)
  or (start_time is not null and end_time is not null)
);
