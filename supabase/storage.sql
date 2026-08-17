-- Storage bucket for worker profile pictures (Ny Arbetare screen, section 4.4).
-- Run after schema.sql.

insert into storage.buckets (id, name, public)
values ('profile-pictures', 'profile-pictures', true)
on conflict (id) do nothing;

-- Public read (avatars are displayed in worker dropdowns/lists, not sensitive
-- on their own). Uploads only ever happen server-side via the Next.js API
-- route using SUPABASE_SERVICE_ROLE_KEY, so no anon INSERT/UPDATE/DELETE
-- policy is defined here — service_role bypasses storage RLS the same way
-- it bypasses table RLS. See schema.sql for the reasoning on the no-auth v1
-- access model.

create policy "Public read of profile pictures"
on storage.objects for select
to public
using (bucket_id = 'profile-pictures');
