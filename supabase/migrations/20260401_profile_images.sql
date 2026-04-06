create table if not exists atlas.profile_images (
  id uuid primary key default gen_random_uuid(),
  enrollee_id uuid not null references atlas.enrollees(id) on delete cascade,
  uploaded_by_person_id uuid references atlas.people(id) on delete set null,
  storage_bucket text not null default 'profile-images',
  storage_path text not null unique,
  public_url text,
  original_filename text,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  width_px int check (width_px is null or width_px > 0),
  height_px int check (height_px is null or height_px > 0),
  checksum_sha256 text,
  intake_source text not null default 'manual'
    check (intake_source in ('manual', 'admin_upload', 'supabase_storage', 'seed', 'import')),
  intake_status text not null default 'pending'
    check (intake_status in ('pending', 'uploaded', 'processed', 'ready', 'failed', 'archived')),
  is_primary boolean not null default false,
  alt_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ready_at timestamptz
);

create index if not exists idx_profile_images_enrollee on atlas.profile_images(enrollee_id);
create unique index if not exists idx_profile_images_primary_enrollee
  on atlas.profile_images(enrollee_id)
  where is_primary;

comment on table atlas.profile_images is
  'Metadata and intake state for enrollee profile images stored in Supabase Storage.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function atlas.fn_sync_primary_profile_image()
returns trigger
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  target_enrollee_id uuid;
  resolved_avatar_url text;
begin
  target_enrollee_id := coalesce(new.enrollee_id, old.enrollee_id);

  select
    coalesce(
      pi.public_url,
      format('/storage/v1/object/public/%s/%s', pi.storage_bucket, pi.storage_path)
    )
  into resolved_avatar_url
  from atlas.profile_images pi
  where pi.enrollee_id = target_enrollee_id
    and pi.is_primary = true
    and pi.intake_status = 'ready'
  order by pi.updated_at desc, pi.created_at desc
  limit 1;

  update atlas.enrollees
  set
    avatar_url = resolved_avatar_url,
    updated_at = now()
  where id = target_enrollee_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_primary_profile_image on atlas.profile_images;
create trigger trg_sync_primary_profile_image
after insert or update or delete on atlas.profile_images
for each row execute function atlas.fn_sync_primary_profile_image();

alter table atlas.profile_images enable row level security;

create policy if not exists profile_images_admin_all on atlas.profile_images
for all
using (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator');

create policy if not exists storage_profile_images_admin_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'profile-images'
  and coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
);

create policy if not exists storage_profile_images_admin_update on storage.objects
for update to authenticated
using (
  bucket_id = 'profile-images'
  and coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
)
with check (
  bucket_id = 'profile-images'
  and coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
);

create policy if not exists storage_profile_images_admin_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'profile-images'
  and coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
);

create policy if not exists storage_profile_images_authenticated_read on storage.objects
for select to authenticated
using (bucket_id = 'profile-images');
