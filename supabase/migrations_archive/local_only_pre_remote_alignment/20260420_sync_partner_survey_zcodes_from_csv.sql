with source(id, z_code, z_group, title, description, is_active) as (
    values
    ('95c5e1e3-e124-4e35-b01b-132ce7784170'::uuid, 'Z55.0', 55, 'Illiteracy and low-level literacy', 'Problems related to reading and writing literacy.', true),
    ('bd41caba-c2a0-4050-afb6-fc1f1d61c009'::uuid, 'Z55.1', 55, 'Schooling unavailable and unattainable', 'Problems related to access to schooling.', true),
    ('0a93615d-ec39-4920-b418-939d4e1e4fd4'::uuid, 'Z55.2', 55, 'Failed school examinations', 'Problems related to failing required school examinations.', true),
    ('2577380c-5db1-42b7-879f-8ce3c0696529'::uuid, 'Z55.3', 55, 'Underachievement in school', 'Problems related to persistent academic underachievement.', true),
    ('05fd3f07-8f92-4376-b523-3b0ccd166c79'::uuid, 'Z55.4', 55, 'Educational maladjustment and discord w/ teachers and classmates', 'Problems related to discord with teachers and classmates.', true),
    ('db2c6d2a-8e6f-492f-b147-48d552b46e3f'::uuid, 'Z55.5', 55, 'Less than a high school diploma', 'Problems related to limited educational attainment.', true),
    ('ef9f7f03-5234-4608-ac1b-6d4282da5d3a'::uuid, 'Z55.6', 55, 'Problems related to health literacy', 'Difficulty understanding medication instructions or completing medical forms.', true),
    ('1aec2f32-4458-4683-b190-be84c4f444e9'::uuid, 'Z55.8', 55, 'Other specified problems related to education and literacy (i.e. - difficulty due to inadequate teaching)', 'Other specified education or literacy barriers, including inadequate teaching.', true),
    ('f5dadf80-81b0-45a7-ac57-10ab6c91ef0e'::uuid, 'Z55.9', 55, 'Problems related to education and literacy, unspecified', 'Unspecified education or literacy problem.', true),
    ('bde30412-96a7-485c-98f1-4d1e530ff35c'::uuid, 'Z56.0', 56, 'Unemployment, unspecified', 'Unspecified unemployment problem.', true),
    ('3b2846b4-02f7-4d80-bf38-b7adec938868'::uuid, 'Z56.1', 56, 'Change of job', 'Problems related to job change.', true),
    ('60d1318f-d636-4b35-ad76-e4db195f618b'::uuid, 'Z56.2', 56, 'Threat of job loss', 'Problems related to possible job loss.', true),
    ('de64c3c3-2e7f-4ef4-8984-27db36d68ae4'::uuid, 'Z56.3', 56, 'Stressful work schedule', 'Problems related to stressful work hours or schedule.', true),
    ('ad251354-a36e-46e2-9a8a-e655f645c463'::uuid, 'Z56.4', 56, 'Discord with boss and workmates', 'Problems related to workplace conflict.', true),
    ('d437821c-013b-47cc-9715-a2aec1cd9f1b'::uuid, 'Z56.5', 56, 'Uncongenial work environment', 'Problems related to an uncongenial work environment.', true),
    ('63480d46-2b88-48a8-a5b4-654e2308e729'::uuid, 'Z56.6', 56, 'Other physical and mental strain related to work', 'Work-related physical or mental strain.', true),
    ('095694a0-d4fb-47c1-810e-ee9514e026f0'::uuid, 'Z56.81', 56, 'Sexual harassment on the job', 'Sexual harassment in the workplace.', true),
    ('677574a4-5959-43c4-ac18-30f711332abe'::uuid, 'Z56.82', 56, 'Military deployment status', 'Problems related to military deployment status.', true),
    ('37279033-a59d-4553-9566-d68c8400ffbf'::uuid, 'Z56.89', 56, 'Other specified problems related to employment  (i.e. - furloughed or underemployed)', 'Other specified employment problem, including furlough or underemployment.', true),
    ('4e8ec0ce-fa85-4742-87cc-35956eaa93ea'::uuid, 'Z56.9', 56, 'Problems related to employment, unspecified', 'Unspecified employment problem.', true),
    ('1fc5b046-45d3-442f-a49f-26eefabd7bf2'::uuid, 'Z57.0', 57, 'Occupational exposure to noise', 'Workplace exposure to noise.', true),
    ('9c3672ee-cd28-4eef-aaf8-79bec24f4ac1'::uuid, 'Z57.1', 57, 'Occupational exposure to radiation', 'Workplace exposure to radiation.', true),
    ('9d879922-794b-49c7-aae6-16cd5af25075'::uuid, 'Z57.2', 57, 'Occupational exposure to dust', 'Workplace exposure to dust.', true),
    ('9ad9e7d9-4719-4a58-bf08-5947a5431a10'::uuid, 'Z57.3', 57, 'Occupational exposure to other air contaminants', 'Workplace exposure to air contaminants.', true),
    ('0ca4aff8-e1dc-43d4-9b22-d0ef16ae2b47'::uuid, 'Z57.31', 57, 'Occupational exposure to environmental tobacco smoke', 'Workplace exposure to secondhand tobacco smoke.', true),
    ('f008a023-6595-4010-b4fa-dc5bbec80c44'::uuid, 'Z57.39', 57, 'Occupational exposure to other air contaminants', 'Workplace exposure to polluted air or similar contaminants.', true),
    ('06d44880-bb69-417e-92c7-65a66f05e72f'::uuid, 'Z57.4', 57, 'Occupational exposure to toxic agents in agriculture', 'Workplace exposure to agricultural toxic agents.', true),
    ('0aa5d825-02fe-4e05-99b1-821eb4e81fe2'::uuid, 'Z57.5', 57, 'Occupational exposure to toxic agents in other industries', 'Workplace exposure to toxic agents outside agriculture.', true),
    ('289c9b56-13ab-4054-9687-3e98647836b6'::uuid, 'Z57.6', 57, 'Occupational exposure to extreme temperature', 'Workplace exposure to extreme heat or cold.', true),
    ('60a095a1-551b-46e9-a6df-23bdb034a5cf'::uuid, 'Z57.7', 57, 'Occupational exposure to vibration', 'Workplace exposure to vibration.', true),
    ('f8bb5ce2-ad29-4d8c-8415-b815cda34ce0'::uuid, 'Z57.8', 57, 'Occupational exposure to other risk factors (i.e., specific chemicals not listed elsewhere)', 'Other specified occupational exposure risk factor.', true),
    ('e4980404-b16d-42ea-9fcb-012c72161fb4'::uuid, 'Z57.9', 57, 'Occupational exposure to unspecified risk factor', 'Unspecified occupational exposure risk factor.', true),
    ('6080564b-f32a-46e7-a780-82f602c04ed7'::uuid, 'Z58.6', 58, 'Inadequate drinking-water supply', 'Problems related to inadequate drinking-water supply.', true),
    ('e019c20f-ea60-47bf-97c1-4a54af39c358'::uuid, 'Z58.81', 58, 'Basic services unavailable in physical environment', 'Problems related to basic services being unavailable in the physical environment.', true),
    ('3420e4f6-10fd-4550-ae21-fe71d7775a86'::uuid, 'Z59.0', 59, 'Homelessness (i.e.,indicates person is homeless, but does not provide specific details on whether they are in a shelter or on the street.)', 'Homelessness.', true),
    ('0119f2f3-b7fc-4f12-a00c-90188501e717'::uuid, 'Z59.01', 59, 'Sheltered homelessness (i.e., indicates living in shelters or motels)', 'Sheltered homelessness.', true),
    ('f243b881-54cd-4558-8f36-81b9a688d095'::uuid, 'Z59.02', 59, 'Unsheltered homelessness (i.e., indicates living in places not meant for habitation)', 'Unsheltered homelessness.', true),
    ('4cbdcfb4-1510-4816-87c1-d2ad749b1531'::uuid, 'Z59.1', 59, 'Inadequate housing', 'Inadequate housing.', true),
    ('9681c78c-4e57-4174-8a17-6798839325fb'::uuid, 'Z59.2', 59, 'Discord with neighbors, lodgers, or landlord', 'Discord with neighbors, lodgers, or landlord.', true),
    ('b35f646d-33dd-4f13-a83a-bedfbbf56d48'::uuid, 'Z59.3', 59, 'Problem related to living in a residential institution', 'Problem related to living in a residential institution.', true),
    ('92f5766d-efd2-4a58-a9ba-f04dcfc4c5e9'::uuid, 'Z59.4', 59, 'Lack of adequate food or safe drinking water', 'Lack of adequate food or safe drinking water.', true),
    ('8bf12fb2-7942-4b11-932e-47a58072fe28'::uuid, 'Z59.5', 59, 'Extreme poverty', 'Extreme poverty.', true),
    ('08a63d18-8641-4cab-86a8-d27ff71a4b17'::uuid, 'Z59.6', 59, 'Low income', 'Low income.', true),
    ('bab69dce-71e5-47f0-a3c5-adedd998820b'::uuid, 'Z59.7', 59, 'Insufficient social insurance or welfare support', 'Insufficient social insurance or welfare support.', true),
    ('17b82b70-5909-4f8d-b966-417a9f626e65'::uuid, 'Z59.8', 59, 'Other specified problems related to housing and economic circumstances (i.e. - risk of homelessness, housing instability, homeless within the past 12 months)', 'Other specified housing or economic instability, including recent homelessness risk.', true),
    ('dc1d91b2-8b5f-4002-aebf-8b1b32fa589b'::uuid, 'Z59.82', 59, 'Transportation insecurity', 'Transportation insecurity.', true),
    ('4fd98e93-d767-4d19-bb3f-d144b088655c'::uuid, 'Z59.86', 59, 'Financial insecurity (despite income level)', 'Financial insecurity despite income level.', true),
    ('d1bef233-cff5-41c9-a7c4-6dde8d87cc87'::uuid, 'Z59.9', 59, 'Housing or economic problem, unspecified', 'Unspecified housing or economic problem.', true),
    ('eea4f68f-a34f-41c4-a62b-7dc2e536e755'::uuid, 'Z60.0', 60, 'Phase of life problem', 'Phase of life problem.', true),
    ('615a0cfa-769a-463d-b9f2-f8cbb9d60e3e'::uuid, 'Z60.2', 60, 'Problems related to living alone', 'Problems related to living alone.', true),
    ('6d839749-bc97-4419-b414-f62d2e8183f2'::uuid, 'Z60.3', 60, 'Acculturation difficulty', 'Acculturation difficulty.', true),
    ('00e36b28-6d1f-4e66-9a74-3e3bcb21d9aa'::uuid, 'Z60.4', 60, 'Social exclusion or rejection', 'Social exclusion or rejection.', true),
    ('c7478a24-8893-40db-ab7e-14783b4d4ff5'::uuid, 'Z60.5', 60, 'Target of perceived adverse discrimination or persecution', 'Perceived discrimination or persecution.', true),
    ('dbe3bb3c-3c68-4027-a98b-ce76b088d3dd'::uuid, 'Z60.8', 60, 'Other specified problems related to social environment (i.e. - Inadequate social support, lack of emotional support)', 'Other specified social-environment problem, including inadequate emotional support.', true),
    ('7ee242ca-9600-42ba-806a-e361685d58a6'::uuid, 'Z62.0', 62, 'Inadequate parental supervision and control', 'Inadequate parental supervision and control.', true),
    ('14b08f3a-daef-4005-a0c9-e996c55bcec0'::uuid, 'Z62.1', 62, 'Parental overprotection', 'Parental overprotection.', true),
    ('a17fd0da-016e-462e-b743-abf46fc83658'::uuid, 'Z62.21', 62, 'Child in welfare custody', 'Child in welfare custody.', true),
    ('f639fa1b-76c4-48c5-9c3a-f8ca26c58265'::uuid, 'Z62.22', 62, 'Institutional upbringing', 'Institutional upbringing.', true),
    ('655547b0-917f-44dd-9e42-605666b661cc'::uuid, 'Z62.3', 62, 'Hostility towards and scapegoating of child', 'Hostility towards or scapegoating of child.', true),
    ('6b4915c4-f0f6-4ec1-9fdb-2caaa4b3412a'::uuid, 'Z62.6', 62, 'Inappropriate excessive parental pressure', 'Inappropriate excessive parental pressure.', true),
    ('6990992e-b5b1-4bfe-bca7-bd1713fefc23'::uuid, 'Z62.810', 62, 'Personal history of physical and sexual abuse in childhood', 'Combined history of physical and sexual abuse in childhood.', true),
    ('89b313d3-7c99-4fb7-af24-0c9209f49fdf'::uuid, 'Z62.811', 62, 'Personal history of psychological abuse in childhood', 'Psychological abuse in childhood.', true),
    ('dde2e846-9259-4a4a-8d13-d910932c9581'::uuid, 'Z62.812', 62, 'Personal history of neglect in childhood', 'Neglect in childhood.', true),
    ('6e70b054-0ae9-44ea-8ee8-5c57ecb08e80'::uuid, 'Z62.813', 62, 'Personal history of forced labor or sexual exploitation in childhood', 'Forced labor or sexual exploitation in childhood.', true),
    ('21dfd754-4120-476e-90dd-8228b659f997'::uuid, 'Z62.814', 62, 'Personal history of child financial abuse', 'Child financial abuse history.', true),
    ('b68c40d2-c5b2-4489-bfbf-ae4e62d39ad1'::uuid, 'Z62.815', 62, 'Personal history of intimate partner abuse in childhood', 'Intimate partner abuse experienced in childhood.', true),
    ('8fbc581f-059a-494a-bc97-a647cf83b7bc'::uuid, 'Z62.819', 62, 'Personal history of unspecified abuse in childhood', 'Unspecified abuse in childhood.', true),
    ('73c357cc-f9ea-4c10-95da-d622dd7b9396'::uuid, 'Z62.82', 62, 'Parent-child conflict', 'Parent-child conflict.', true),
    ('6fc417cc-8f00-4055-8971-e534892c85ab'::uuid, 'Z62.89', 62, 'Other specified problems related to upbringing (i.e. - parent-child estrangement, sibling rivalry, running away, etc.)', 'Other specified upbringing problem, including estrangement or sibling rivalry.', true),
    ('a8bcd88f-983d-4d15-9eba-f41c0cd6c96f'::uuid, 'Z62.9', 62, 'Problem related to upbringing, unspecified', 'Unspecified upbringing problem.', true),
    ('208f47b2-fbea-4233-b1f0-ab0e1ec9b0e9'::uuid, 'Z63.0', 63, 'Problems in relationship with spouse or partner', 'Relationship problems with spouse or partner.', true),
    ('5fb8ec18-dfff-4c4b-9a42-25488728022e'::uuid, 'Z63.1', 63, 'Problems in relationship with in-laws', 'Problems in relationship with in-laws.', true),
    ('07df290f-d8ac-4a70-b6d3-4bd1e6adebc1'::uuid, 'Z63.31', 63, 'Absence of family member due to military deployment', 'Absence of family member due to military deployment.', true),
    ('e5a7de5d-0544-4636-b5fa-4e0b5e021291'::uuid, 'Z63.32', 63, 'Other absence of family member', 'Other absence of family member.', true),
    ('b8a656f3-17cc-4783-a3a9-3a8727d5e4b4'::uuid, 'Z63.4', 63, 'Disappearance and death of a family member (includes assumed death of a family member & bereavement)', 'Includes assumed death of a family member and bereavement.', true),
    ('98e21e90-c678-4624-9dae-8d47b7de09e3'::uuid, 'Z63.5', 63, 'Disruption of family by separation or divorce', 'Disruption of family by separation or divorce.', true),
    ('2c2843e4-7639-482a-8686-5b99b30af87e'::uuid, 'Z63.6', 63, 'Dependent relative needing care at home', 'Dependent relative needing care at home.', true),
    ('3e8be793-a893-41f9-817f-fa7fcbd88c06'::uuid, 'Z63.71', 63, 'Stress on family due to return of family member from military deployment', 'Stress on family due to a returning family member from deployment.', true),
    ('fbc18880-4c66-470e-84be-e7e61a6334b7'::uuid, 'Z63.72', 63, 'Alcoholism and drug addiction in family', 'Alcoholism or drug addiction in family.', true),
    ('6c281269-b076-4fc8-9af0-818d1e189608'::uuid, 'Z63.79', 63, 'Other stressful life events affecting family and household', 'Other stressful life events affecting family and household.', true),
    ('ef38e2a7-4575-46fe-a72a-508401674142'::uuid, 'Z63.8', 63, 'Other specified problems related to primary support group (i.e. - inadequate support, discord with or estrangement from family)', 'Other specified primary support group problem, including inadequate support or estrangement.', true),
    ('669afc60-447a-4aa4-acb6-08a3bb7e3294'::uuid, 'Z63.9', 63, 'Problem related to primary support group, unspecified', 'Unspecified primary support group problem.', true),
    ('e12f694d-02cf-43bf-9268-a5f507db16cc'::uuid, 'Z64.0', 64, 'Problems related to unwanted pregnancy', 'Problems related to unwanted pregnancy.', true),
    ('98881652-6516-468c-89d2-4bdfec6a081a'::uuid, 'Z64.1', 64, 'Problems related to multiparity', 'Problems related to multiparity.', true),
    ('ba1a165b-c889-40fa-8935-0ffc464e61ce'::uuid, 'Z64.4', 64, 'Discord with counselors (social service provider/s: probation officer/s, case manager/s, social worker/s, etc.)', 'Discord with social service providers such as probation officers, case managers, or social workers.', true),
    ('28aecdfd-9ad1-4200-b2f3-53e1c08becc7'::uuid, 'Z65.0', 65, 'Conviction in civil or criminal proceedings without imprisonment', 'Conviction in civil or criminal proceedings without imprisonment.', true),
    ('2b28aab0-1038-4007-95de-901658108018'::uuid, 'Z65.1', 65, 'Imprisonment or other incarceration', 'Imprisonment or other incarceration.', true),
    ('65d7329f-05b4-452f-8722-7aecc3c7d360'::uuid, 'Z65.2', 65, 'Problems related to release from prison', 'Problems related to release from prison.', true),
    ('c31411ab-4d22-483a-8317-241b8b0f38e2'::uuid, 'Z65.3', 65, 'Problems related to other legal circumstances', 'Problems related to other legal circumstances.', true),
    ('d9360902-c445-4c6c-9b62-ce5d885358a9'::uuid, 'Z65.4', 65, 'Victim of crime and terrorism or torture', 'Victim of crime, terrorism, or torture.', true),
    ('3b7bd591-3e53-47ae-9436-8ae262551ff9'::uuid, 'Z65.5', 65, 'Exposure to disaster, war, or other hostilities', 'Exposure to disaster, war, or other hostilities.', true),
    ('34d8dd67-ae21-41b4-b43a-be8a82255c14'::uuid, 'Z65.8', 65, 'Other specified problems related to psychosocial circumstances (codependency, risk for feeling loneliness or spiritual or religious problems)', 'Other specified psychosocial problem, including codependency, loneliness risk, or spiritual concerns.', true)
  ),
  upserted as (
    insert into atlas.z_codes (id, z_code, z_group, title, description, is_active)
    select id, z_code, z_group, title, description, is_active
    from source
    on conflict (z_code) do update
      set z_group = excluded.z_group,
          title = excluded.title,
          description = excluded.description,
          is_active = excluded.is_active
    returning z_code
  ),
  deactivated as (
    update atlas.z_codes
    set is_active = false
    where z_code not in ('Z55.0', 'Z55.1', 'Z55.2', 'Z55.3', 'Z55.4', 'Z55.5', 'Z55.6', 'Z55.8', 'Z55.9', 'Z56.0', 'Z56.1', 'Z56.2', 'Z56.3', 'Z56.4', 'Z56.5', 'Z56.6', 'Z56.81', 'Z56.82', 'Z56.89', 'Z56.9', 'Z57.0', 'Z57.1', 'Z57.2', 'Z57.3', 'Z57.31', 'Z57.39', 'Z57.4', 'Z57.5', 'Z57.6', 'Z57.7', 'Z57.8', 'Z57.9', 'Z58.6', 'Z58.81', 'Z59.0', 'Z59.01', 'Z59.02', 'Z59.1', 'Z59.2', 'Z59.3', 'Z59.4', 'Z59.5', 'Z59.6', 'Z59.7', 'Z59.8', 'Z59.82', 'Z59.86', 'Z59.9', 'Z60.0', 'Z60.2', 'Z60.3', 'Z60.4', 'Z60.5', 'Z60.8', 'Z62.0', 'Z62.1', 'Z62.21', 'Z62.22', 'Z62.3', 'Z62.6', 'Z62.810', 'Z62.811', 'Z62.812', 'Z62.813', 'Z62.814', 'Z62.815', 'Z62.819', 'Z62.82', 'Z62.89', 'Z62.9', 'Z63.0', 'Z63.1', 'Z63.31', 'Z63.32', 'Z63.4', 'Z63.5', 'Z63.6', 'Z63.71', 'Z63.72', 'Z63.79', 'Z63.8', 'Z63.9', 'Z64.0', 'Z64.1', 'Z64.4', 'Z65.0', 'Z65.1', 'Z65.2', 'Z65.3', 'Z65.4', 'Z65.5', 'Z65.8')
    returning z_code
  ),
  header_map as (
    select
      coalesce(z_group, z_code_key)::integer as z_group,
      max(z_code_hdr_desc)::text as z_code_hdr_desc
    from atlas.z_code_headers
    group by coalesce(z_group, z_code_key)
  ),
  section_rows as (
    select
      z.z_group as z_group,
      format('Z%s', lpad(z.z_group::text, 2, '0')) as parent_code,
      coalesce(nullif(trim(h.z_code_hdr_desc), ''), format('Z%s', lpad(z.z_group::text, 2, '0'))) as parent_theme,
      jsonb_agg(
        jsonb_build_object(
          'id', lower(replace(z.z_code, '.', '-')),
          'parentCode', format('Z%s', lpad(z.z_group::text, 2, '0')),
          'parentTheme', coalesce(nullif(trim(h.z_code_hdr_desc), ''), format('Z%s', lpad(z.z_group::text, 2, '0'))),
          'zCode', z.z_code,
          'normalizedZCode', z.z_code,
          'title', z.z_code,
          'description', z.title
        )
        order by z.z_code
      ) as prompts
    from atlas.z_codes z
    left join header_map h
      on h.z_group = z.z_group
    where z.is_active = true
      and z.z_code in (select z_code from source)
    group by z.z_group, h.z_code_hdr_desc
  ),
  section_payload as (
    select jsonb_agg(
      jsonb_build_object(
        'parentCode', parent_code,
        'theme', parent_theme,
        'prompts', prompts
      )
      order by z_group
    ) as sections
    from section_rows
  ),
  latest_scale as (
    select payload->'scale' as scale
    from atlas.app_config_documents
    where surface = 'singlepane'
      and config_key = 'service_capacity_survey'
      and version = '2026-z-burden-v2'
    order by created_at desc
    limit 1
  )
  insert into atlas.app_config_documents (surface, config_key, version, payload)
  select
    'singlepane',
    'service_capacity_survey',
    '2026-z-burden-v2',
    jsonb_build_object(
      'scale',
      coalesce(
        (select scale from latest_scale),
        '[{"value":1,"label":"major burden","description":"We do not handle this and it creates major burden."},{"value":2,"label":"rarely handled","description":"We rarely handle this and it creates burden."},{"value":3,"label":"poor fit","description":"We are not a good fit for this."},{"value":4,"label":"inconsistent fit","description":"We sometimes handle this, but inconsistently."},{"value":5,"label":"mixed fit","description":"Mixed fit and depends on the situation."},{"value":6,"label":"case by case","description":"We can handle this in some cases."},{"value":7,"label":"handles well","description":"We handle this well."},{"value":8,"label":"reliable fit","description":"We handle this reliably."},{"value":9,"label":"specialty area","description":"This is a strong area of specialty for us."}]'::jsonb
      ),
      'sections',
      coalesce((select sections from section_payload), '[]'::jsonb)
    );
