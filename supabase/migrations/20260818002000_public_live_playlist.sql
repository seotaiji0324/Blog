-- Allow the public GitHub Pages site to read active playlist rows immediately.
-- Inactive rows, creator identifiers, and unrelated storage objects remain private.

revoke select on table public."PlayList" from anon;
grant select (
  id,
  title,
  artist,
  genre,
  release_year,
  music_url,
  audio_path,
  display_order,
  is_active,
  created_at
) on table public."PlayList" to anon;

drop policy if exists "seoulwave_public_select_active_playlist" on public."PlayList";
create policy "seoulwave_public_select_active_playlist"
on public."PlayList" for select to anon
using (is_active = true);

create or replace function public.is_public_playlist_audio(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public."PlayList" as playlist
    where playlist.audio_path = object_name
      and playlist.is_active = true
  );
$$;

revoke all on function public.is_public_playlist_audio(text) from public;
grant execute on function public.is_public_playlist_audio(text) to anon;

drop policy if exists "seoulwave_public_select_active_audio" on storage.objects;
create policy "seoulwave_public_select_active_audio"
on storage.objects for select to anon
using (
  bucket_id = 'kpop-audio'
  and (storage.foldername(name))[1] = 'playlist'
  and (select public.is_public_playlist_audio(name))
);

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'PlayList'
  ) then
    execute 'alter publication supabase_realtime add table public."PlayList"';
  end if;
end
$$;
