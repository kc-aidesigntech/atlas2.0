import type {
  PartnerServiceCapacityAnswer,
  PartnerServiceCapacityScaleOption,
  ZCodeSurveyPrompt,
  ZCodeSurveySection
} from '@/features/atlas2026/singlepane/types'

/**
 * Service-capacity survey catalog.
 *
 * Purpose:
 * - defines the default Z-code prompt corpus and burden scoring scale.
 * - provides deterministic helpers for constructing answer payload skeletons.
 */

export const SERVICE_CAPACITY_FORM_VERSION = '2026-z-burden-v2'
export const ZCODE_DOMAIN_SURVEY_FORM_VERSION = '2026-z-domain-spectrum-v1'
export const ZCODE_DOMAIN_SCORE_RANGE = { min: 1, max: 99, step: 1 } as const

export const DEFAULT_SERVICE_CAPACITY_SCALE: PartnerServiceCapacityScaleOption[] = [
  { value: 1, label: 'major burden', description: 'We do not handle this and it creates major burden.' },
  { value: 2, label: 'rarely handled', description: 'We rarely handle this and it creates burden.' },
  { value: 3, label: 'poor fit', description: 'We are not a good fit for this.' },
  { value: 4, label: 'inconsistent fit', description: 'We sometimes handle this, but inconsistently.' },
  { value: 5, label: 'mixed fit', description: 'Mixed fit and depends on the situation.' },
  { value: 6, label: 'case by case', description: 'We can handle this in some cases.' },
  { value: 7, label: 'handles well', description: 'We handle this well.' },
  { value: 8, label: 'reliable fit', description: 'We handle this reliably.' },
  { value: 9, label: 'specialty area', description: 'This is a strong area of specialty for us.' }
]

export const ZCODE_DOMAIN_SCALE_GUIDE: PartnerServiceCapacityScaleOption[] = [
  {
    value: 1,
    label: 'habitat anchor',
    description: 'Near 1 sits almost entirely in habitat.'
  },
  {
    value: 33,
    label: 'social networks anchor',
    description: '33 is the social networks vertex.'
  },
  {
    value: 66,
    label: 'work anchor',
    description: '66 is the work vertex.'
  },
  {
    value: 99,
    label: 'habitat return',
    description: 'Near 99 returns almost entirely to habitat.'
  }
]

export const DEFAULT_SERVICE_CAPACITY_SECTIONS: ZCodeSurveySection[] = [
  // Prompt ids/normalized codes are treated as stable persistence keys, so
  // edits here should preserve backward compatibility with stored submissions.
  {
    parentCode: 'Z55',
    theme: 'Problems related to education and literacy',
    prompts: [
      { id: 'z55-0', parentCode: 'Z55', parentTheme: 'Problems related to education and literacy', zCode: 'Z55.0', normalizedZCode: 'Z55.0', title: 'Z55.0', description: 'Illiteracy and low-level literacy' },
      { id: 'z55-1', parentCode: 'Z55', parentTheme: 'Problems related to education and literacy', zCode: 'Z55.1', normalizedZCode: 'Z55.1', title: 'Z55.1', description: 'Schooling unavailable and unattainable' },
      { id: 'z55-2', parentCode: 'Z55', parentTheme: 'Problems related to education and literacy', zCode: 'Z55.2', normalizedZCode: 'Z55.2', title: 'Z55.2', description: 'Failed school examinations' },
      { id: 'z55-3', parentCode: 'Z55', parentTheme: 'Problems related to education and literacy', zCode: 'Z55.3', normalizedZCode: 'Z55.3', title: 'Z55.3', description: 'Underachievement in school' },
      { id: 'z55-4', parentCode: 'Z55', parentTheme: 'Problems related to education and literacy', zCode: 'Z55.4', normalizedZCode: 'Z55.4', title: 'Z55.4', description: 'Educational maladjustment and discord w/ teachers and classmates' },
      { id: 'z55-5', parentCode: 'Z55', parentTheme: 'Problems related to education and literacy', zCode: 'Z55.5', normalizedZCode: 'Z55.5', title: 'Z55.5', description: 'Less than a high school diploma' },
      { id: 'z55-6', parentCode: 'Z55', parentTheme: 'Problems related to education and literacy', zCode: 'Z55.6', normalizedZCode: 'Z55.6', title: 'Z55.6', description: 'Problems related to health literacy' },
      { id: 'z55-8', parentCode: 'Z55', parentTheme: 'Problems related to education and literacy', zCode: 'Z55.8', normalizedZCode: 'Z55.8', title: 'Z55.8', description: 'Other specified problems related to education and literacy' },
      { id: 'z55-9', parentCode: 'Z55', parentTheme: 'Problems related to education and literacy', zCode: 'Z55.9', normalizedZCode: 'Z55.9', title: 'Z55.9', description: 'Problems related to education and literacy, unspecified' }
    ]
  },
  {
    parentCode: 'Z56',
    theme: 'Problems related to employment and unemployment',
    prompts: [
      { id: 'z56-0', parentCode: 'Z56', parentTheme: 'Problems related to employment and unemployment', zCode: 'Z56.0', normalizedZCode: 'Z56.0', title: 'Z56.0', description: 'Unemployment, unspecified' },
      { id: 'z56-1', parentCode: 'Z56', parentTheme: 'Problems related to employment and unemployment', zCode: 'Z56.1', normalizedZCode: 'Z56.1', title: 'Z56.1', description: 'Change of job' },
      { id: 'z56-2', parentCode: 'Z56', parentTheme: 'Problems related to employment and unemployment', zCode: 'Z56.2', normalizedZCode: 'Z56.2', title: 'Z56.2', description: 'Threat of job loss' },
      { id: 'z56-3', parentCode: 'Z56', parentTheme: 'Problems related to employment and unemployment', zCode: 'Z56.3', normalizedZCode: 'Z56.3', title: 'Z56.3', description: 'Stressful work schedule' },
      { id: 'z56-4', parentCode: 'Z56', parentTheme: 'Problems related to employment and unemployment', zCode: 'Z56.4', normalizedZCode: 'Z56.4', title: 'Z56.4', description: 'Discord with boss and workmates' },
      { id: 'z56-5', parentCode: 'Z56', parentTheme: 'Problems related to employment and unemployment', zCode: 'Z56.5', normalizedZCode: 'Z56.5', title: 'Z56.5', description: 'Uncongenial work environment' },
      { id: 'z56-6', parentCode: 'Z56', parentTheme: 'Problems related to employment and unemployment', zCode: 'Z56.6', normalizedZCode: 'Z56.6', title: 'Z56.6', description: 'Other physical and mental strain related to work' },
      { id: 'z56-81', parentCode: 'Z56', parentTheme: 'Problems related to employment and unemployment', zCode: 'Z56.81', normalizedZCode: 'Z56.81', title: 'Z56.81', description: 'Sexual harassment on the job' },
      { id: 'z56-82', parentCode: 'Z56', parentTheme: 'Problems related to employment and unemployment', zCode: 'Z56.82', normalizedZCode: 'Z56.82', title: 'Z56.82', description: 'Military deployment status' },
      { id: 'z56-89', parentCode: 'Z56', parentTheme: 'Problems related to employment and unemployment', zCode: 'Z56.89', normalizedZCode: 'Z56.89', title: 'Z56.89', description: 'Other specified problems related to employment' },
      { id: 'z56-9', parentCode: 'Z56', parentTheme: 'Problems related to employment and unemployment', zCode: 'Z56.9', normalizedZCode: 'Z56.9', title: 'Z56.9', description: 'Problems related to employment, unspecified' }
    ]
  },
  {
    parentCode: 'Z57',
    theme: 'Occupational exposure to risk factors',
    prompts: [
      { id: 'z57-0', parentCode: 'Z57', parentTheme: 'Occupational exposure to risk factors', zCode: 'Z57.0', normalizedZCode: 'Z57.0', title: 'Z57.0', description: 'Occupational exposure to noise' },
      { id: 'z57-1', parentCode: 'Z57', parentTheme: 'Occupational exposure to risk factors', zCode: 'Z57.1', normalizedZCode: 'Z57.1', title: 'Z57.1', description: 'Occupational exposure to radiation' },
      { id: 'z57-2', parentCode: 'Z57', parentTheme: 'Occupational exposure to risk factors', zCode: 'Z57.2', normalizedZCode: 'Z57.2', title: 'Z57.2', description: 'Occupational exposure to dust' },
      { id: 'z57-3', parentCode: 'Z57', parentTheme: 'Occupational exposure to risk factors', zCode: 'Z57.3', normalizedZCode: 'Z57.3', title: 'Z57.3', description: 'Occupational exposure to other air contaminants' },
      { id: 'z57-31', parentCode: 'Z57', parentTheme: 'Occupational exposure to risk factors', zCode: 'Z57.31', normalizedZCode: 'Z57.31', title: 'Z57.31', description: 'Occupational exposure to environmental tobacco smoke' },
      { id: 'z57-39', parentCode: 'Z57', parentTheme: 'Occupational exposure to risk factors', zCode: 'Z57.39', normalizedZCode: 'Z57.39', title: 'Z57.39', description: 'Occupational exposure to other air contaminants' },
      { id: 'z57-4', parentCode: 'Z57', parentTheme: 'Occupational exposure to risk factors', zCode: 'Z57.4', normalizedZCode: 'Z57.4', title: 'Z57.4', description: 'Occupational exposure to toxic agents in agriculture' },
      { id: 'z57-5', parentCode: 'Z57', parentTheme: 'Occupational exposure to risk factors', zCode: 'Z57.5', normalizedZCode: 'Z57.5', title: 'Z57.5', description: 'Occupational exposure to toxic agents in other industries' },
      { id: 'z57-6', parentCode: 'Z57', parentTheme: 'Occupational exposure to risk factors', zCode: 'Z57.6', normalizedZCode: 'Z57.6', title: 'Z57.6', description: 'Occupational exposure to extreme temperature' },
      { id: 'z57-7', parentCode: 'Z57', parentTheme: 'Occupational exposure to risk factors', zCode: 'Z57.7', normalizedZCode: 'Z57.7', title: 'Z57.7', description: 'Occupational exposure to vibration' },
      { id: 'z57-8', parentCode: 'Z57', parentTheme: 'Occupational exposure to risk factors', zCode: 'Z57.8', normalizedZCode: 'Z57.8', title: 'Z57.8', description: 'Occupational exposure to other risk factors' },
      { id: 'z57-9', parentCode: 'Z57', parentTheme: 'Occupational exposure to risk factors', zCode: 'Z57.9', normalizedZCode: 'Z57.9', title: 'Z57.9', description: 'Occupational exposure to unspecified risk factor' }
    ]
  },
  {
    parentCode: 'Z58',
    theme: 'Problems related to physical environment',
    prompts: [
      { id: 'z58-6', parentCode: 'Z58', parentTheme: 'Problems related to physical environment', zCode: 'Z58.6', normalizedZCode: 'Z58.6', title: 'Z58.6', description: 'Inadequate drinking-water supply' },
      { id: 'z58-81', parentCode: 'Z58', parentTheme: 'Problems related to physical environment', zCode: 'Z58.81', normalizedZCode: 'Z58.81', title: 'Z58.81', description: 'Basic services unavailable in physical environment' }
    ]
  },
  {
    parentCode: 'Z59',
    theme: 'Problems related to housing and economic circumstances',
    prompts: [
      { id: 'z59-0', parentCode: 'Z59', parentTheme: 'Problems related to housing and economic circumstances', zCode: 'Z59.0', normalizedZCode: 'Z59.0', title: 'Z59.0', description: 'Homelessness' },
      { id: 'z59-01', parentCode: 'Z59', parentTheme: 'Problems related to housing and economic circumstances', zCode: 'Z59.01', normalizedZCode: 'Z59.01', title: 'Z59.01', description: 'Sheltered homelessness' },
      { id: 'z59-02', parentCode: 'Z59', parentTheme: 'Problems related to housing and economic circumstances', zCode: 'Z59.02', normalizedZCode: 'Z59.02', title: 'Z59.02', description: 'Unsheltered homelessness' },
      { id: 'z59-1', parentCode: 'Z59', parentTheme: 'Problems related to housing and economic circumstances', zCode: 'Z59.1', normalizedZCode: 'Z59.1', title: 'Z59.1', description: 'Inadequate housing' },
      { id: 'z59-2', parentCode: 'Z59', parentTheme: 'Problems related to housing and economic circumstances', zCode: 'Z59.2', normalizedZCode: 'Z59.2', title: 'Z59.2', description: 'Discord with neighbors, lodgers, or landlord' },
      { id: 'z59-3', parentCode: 'Z59', parentTheme: 'Problems related to housing and economic circumstances', zCode: 'Z59.3', normalizedZCode: 'Z59.3', title: 'Z59.3', description: 'Problem related to living in a residential institution' },
      { id: 'z59-4', parentCode: 'Z59', parentTheme: 'Problems related to housing and economic circumstances', zCode: 'Z59.4', normalizedZCode: 'Z59.4', title: 'Z59.4', description: 'Lack of adequate food or safe drinking water' },
      { id: 'z59-5', parentCode: 'Z59', parentTheme: 'Problems related to housing and economic circumstances', zCode: 'Z59.5', normalizedZCode: 'Z59.5', title: 'Z59.5', description: 'Extreme poverty' },
      { id: 'z59-6', parentCode: 'Z59', parentTheme: 'Problems related to housing and economic circumstances', zCode: 'Z59.6', normalizedZCode: 'Z59.6', title: 'Z59.6', description: 'Low income' },
      { id: 'z59-7', parentCode: 'Z59', parentTheme: 'Problems related to housing and economic circumstances', zCode: 'Z59.7', normalizedZCode: 'Z59.7', title: 'Z59.7', description: 'Insufficient social insurance or welfare support' },
      { id: 'z59-8', parentCode: 'Z59', parentTheme: 'Problems related to housing and economic circumstances', zCode: 'Z59.8', normalizedZCode: 'Z59.8', title: 'Z59.8', description: 'Other specified problems related to housing and economic circumstances' },
      { id: 'z59-82', parentCode: 'Z59', parentTheme: 'Problems related to housing and economic circumstances', zCode: 'Z59.82', normalizedZCode: 'Z59.82', title: 'Z59.82', description: 'Transportation insecurity' },
      { id: 'z59-86', parentCode: 'Z59', parentTheme: 'Problems related to housing and economic circumstances', zCode: 'Z59.86', normalizedZCode: 'Z59.86', title: 'Z59.86', description: 'Financial insecurity' },
      { id: 'z59-9', parentCode: 'Z59', parentTheme: 'Problems related to housing and economic circumstances', zCode: 'Z59.9', normalizedZCode: 'Z59.9', title: 'Z59.9', description: 'Housing or economic problem, unspecified' }
    ]
  },
  {
    parentCode: 'Z60',
    theme: 'Problems related to social environment',
    prompts: [
      { id: 'z60-0', parentCode: 'Z60', parentTheme: 'Problems related to social environment', zCode: 'Z60.0', normalizedZCode: 'Z60.0', title: 'Z60.0', description: 'Phase of life problem' },
      { id: 'z60-2', parentCode: 'Z60', parentTheme: 'Problems related to social environment', zCode: 'Z60.2', normalizedZCode: 'Z60.2', title: 'Z60.2', description: 'Problems related to living alone' },
      { id: 'z60-3', parentCode: 'Z60', parentTheme: 'Problems related to social environment', zCode: 'Z60.3', normalizedZCode: 'Z60.3', title: 'Z60.3', description: 'Acculturation difficulty' },
      { id: 'z60-4', parentCode: 'Z60', parentTheme: 'Problems related to social environment', zCode: 'Z60.4', normalizedZCode: 'Z60.4', title: 'Z60.4', description: 'Social exclusion or rejection' },
      { id: 'z60-5', parentCode: 'Z60', parentTheme: 'Problems related to social environment', zCode: 'Z60.5', normalizedZCode: 'Z60.5', title: 'Z60.5', description: 'Target of perceived adverse discrimination or persecution' },
      { id: 'z60-8', parentCode: 'Z60', parentTheme: 'Problems related to social environment', zCode: 'Z60.8', normalizedZCode: 'Z60.8', title: 'Z60.8', description: 'Other specified problems related to social environment' }
    ]
  },
  {
    parentCode: 'Z62',
    theme: 'Problems related to upbringing',
    prompts: [
      { id: 'z62-0', parentCode: 'Z62', parentTheme: 'Problems related to upbringing', zCode: 'Z62.0', normalizedZCode: 'Z62.0', title: 'Z62.0', description: 'Inadequate parental supervision and control' },
      { id: 'z62-1', parentCode: 'Z62', parentTheme: 'Problems related to upbringing', zCode: 'Z62.1', normalizedZCode: 'Z62.1', title: 'Z62.1', description: 'Parental overprotection' },
      { id: 'z62-21', parentCode: 'Z62', parentTheme: 'Problems related to upbringing', zCode: 'Z62.21', normalizedZCode: 'Z62.21', title: 'Z62.21', description: 'Child in welfare custody' },
      { id: 'z62-22', parentCode: 'Z62', parentTheme: 'Problems related to upbringing', zCode: 'Z62.22', normalizedZCode: 'Z62.22', title: 'Z62.22', description: 'Institutional upbringing' },
      { id: 'z62-3', parentCode: 'Z62', parentTheme: 'Problems related to upbringing', zCode: 'Z62.3', normalizedZCode: 'Z62.3', title: 'Z62.3', description: 'Hostility towards and scapegoating of child' },
      { id: 'z62-6', parentCode: 'Z62', parentTheme: 'Problems related to upbringing', zCode: 'Z62.6', normalizedZCode: 'Z62.6', title: 'Z62.6', description: 'Inappropriate excessive parental pressure' },
      { id: 'z62-810-physical-history', parentCode: 'Z62', parentTheme: 'Problems related to upbringing', zCode: 'Z62.810*', normalizedZCode: 'Z62.810', title: 'Z62.810*', description: 'Personal history of physical abuse in childhood' },
      { id: 'z62-810-sexual-history', parentCode: 'Z62', parentTheme: 'Problems related to upbringing', zCode: 'Z62.810*', normalizedZCode: 'Z62.810', title: 'Z62.810*', description: 'Personal history of sexual abuse in childhood' },
      { id: 'z62-810-combined', parentCode: 'Z62', parentTheme: 'Problems related to upbringing', zCode: 'Z62.810', normalizedZCode: 'Z62.810', title: 'Z62.810', description: 'Personal history of physical and sexual abuse in childhood' },
      { id: 'z62-811', parentCode: 'Z62', parentTheme: 'Problems related to upbringing', zCode: 'Z62.811', normalizedZCode: 'Z62.811', title: 'Z62.811', description: 'Personal history of psychological abuse in childhood' },
      { id: 'z62-812', parentCode: 'Z62', parentTheme: 'Problems related to upbringing', zCode: 'Z62.812', normalizedZCode: 'Z62.812', title: 'Z62.812', description: 'Personal history of neglect in childhood' },
      { id: 'z62-813', parentCode: 'Z62', parentTheme: 'Problems related to upbringing', zCode: 'Z62.813', normalizedZCode: 'Z62.813', title: 'Z62.813', description: 'Personal history of forced labor or sexual exploitation in childhood' },
      { id: 'z62-814', parentCode: 'Z62', parentTheme: 'Problems related to upbringing', zCode: 'Z62.814', normalizedZCode: 'Z62.814', title: 'Z62.814', description: 'Personal history of child financial abuse' },
      { id: 'z62-815', parentCode: 'Z62', parentTheme: 'Problems related to upbringing', zCode: 'Z62.815', normalizedZCode: 'Z62.815', title: 'Z62.815', description: 'Personal history of intimate partner abuse in childhood' },
      { id: 'z62-819', parentCode: 'Z62', parentTheme: 'Problems related to upbringing', zCode: 'Z62.819', normalizedZCode: 'Z62.819', title: 'Z62.819', description: 'Personal history of unspecified abuse in childhood' },
      { id: 'z62-82', parentCode: 'Z62', parentTheme: 'Problems related to upbringing', zCode: 'Z62.82', normalizedZCode: 'Z62.82', title: 'Z62.82', description: 'Parent-child conflict' },
      { id: 'z62-89', parentCode: 'Z62', parentTheme: 'Problems related to upbringing', zCode: 'Z62.89', normalizedZCode: 'Z62.89', title: 'Z62.89', description: 'Other specified problems related to upbringing' },
      { id: 'z62-9', parentCode: 'Z62', parentTheme: 'Problems related to upbringing', zCode: 'Z62.9', normalizedZCode: 'Z62.9', title: 'Z62.9', description: 'Problem related to upbringing, unspecified' }
    ]
  },
  {
    parentCode: 'Z63',
    theme: 'Problems related to primary support group and family circumstances',
    prompts: [
      { id: 'z63-0', parentCode: 'Z63', parentTheme: 'Problems related to primary support group and family circumstances', zCode: 'Z63.0', normalizedZCode: 'Z63.0', title: 'Z63.0', description: 'Problems in relationship with spouse or partner' },
      { id: 'z63-1', parentCode: 'Z63', parentTheme: 'Problems related to primary support group and family circumstances', zCode: 'Z63.1', normalizedZCode: 'Z63.1', title: 'Z63.1', description: 'Problems in relationship with in-laws' },
      { id: 'z63-31', parentCode: 'Z63', parentTheme: 'Problems related to primary support group and family circumstances', zCode: 'Z63.31', normalizedZCode: 'Z63.31', title: 'Z63.31', description: 'Absence of family member due to military deployment' },
      { id: 'z63-32', parentCode: 'Z63', parentTheme: 'Problems related to primary support group and family circumstances', zCode: 'Z63.32', normalizedZCode: 'Z63.32', title: 'Z63.32', description: 'Other absence of family member' },
      { id: 'z63-4', parentCode: 'Z63', parentTheme: 'Problems related to primary support group and family circumstances', zCode: 'Z63.4', normalizedZCode: 'Z63.4', title: 'Z63.4', description: 'Disappearance and death of a family member' },
      { id: 'z63-5', parentCode: 'Z63', parentTheme: 'Problems related to primary support group and family circumstances', zCode: 'Z63.5', normalizedZCode: 'Z63.5', title: 'Z63.5', description: 'Disruption of family by separation or divorce' },
      { id: 'z63-6', parentCode: 'Z63', parentTheme: 'Problems related to primary support group and family circumstances', zCode: 'Z63.6', normalizedZCode: 'Z63.6', title: 'Z63.6', description: 'Dependent relative needing care at home' },
      { id: 'z63-71', parentCode: 'Z63', parentTheme: 'Problems related to primary support group and family circumstances', zCode: 'Z63.71', normalizedZCode: 'Z63.71', title: 'Z63.71', description: 'Stress on family due to return of family member from military deployment' },
      { id: 'z63-72', parentCode: 'Z63', parentTheme: 'Problems related to primary support group and family circumstances', zCode: 'Z63.72', normalizedZCode: 'Z63.72', title: 'Z63.72', description: 'Alcoholism and drug addiction in family' },
      { id: 'z63-79', parentCode: 'Z63', parentTheme: 'Problems related to primary support group and family circumstances', zCode: 'Z63.79', normalizedZCode: 'Z63.79', title: 'Z63.79', description: 'Other stressful life events affecting family and household' },
      { id: 'z63-8', parentCode: 'Z63', parentTheme: 'Problems related to primary support group and family circumstances', zCode: 'Z63.8', normalizedZCode: 'Z63.8', title: 'Z63.8', description: 'Other specified problems related to primary support group' },
      { id: 'z63-9', parentCode: 'Z63', parentTheme: 'Problems related to primary support group and family circumstances', zCode: 'Z63.9', normalizedZCode: 'Z63.9', title: 'Z63.9', description: 'Problem related to primary support group, unspecified' }
    ]
  },
  {
    parentCode: 'Z64',
    theme: 'Problems related to certain psychosocial circumstances',
    prompts: [
      { id: 'z64-0', parentCode: 'Z64', parentTheme: 'Problems related to certain psychosocial circumstances', zCode: 'Z64.0', normalizedZCode: 'Z64.0', title: 'Z64.0', description: 'Problems related to unwanted pregnancy' },
      { id: 'z64-1', parentCode: 'Z64', parentTheme: 'Problems related to certain psychosocial circumstances', zCode: 'Z64.1', normalizedZCode: 'Z64.1', title: 'Z64.1', description: 'Problems related to multiparity' },
      { id: 'z64-4', parentCode: 'Z64', parentTheme: 'Problems related to certain psychosocial circumstances', zCode: 'Z64.4', normalizedZCode: 'Z64.4', title: 'Z64.4', description: 'Discord with counselors' }
    ]
  },
  {
    parentCode: 'Z65',
    theme: 'Problems related to other psychosocial circumstances',
    prompts: [
      { id: 'z65-0', parentCode: 'Z65', parentTheme: 'Problems related to other psychosocial circumstances', zCode: 'Z65.0', normalizedZCode: 'Z65.0', title: 'Z65.0', description: 'Conviction in civil or criminal proceedings without imprisonment' },
      { id: 'z65-1', parentCode: 'Z65', parentTheme: 'Problems related to other psychosocial circumstances', zCode: 'Z65.1', normalizedZCode: 'Z65.1', title: 'Z65.1', description: 'Imprisonment or other incarceration' },
      { id: 'z65-2', parentCode: 'Z65', parentTheme: 'Problems related to other psychosocial circumstances', zCode: 'Z65.2', normalizedZCode: 'Z65.2', title: 'Z65.2', description: 'Problems related to release from prison' },
      { id: 'z65-3', parentCode: 'Z65', parentTheme: 'Problems related to other psychosocial circumstances', zCode: 'Z65.3', normalizedZCode: 'Z65.3', title: 'Z65.3', description: 'Problems related to other legal circumstances' },
      { id: 'z65-4', parentCode: 'Z65', parentTheme: 'Problems related to other psychosocial circumstances', zCode: 'Z65.4', normalizedZCode: 'Z65.4', title: 'Z65.4', description: 'Victim of crime and terrorism or torture' },
      { id: 'z65-5', parentCode: 'Z65', parentTheme: 'Problems related to other psychosocial circumstances', zCode: 'Z65.5', normalizedZCode: 'Z65.5', title: 'Z65.5', description: 'Exposure to disaster, war, or other hostilities' },
      { id: 'z65-8', parentCode: 'Z65', parentTheme: 'Problems related to other psychosocial circumstances', zCode: 'Z65.8', normalizedZCode: 'Z65.8', title: 'Z65.8', description: 'Other specified problems related to psychosocial circumstances' }
    ]
  }
]

export const DEFAULT_SERVICE_CAPACITY_SURVEY_DEFINITION = {
  scale: DEFAULT_SERVICE_CAPACITY_SCALE,
  sections: DEFAULT_SERVICE_CAPACITY_SECTIONS
}

export function flattenSurveyPrompts(sections: ZCodeSurveySection[]) {
  return sections.flatMap((section) => section.prompts)
}

export function buildDefaultPartnerServiceCapacityAnswers(prompts: ZCodeSurveyPrompt[]): PartnerServiceCapacityAnswer[] {
  return prompts.map((item) => ({
    promptId: item.id,
    parentCode: item.parentCode,
    zCode: item.zCode,
    normalizedZCode: item.normalizedZCode,
    title: item.title,
    description: item.description,
    score: null,
    notEncountered: false
  }))
}

export function getScaleOption(scale: PartnerServiceCapacityScaleOption[], value: number) {
  return scale.find((option) => option.value === value) || scale[4] || { value: 5, label: 'mixed fit', description: '' }
}

export function describeZCodeDomainSpectrumScore(score: number) {
  const clampedScore = Math.max(ZCODE_DOMAIN_SCORE_RANGE.min, Math.min(ZCODE_DOMAIN_SCORE_RANGE.max, Math.round(score)))
  if (clampedScore === 33) {
    return {
      value: clampedScore,
      label: 'social networks anchor',
      description: 'This score lands directly on the social networks vertex.'
    }
  }
  if (clampedScore === 66) {
    return {
      value: clampedScore,
      label: 'work anchor',
      description: 'This score lands directly on the work vertex.'
    }
  }
  if (clampedScore <= 33) {
    return {
      value: clampedScore,
      label: 'habitat-social spectrum',
      description: 'This score moves between habitat (near 1) and social networks (near 33).'
    }
  }
  if (clampedScore <= 66) {
    return {
      value: clampedScore,
      label: 'social-work spectrum',
      description: 'This score moves between social networks (near 33) and work (near 66).'
    }
  }
  return {
    value: clampedScore,
    label: 'work-habitat spectrum',
    description: 'This score moves between work (near 66) and habitat (near 99).'
  }
}
