-- Username/password admin access for SEOULWAVE GitHub Pages.
-- Passwords remain in Supabase Auth and are never stored in public.member.

create table if not exists public.member (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  username text not null unique,
  role text not null default 'member' check (role in ('member', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_username_format check (username ~ '^[a-z0-9_]{4,40}$')
);

alter table public.member enable row level security;
revoke all on table public.member from anon;
revoke insert, update, delete on table public.member from authenticated;
grant select on table public.member to authenticated;

drop policy if exists "member_self_select" on public.member;
create policy "member_self_select"
on public.member for select to authenticated
using ((select auth.uid()) = auth_user_id);

create or replace function public.is_seoulwave_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and exists (
      select 1
      from public.member as m
      where m.auth_user_id = (select auth.uid())
        and m.username = 'seotaiji0324'
        and m.role = 'admin'
        and m.is_active = true
    );
$$;

revoke all on function public.is_seoulwave_admin() from public;
grant execute on function public.is_seoulwave_admin() to authenticated;

drop policy if exists "seoulwave_admin_select_playlist" on public."PlayList";
drop policy if exists "seoulwave_admin_insert_playlist" on public."PlayList";
drop policy if exists "seoulwave_admin_update_playlist" on public."PlayList";
drop policy if exists "seoulwave_admin_delete_playlist" on public."PlayList";

create policy "seoulwave_admin_select_playlist"
on public."PlayList" for select to authenticated
using ((select public.is_seoulwave_admin()));

create policy "seoulwave_admin_insert_playlist"
on public."PlayList" for insert to authenticated
with check ((select public.is_seoulwave_admin()));

create policy "seoulwave_admin_update_playlist"
on public."PlayList" for update to authenticated
using ((select public.is_seoulwave_admin()))
with check ((select public.is_seoulwave_admin()));

create policy "seoulwave_admin_delete_playlist"
on public."PlayList" for delete to authenticated
using ((select public.is_seoulwave_admin()));

drop policy if exists "seoulwave_admin_select_audio" on storage.objects;
drop policy if exists "seoulwave_admin_insert_audio" on storage.objects;
drop policy if exists "seoulwave_admin_update_audio" on storage.objects;
drop policy if exists "seoulwave_admin_delete_audio" on storage.objects;

create policy "seoulwave_admin_select_audio"
on storage.objects for select to authenticated
using (
  bucket_id = 'kpop-audio'
  and (storage.foldername(name))[1] = 'playlist'
  and (select public.is_seoulwave_admin())
);

create policy "seoulwave_admin_insert_audio"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'kpop-audio'
  and (storage.foldername(name))[1] = 'playlist'
  and (select public.is_seoulwave_admin())
);

create policy "seoulwave_admin_update_audio"
on storage.objects for update to authenticated
using (
  bucket_id = 'kpop-audio'
  and (storage.foldername(name))[1] = 'playlist'
  and (select public.is_seoulwave_admin())
)
with check (
  bucket_id = 'kpop-audio'
  and (storage.foldername(name))[1] = 'playlist'
  and (select public.is_seoulwave_admin())
);

create policy "seoulwave_admin_delete_audio"
on storage.objects for delete to authenticated
using (
  bucket_id = 'kpop-audio'
  and (storage.foldername(name))[1] = 'playlist'
  and (select public.is_seoulwave_admin())
);
