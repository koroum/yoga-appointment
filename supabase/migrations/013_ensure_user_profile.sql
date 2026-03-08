-- RPC function to ensure a user profile exists after signup/login.
-- Runs as SECURITY DEFINER to bypass RLS when handling re-signups
-- where the auth user ID changed but the email already has a users row.

create or replace function public.ensure_user_profile(
  p_user_id uuid,
  p_name text,
  p_role text,
  p_email text,
  p_phone text default null,
  p_username text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing record;
  v_result jsonb;
begin
  -- First check if profile already exists for this auth user ID
  select id, role into v_existing from users where id = p_user_id;
  if found then
    return jsonb_build_object('status', 'exists', 'role', v_existing.role);
  end if;

  -- Check if a row exists with the same email but different ID (re-signup)
  select id, role into v_existing from users where email = p_email;
  if found then
    -- Update existing row to use the new auth user ID
    update users set id = p_user_id, name = p_name, phone = p_phone
    where email = p_email;
    return jsonb_build_object('status', 'updated', 'role', v_existing.role);
  end if;

  -- No existing row — insert new profile
  insert into users (id, name, role, email, phone, username)
  values (p_user_id, p_name, p_role, p_email, p_phone, p_username);
  return jsonb_build_object('status', 'created', 'role', p_role);
end;
$$;
