-- Preserve every submitted domain-spectrum answer while allowing administrators
-- to exclude anomalous values from aggregate analytics.
alter table atlas.partner_service_capacity_answers
  add column if not exists is_nullified boolean not null default false,
  add column if not exists nullified_at timestamptz null,
  add column if not exists nullified_by_email text null,
  add column if not exists nullified_reason text null;

create index if not exists partner_service_capacity_answers_normalized_z_code_nullified_idx
  on atlas.partner_service_capacity_answers (normalized_z_code, is_nullified);
