drop policy if exists profile_images_public_select on atlas.profile_images;
create policy profile_images_public_select on atlas.profile_images
for select to public
using (storage_bucket = 'profile-images');

drop policy if exists profile_images_public_insert on atlas.profile_images;
create policy profile_images_public_insert on atlas.profile_images
for insert to public
with check (storage_bucket = 'profile-images');

drop policy if exists profile_images_public_update on atlas.profile_images;
create policy profile_images_public_update on atlas.profile_images
for update to public
using (storage_bucket = 'profile-images')
with check (storage_bucket = 'profile-images');

drop policy if exists profile_images_public_delete on atlas.profile_images;
create policy profile_images_public_delete on atlas.profile_images
for delete to public
using (storage_bucket = 'profile-images');;
