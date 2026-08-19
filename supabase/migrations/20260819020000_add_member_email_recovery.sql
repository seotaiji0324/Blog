-- Store the recovery email on public.member so login and account recovery use
-- the same administrator record. Passwords remain exclusively in Supabase Auth.

begin;

alter table public.member
  add column if not exists email text;

update public.member as m
set email = lower(btrim(u.email)),
    updated_at = now()
from auth.users as u
where u.id = m.auth_user_id
  and u.email is not null
  and m.email is distinct from lower(btrim(u.email));

create unique index if not exists member_email_lower_unique
  on public.member (lower(email))
  where email is not null;

comment on column public.member.email is
  'Normalized email used for administrator login resolution and account recovery.';

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
  where lower(m.email) = lower(btrim(coalesce(p_email, '')))
    and m.role = 'admin'
    and m.is_active = true
  limit 1;
$$;

revoke all on function public.find_member_username(text) from public;
grant execute on function public.find_member_username(text) to anon, authenticated;

commit;
