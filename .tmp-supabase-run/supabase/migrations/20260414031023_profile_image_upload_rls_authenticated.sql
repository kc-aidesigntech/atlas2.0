alter table if exists atlas.profile_images enable row level security;

drop policy if exists profile_images_authenticated_select on atlas.profile_images;
create policy profile_images_authenticated_select on atlas.profile_images
for select to authenticated
using (storage_bucket = 'profile-images');

drop policy if exists profile_images_authenticated_insert on atlas.profile_images;
create policy profile_images_authenticated_insert on atlas.profile_images
for insert to authenticated
with check (storage_bucket = 'profile-images');

drop policy if exists profile_images_authenticated_update on atlas.profile_images;
create policy profile_images_authenticated_update on atlas.profile_images
for update to authenticated
using (storage_bucket = 'profile-images')
with check (storage_bucket = 'profile-images');

drop policy if exists profile_images_authenticated_delete on atlas.profile_images;
create policy profile_images_authenticated_delete on atlas.profile_images
for delete to authenticated
using (storage_bucket = 'profile-images');

drop policy if exists storage_profile_images_authenticated_insert on storage.objects;
create policy storage_profile_images_authenticated_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'profile-images');

drop policy if exists storage_profile_images_authenticated_update on storage.objects;
create policy storage_profile_images_authenticated_update on storage.objects
for update to authenticated
using (bucket_id = 'profile-images')
with check (bucket_id = 'profile-images');

drop policy if exists storage_profile_images_authenticated_delete on storage.objects;
create policy storage_profile_images_authenticated_delete on storage.objects
for delete to authenticated
using (bucket_id = 'profile-images');;
