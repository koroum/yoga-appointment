-- Create instructor-photos storage bucket
insert into storage.buckets (id, name, public)
values ('instructor-photos', 'instructor-photos', true)
on conflict (id) do nothing;

-- Storage RLS policies (drop + recreate for idempotency)
do $$ begin
  drop policy if exists "instructor-photos: public read" on storage.objects;
  drop policy if exists "instructor-photos: instructor upload" on storage.objects;
  drop policy if exists "instructor-photos: instructor delete" on storage.objects;
exception when others then null;
end $$;

create policy "instructor-photos: public read"
  on storage.objects for select
  using (bucket_id = 'instructor-photos');

create policy "instructor-photos: instructor upload"
  on storage.objects for insert
  with check (bucket_id = 'instructor-photos' and auth.role() = 'authenticated');

create policy "instructor-photos: instructor delete"
  on storage.objects for delete
  using (bucket_id = 'instructor-photos' and auth.uid()::text = (storage.foldername(name))[1]);
