alter table atlas.partner_service_capacity_answers
  add column if not exists not_encountered boolean not null default false;

alter table atlas.partner_service_capacity_answers
  drop constraint if exists partner_service_capacity_answers_burden_score_check;

alter table atlas.partner_service_capacity_answers
  alter column burden_score drop not null;

alter table atlas.partner_service_capacity_answers
  add constraint partner_service_capacity_answers_burden_score_check
  check (
    (not_encountered = true and burden_score is null) or
    (not_encountered = false and burden_score between 1 and 9)
  );

comment on column atlas.partner_service_capacity_answers.not_encountered is
  'True when a survey item is intentionally marked as not encountered in the organization''s work.';

insert into atlas.z_code_categories(category_key, category_name)
values
  ('habitat', 'Habitat'),
  ('work', 'Work'),
  ('social_network', 'Social Network')
on conflict (category_key) do update
set category_name = excluded.category_name;

insert into atlas.z_codes (z_code, z_group, title, description, is_active)
values
  ('Z55.0', 55, 'Illiteracy and low-level literacy', 'Problems related to reading and writing literacy.', true),
  ('Z55.1', 55, 'Schooling unavailable and unattainable', 'Problems related to access to schooling.', true),
  ('Z55.2', 55, 'Failed school examinations', 'Problems related to failing required school examinations.', true),
  ('Z55.3', 55, 'Underachievement in school', 'Problems related to persistent academic underachievement.', true),
  ('Z55.4', 55, 'Educational maladjustment and discord w/ teachers and classmates', 'Problems related to discord with teachers and classmates.', true),
  ('Z55.5', 55, 'Less than a high school diploma', 'Problems related to limited educational attainment.', true),
  ('Z55.6', 55, 'Problems related to health literacy', 'Difficulty understanding medication instructions or completing medical forms.', true),
  ('Z55.8', 55, 'Other specified problems related to education and literacy', 'Other specified education or literacy barriers, including inadequate teaching.', true),
  ('Z55.9', 55, 'Problems related to education and literacy, unspecified', 'Unspecified education or literacy problem.', true),
  ('Z56.0', 56, 'Unemployment, unspecified', 'Unspecified unemployment problem.', true),
  ('Z56.1', 56, 'Change of job', 'Problems related to job change.', true),
  ('Z56.2', 56, 'Threat of job loss', 'Problems related to possible job loss.', true),
  ('Z56.3', 56, 'Stressful work schedule', 'Problems related to stressful work hours or schedule.', true),
  ('Z56.4', 56, 'Discord with boss and workmates', 'Problems related to workplace conflict.', true),
  ('Z56.5', 56, 'Uncongenial work environment', 'Problems related to an uncongenial work environment.', true),
  ('Z56.6', 56, 'Other physical and mental strain related to work', 'Work-related physical or mental strain.', true),
  ('Z56.81', 56, 'Sexual harassment on the job', 'Sexual harassment in the workplace.', true),
  ('Z56.82', 56, 'Military deployment status', 'Problems related to military deployment status.', true),
  ('Z56.89', 56, 'Other specified problems related to employment', 'Other specified employment problem, including furlough or underemployment.', true),
  ('Z56.9', 56, 'Problems related to employment, unspecified', 'Unspecified employment problem.', true),
  ('Z57.0', 57, 'Occupational exposure to noise', 'Workplace exposure to noise.', true),
  ('Z57.1', 57, 'Occupational exposure to radiation', 'Workplace exposure to radiation.', true),
  ('Z57.2', 57, 'Occupational exposure to dust', 'Workplace exposure to dust.', true),
  ('Z57.3', 57, 'Occupational exposure to other air contaminants', 'Workplace exposure to air contaminants.', true),
  ('Z57.31', 57, 'Occupational exposure to environmental tobacco smoke', 'Workplace exposure to secondhand tobacco smoke.', true),
  ('Z57.39', 57, 'Occupational exposure to other air contaminants', 'Workplace exposure to polluted air or similar contaminants.', true),
  ('Z57.4', 57, 'Occupational exposure to toxic agents in agriculture', 'Workplace exposure to agricultural toxic agents.', true),
  ('Z57.5', 57, 'Occupational exposure to toxic agents in other industries', 'Workplace exposure to toxic agents outside agriculture.', true),
  ('Z57.6', 57, 'Occupational exposure to extreme temperature', 'Workplace exposure to extreme heat or cold.', true),
  ('Z57.7', 57, 'Occupational exposure to vibration', 'Workplace exposure to vibration.', true),
  ('Z57.8', 57, 'Occupational exposure to other risk factors', 'Other specified occupational exposure risk factor.', true),
  ('Z57.9', 57, 'Occupational exposure to unspecified risk factor', 'Unspecified occupational exposure risk factor.', true),
  ('Z58.6', 58, 'Inadequate drinking-water supply', 'Problems related to inadequate drinking-water supply.', true),
  ('Z58.81', 58, 'Basic services unavailable in physical environment', 'Problems related to basic services being unavailable in the physical environment.', true),
  ('Z59.0', 59, 'Homelessness', 'Homelessness.', true),
  ('Z59.01', 59, 'Sheltered homelessness', 'Sheltered homelessness.', true),
  ('Z59.02', 59, 'Unsheltered homelessness', 'Unsheltered homelessness.', true),
  ('Z59.1', 59, 'Inadequate housing', 'Inadequate housing.', true),
  ('Z59.2', 59, 'Discord with neighbors, lodgers, or landlord', 'Discord with neighbors, lodgers, or landlord.', true),
  ('Z59.3', 59, 'Problem related to living in a residential institution', 'Problem related to living in a residential institution.', true),
  ('Z59.4', 59, 'Lack of adequate food or safe drinking water', 'Lack of adequate food or safe drinking water.', true),
  ('Z59.5', 59, 'Extreme poverty', 'Extreme poverty.', true),
  ('Z59.6', 59, 'Low income', 'Low income.', true),
  ('Z59.7', 59, 'Insufficient social insurance or welfare support', 'Insufficient social insurance or welfare support.', true),
  ('Z59.8', 59, 'Other specified problems related to housing and economic circumstances', 'Other specified housing or economic instability, including recent homelessness risk.', true),
  ('Z59.82', 59, 'Transportation insecurity', 'Transportation insecurity.', true),
  ('Z59.86', 59, 'Financial insecurity', 'Financial insecurity despite income level.', true),
  ('Z59.9', 59, 'Housing or economic problem, unspecified', 'Unspecified housing or economic problem.', true),
  ('Z60.0', 60, 'Phase of life problem', 'Phase of life problem.', true),
  ('Z60.2', 60, 'Problems related to living alone', 'Problems related to living alone.', true),
  ('Z60.3', 60, 'Acculturation difficulty', 'Acculturation difficulty.', true),
  ('Z60.4', 60, 'Social exclusion or rejection', 'Social exclusion or rejection.', true),
  ('Z60.5', 60, 'Target of perceived adverse discrimination or persecution', 'Perceived discrimination or persecution.', true),
  ('Z60.8', 60, 'Other specified problems related to social environment', 'Other specified social-environment problem, including inadequate emotional support.', true),
  ('Z62.0', 62, 'Inadequate parental supervision and control', 'Inadequate parental supervision and control.', true),
  ('Z62.1', 62, 'Parental overprotection', 'Parental overprotection.', true),
  ('Z62.21', 62, 'Child in welfare custody', 'Child in welfare custody.', true),
  ('Z62.22', 62, 'Institutional upbringing', 'Institutional upbringing.', true),
  ('Z62.3', 62, 'Hostility towards and scapegoating of child', 'Hostility towards or scapegoating of child.', true),
  ('Z62.6', 62, 'Inappropriate excessive parental pressure', 'Inappropriate excessive parental pressure.', true),
  ('Z62.810', 62, 'Personal history of physical and sexual abuse in childhood', 'Combined history of physical and sexual abuse in childhood.', true),
  ('Z62.811', 62, 'Personal history of psychological abuse in childhood', 'Psychological abuse in childhood.', true),
  ('Z62.812', 62, 'Personal history of neglect in childhood', 'Neglect in childhood.', true),
  ('Z62.813', 62, 'Personal history of forced labor or sexual exploitation in childhood', 'Forced labor or sexual exploitation in childhood.', true),
  ('Z62.814', 62, 'Personal history of child financial abuse', 'Child financial abuse history.', true),
  ('Z62.815', 62, 'Personal history of intimate partner abuse in childhood', 'Intimate partner abuse experienced in childhood.', true),
  ('Z62.819', 62, 'Personal history of unspecified abuse in childhood', 'Unspecified abuse in childhood.', true),
  ('Z62.82', 62, 'Parent-child conflict', 'Parent-child conflict.', true),
  ('Z62.89', 62, 'Other specified problems related to upbringing', 'Other specified upbringing problem, including estrangement or sibling rivalry.', true),
  ('Z62.9', 62, 'Problem related to upbringing, unspecified', 'Unspecified upbringing problem.', true),
  ('Z63.0', 63, 'Problems in relationship with spouse or partner', 'Relationship problems with spouse or partner.', true),
  ('Z63.1', 63, 'Problems in relationship with in-laws', 'Problems in relationship with in-laws.', true),
  ('Z63.31', 63, 'Absence of family member due to military deployment', 'Absence of family member due to military deployment.', true),
  ('Z63.32', 63, 'Other absence of family member', 'Other absence of family member.', true),
  ('Z63.4', 63, 'Disappearance and death of a family member', 'Includes assumed death of a family member and bereavement.', true),
  ('Z63.5', 63, 'Disruption of family by separation or divorce', 'Disruption of family by separation or divorce.', true),
  ('Z63.6', 63, 'Dependent relative needing care at home', 'Dependent relative needing care at home.', true),
  ('Z63.71', 63, 'Stress on family due to return of family member from military deployment', 'Stress on family due to a returning family member from deployment.', true),
  ('Z63.72', 63, 'Alcoholism and drug addiction in family', 'Alcoholism or drug addiction in family.', true),
  ('Z63.79', 63, 'Other stressful life events affecting family and household', 'Other stressful life events affecting family and household.', true),
  ('Z63.8', 63, 'Other specified problems related to primary support group', 'Other specified primary support group problem, including inadequate support or estrangement.', true),
  ('Z63.9', 63, 'Problem related to primary support group, unspecified', 'Unspecified primary support group problem.', true),
  ('Z64.0', 64, 'Problems related to unwanted pregnancy', 'Problems related to unwanted pregnancy.', true),
  ('Z64.1', 64, 'Problems related to multiparity', 'Problems related to multiparity.', true),
  ('Z64.4', 64, 'Discord with counselors', 'Discord with social service providers such as probation officers, case managers, or social workers.', true),
  ('Z65.0', 65, 'Conviction in civil or criminal proceedings without imprisonment', 'Conviction in civil or criminal proceedings without imprisonment.', true),
  ('Z65.1', 65, 'Imprisonment or other incarceration', 'Imprisonment or other incarceration.', true),
  ('Z65.2', 65, 'Problems related to release from prison', 'Problems related to release from prison.', true),
  ('Z65.3', 65, 'Problems related to other legal circumstances', 'Problems related to other legal circumstances.', true),
  ('Z65.4', 65, 'Victim of crime and terrorism or torture', 'Victim of crime, terrorism, or torture.', true),
  ('Z65.5', 65, 'Exposure to disaster, war, or other hostilities', 'Exposure to disaster, war, or other hostilities.', true),
  ('Z65.8', 65, 'Other specified problems related to psychosocial circumstances', 'Other specified psychosocial problem, including codependency, loneliness risk, or spiritual concerns.', true)
on conflict (z_code) do update
set z_group = excluded.z_group,
    title = excluded.title,
    description = excluded.description,
    is_active = excluded.is_active;

update atlas.z_codes
set is_active = false
where z_code = 'Z59.00';

with habitat_category as (
  select id from atlas.z_code_categories where category_key = 'habitat'
),
z58_codes as (
  select id
  from atlas.z_codes
  where z_group = 58
    and is_active = true
)
insert into atlas.z_code_category_map(z_code_id, category_id, weight)
select z58_codes.id, habitat_category.id, 1.0
from z58_codes
cross join habitat_category
on conflict (z_code_id, category_id) do update
set weight = excluded.weight;

create or replace view atlas.v_singlepane_enrollee_domain_load_breakdown as
with grouped as (
  select
    en.id as enrollment_id,
    p.display_name as full_name,
    upper('z' || substring(z.z_code from 2 for 2)) as z_code_group,
    case
      when substring(z.z_code from 2 for 2) in ('55', '56', '57') then 'work'
      when substring(z.z_code from 2 for 2) in ('58', '59') then 'habitat'
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
      when substring(z.z_code from 2 for 2) in ('58', '59') then 'habitat'
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

insert into atlas.app_config_documents (surface, config_key, version, payload)
values
  (
    'singlepane',
    'service_capacity_survey',
    '2026-z-burden-v2',
    $${
      "scale": [
        { "value": 1, "label": "major burden", "description": "We do not handle this and it creates major burden." },
        { "value": 2, "label": "rarely handled", "description": "We rarely handle this and it creates burden." },
        { "value": 3, "label": "poor fit", "description": "We are not a good fit for this." },
        { "value": 4, "label": "inconsistent fit", "description": "We sometimes handle this, but inconsistently." },
        { "value": 5, "label": "mixed fit", "description": "Mixed fit and depends on the situation." },
        { "value": 6, "label": "case by case", "description": "We can handle this in some cases." },
        { "value": 7, "label": "handles well", "description": "We handle this well." },
        { "value": 8, "label": "reliable fit", "description": "We handle this reliably." },
        { "value": 9, "label": "specialty area", "description": "This is a strong area of specialty for us." }
      ],
      "sections": []
    }$$::jsonb
  )
on conflict (surface, config_key, version) do update
set payload = excluded.payload;;
