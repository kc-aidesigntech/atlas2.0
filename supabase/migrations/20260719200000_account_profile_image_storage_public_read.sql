-- Account (navigator/partner) profile photos live under accounts/{user_id}/ in the
-- profile-images bucket. Enrollee public-read was previously limited to enrollees/%,
-- so account avatars uploaded for My Profile could not render in <img> tags.

drop policy if exists storage_profile_images_public_read_accounts on storage.objects;
create policy storage_profile_images_public_read_accounts on storage.objects
for select
to public
using (
  bucket_id = 'profile-images'
  and name like 'accounts/%'
);
