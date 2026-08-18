-- Link the real Supabase Auth account to the SEOULWAVE playlist administrator.
-- Run after 20260818001000_member_admin_login.sql.

do $$
declare
  target_user_id uuid;
  previous_admin_user_id uuid;
begin
  select id
  into target_user_id
  from auth.users
  where lower(email) = lower('hyunho76.seo@miracom-inc.com')
  order by created_at asc
  limit 1;

  if target_user_id is null then
    raise exception
      'Supabase Auth user hyunho76.seo@miracom-inc.com does not exist. Create or invite the user before running this migration.';
  end if;

  select auth_user_id
  into previous_admin_user_id
  from public.member
  where username = 'seotaiji0324';

  -- Remove a conflicting profile for the target user before assigning the
  -- stable SEOULWAVE administrator username.
  delete from public.member
  where auth_user_id = target_user_id
    and username <> 'seotaiji0324';

  insert into public.member (
    auth_user_id,
    username,
    role,
    is_active,
    updated_at
  )
  values (
    target_user_id,
    'seotaiji0324',
    'admin',
    true,
    now()
  )
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

  -- Retire the old placeholder login if it previously owned the administrator
  -- profile. The member/RLS checks already block it; this also removes the
  -- stale role claim the next time its token is refreshed.
  if previous_admin_user_id is not null
     and previous_admin_user_id <> target_user_id then
    update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'role',
        updated_at = now()
    where id = previous_admin_user_id
      and lower(email) = lower('seotaiji0324@admin.seoulwave.app');
  end if;
end
$$;
