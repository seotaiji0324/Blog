-- Drive SEOULWAVE administrator login and authorization from public.member.
-- Passwords remain exclusively in Supabase Auth and are never stored here.

begin;

create or replace function public.resolve_member_login(p_username text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email)::text
  from public.member as m
  join auth.users as u on u.id = m.auth_user_id
  where lower(m.username) = lower(btrim(coalesce(p_username, '')))
    and m.role = 'admin'
    and m.is_active = true
    and u.deleted_at is null
  limit 1;
$$;

revoke all on function public.resolve_member_login(text) from public;
grant execute on function public.resolve_member_login(text) to anon, authenticated;

create or replace function public.find_member_username(p_email text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.username
  from public.member as m
  join auth.users as u on u.id = m.auth_user_id
  where lower(u.email) = lower(btrim(coalesce(p_email, '')))
    and m.role = 'admin'
    and m.is_active = true
    and u.deleted_at is null
  limit 1;
$$;

revoke all on function public.find_member_username(text) from public;
grant execute on function public.find_member_username(text) to anon, authenticated;

create or replace function public.is_seoulwave_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.member as m
    where m.auth_user_id = (select auth.uid())
      and m.role = 'admin'
      and m.is_active = true
  );
$$;

revoke all on function public.is_seoulwave_admin() from public;
grant execute on function public.is_seoulwave_admin() to authenticated;

do $$
declare
  target_user_id uuid;
begin
  select id
  into target_user_id
  from auth.users
  where lower(email) = lower('hyunho76.seo@miracom-inc.com')
  order by created_at asc
  limit 1;

  if target_user_id is null then
    raise exception 'Supabase Auth user hyunho76.seo@miracom-inc.com does not exist.';
  end if;

  delete from public.member
  where auth_user_id = target_user_id
    and username <> 'seotaiji0324';

  insert into public.member (auth_user_id, username, role, is_active, updated_at)
  values (target_user_id, 'seotaiji0324', 'admin', true, now())
  on conflict (username) do update
  set auth_user_id = excluded.auth_user_id,
      role = excluded.role,
      is_active = excluded.is_active,
      updated_at = now();

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', 'admin'),
      updated_at = now()
  where id = target_user_id;
end
$$;

commit;
