-- 003: instructor_students, bookings, notifications_log, student_notification_prefs, book_slot()

create table if not exists public.instructor_students (
  instructor_id  uuid not null references public.users(id) on delete cascade,
  student_id     uuid not null references public.users(id) on delete cascade,
  linked_via     text not null check (linked_via in ('invite', 'discovery')),
  linked_at      timestamptz not null default now(),
  primary key (instructor_id, student_id)
);

create table if not exists public.bookings (
  id                          uuid primary key default gen_random_uuid(),
  slot_id                     uuid not null references public.slots(id) on delete cascade,
  student_id                  uuid not null references public.users(id) on delete cascade,
  status                      text not null default 'pending'
                                check (status in ('pending', 'confirmed', 'cancelled', 'cancellation_requested')),
  booked_by                   text not null check (booked_by in ('instructor', 'student')),
  cancellation_requested_at   timestamptz,
  proposed_slot_id            uuid references public.slots(id) on delete set null,
  created_at                  timestamptz not null default now()
);

create table if not exists public.notifications_log (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid references public.bookings(id) on delete set null,
  recipient_id   uuid not null references public.users(id) on delete cascade,
  channel        text not null check (channel in ('email', 'sms')),
  type           text not null check (type in (
                   'booking_requested', 'booking_confirmed', 'booking_rejected',
                   'booking_cancelled', 'cancellation_requested', 'alternative_proposed',
                   'alternative_confirmed', 'slot_cancelled', 'schedule_changed',
                   'reminder_28h', 'reminder_4h'
                 )),
  status         text not null default 'sent' check (status in ('sent', 'retrying', 'failed')),
  sent_at        timestamptz,
  failed_at      timestamptz,
  error_message  text
);

create table if not exists public.student_notification_prefs (
  id                 uuid primary key default gen_random_uuid(),
  instructor_id      uuid not null references public.users(id) on delete cascade,
  student_id         uuid not null references public.users(id) on delete cascade,
  reminders_enabled  boolean not null default true,
  updated_at         timestamptz not null default now(),
  unique (instructor_id, student_id)
);

-- book_slot(): atomic booking with capacity check (FOR UPDATE row lock)
create or replace function public.book_slot(
  p_slot_id    uuid,
  p_student_id uuid,
  p_booked_by  text
) returns uuid
language plpgsql
security definer
as $$
declare
  v_slot         record;
  v_class        record;
  v_confirmed    int;
  v_booking_id   uuid;
  v_status       text;
begin
  -- Lock the slot row to prevent concurrent capacity races
  select * into v_slot
  from public.slots
  where id = p_slot_id
  for update;

  if not found then
    raise exception 'Slot not found';
  end if;

  if v_slot.status = 'unavailable' then
    raise exception 'Slot is unavailable';
  end if;

  if v_slot.starts_at < now() then
    raise exception 'Slot is in the past';
  end if;

  -- Count confirmed bookings only (pending does not consume capacity)
  select count(*) into v_confirmed
  from public.bookings
  where slot_id = p_slot_id
    and status = 'confirmed';

  select * into v_class from public.classes where id = v_slot.class_id;

  if v_confirmed >= v_class.max_capacity then
    raise exception 'Slot is full';
  end if;

  -- Instructor direct-book creates confirmed immediately; student creates pending
  v_status := case when p_booked_by = 'instructor' then 'confirmed' else 'pending' end;

  insert into public.bookings (slot_id, student_id, status, booked_by)
  values (p_slot_id, p_student_id, v_status, p_booked_by)
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;
