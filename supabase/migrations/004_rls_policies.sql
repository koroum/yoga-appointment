-- 004: Row Level Security policies for all 9 tables

alter table public.users enable row level security;
alter table public.instructor_profiles enable row level security;
alter table public.classes enable row level security;
alter table public.availability_rules enable row level security;
alter table public.slots enable row level security;
alter table public.bookings enable row level security;
alter table public.notifications_log enable row level security;
alter table public.instructor_students enable row level security;
alter table public.student_notification_prefs enable row level security;

-- Helper: get current user's role from public.users
create or replace function public.current_user_role()
returns text language sql security definer stable as $$
  select role from public.users where id = auth.uid()
$$;

-- Helper: get current user's id
create or replace function public.my_id()
returns uuid language sql security definer stable as $$
  select auth.uid()
$$;

-- ─────────────────────────────────────────────
-- users
-- ─────────────────────────────────────────────

-- Users can read their own row; instructors can read linked students
create policy "users: select own" on public.users
  for select using (id = auth.uid());

create policy "users: instructor reads linked students" on public.users
  for select using (
    public.current_user_role() = 'instructor'
    and exists (
      select 1 from public.instructor_students
      where instructor_id = auth.uid() and student_id = users.id
    )
  );

-- Anon/service can read instructors (for public profile lookup by username)
create policy "users: anon reads instructors" on public.users
  for select using (role = 'instructor');

-- Users can insert their own row (on signup)
create policy "users: insert own" on public.users
  for insert with check (id = auth.uid());

-- Users can update their own row
create policy "users: update own" on public.users
  for update using (id = auth.uid());

-- ─────────────────────────────────────────────
-- instructor_profiles
-- ─────────────────────────────────────────────

create policy "profiles: public read" on public.instructor_profiles
  for select using (true);

create policy "profiles: instructor insert own" on public.instructor_profiles
  for insert with check (user_id = auth.uid());

create policy "profiles: instructor update own" on public.instructor_profiles
  for update using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- classes
-- ─────────────────────────────────────────────

create policy "classes: public read" on public.classes
  for select using (true);

create policy "classes: instructor crud own" on public.classes
  for all using (instructor_id = auth.uid());

-- ─────────────────────────────────────────────
-- availability_rules
-- ─────────────────────────────────────────────

create policy "rules: instructor crud own" on public.availability_rules
  for all using (instructor_id = auth.uid());

create policy "rules: student read" on public.availability_rules
  for select using (public.current_user_role() = 'student');

-- ─────────────────────────────────────────────
-- slots
-- ─────────────────────────────────────────────

create policy "slots: anon reads available" on public.slots
  for select using (status = 'available');

create policy "slots: auth reads all" on public.slots
  for select using (auth.uid() is not null);

create policy "slots: instructor crud own" on public.slots
  for all using (instructor_id = auth.uid());

-- ─────────────────────────────────────────────
-- bookings
-- ─────────────────────────────────────────────

create policy "bookings: student reads own" on public.bookings
  for select using (student_id = auth.uid());

create policy "bookings: student inserts own" on public.bookings
  for insert with check (student_id = auth.uid());

create policy "bookings: student updates own" on public.bookings
  for update using (student_id = auth.uid());

create policy "bookings: instructor reads slot bookings" on public.bookings
  for select using (
    exists (
      select 1 from public.slots
      where slots.id = bookings.slot_id
        and slots.instructor_id = auth.uid()
    )
  );

create policy "bookings: instructor updates slot bookings" on public.bookings
  for update using (
    exists (
      select 1 from public.slots
      where slots.id = bookings.slot_id
        and slots.instructor_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- notifications_log
-- ─────────────────────────────────────────────

create policy "notif: student reads own" on public.notifications_log
  for select using (recipient_id = auth.uid());

create policy "notif: instructor reads linked students" on public.notifications_log
  for select using (
    exists (
      select 1 from public.instructor_students
      where instructor_id = auth.uid()
        and student_id = notifications_log.recipient_id
    )
  );

-- ─────────────────────────────────────────────
-- instructor_students
-- ─────────────────────────────────────────────

create policy "inst_stu: student reads own" on public.instructor_students
  for select using (student_id = auth.uid());

create policy "inst_stu: instructor reads own" on public.instructor_students
  for select using (instructor_id = auth.uid());

create policy "inst_stu: instructor inserts" on public.instructor_students
  for insert with check (instructor_id = auth.uid());

-- Students can insert their own link (on signup via profile)
create policy "inst_stu: student inserts own link" on public.instructor_students
  for insert with check (student_id = auth.uid());

-- ─────────────────────────────────────────────
-- student_notification_prefs
-- ─────────────────────────────────────────────

create policy "prefs: student reads own" on public.student_notification_prefs
  for select using (student_id = auth.uid());

create policy "prefs: instructor reads linked" on public.student_notification_prefs
  for select using (instructor_id = auth.uid());

create policy "prefs: instructor updates linked" on public.student_notification_prefs
  for update using (
    instructor_id = auth.uid()
    and exists (
      select 1 from public.instructor_students
      where instructor_id = auth.uid()
        and student_id = student_notification_prefs.student_id
    )
  );

create policy "prefs: instructor inserts for linked" on public.student_notification_prefs
  for insert with check (
    instructor_id = auth.uid()
    and exists (
      select 1 from public.instructor_students
      where instructor_id = auth.uid()
        and student_id = student_notification_prefs.student_id
    )
  );
