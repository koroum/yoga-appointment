-- RPC function to delete a user account.
-- Cancels active bookings, cleans up storage, deletes users row (CASCADE),
-- and removes the auth.users entry so the email can be reused.

create or replace function public.delete_user_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_cancelled jsonb := '[]'::jsonb;
  v_booking record;
begin
  -- Look up user role
  select role into v_role from users where id = p_user_id;
  if not found then
    return jsonb_build_object('deleted', false, 'error', 'User not found');
  end if;

  -- Find and cancel active bookings for future slots
  if v_role = 'instructor' then
    -- Cancel all active bookings on this instructor's slots
    for v_booking in
      select b.id as booking_id, b.student_id,
             s.starts_at, c.title as class_title,
             st.name as student_name
      from bookings b
      join slots s on s.id = b.slot_id
      join classes c on c.id = s.class_id
      join users st on st.id = b.student_id
      where s.instructor_id = p_user_id
        and b.status in ('pending', 'confirmed', 'cancellation_requested')
        and s.starts_at > now()
    loop
      update bookings set status = 'cancelled' where id = v_booking.booking_id;
      v_cancelled := v_cancelled || jsonb_build_object(
        'booking_id', v_booking.booking_id,
        'student_name', v_booking.student_name,
        'class_title', v_booking.class_title,
        'starts_at', v_booking.starts_at
      );
    end loop;
  else
    -- Cancel all active bookings by this student
    for v_booking in
      select b.id as booking_id, s.instructor_id,
             s.starts_at, c.title as class_title,
             inst.name as instructor_name
      from bookings b
      join slots s on s.id = b.slot_id
      join classes c on c.id = s.class_id
      join users inst on inst.id = s.instructor_id
      where b.student_id = p_user_id
        and b.status in ('pending', 'confirmed', 'cancellation_requested')
        and s.starts_at > now()
    loop
      update bookings set status = 'cancelled' where id = v_booking.booking_id;
      v_cancelled := v_cancelled || jsonb_build_object(
        'booking_id', v_booking.booking_id,
        'instructor_name', v_booking.instructor_name,
        'class_title', v_booking.class_title,
        'starts_at', v_booking.starts_at
      );
    end loop;
  end if;

  -- Delete users row (CASCADE handles profiles, classes, slots, bookings, links, etc.)
  delete from users where id = p_user_id;

  -- Delete auth user so the email can be reused for re-signup
  delete from auth.users where id = p_user_id;

  return jsonb_build_object(
    'deleted', true,
    'role', v_role,
    'cancelled_bookings', v_cancelled
  );
end;
$$;
