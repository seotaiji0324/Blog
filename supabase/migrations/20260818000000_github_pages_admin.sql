-- GitHub Pages admin access for SEOULWAVE.
-- The browser uses a publishable key; all write access is enforced by JWT app_metadata.

grant select, insert, update, delete on table public."PlayList" to authenticated;
alter table public."PlayList" enable row level security;

drop policy if exists "seoulwave_admin_select_playlist" on public."PlayList";
drop policy if exists "seoulwave_admin_insert_playlist" on public."PlayList";
drop policy if exists "seoulwave_admin_update_playlist" on public."PlayList";
drop policy if exists "seoulwave_admin_delete_playlist" on public."PlayList";

create policy "seoulwave_admin_select_playlist"
on public."PlayList" for select to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "seoulwave_admin_insert_playlist"
on public."PlayList" for insert to authenticated
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "seoulwave_admin_update_playlist"
on public."PlayList" for update to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "seoulwave_admin_delete_playlist"
on public."PlayList" for delete to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

update storage.buckets
set public = false,
    file_size_limit = 26214400,
    allowed_mime_types = array['audio/mpeg']
where id = 'kpop-audio';

drop policy if exists "seoulwave_admin_select_audio" on storage.objects;
drop policy if exists "seoulwave_admin_insert_audio" on storage.objects;
drop policy if exists "seoulwave_admin_update_audio" on storage.objects;
drop policy if exists "seoulwave_admin_delete_audio" on storage.objects;

create policy "seoulwave_admin_select_audio"
on storage.objects for select to authenticated
using (
  bucket_id = 'kpop-audio'
  and (storage.foldername(name))[1] = 'playlist'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "seoulwave_admin_insert_audio"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'kpop-audio'
  and (storage.foldername(name))[1] = 'playlist'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "seoulwave_admin_update_audio"
on storage.objects for update to authenticated
using (
  bucket_id = 'kpop-audio'
  and (storage.foldername(name))[1] = 'playlist'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
with check (
  bucket_id = 'kpop-audio'
  and (storage.foldername(name))[1] = 'playlist'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "seoulwave_admin_delete_audio"
on storage.objects for delete to authenticated
using (
  bucket_id = 'kpop-audio'
  and (storage.foldername(name))[1] = 'playlist'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);
