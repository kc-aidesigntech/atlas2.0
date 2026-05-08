drop policy if exists storage_profile_images_public_read on storage.objects;
create policy storage_profile_images_public_read on storage.objects
for select to public
using (
  bucket_id = 'profile-images'
  and name like 'enrollees/%'
);;
