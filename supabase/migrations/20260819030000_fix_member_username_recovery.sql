-- Ensure administrator username recovery is available through the Data API.
-- Existing recovery emails are intentionally preserved instead of being
-- overwritten by the linked Supabase Auth login email.

begin;

alter table public.member
  add column if not exists email text;

update public.member as m
set email = lower(btrim(u.email)),
    updated_at = now()
from auth.users as u
where u.id = m.auth_user_id
  and u.email is not null
  and (m.email is null or btrim(m.email) = '');

create unique index if not exists member_email_lower_unique
  on public.member (lower(email))
  where email is not null;

create or replace function public.find_member_username(p_email text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.username
  from public.member as m
  where lower(btrim(m.email)) = lower(btrim(coalesce(p_email, '')))
    and m.role = 'admin'
    and m.is_active = true
  limit 1;
$$;

revoke all on function public.find_member_username(text) from public;
grant execute on function public.find_member_username(text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
