-- Seed Z75 regulation-provider codes used when stable Stress Vulnerability Scale (SVS)
-- and Mental Health Self-Care Agency (MH-SCA) milestones are logged as stops under Lucid
-- in Tacoma. Other install areas substitute their local regulation provider under Z75.

insert into atlas.z_codes (z_code, z_group, title, description, is_active)
values
  (
    'Z75.3',
    75,
    'Unavailability and inaccessibility of health care facilities',
    'Unavailability and inaccessibility of health care facilities.',
    true
  ),
  (
    'Z75.4',
    75,
    'Unavailability and inaccessibility of other helping agencies',
    'Unavailability and inaccessibility of other helping agencies.',
    true
  )
on conflict (z_code) do update
set
  z_group = excluded.z_group,
  title = excluded.title,
  description = excluded.description,
  is_active = true;
