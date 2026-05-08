create table if not exists atlas.app_role_navigation (
  id uuid primary key default gen_random_uuid(),
  surface text not null,
  role_key text not null,
  top_menus jsonb not null default '[]'::jsonb,
  action_menus jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(surface, role_key)
);

create table if not exists atlas.app_config_documents (
  id uuid primary key default gen_random_uuid(),
  surface text not null,
  config_key text not null,
  version text not null default 'live',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(surface, config_key, version)
);

drop trigger if exists trg_app_role_navigation_touch_updated_at on atlas.app_role_navigation;
create trigger trg_app_role_navigation_touch_updated_at
before update on atlas.app_role_navigation
for each row execute function atlas.fn_touch_updated_at();

drop trigger if exists trg_app_config_documents_touch_updated_at on atlas.app_config_documents;
create trigger trg_app_config_documents_touch_updated_at
before update on atlas.app_config_documents
for each row execute function atlas.fn_touch_updated_at();

create or replace view atlas.v_singlepane_enrollee_profiles as
with active_z_codes as (
  select
    ez.enrollment_id,
    array_agg(z.z_code order by z.z_code) as z_code_tags
  from atlas.enrollee_z_codes ez
  join atlas.z_codes z on z.id = ez.z_code_id
  where ez.ended_at is null
  group by ez.enrollment_id
)
select
  e.id as enrollee_id,
  en.id as enrollment_id,
  p.display_name as full_name,
  coalesce(e.dob::text, '') as dob,
  coalesce(e.case_id, '') as case_id,
  coalesce(p.email, '') as email,
  e.avatar_url,
  coalesce(nav.display_name, 'unassigned') as assigned_navigator,
  coalesce(az.z_code_tags, '{}') as z_code_tags,
  en.start_date::text as enrollment_start_iso,
  en.target_duration_months,
  e.current_phase
from atlas.enrollments en
join atlas.enrollees e on e.id = en.enrollee_id
join atlas.people p on p.id = e.person_id
left join atlas.navigator_assignments na on na.enrollment_id = en.id and na.ends_on is null
left join atlas.people nav on nav.id = na.navigator_person_id
left join active_z_codes az on az.enrollment_id = en.id
where en.status = 'active';

create or replace view atlas.v_singlepane_enrollee_domain_load_breakdown as
with grouped as (
  select
    en.id as enrollment_id,
    p.display_name as full_name,
    upper('z' || substring(z.z_code from 2 for 2)) as z_code_group,
    case
      when substring(z.z_code from 2 for 2) in ('55', '56', '57') then 'work'
      when substring(z.z_code from 2 for 2) = '59' then 'habitat'
      else 'socialNetworks'
    end as mapped_domain,
    count(*)::int as raw_count
  from atlas.enrollments en
  join atlas.enrollees e on e.id = en.enrollee_id
  join atlas.people p on p.id = e.person_id
  join atlas.enrollee_z_codes ez on ez.enrollment_id = en.id and ez.ended_at is null
  join atlas.z_codes z on z.id = ez.z_code_id
  where en.status = 'active'
  group by en.id, p.display_name, upper('z' || substring(z.z_code from 2 for 2)),
    case
      when substring(z.z_code from 2 for 2) in ('55', '56', '57') then 'work'
      when substring(z.z_code from 2 for 2) = '59' then 'habitat'
      else 'socialNetworks'
    end
)
select
  enrollment_id,
  full_name,
  z_code_group,
  mapped_domain,
  raw_count
from grouped;

create or replace view atlas.v_singlepane_enrollee_domain_loads as
with grouped as (
  select
    enrollment_id,
    mapped_domain,
    sum(raw_count)::int as raw_count
  from atlas.v_singlepane_enrollee_domain_load_breakdown
  group by enrollment_id, mapped_domain
)
select
  enrollment_id,
  greatest(0, least(100, 20 + coalesce(max(raw_count) filter (where mapped_domain = 'habitat'), 0) * 26))::int as habitat,
  greatest(0, least(100, 20 + coalesce(max(raw_count) filter (where mapped_domain = 'work'), 0) * 26))::int as work,
  greatest(0, least(100, 20 + coalesce(max(raw_count) filter (where mapped_domain = 'socialNetworks'), 0) * 26))::int as social_networks
from grouped
group by enrollment_id;

drop view if exists atlas.v_navigator_route_candidates;
drop function if exists atlas.fn_rank_route_candidates(uuid);

create or replace function atlas.fn_rank_route_candidates(p_enrollment_id uuid)
returns table(
  station_id uuid,
  partner_id uuid,
  station_name text,
  score numeric,
  specialize_hits int,
  conflict_hits int,
  interfere_hits int,
  matched_z_codes text[]
)
language sql
stable
as $$
with active_codes as (
  select ez.z_code_id
  from atlas.enrollee_z_codes ez
  where ez.enrollment_id = p_enrollment_id
    and ez.ended_at is null
),
pairs as (
  select
    ps.id as station_id,
    ps.partner_id,
    ps.station_name,
    ac.z_code_id,
    upper('z' || substring(z.z_code from 2 for 2)) as matched_z_group,
    max(case when pzc.relation_type = 'specialize' and pzc.is_active then 1 else 0 end) as has_specialize,
    max(case when pzc.relation_type = 'interfere' and pzc.is_active then 1 else 0 end) as has_interfere,
    max(case when pzc.relation_type = 'specialize' and pzc.is_active then pzc.strength else 0 end) as specialize_strength
  from atlas.partner_stations ps
  cross join active_codes ac
  join atlas.z_codes z on z.id = ac.z_code_id
  left join atlas.partner_z_code_capabilities pzc
    on pzc.partner_id = ps.partner_id
   and pzc.z_code_id = ac.z_code_id
  where ps.is_active = true
  group by ps.id, ps.partner_id, ps.station_name, ac.z_code_id, upper('z' || substring(z.z_code from 2 for 2))
),
agg as (
  select
    station_id,
    partner_id,
    station_name,
    sum(case when has_specialize = 1 and has_interfere = 0 then 1 else 0 end) as specialize_hits,
    sum(case when has_specialize = 1 and has_interfere = 1 then 1 else 0 end) as conflict_hits,
    sum(case when has_specialize = 0 and has_interfere = 1 then 1 else 0 end) as interfere_hits,
    sum(specialize_strength) as specialize_strength,
    array_agg(distinct matched_z_group order by matched_z_group)
      filter (where has_specialize = 1) as matched_z_codes
  from pairs
  group by station_id, partner_id, station_name
)
select
  station_id,
  partner_id,
  station_name,
  (specialize_hits * 10.0) + (specialize_strength * 2.0) - (conflict_hits * 6.0) - (interfere_hits * 4.0) as score,
  specialize_hits,
  conflict_hits,
  interfere_hits,
  coalesce(matched_z_codes, '{}')
from agg
order by score desc, specialize_hits desc, conflict_hits asc, interfere_hits asc, station_name asc;
$$;

create or replace view atlas.v_navigator_route_candidates as
select
  en.id as enrollment_id,
  ranked.station_id,
  ranked.partner_id,
  ranked.station_name,
  ranked.score,
  ranked.specialize_hits,
  ranked.conflict_hits,
  ranked.interfere_hits,
  ranked.matched_z_codes
from atlas.enrollments en
cross join lateral atlas.fn_rank_route_candidates(en.id) ranked
where en.status = 'active';

insert into atlas.app_role_navigation (surface, role_key, top_menus, action_menus, metadata)
values
  ('singlepane', 'navigator', '["assigned enrollees","requests to enroll","referral portal","route planning","my station","county commons"]'::jsonb, '["route planning","log contact","append route step","escalate risk"]'::jsonb, '{}'::jsonb),
  ('singlepane', 'partner', '["assigned enrollees","partner referrals","route planning","service capacity","county commons"]'::jsonb, '["route planning","submit service update","confirm milestone","request support"]'::jsonb, '{}'::jsonb),
  ('singlepane', 'supervisor', '["assigned navigators","navigator assessments","route planning","team burden","county commons"]'::jsonb, '["record navigator assessment","append route step","confirm milestone"]'::jsonb, '{}'::jsonb),
  ('singlepane', 'administrator', '["assigned enrollees","system operations","route planning","governance","county commons"]'::jsonb, '["route planning","set policy threshold","approve route template","audit event logs"]'::jsonb, '{}'::jsonb)
on conflict (surface, role_key) do update
set top_menus = excluded.top_menus,
    action_menus = excluded.action_menus,
    metadata = excluded.metadata;

insert into atlas.app_config_documents (surface, config_key, version, payload)
values
  (
    'singlepane',
    'timeline_defaults',
    '2026-v1',
    '{
      "durationMonths": 9,
      "maxDurationMonths": 12,
      "gates": [
        { "id": "gate-regulation", "label": "regulation", "phase": "regulation", "monthOffset": 0 },
        { "id": "gate-readiness", "label": "readiness", "phase": "readiness", "monthOffset": 3 },
        { "id": "gate-renewal", "label": "renewal", "phase": "renewal", "monthOffset": 6 }
      ]
    }'::jsonb
  ),
  (
    'singlepane',
    'service_capacity_survey',
    '2026-z-burden-v1',
    $$ {
      "scale": [
        { "value": 1, "label": "major burden", "description": "We do not handle this and it creates major burden." },
        { "value": 2, "label": "rarely handled", "description": "We rarely handle this and it creates burden." },
        { "value": 3, "label": "poor fit", "description": "We are not a good fit for this." },
        { "value": 4, "label": "inconsistent fit", "description": "We sometimes handle this, but inconsistently." },
        { "value": 5, "label": "mixed fit", "description": "Mixed fit / depends on situation." },
        { "value": 6, "label": "case by case", "description": "We can handle this in some cases." },
        { "value": 7, "label": "handles well", "description": "We handle this well." },
        { "value": 8, "label": "reliable fit", "description": "We handle this reliably." },
        { "value": 9, "label": "specialty area", "description": "This is a strong area of specialty for us." }
      ],
      "sections": [
        {
          "parentCode": "Z55",
          "theme": "Educational and literacy problems persist",
          "prompts": [
            { "id": "z55-0", "parentCode": "Z55", "parentTheme": "Educational and literacy problems persist", "zCode": "Z55.0", "normalizedZCode": "Z55.0", "title": "Z55.0", "description": "Illiteracy and Low-Level Literacy" },
            { "id": "z55-1", "parentCode": "Z55", "parentTheme": "Educational and literacy problems persist", "zCode": "Z55.1", "normalizedZCode": "Z55.1", "title": "Z55.1", "description": "Schooling Unavailable and Unattainable" },
            { "id": "z55-2", "parentCode": "Z55", "parentTheme": "Educational and literacy problems persist", "zCode": "Z55.2", "normalizedZCode": "Z55.2", "title": "Z55.2", "description": "Failed School Examinations" },
            { "id": "z55-3", "parentCode": "Z55", "parentTheme": "Educational and literacy problems persist", "zCode": "Z55.3", "normalizedZCode": "Z55.3", "title": "Z55.3", "description": "Underachievement in School" },
            { "id": "z55-4", "parentCode": "Z55", "parentTheme": "Educational and literacy problems persist", "zCode": "Z55.4", "normalizedZCode": "Z55.4", "title": "Z55.4", "description": "Educational Maladjustment & Discord w/Teachers & Classmates" },
            { "id": "z55-5", "parentCode": "Z55", "parentTheme": "Educational and literacy problems persist", "zCode": "Z55.5", "normalizedZCode": "Z55.5", "title": "Z55.5", "description": "Less than a Highschool Diploma" },
            { "id": "z55-8", "parentCode": "Z55", "parentTheme": "Educational and literacy problems persist", "zCode": "Z55.8", "normalizedZCode": "Z55.8", "title": "Z55.8", "description": "Other Problems Related to Education and Literacy" },
            { "id": "z55-9-academic", "parentCode": "Z55", "parentTheme": "Educational and literacy problems persist", "zCode": "Z55.9*", "normalizedZCode": "Z55.9", "title": "Z55.9*", "description": "Academic or Educational Problems" },
            { "id": "z55-9-unspecified", "parentCode": "Z55", "parentTheme": "Educational and literacy problems persist", "zCode": "Z55.9", "normalizedZCode": "Z55.9", "title": "Z55.9", "description": "Problems Related to Education and Literacy Unspecified" }
          ]
        },
        {
          "parentCode": "Z56",
          "theme": "Work-related stress and job issues",
          "prompts": [
            { "id": "z56-0", "parentCode": "Z56", "parentTheme": "Work-related stress and job issues", "zCode": "Z56.0", "normalizedZCode": "Z56.0", "title": "Z56.0", "description": "Unemployment Unspecified" },
            { "id": "z56-1", "parentCode": "Z56", "parentTheme": "Work-related stress and job issues", "zCode": "Z56.1", "normalizedZCode": "Z56.1", "title": "Z56.1", "description": "Change of Job" },
            { "id": "z56-2", "parentCode": "Z56", "parentTheme": "Work-related stress and job issues", "zCode": "Z56.2", "normalizedZCode": "Z56.2", "title": "Z56.2", "description": "Threat of Job Loss" },
            { "id": "z56-3", "parentCode": "Z56", "parentTheme": "Work-related stress and job issues", "zCode": "Z56.3", "normalizedZCode": "Z56.3", "title": "Z56.3", "description": "Stressful Work Schedule" },
            { "id": "z56-4", "parentCode": "Z56", "parentTheme": "Work-related stress and job issues", "zCode": "Z56.4", "normalizedZCode": "Z56.4", "title": "Z56.4", "description": "Discord With Boss and Workmates" },
            { "id": "z56-5", "parentCode": "Z56", "parentTheme": "Work-related stress and job issues", "zCode": "Z56.5", "normalizedZCode": "Z56.5", "title": "Z56.5", "description": "Uncongenial Work Environment" },
            { "id": "z56-6", "parentCode": "Z56", "parentTheme": "Work-related stress and job issues", "zCode": "Z56.6", "normalizedZCode": "Z56.6", "title": "Z56.6", "description": "Other Physical and Mental Strain related to work" },
            { "id": "z56-81", "parentCode": "Z56", "parentTheme": "Work-related stress and job issues", "zCode": "Z56.81", "normalizedZCode": "Z56.81", "title": "Z56.81", "description": "Sexual Harassment on the Job" },
            { "id": "z56-89", "parentCode": "Z56", "parentTheme": "Work-related stress and job issues", "zCode": "Z56.89", "normalizedZCode": "Z56.89", "title": "Z56.89", "description": "Other Problems Related to Employment" },
            { "id": "z56-9", "parentCode": "Z56", "parentTheme": "Work-related stress and job issues", "zCode": "Z56.9", "normalizedZCode": "Z56.9", "title": "Z56.9", "description": "Unspecified Problems Related to Employment" }
          ]
        },
        {
          "parentCode": "Z57",
          "theme": "Workplace exposure to unidentified risks",
          "prompts": [
            { "id": "z57-8", "parentCode": "Z57", "parentTheme": "Workplace exposure to unidentified risks", "zCode": "Z57.8", "normalizedZCode": "Z57.8", "title": "Z57.8", "description": "Occupational Exposure to other risk factors" },
            { "id": "z57-9", "parentCode": "Z57", "parentTheme": "Workplace exposure to unidentified risks", "zCode": "Z57.9", "normalizedZCode": "Z57.9", "title": "Z57.9", "description": "Occupational exposure to unspecified risk factor" }
          ]
        },
        {
          "parentCode": "Z59",
          "theme": "Homelessness poverty housing insecurity hunger",
          "prompts": [
            { "id": "z59-0", "parentCode": "Z59", "parentTheme": "Homelessness poverty housing insecurity hunger", "zCode": "Z59.0", "normalizedZCode": "Z59.0", "title": "Z59.0", "description": "Homelessness" },
            { "id": "z59-00", "parentCode": "Z59", "parentTheme": "Homelessness poverty housing insecurity hunger", "zCode": "Z59.00", "normalizedZCode": "Z59.00", "title": "Z59.00", "description": "Homelessness Unspecified" },
            { "id": "z59-01", "parentCode": "Z59", "parentTheme": "Homelessness poverty housing insecurity hunger", "zCode": "Z59.01", "normalizedZCode": "Z59.01", "title": "Z59.01", "description": "Sheltered Homelessness" },
            { "id": "z59-02", "parentCode": "Z59", "parentTheme": "Homelessness poverty housing insecurity hunger", "zCode": "Z59.02", "normalizedZCode": "Z59.02", "title": "Z59.02", "description": "Unsheltered Homelessness" },
            { "id": "z59-1", "parentCode": "Z59", "parentTheme": "Homelessness poverty housing insecurity hunger", "zCode": "Z59.1", "normalizedZCode": "Z59.1", "title": "Z59.1", "description": "Inadequate Housing" },
            { "id": "z59-2", "parentCode": "Z59", "parentTheme": "Homelessness poverty housing insecurity hunger", "zCode": "Z59.2", "normalizedZCode": "Z59.2", "title": "Z59.2", "description": "Discord with neighbor, lodger, or landlord" },
            { "id": "z59-3", "parentCode": "Z59", "parentTheme": "Homelessness poverty housing insecurity hunger", "zCode": "Z59.3", "normalizedZCode": "Z59.3", "title": "Z59.3", "description": "Problem Related to living in a Residential Institution" },
            { "id": "z59-4", "parentCode": "Z59", "parentTheme": "Homelessness poverty housing insecurity hunger", "zCode": "Z59.4", "normalizedZCode": "Z59.4", "title": "Z59.4", "description": "Lack of adequate food or safe drinking water" },
            { "id": "z59-5", "parentCode": "Z59", "parentTheme": "Homelessness poverty housing insecurity hunger", "zCode": "Z59.5", "normalizedZCode": "Z59.5", "title": "Z59.5", "description": "Extreme Poverty" },
            { "id": "z59-6", "parentCode": "Z59", "parentTheme": "Homelessness poverty housing insecurity hunger", "zCode": "Z59.6", "normalizedZCode": "Z59.6", "title": "Z59.6", "description": "Low Income" },
            { "id": "z59-7", "parentCode": "Z59", "parentTheme": "Homelessness poverty housing insecurity hunger", "zCode": "Z59.7", "normalizedZCode": "Z59.7", "title": "Z59.7", "description": "Insufficient Social Insurance or Welfare Support" },
            { "id": "z59-8", "parentCode": "Z59", "parentTheme": "Homelessness poverty housing insecurity hunger", "zCode": "Z59.8", "normalizedZCode": "Z59.8", "title": "Z59.8", "description": "Other Problems Related to Housing and Economic Circumstances" },
            { "id": "z59-9", "parentCode": "Z59", "parentTheme": "Homelessness poverty housing insecurity hunger", "zCode": "Z59.9", "normalizedZCode": "Z59.9", "title": "Z59.9", "description": "Unspecified Housing or Economic Problems" }
          ]
        },
        {
          "parentCode": "Z60",
          "theme": "Social environment challenges, exclusion, discrimination",
          "prompts": [
            { "id": "z60-0", "parentCode": "Z60", "parentTheme": "Social environment challenges, exclusion, discrimination", "zCode": "Z60.0", "normalizedZCode": "Z60.0", "title": "Z60.0", "description": "Phase of Life Problem" },
            { "id": "z60-2", "parentCode": "Z60", "parentTheme": "Social environment challenges, exclusion, discrimination", "zCode": "Z60.2", "normalizedZCode": "Z60.2", "title": "Z60.2", "description": "Problems Related to Living Alone" },
            { "id": "z60-3", "parentCode": "Z60", "parentTheme": "Social environment challenges, exclusion, discrimination", "zCode": "Z60.3", "normalizedZCode": "Z60.3", "title": "Z60.3", "description": "Acculturation Difficulty" },
            { "id": "z60-4", "parentCode": "Z60", "parentTheme": "Social environment challenges, exclusion, discrimination", "zCode": "Z60.4", "normalizedZCode": "Z60.4", "title": "Z60.4", "description": "Social Exclusion and/or Rejection" },
            { "id": "z60-5", "parentCode": "Z60", "parentTheme": "Social environment challenges, exclusion, discrimination", "zCode": "Z60.5", "normalizedZCode": "Z60.5", "title": "Z60.5", "description": "Target of Perceived Adverse Discrimination or Persecution" },
            { "id": "z60-8", "parentCode": "Z60", "parentTheme": "Social environment challenges, exclusion, discrimination", "zCode": "Z60.8", "normalizedZCode": "Z60.8", "title": "Z60.8", "description": "Other Problems Related to Social Environment" }
          ]
        },
        {
          "parentCode": "Z62",
          "theme": "Childhood abuse, neglect, relational problems",
          "prompts": [
            { "id": "z62-0", "parentCode": "Z62", "parentTheme": "Childhood abuse, neglect, relational problems", "zCode": "Z62.0", "normalizedZCode": "Z62.0", "title": "Z62.0", "description": "Inadequate Parental Supervision and Control" },
            { "id": "z62-1", "parentCode": "Z62", "parentTheme": "Childhood abuse, neglect, relational problems", "zCode": "Z62.1", "normalizedZCode": "Z62.1", "title": "Z62.1", "description": "Parental Overprotection" },
            { "id": "z62-21", "parentCode": "Z62", "parentTheme": "Childhood abuse, neglect, relational problems", "zCode": "Z62.21", "normalizedZCode": "Z62.21", "title": "Z62.21", "description": "Child in Welfare Custody" },
            { "id": "z62-22", "parentCode": "Z62", "parentTheme": "Childhood abuse, neglect, relational problems", "zCode": "Z62.22", "normalizedZCode": "Z62.22", "title": "Z62.22", "description": "Institutional Upbringing" },
            { "id": "z62-6", "parentCode": "Z62", "parentTheme": "Childhood abuse, neglect, relational problems", "zCode": "Z62.6", "normalizedZCode": "Z62.6", "title": "Z62.6", "description": "Inappropriate Excessive Parental Pressure" },
            { "id": "z62-810-physical-history", "parentCode": "Z62", "parentTheme": "Childhood abuse, neglect, relational problems", "zCode": "Z62.810*", "normalizedZCode": "Z62.810", "title": "Z62.810*", "description": "Personal History (Past History) of Physical Abuse in Childhood" },
            { "id": "z62-810-sexual-history", "parentCode": "Z62", "parentTheme": "Childhood abuse, neglect, relational problems", "zCode": "Z62.810*", "normalizedZCode": "Z62.810", "title": "Z62.810*", "description": "Personal History (Past History) of Sexual Abuse in Childhood" },
            { "id": "z62-810-combined", "parentCode": "Z62", "parentTheme": "Childhood abuse, neglect, relational problems", "zCode": "Z62.810", "normalizedZCode": "Z62.810", "title": "Z62.810", "description": "Personal History of Physical and Sexual Abuse in Childhood" },
            { "id": "z62-811", "parentCode": "Z62", "parentTheme": "Childhood abuse, neglect, relational problems", "zCode": "Z62.811", "normalizedZCode": "Z62.811", "title": "Z62.811", "description": "Personal History of Psychological Abuse in Childhood" },
            { "id": "z62-812", "parentCode": "Z62", "parentTheme": "Childhood abuse, neglect, relational problems", "zCode": "Z62.812", "normalizedZCode": "Z62.812", "title": "Z62.812", "description": "Personal History of Neglect in Childhood" },
            { "id": "z62-819", "parentCode": "Z62", "parentTheme": "Childhood abuse, neglect, relational problems", "zCode": "Z62.819", "normalizedZCode": "Z62.819", "title": "Z62.819", "description": "Personal History of Unspecified Abuse in Childhood" },
            { "id": "z62-820", "parentCode": "Z62", "parentTheme": "Childhood abuse, neglect, relational problems", "zCode": "Z62.820", "normalizedZCode": "Z62.820", "title": "Z62.820", "description": "Parent-Child Relational Problem" },
            { "id": "z62-821", "parentCode": "Z62", "parentTheme": "Childhood abuse, neglect, relational problems", "zCode": "Z62.821", "normalizedZCode": "Z62.821", "title": "Z62.821", "description": "Parent-Adopted Child Conflict" },
            { "id": "z62-822", "parentCode": "Z62", "parentTheme": "Childhood abuse, neglect, relational problems", "zCode": "Z62.822", "normalizedZCode": "Z62.822", "title": "Z62.822", "description": "Parent-Foster Child Conflict" },
            { "id": "z62-890", "parentCode": "Z62", "parentTheme": "Childhood abuse, neglect, relational problems", "zCode": "Z62.890", "normalizedZCode": "Z62.890", "title": "Z62.890", "description": "Parent-Child Estrangement NEC" },
            { "id": "z62-9", "parentCode": "Z62", "parentTheme": "Childhood abuse, neglect, relational problems", "zCode": "Z62.9", "normalizedZCode": "Z62.9", "title": "Z62.9", "description": "Problem Related to Upbringing" }
          ]
        },
        {
          "parentCode": "Z63",
          "theme": "Family-related stress and loss",
          "prompts": [
            { "id": "z63-0", "parentCode": "Z63", "parentTheme": "Family-related stress and loss", "zCode": "Z63.0", "normalizedZCode": "Z63.0", "title": "Z63.0", "description": "Relationship Distress with Spouse or Intimate Partner" },
            { "id": "z63-1", "parentCode": "Z63", "parentTheme": "Family-related stress and loss", "zCode": "Z63.1", "normalizedZCode": "Z63.1", "title": "Z63.1", "description": "Problems in Relationships with In-Laws" },
            { "id": "z63-31", "parentCode": "Z63", "parentTheme": "Family-related stress and loss", "zCode": "Z63.31", "normalizedZCode": "Z63.31", "title": "Z63.31", "description": "Absence of Family Member Due to Military Deployment" },
            { "id": "z63-32", "parentCode": "Z63", "parentTheme": "Family-related stress and loss", "zCode": "Z63.32", "normalizedZCode": "Z63.32", "title": "Z63.32", "description": "Other Absence of Family Member" },
            { "id": "z63-4-bereavement", "parentCode": "Z63", "parentTheme": "Family-related stress and loss", "zCode": "Z63.4*", "normalizedZCode": "Z63.4", "title": "Z63.4*", "description": "Uncomplicated Bereavement" },
            { "id": "z63-4-death", "parentCode": "Z63", "parentTheme": "Family-related stress and loss", "zCode": "Z63.4", "normalizedZCode": "Z63.4", "title": "Z63.4", "description": "Disappearance and Death of Family Member" },
            { "id": "z63-6", "parentCode": "Z63", "parentTheme": "Family-related stress and loss", "zCode": "Z63.6", "normalizedZCode": "Z63.6", "title": "Z63.6", "description": "Dependent Relative Needing Care at Home" },
            { "id": "z63-5", "parentCode": "Z63", "parentTheme": "Family-related stress and loss", "zCode": "Z63.5", "normalizedZCode": "Z63.5", "title": "Z63.5", "description": "Disruption of Family by Separation and/or Divorce" },
            { "id": "z63-72", "parentCode": "Z63", "parentTheme": "Family-related stress and loss", "zCode": "Z63.72", "normalizedZCode": "Z63.72", "title": "Z63.72", "description": "Alcoholism and Drug Addiction in Family" },
            { "id": "z63-79", "parentCode": "Z63", "parentTheme": "Family-related stress and loss", "zCode": "Z63.79", "normalizedZCode": "Z63.79", "title": "Z63.79", "description": "Other Stressful Life Events Affecting Family and Household" },
            { "id": "z63-8", "parentCode": "Z63", "parentTheme": "Family-related stress and loss", "zCode": "Z63.8", "normalizedZCode": "Z63.8", "title": "Z63.8", "description": "High Expressed Emotion Level Within Family" },
            { "id": "z63-9", "parentCode": "Z63", "parentTheme": "Family-related stress and loss", "zCode": "Z63.9", "normalizedZCode": "Z63.9", "title": "Z63.9", "description": "Problem Related to Primary Support Group, Unspecified" }
          ]
        },
        {
          "parentCode": "Z64",
          "theme": "Unwanted pregnancy multiparity social discord",
          "prompts": [
            { "id": "z64-0", "parentCode": "Z64", "parentTheme": "Unwanted pregnancy multiparity social discord", "zCode": "Z64.0", "normalizedZCode": "Z64.0", "title": "Z64.0", "description": "Problems Related to Unwanted Pregnancy" },
            { "id": "z64-1", "parentCode": "Z64", "parentTheme": "Unwanted pregnancy multiparity social discord", "zCode": "Z64.1", "normalizedZCode": "Z64.1", "title": "Z64.1", "description": "Problems Related to Multiparity" },
            { "id": "z64-4", "parentCode": "Z64", "parentTheme": "Unwanted pregnancy multiparity social discord", "zCode": "Z64.4", "normalizedZCode": "Z64.4", "title": "Z64.4", "description": "Discord with Social Service Provider, Including Probation Officer, Case Manager, or Social Service Worker" }
          ]
        },
        {
          "parentCode": "Z65",
          "theme": "Legal issues and victimization experiences",
          "prompts": [
            { "id": "z65-0", "parentCode": "Z65", "parentTheme": "Legal issues and victimization experiences", "zCode": "Z65.0", "normalizedZCode": "Z65.0", "title": "Z65.0", "description": "Conviction in Civil or Criminal Proceedings Without Imprisonment" },
            { "id": "z65-1", "parentCode": "Z65", "parentTheme": "Legal issues and victimization experiences", "zCode": "Z65.1", "normalizedZCode": "Z65.1", "title": "Z65.1", "description": "Imprisonment or Other Incarceration" },
            { "id": "z65-2", "parentCode": "Z65", "parentTheme": "Legal issues and victimization experiences", "zCode": "Z65.2", "normalizedZCode": "Z65.2", "title": "Z65.2", "description": "Problems Related to Release from Prison" },
            { "id": "z65-3", "parentCode": "Z65", "parentTheme": "Legal issues and victimization experiences", "zCode": "Z65.3", "normalizedZCode": "Z65.3", "title": "Z65.3", "description": "Problems Related to Other Legal Circumstances" },
            { "id": "z65-4-crime", "parentCode": "Z65", "parentTheme": "Legal issues and victimization experiences", "zCode": "Z65.4*", "normalizedZCode": "Z65.4", "title": "Z65.4*", "description": "Victim of Crime" },
            { "id": "z65-4-terror", "parentCode": "Z65", "parentTheme": "Legal issues and victimization experiences", "zCode": "Z65.4*", "normalizedZCode": "Z65.4", "title": "Z65.4*", "description": "Victim of Terrorism or Torture" },
            { "id": "z65-4-combined", "parentCode": "Z65", "parentTheme": "Legal issues and victimization experiences", "zCode": "Z65.4", "normalizedZCode": "Z65.4", "title": "Z65.4", "description": "Victim of Crime and Terrorism" },
            { "id": "z65-5", "parentCode": "Z65", "parentTheme": "Legal issues and victimization experiences", "zCode": "Z65.5", "normalizedZCode": "Z65.5", "title": "Z65.5", "description": "Exposure to Disaster War or Other Hostilities" }
          ]
        }
      ]
    } $$::jsonb
  )
on conflict (surface, config_key, version) do update
set payload = excluded.payload;

grant select, insert, update, delete on atlas.app_role_navigation to anon, authenticated;
grant select, insert, update, delete on atlas.app_config_documents to anon, authenticated;
grant select on atlas.v_singlepane_enrollee_profiles to anon, authenticated;
grant select on atlas.v_singlepane_enrollee_domain_load_breakdown to anon, authenticated;
grant select on atlas.v_singlepane_enrollee_domain_loads to anon, authenticated;
grant select on atlas.v_navigator_route_candidates to anon, authenticated;;
