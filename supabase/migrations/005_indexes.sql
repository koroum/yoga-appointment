-- 005: Indexes for performance

create index if not exists idx_slots_starts_at
  on public.slots (starts_at);

create index if not exists idx_slots_instructor_status
  on public.slots (instructor_id, status, starts_at);

create index if not exists idx_bookings_slot_id
  on public.bookings (slot_id);

create index if not exists idx_bookings_student_id
  on public.bookings (student_id);

create index if not exists idx_bookings_status
  on public.bookings (status);

create index if not exists idx_bookings_slot_status
  on public.bookings (slot_id, status);

create index if not exists idx_notifications_booking_type_date
  on public.notifications_log (booking_id, type, sent_at);

create index if not exists idx_notifications_recipient
  on public.notifications_log (recipient_id);

create index if not exists idx_instructor_students_instructor
  on public.instructor_students (instructor_id);
