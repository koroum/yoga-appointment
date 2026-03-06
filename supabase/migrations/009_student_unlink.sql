-- Allow students to unlink themselves from instructors
create policy "inst_stu: student deletes own link" on public.instructor_students
  for delete using (student_id = auth.uid());
