drop policy if exists profile_images_public_select on atlas.profile_images;
create policy profile_images_public_select on atlas.profile_images
for select to public
using (
  storage_bucket = 'profile-images'
  and storage_path like 'enrollees/%'
);

drop policy if exists profile_images_public_insert on atlas.profile_images;
create policy profile_images_public_insert on atlas.profile_images
for insert to public
with check (
  storage_bucket = 'profile-images'
  and storage_path like 'enrollees/%'
);

drop policy if exists profile_images_public_update on atlas.profile_images;
create policy profile_images_public_update on atlas.profile_images
for update to public
using (
  storage_bucket = 'profile-images'
  and storage_path like 'enrollees/%'
)
with check (
  storage_bucket = 'profile-images'
  and storage_path like 'enrollees/%'
);

drop policy if exists profile_images_public_delete on atlas.profile_images;
create policy profile_images_public_delete on atlas.profile_images
for delete to public
using (
  storage_bucket = 'profile-images'
  and storage_path like 'enrollees/%'
);

drop policy if exists storage_profile_images_public_insert on storage.objects;
create policy storage_profile_images_public_insert on storage.objects
for insert to public
with check (
  bucket_id = 'profile-images'
  and name like 'enrollees/%'
);

drop policy if exists storage_profile_images_public_update on storage.objects;
create policy storage_profile_images_public_update on storage.objects
for update to public
using (
  bucket_id = 'profile-images'
  and name like 'enrollees/%'
)
with check (
  bucket_id = 'profile-images'
  and name like 'enrollees/%'
);

drop policy if exists storage_profile_images_public_delete on storage.objects;
create policy storage_profile_images_public_delete on storage.objects
for delete to public
using (
  bucket_id = 'profile-images'
  and name like 'enrollees/%'
);
