-- Allow instructors to read student info for students who have bookings on their slots
create policy "users: instructor reads booking students" on public.users
  for select using (
    exists (
      select 1
      from public.bookings b
      join public.slots s on s.id = b.slot_id
      where b.student_id = users.id
        and s.instructor_id = auth.uid()
    )
  );
