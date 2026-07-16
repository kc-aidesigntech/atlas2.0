-- Persists short timeline labels for Z-codes so partner stage markers can render
-- readable callouts without recomputing ad-hoc abbreviations in each client.
create table if not exists atlas.z_code_timeline_labels (
  normalized_z_code text primary key,
  timeline_full_label text not null,
  timeline_short_label text not null,
  updated_at timestamptz not null default now()
);

alter table atlas.z_code_timeline_labels enable row level security;

drop policy if exists z_code_timeline_labels_public_select on atlas.z_code_timeline_labels;
create policy z_code_timeline_labels_public_select
  on atlas.z_code_timeline_labels
  for select
  using (true);

grant select on table atlas.z_code_timeline_labels to anon, authenticated;

create or replace function atlas.build_z_code_timeline_short_label(full_label text, fallback_code text)
returns text
language plpgsql
immutable
as $$
declare
  cleaned text;
  normalized_words text[];
  word text;
  short_parts text[] := '{}';
  candidate text;
begin
  if coalesce(trim(full_label), '') = '' then
    return trim(coalesce(fallback_code, ''));
  end if;

  cleaned := regexp_replace(
    trim(full_label),
    '\m(and|or|with|without|related|problem|problems|specified|unspecified|other|to|of|the|in)\M',
    ' ',
    'gi'
  );
  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');
  normalized_words := regexp_split_to_array(trim(cleaned), '\s+');

  if coalesce(array_length(normalized_words, 1), 0) = 0 then
    return trim(coalesce(fallback_code, ''));
  end if;

  foreach word in array normalized_words loop
    if coalesce(trim(word), '') = '' then
      continue;
    end if;
    if char_length(word) <= 4 then
      short_parts := array_append(short_parts, word);
    else
      short_parts := array_append(short_parts, left(word, 4) || '.');
    end if;
    exit when array_length(short_parts, 1) >= 4;
  end loop;

  candidate := array_to_string(short_parts, ' ');
  if char_length(candidate) > 24 then
    return left(candidate, 23) || '...';
  end if;
  return candidate;
end;
$$;

with source_rows as (
  select
    upper(trim(normalized_z_code)) as normalized_z_code,
    trim(coalesce(description, title, normalized_z_code)) as full_label
  from atlas.partner_service_capacity_answers
  where coalesce(trim(normalized_z_code), '') <> ''
  union all
  select
    upper(trim(normalized_z_code)) as normalized_z_code,
    trim(coalesce(description, title, normalized_z_code)) as full_label
  from atlas.enrollee_burden_survey_answers
  where coalesce(trim(normalized_z_code), '') <> ''
),
best_label_by_code as (
  select distinct on (normalized_z_code)
    normalized_z_code,
    full_label
  from source_rows
  where coalesce(full_label, '') <> ''
  order by normalized_z_code, char_length(full_label) desc
),
fallback_codes as (
  select upper(trim(z_code)) as normalized_z_code, upper(trim(z_code)) as full_label
  from atlas.z_codes
  where coalesce(trim(z_code), '') <> ''
),
merged as (
  select * from best_label_by_code
  union
  select fallback_codes.*
  from fallback_codes
  left join best_label_by_code using (normalized_z_code)
  where best_label_by_code.normalized_z_code is null
)
insert into atlas.z_code_timeline_labels (
  normalized_z_code,
  timeline_full_label,
  timeline_short_label
)
select
  normalized_z_code,
  full_label,
  atlas.build_z_code_timeline_short_label(full_label, normalized_z_code)
from merged
on conflict (normalized_z_code) do update
set
  timeline_full_label = excluded.timeline_full_label,
  timeline_short_label = excluded.timeline_short_label,
  updated_at = now();
