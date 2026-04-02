insert into atlas.z_code_categories(category_key, category_name)
values
  ('habitat', 'Habitat'),
  ('work', 'Work'),
  ('social_network', 'Social Network')
on conflict (category_key) do update set category_name = excluded.category_name;

-- draft taxonomy from z-group affinity:
-- habitat: 55, 56, 59
-- work: 55, 56, 57
-- social_network: 60, 62, 63, 64, 65, 75
with category_ids as (
  select category_key, id from atlas.z_code_categories
),
z_source as (
  select id, z_group
  from atlas.z_codes
  where z_group is not null
)
insert into atlas.z_code_category_map(z_code_id, category_id, weight)
select zs.id, ci.id,
  case
    when zs.z_group in (55, 56) and ci.category_key in ('habitat', 'work') then 0.5
    when zs.z_group in (59) and ci.category_key = 'habitat' then 1.0
    when zs.z_group in (57) and ci.category_key = 'work' then 1.0
    when zs.z_group in (60, 62, 63, 64, 65, 75) and ci.category_key = 'social_network' then 1.0
    else null
  end as weight
from z_source zs
cross join category_ids ci
where (
  (zs.z_group in (55, 56) and ci.category_key in ('habitat', 'work')) or
  (zs.z_group in (59) and ci.category_key = 'habitat') or
  (zs.z_group in (57) and ci.category_key = 'work') or
  (zs.z_group in (60, 62, 63, 64, 65, 75) and ci.category_key = 'social_network')
)
on conflict (z_code_id, category_id) do update set weight = excluded.weight;
