-- Storage RLS policies for the instructor-photos bucket.
-- Allows public read access and authenticated users can manage their own photos.

-- Public read access (anyone can view instructor photos)
create policy "Public read access"
on storage.objects for select
using (bucket_id = 'instructor-photos');

-- Authenticated users can upload photos
create policy "Authenticated users can upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'instructor-photos');

-- Authenticated users can update their own photos
create policy "Authenticated users can update"
on storage.objects for update
to authenticated
using (bucket_id = 'instructor-photos');

-- Authenticated users can delete their own photos
create policy "Authenticated users can delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'instructor-photos');
