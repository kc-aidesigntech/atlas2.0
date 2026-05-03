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
      "sections": [
        {
          "parentCode": "Z55",
          "theme": "Problems related to education and literacy",
          "prompts": [
            { "id": "z55-0", "parentCode": "Z55", "parentTheme": "Problems related to education and literacy", "zCode": "Z55.0", "normalizedZCode": "Z55.0", "title": "Z55.0", "description": "Illiteracy and low-level literacy" },
            { "id": "z55-1", "parentCode": "Z55", "parentTheme": "Problems related to education and literacy", "zCode": "Z55.1", "normalizedZCode": "Z55.1", "title": "Z55.1", "description": "Schooling unavailable and unattainable" },
            { "id": "z55-2", "parentCode": "Z55", "parentTheme": "Problems related to education and literacy", "zCode": "Z55.2", "normalizedZCode": "Z55.2", "title": "Z55.2", "description": "Failed school examinations" },
            { "id": "z55-3", "parentCode": "Z55", "parentTheme": "Problems related to education and literacy", "zCode": "Z55.3", "normalizedZCode": "Z55.3", "title": "Z55.3", "description": "Underachievement in school" },
            { "id": "z55-4", "parentCode": "Z55", "parentTheme": "Problems related to education and literacy", "zCode": "Z55.4", "normalizedZCode": "Z55.4", "title": "Z55.4", "description": "Educational maladjustment and discord w/ teachers and classmates" },
            { "id": "z55-5", "parentCode": "Z55", "parentTheme": "Problems related to education and literacy", "zCode": "Z55.5", "normalizedZCode": "Z55.5", "title": "Z55.5", "description": "Less than a high school diploma" },
            { "id": "z55-6", "parentCode": "Z55", "parentTheme": "Problems related to education and literacy", "zCode": "Z55.6", "normalizedZCode": "Z55.6", "title": "Z55.6", "description": "Problems related to health literacy" },
            { "id": "z55-8", "parentCode": "Z55", "parentTheme": "Problems related to education and literacy", "zCode": "Z55.8", "normalizedZCode": "Z55.8", "title": "Z55.8", "description": "Other specified problems related to education and literacy" },
            { "id": "z55-9", "parentCode": "Z55", "parentTheme": "Problems related to education and literacy", "zCode": "Z55.9", "normalizedZCode": "Z55.9", "title": "Z55.9", "description": "Problems related to education and literacy, unspecified" }
          ]
        },
        {
          "parentCode": "Z56",
          "theme": "Problems related to employment and unemployment",
          "prompts": [
            { "id": "z56-0", "parentCode": "Z56", "parentTheme": "Problems related to employment and unemployment", "zCode": "Z56.0", "normalizedZCode": "Z56.0", "title": "Z56.0", "description": "Unemployment, unspecified" },
            { "id": "z56-1", "parentCode": "Z56", "parentTheme": "Problems related to employment and unemployment", "zCode": "Z56.1", "normalizedZCode": "Z56.1", "title": "Z56.1", "description": "Change of job" },
            { "id": "z56-2", "parentCode": "Z56", "parentTheme": "Problems related to employment and unemployment", "zCode": "Z56.2", "normalizedZCode": "Z56.2", "title": "Z56.2", "description": "Threat of job loss" },
            { "id": "z56-3", "parentCode": "Z56", "parentTheme": "Problems related to employment and unemployment", "zCode": "Z56.3", "normalizedZCode": "Z56.3", "title": "Z56.3", "description": "Stressful work schedule" },
            { "id": "z56-4", "parentCode": "Z56", "parentTheme": "Problems related to employment and unemployment", "zCode": "Z56.4", "normalizedZCode": "Z56.4", "title": "Z56.4", "description": "Discord with boss and workmates" },
            { "id": "z56-5", "parentCode": "Z56", "parentTheme": "Problems related to employment and unemployment", "zCode": "Z56.5", "normalizedZCode": "Z56.5", "title": "Z56.5", "description": "Uncongenial work environment" },
            { "id": "z56-6", "parentCode": "Z56", "parentTheme": "Problems related to employment and unemployment", "zCode": "Z56.6", "normalizedZCode": "Z56.6", "title": "Z56.6", "description": "Other physical and mental strain related to work" },
            { "id": "z56-81", "parentCode": "Z56", "parentTheme": "Problems related to employment and unemployment", "zCode": "Z56.81", "normalizedZCode": "Z56.81", "title": "Z56.81", "description": "Sexual harassment on the job" },
            { "id": "z56-82", "parentCode": "Z56", "parentTheme": "Problems related to employment and unemployment", "zCode": "Z56.82", "normalizedZCode": "Z56.82", "title": "Z56.82", "description": "Military deployment status" },
            { "id": "z56-89", "parentCode": "Z56", "parentTheme": "Problems related to employment and unemployment", "zCode": "Z56.89", "normalizedZCode": "Z56.89", "title": "Z56.89", "description": "Other specified problems related to employment" },
            { "id": "z56-9", "parentCode": "Z56", "parentTheme": "Problems related to employment and unemployment", "zCode": "Z56.9", "normalizedZCode": "Z56.9", "title": "Z56.9", "description": "Problems related to employment, unspecified" }
          ]
        },
        {
          "parentCode": "Z57",
          "theme": "Occupational exposure to risk factors",
          "prompts": [
            { "id": "z57-0", "parentCode": "Z57", "parentTheme": "Occupational exposure to risk factors", "zCode": "Z57.0", "normalizedZCode": "Z57.0", "title": "Z57.0", "description": "Occupational exposure to noise" },
            { "id": "z57-1", "parentCode": "Z57", "parentTheme": "Occupational exposure to risk factors", "zCode": "Z57.1", "normalizedZCode": "Z57.1", "title": "Z57.1", "description": "Occupational exposure to radiation" },
            { "id": "z57-2", "parentCode": "Z57", "parentTheme": "Occupational exposure to risk factors", "zCode": "Z57.2", "normalizedZCode": "Z57.2", "title": "Z57.2", "description": "Occupational exposure to dust" },
            { "id": "z57-3", "parentCode": "Z57", "parentTheme": "Occupational exposure to risk factors", "zCode": "Z57.3", "normalizedZCode": "Z57.3", "title": "Z57.3", "description": "Occupational exposure to other air contaminants" },
            { "id": "z57-31", "parentCode": "Z57", "parentTheme": "Occupational exposure to risk factors", "zCode": "Z57.31", "normalizedZCode": "Z57.31", "title": "Z57.31", "description": "Occupational exposure to environmental tobacco smoke" },
            { "id": "z57-39", "parentCode": "Z57", "parentTheme": "Occupational exposure to risk factors", "zCode": "Z57.39", "normalizedZCode": "Z57.39", "title": "Z57.39", "description": "Occupational exposure to other air contaminants" },
            { "id": "z57-4", "parentCode": "Z57", "parentTheme": "Occupational exposure to risk factors", "zCode": "Z57.4", "normalizedZCode": "Z57.4", "title": "Z57.4", "description": "Occupational exposure to toxic agents in agriculture" },
            { "id": "z57-5", "parentCode": "Z57", "parentTheme": "Occupational exposure to risk factors", "zCode": "Z57.5", "normalizedZCode": "Z57.5", "title": "Z57.5", "description": "Occupational exposure to toxic agents in other industries" },
            { "id": "z57-6", "parentCode": "Z57", "parentTheme": "Occupational exposure to risk factors", "zCode": "Z57.6", "normalizedZCode": "Z57.6", "title": "Z57.6", "description": "Occupational exposure to extreme temperature" },
            { "id": "z57-7", "parentCode": "Z57", "parentTheme": "Occupational exposure to risk factors", "zCode": "Z57.7", "normalizedZCode": "Z57.7", "title": "Z57.7", "description": "Occupational exposure to vibration" },
            { "id": "z57-8", "parentCode": "Z57", "parentTheme": "Occupational exposure to risk factors", "zCode": "Z57.8", "normalizedZCode": "Z57.8", "title": "Z57.8", "description": "Occupational exposure to other risk factors" },
            { "id": "z57-9", "parentCode": "Z57", "parentTheme": "Occupational exposure to risk factors", "zCode": "Z57.9", "normalizedZCode": "Z57.9", "title": "Z57.9", "description": "Occupational exposure to unspecified risk factor" }
          ]
        },
        {
          "parentCode": "Z58",
          "theme": "Problems related to physical environment",
          "prompts": [
            { "id": "z58-6", "parentCode": "Z58", "parentTheme": "Problems related to physical environment", "zCode": "Z58.6", "normalizedZCode": "Z58.6", "title": "Z58.6", "description": "Inadequate drinking-water supply" },
            { "id": "z58-81", "parentCode": "Z58", "parentTheme": "Problems related to physical environment", "zCode": "Z58.81", "normalizedZCode": "Z58.81", "title": "Z58.81", "description": "Basic services unavailable in physical environment" }
          ]
        },
        {
          "parentCode": "Z59",
          "theme": "Problems related to housing and economic circumstances",
          "prompts": [
            { "id": "z59-0", "parentCode": "Z59", "parentTheme": "Problems related to housing and economic circumstances", "zCode": "Z59.0", "normalizedZCode": "Z59.0", "title": "Z59.0", "description": "Homelessness" },
            { "id": "z59-01", "parentCode": "Z59", "parentTheme": "Problems related to housing and economic circumstances", "zCode": "Z59.01", "normalizedZCode": "Z59.01", "title": "Z59.01", "description": "Sheltered homelessness" },
            { "id": "z59-02", "parentCode": "Z59", "parentTheme": "Problems related to housing and economic circumstances", "zCode": "Z59.02", "normalizedZCode": "Z59.02", "title": "Z59.02", "description": "Unsheltered homelessness" },
            { "id": "z59-1", "parentCode": "Z59", "parentTheme": "Problems related to housing and economic circumstances", "zCode": "Z59.1", "normalizedZCode": "Z59.1", "title": "Z59.1", "description": "Inadequate housing" },
            { "id": "z59-2", "parentCode": "Z59", "parentTheme": "Problems related to housing and economic circumstances", "zCode": "Z59.2", "normalizedZCode": "Z59.2", "title": "Z59.2", "description": "Discord with neighbors, lodgers, or landlord" },
            { "id": "z59-3", "parentCode": "Z59", "parentTheme": "Problems related to housing and economic circumstances", "zCode": "Z59.3", "normalizedZCode": "Z59.3", "title": "Z59.3", "description": "Problem related to living in a residential institution" },
            { "id": "z59-4", "parentCode": "Z59", "parentTheme": "Problems related to housing and economic circumstances", "zCode": "Z59.4", "normalizedZCode": "Z59.4", "title": "Z59.4", "description": "Lack of adequate food or safe drinking water" },
            { "id": "z59-5", "parentCode": "Z59", "parentTheme": "Problems related to housing and economic circumstances", "zCode": "Z59.5", "normalizedZCode": "Z59.5", "title": "Z59.5", "description": "Extreme poverty" },
            { "id": "z59-6", "parentCode": "Z59", "parentTheme": "Problems related to housing and economic circumstances", "zCode": "Z59.6", "normalizedZCode": "Z59.6", "title": "Z59.6", "description": "Low income" },
            { "id": "z59-7", "parentCode": "Z59", "parentTheme": "Problems related to housing and economic circumstances", "zCode": "Z59.7", "normalizedZCode": "Z59.7", "title": "Z59.7", "description": "Insufficient social insurance or welfare support" },
            { "id": "z59-8", "parentCode": "Z59", "parentTheme": "Problems related to housing and economic circumstances", "zCode": "Z59.8", "normalizedZCode": "Z59.8", "title": "Z59.8", "description": "Other specified problems related to housing and economic circumstances" },
            { "id": "z59-82", "parentCode": "Z59", "parentTheme": "Problems related to housing and economic circumstances", "zCode": "Z59.82", "normalizedZCode": "Z59.82", "title": "Z59.82", "description": "Transportation insecurity" },
            { "id": "z59-86", "parentCode": "Z59", "parentTheme": "Problems related to housing and economic circumstances", "zCode": "Z59.86", "normalizedZCode": "Z59.86", "title": "Z59.86", "description": "Financial insecurity" },
            { "id": "z59-9", "parentCode": "Z59", "parentTheme": "Problems related to housing and economic circumstances", "zCode": "Z59.9", "normalizedZCode": "Z59.9", "title": "Z59.9", "description": "Housing or economic problem, unspecified" }
          ]
        },
        {
          "parentCode": "Z60",
          "theme": "Problems related to social environment",
          "prompts": [
            { "id": "z60-0", "parentCode": "Z60", "parentTheme": "Problems related to social environment", "zCode": "Z60.0", "normalizedZCode": "Z60.0", "title": "Z60.0", "description": "Phase of life problem" },
            { "id": "z60-2", "parentCode": "Z60", "parentTheme": "Problems related to social environment", "zCode": "Z60.2", "normalizedZCode": "Z60.2", "title": "Z60.2", "description": "Problems related to living alone" },
            { "id": "z60-3", "parentCode": "Z60", "parentTheme": "Problems related to social environment", "zCode": "Z60.3", "normalizedZCode": "Z60.3", "title": "Z60.3", "description": "Acculturation difficulty" },
            { "id": "z60-4", "parentCode": "Z60", "parentTheme": "Problems related to social environment", "zCode": "Z60.4", "normalizedZCode": "Z60.4", "title": "Z60.4", "description": "Social exclusion or rejection" },
            { "id": "z60-5", "parentCode": "Z60", "parentTheme": "Problems related to social environment", "zCode": "Z60.5", "normalizedZCode": "Z60.5", "title": "Z60.5", "description": "Target of perceived adverse discrimination or persecution" },
            { "id": "z60-8", "parentCode": "Z60", "parentTheme": "Problems related to social environment", "zCode": "Z60.8", "normalizedZCode": "Z60.8", "title": "Z60.8", "description": "Other specified problems related to social environment" }
          ]
        },
        {
          "parentCode": "Z62",
          "theme": "Problems related to upbringing",
          "prompts": [
            { "id": "z62-0", "parentCode": "Z62", "parentTheme": "Problems related to upbringing", "zCode": "Z62.0", "normalizedZCode": "Z62.0", "title": "Z62.0", "description": "Inadequate parental supervision and control" },
            { "id": "z62-1", "parentCode": "Z62", "parentTheme": "Problems related to upbringing", "zCode": "Z62.1", "normalizedZCode": "Z62.1", "title": "Z62.1", "description": "Parental overprotection" },
            { "id": "z62-21", "parentCode": "Z62", "parentTheme": "Problems related to upbringing", "zCode": "Z62.21", "normalizedZCode": "Z62.21", "title": "Z62.21", "description": "Child in welfare custody" },
            { "id": "z62-22", "parentCode": "Z62", "parentTheme": "Problems related to upbringing", "zCode": "Z62.22", "normalizedZCode": "Z62.22", "title": "Z62.22", "description": "Institutional upbringing" },
            { "id": "z62-3", "parentCode": "Z62", "parentTheme": "Problems related to upbringing", "zCode": "Z62.3", "normalizedZCode": "Z62.3", "title": "Z62.3", "description": "Hostility towards and scapegoating of child" },
            { "id": "z62-6", "parentCode": "Z62", "parentTheme": "Problems related to upbringing", "zCode": "Z62.6", "normalizedZCode": "Z62.6", "title": "Z62.6", "description": "Inappropriate excessive parental pressure" },
            { "id": "z62-810-physical-history", "parentCode": "Z62", "parentTheme": "Problems related to upbringing", "zCode": "Z62.810*", "normalizedZCode": "Z62.810", "title": "Z62.810*", "description": "Personal history of physical abuse in childhood" },
            { "id": "z62-810-sexual-history", "parentCode": "Z62", "parentTheme": "Problems related to upbringing", "zCode": "Z62.810*", "normalizedZCode": "Z62.810", "title": "Z62.810*", "description": "Personal history of sexual abuse in childhood" },
            { "id": "z62-810-combined", "parentCode": "Z62", "parentTheme": "Problems related to upbringing", "zCode": "Z62.810", "normalizedZCode": "Z62.810", "title": "Z62.810", "description": "Personal history of physical and sexual abuse in childhood" },
            { "id": "z62-811", "parentCode": "Z62", "parentTheme": "Problems related to upbringing", "zCode": "Z62.811", "normalizedZCode": "Z62.811", "title": "Z62.811", "description": "Personal history of psychological abuse in childhood" },
            { "id": "z62-812", "parentCode": "Z62", "parentTheme": "Problems related to upbringing", "zCode": "Z62.812", "normalizedZCode": "Z62.812", "title": "Z62.812", "description": "Personal history of neglect in childhood" },
            { "id": "z62-813", "parentCode": "Z62", "parentTheme": "Problems related to upbringing", "zCode": "Z62.813", "normalizedZCode": "Z62.813", "title": "Z62.813", "description": "Personal history of forced labor or sexual exploitation in childhood" },
            { "id": "z62-814", "parentCode": "Z62", "parentTheme": "Problems related to upbringing", "zCode": "Z62.814", "normalizedZCode": "Z62.814", "title": "Z62.814", "description": "Personal history of child financial abuse" },
            { "id": "z62-815", "parentCode": "Z62", "parentTheme": "Problems related to upbringing", "zCode": "Z62.815", "normalizedZCode": "Z62.815", "title": "Z62.815", "description": "Personal history of intimate partner abuse in childhood" },
            { "id": "z62-819", "parentCode": "Z62", "parentTheme": "Problems related to upbringing", "zCode": "Z62.819", "normalizedZCode": "Z62.819", "title": "Z62.819", "description": "Personal history of unspecified abuse in childhood" },
            { "id": "z62-82", "parentCode": "Z62", "parentTheme": "Problems related to upbringing", "zCode": "Z62.82", "normalizedZCode": "Z62.82", "title": "Z62.82", "description": "Parent-child conflict" },
            { "id": "z62-89", "parentCode": "Z62", "parentTheme": "Problems related to upbringing", "zCode": "Z62.89", "normalizedZCode": "Z62.89", "title": "Z62.89", "description": "Other specified problems related to upbringing" },
            { "id": "z62-9", "parentCode": "Z62", "parentTheme": "Problems related to upbringing", "zCode": "Z62.9", "normalizedZCode": "Z62.9", "title": "Z62.9", "description": "Problem related to upbringing, unspecified" }
          ]
        },
        {
          "parentCode": "Z63",
          "theme": "Problems related to primary support group and family circumstances",
          "prompts": [
            { "id": "z63-0", "parentCode": "Z63", "parentTheme": "Problems related to primary support group and family circumstances", "zCode": "Z63.0", "normalizedZCode": "Z63.0", "title": "Z63.0", "description": "Problems in relationship with spouse or partner" },
            { "id": "z63-1", "parentCode": "Z63", "parentTheme": "Problems related to primary support group and family circumstances", "zCode": "Z63.1", "normalizedZCode": "Z63.1", "title": "Z63.1", "description": "Problems in relationship with in-laws" },
            { "id": "z63-31", "parentCode": "Z63", "parentTheme": "Problems related to primary support group and family circumstances", "zCode": "Z63.31", "normalizedZCode": "Z63.31", "title": "Z63.31", "description": "Absence of family member due to military deployment" },
            { "id": "z63-32", "parentCode": "Z63", "parentTheme": "Problems related to primary support group and family circumstances", "zCode": "Z63.32", "normalizedZCode": "Z63.32", "title": "Z63.32", "description": "Other absence of family member" },
            { "id": "z63-4", "parentCode": "Z63", "parentTheme": "Problems related to primary support group and family circumstances", "zCode": "Z63.4", "normalizedZCode": "Z63.4", "title": "Z63.4", "description": "Disappearance and death of a family member" },
            { "id": "z63-5", "parentCode": "Z63", "parentTheme": "Problems related to primary support group and family circumstances", "zCode": "Z63.5", "normalizedZCode": "Z63.5", "title": "Z63.5", "description": "Disruption of family by separation or divorce" },
            { "id": "z63-6", "parentCode": "Z63", "parentTheme": "Problems related to primary support group and family circumstances", "zCode": "Z63.6", "normalizedZCode": "Z63.6", "title": "Z63.6", "description": "Dependent relative needing care at home" },
            { "id": "z63-71", "parentCode": "Z63", "parentTheme": "Problems related to primary support group and family circumstances", "zCode": "Z63.71", "normalizedZCode": "Z63.71", "title": "Z63.71", "description": "Stress on family due to return of family member from military deployment" },
            { "id": "z63-72", "parentCode": "Z63", "parentTheme": "Problems related to primary support group and family circumstances", "zCode": "Z63.72", "normalizedZCode": "Z63.72", "title": "Z63.72", "description": "Alcoholism and drug addiction in family" },
            { "id": "z63-79", "parentCode": "Z63", "parentTheme": "Problems related to primary support group and family circumstances", "zCode": "Z63.79", "normalizedZCode": "Z63.79", "title": "Z63.79", "description": "Other stressful life events affecting family and household" },
            { "id": "z63-8", "parentCode": "Z63", "parentTheme": "Problems related to primary support group and family circumstances", "zCode": "Z63.8", "normalizedZCode": "Z63.8", "title": "Z63.8", "description": "Other specified problems related to primary support group" },
            { "id": "z63-9", "parentCode": "Z63", "parentTheme": "Problems related to primary support group and family circumstances", "zCode": "Z63.9", "normalizedZCode": "Z63.9", "title": "Z63.9", "description": "Problem related to primary support group, unspecified" }
          ]
        },
        {
          "parentCode": "Z64",
          "theme": "Problems related to certain psychosocial circumstances",
          "prompts": [
            { "id": "z64-0", "parentCode": "Z64", "parentTheme": "Problems related to certain psychosocial circumstances", "zCode": "Z64.0", "normalizedZCode": "Z64.0", "title": "Z64.0", "description": "Problems related to unwanted pregnancy" },
            { "id": "z64-1", "parentCode": "Z64", "parentTheme": "Problems related to certain psychosocial circumstances", "zCode": "Z64.1", "normalizedZCode": "Z64.1", "title": "Z64.1", "description": "Problems related to multiparity" },
            { "id": "z64-4", "parentCode": "Z64", "parentTheme": "Problems related to certain psychosocial circumstances", "zCode": "Z64.4", "normalizedZCode": "Z64.4", "title": "Z64.4", "description": "Discord with counselors" }
          ]
        },
        {
          "parentCode": "Z65",
          "theme": "Problems related to other psychosocial circumstances",
          "prompts": [
            { "id": "z65-0", "parentCode": "Z65", "parentTheme": "Problems related to other psychosocial circumstances", "zCode": "Z65.0", "normalizedZCode": "Z65.0", "title": "Z65.0", "description": "Conviction in civil or criminal proceedings without imprisonment" },
            { "id": "z65-1", "parentCode": "Z65", "parentTheme": "Problems related to other psychosocial circumstances", "zCode": "Z65.1", "normalizedZCode": "Z65.1", "title": "Z65.1", "description": "Imprisonment or other incarceration" },
            { "id": "z65-2", "parentCode": "Z65", "parentTheme": "Problems related to other psychosocial circumstances", "zCode": "Z65.2", "normalizedZCode": "Z65.2", "title": "Z65.2", "description": "Problems related to release from prison" },
            { "id": "z65-3", "parentCode": "Z65", "parentTheme": "Problems related to other psychosocial circumstances", "zCode": "Z65.3", "normalizedZCode": "Z65.3", "title": "Z65.3", "description": "Problems related to other legal circumstances" },
            { "id": "z65-4", "parentCode": "Z65", "parentTheme": "Problems related to other psychosocial circumstances", "zCode": "Z65.4", "normalizedZCode": "Z65.4", "title": "Z65.4", "description": "Victim of crime and terrorism or torture" },
            { "id": "z65-5", "parentCode": "Z65", "parentTheme": "Problems related to other psychosocial circumstances", "zCode": "Z65.5", "normalizedZCode": "Z65.5", "title": "Z65.5", "description": "Exposure to disaster, war, or other hostilities" },
            { "id": "z65-8", "parentCode": "Z65", "parentTheme": "Problems related to other psychosocial circumstances", "zCode": "Z65.8", "normalizedZCode": "Z65.8", "title": "Z65.8", "description": "Other specified problems related to psychosocial circumstances" }
          ]
        }
      ]
    }$$::jsonb
  )
on conflict (surface, config_key, version) do update
set payload = excluded.payload;
