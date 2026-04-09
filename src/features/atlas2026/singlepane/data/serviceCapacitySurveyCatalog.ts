import type {
  PartnerServiceCapacityAnswer,
  PartnerServiceCapacityScaleOption,
  ZCodeSurveyPrompt,
  ZCodeSurveySection
} from '@/features/atlas2026/singlepane/types'

export const SERVICE_CAPACITY_FORM_VERSION = '2026-z-burden-v1'

export const SERVICE_CAPACITY_SCALE: PartnerServiceCapacityScaleOption[] = [
  { value: 1, label: 'major burden', description: 'We do not handle this and it creates major burden.' },
  { value: 2, label: 'rarely handled', description: 'We rarely handle this and it creates burden.' },
  { value: 3, label: 'poor fit', description: 'We are not a good fit for this.' },
  { value: 4, label: 'inconsistent fit', description: 'We sometimes handle this, but inconsistently.' },
  { value: 5, label: 'mixed fit', description: 'Mixed fit / depends on situation.' },
  { value: 6, label: 'case by case', description: 'We can handle this in some cases.' },
  { value: 7, label: 'handles well', description: 'We handle this well.' },
  { value: 8, label: 'reliable fit', description: 'We handle this reliably.' },
  { value: 9, label: 'specialty area', description: 'This is a strong area of specialty for us.' }
]

function prompt(
  id: string,
  parentCode: string,
  parentTheme: string,
  zCode: string,
  description: string,
  normalizedZCode = zCode
): ZCodeSurveyPrompt {
  return {
    id,
    parentCode,
    parentTheme,
    zCode,
    normalizedZCode,
    title: zCode,
    description
  }
}

export const SERVICE_CAPACITY_SURVEY_SECTIONS: ZCodeSurveySection[] = [
  {
    parentCode: 'Z55',
    theme: 'Educational and literacy problems persist',
    prompts: [
      prompt('z55-0', 'Z55', 'Educational and literacy problems persist', 'Z55.0', 'Illiteracy and Low-Level Literacy'),
      prompt('z55-1', 'Z55', 'Educational and literacy problems persist', 'Z55.1', 'Schooling Unavailable and Unattainable'),
      prompt('z55-2', 'Z55', 'Educational and literacy problems persist', 'Z55.2', 'Failed School Examinations'),
      prompt('z55-3', 'Z55', 'Educational and literacy problems persist', 'Z55.3', 'Underachievement in School'),
      prompt('z55-4', 'Z55', 'Educational and literacy problems persist', 'Z55.4', 'Educational Maladjustment & Discord w/Teachers & Classmates'),
      prompt('z55-5', 'Z55', 'Educational and literacy problems persist', 'Z55.5', 'Less than a Highschool Diploma'),
      prompt('z55-8', 'Z55', 'Educational and literacy problems persist', 'Z55.8', 'Other Problems Related to Education and Literacy'),
      prompt('z55-9-academic', 'Z55', 'Educational and literacy problems persist', 'Z55.9*', 'Academic or Educational Problems', 'Z55.9'),
      prompt('z55-9-unspecified', 'Z55', 'Educational and literacy problems persist', 'Z55.9', 'Problems Related to Education and Literacy Unspecified')
    ]
  },
  {
    parentCode: 'Z56',
    theme: 'Work-related stress and job issues',
    prompts: [
      prompt('z56-0', 'Z56', 'Work-related stress and job issues', 'Z56.0', 'Unemployment Unspecified'),
      prompt('z56-1', 'Z56', 'Work-related stress and job issues', 'Z56.1', 'Change of Job'),
      prompt('z56-2', 'Z56', 'Work-related stress and job issues', 'Z56.2', 'Threat of Job Loss'),
      prompt('z56-3', 'Z56', 'Work-related stress and job issues', 'Z56.3', 'Stressful Work Schedule'),
      prompt('z56-4', 'Z56', 'Work-related stress and job issues', 'Z56.4', 'Discord With Boss and Workmates'),
      prompt('z56-5', 'Z56', 'Work-related stress and job issues', 'Z56.5', 'Uncongenial Work Environment'),
      prompt('z56-6', 'Z56', 'Work-related stress and job issues', 'Z56.6', 'Other Physical and Mental Strain related to work'),
      prompt('z56-81', 'Z56', 'Work-related stress and job issues', 'Z56.81', 'Sexual Harassment on the Job'),
      prompt('z56-89', 'Z56', 'Work-related stress and job issues', 'Z56.89', 'Other Problems Related to Employment'),
      prompt('z56-9', 'Z56', 'Work-related stress and job issues', 'Z56.9', 'Unspecified Problems Related to Employment')
    ]
  },
  {
    parentCode: 'Z57',
    theme: 'Workplace exposure to unidentified risks',
    prompts: [
      prompt('z57-8', 'Z57', 'Workplace exposure to unidentified risks', 'Z57.8', 'Occupational Exposure to other risk factors'),
      prompt('z57-9', 'Z57', 'Workplace exposure to unidentified risks', 'Z57.9', 'Occupational exposure to unspecified risk factor')
    ]
  },
  {
    parentCode: 'Z59',
    theme: 'Homelessness poverty housing insecurity hunger',
    prompts: [
      prompt('z59-0', 'Z59', 'Homelessness poverty housing insecurity hunger', 'Z59.0', 'Homelessness'),
      prompt('z59-00', 'Z59', 'Homelessness poverty housing insecurity hunger', 'Z59.00', 'Homelessness Unspecified'),
      prompt('z59-01', 'Z59', 'Homelessness poverty housing insecurity hunger', 'Z59.01', 'Sheltered Homelessness'),
      prompt('z59-02', 'Z59', 'Homelessness poverty housing insecurity hunger', 'Z59.02', 'Unsheltered Homelessness'),
      prompt('z59-1', 'Z59', 'Homelessness poverty housing insecurity hunger', 'Z59.1', 'Inadequate Housing'),
      prompt('z59-2', 'Z59', 'Homelessness poverty housing insecurity hunger', 'Z59.2', 'Discord with neighbor, lodger, or landlord'),
      prompt('z59-3', 'Z59', 'Homelessness poverty housing insecurity hunger', 'Z59.3', 'Problem Related to living in a Residential Institution'),
      prompt('z59-4', 'Z59', 'Homelessness poverty housing insecurity hunger', 'Z59.4', 'Lack of adequate food or safe drinking water'),
      prompt('z59-5', 'Z59', 'Homelessness poverty housing insecurity hunger', 'Z59.5', 'Extreme Poverty'),
      prompt('z59-6', 'Z59', 'Homelessness poverty housing insecurity hunger', 'Z59.6', 'Low Income'),
      prompt('z59-7', 'Z59', 'Homelessness poverty housing insecurity hunger', 'Z59.7', 'Insufficient Social Insurance or Welfare Support'),
      prompt('z59-8', 'Z59', 'Homelessness poverty housing insecurity hunger', 'Z59.8', 'Other Problems Related to Housing and Economic Circumstances'),
      prompt('z59-9', 'Z59', 'Homelessness poverty housing insecurity hunger', 'Z59.9', 'Unspecified Housing or Economic Problems')
    ]
  },
  {
    parentCode: 'Z60',
    theme: 'Social environment challenges, exclusion, discrimination',
    prompts: [
      prompt('z60-0', 'Z60', 'Social environment challenges, exclusion, discrimination', 'Z60.0', 'Phase of Life Problem'),
      prompt('z60-2', 'Z60', 'Social environment challenges, exclusion, discrimination', 'Z60.2', 'Problems Related to Living Alone'),
      prompt('z60-3', 'Z60', 'Social environment challenges, exclusion, discrimination', 'Z60.3', 'Acculturation Difficulty'),
      prompt('z60-4', 'Z60', 'Social environment challenges, exclusion, discrimination', 'Z60.4', 'Social Exclusion and/or Rejection'),
      prompt('z60-5', 'Z60', 'Social environment challenges, exclusion, discrimination', 'Z60.5', 'Target of Perceived Adverse Discrimination or Persecution'),
      prompt('z60-8', 'Z60', 'Social environment challenges, exclusion, discrimination', 'Z60.8', 'Other Problems Related to Social Environment')
    ]
  },
  {
    parentCode: 'Z62',
    theme: 'Childhood abuse, neglect, relational problems',
    prompts: [
      prompt('z62-0', 'Z62', 'Childhood abuse, neglect, relational problems', 'Z62.0', 'Inadequate Parental Supervision and Control'),
      prompt('z62-1', 'Z62', 'Childhood abuse, neglect, relational problems', 'Z62.1', 'Parental Overprotection'),
      prompt('z62-21', 'Z62', 'Childhood abuse, neglect, relational problems', 'Z62.21', 'Child in Welfare Custody'),
      prompt('z62-22', 'Z62', 'Childhood abuse, neglect, relational problems', 'Z62.22', 'Institutional Upbringing'),
      prompt('z62-6', 'Z62', 'Childhood abuse, neglect, relational problems', 'Z62.6', 'Inappropriate Excessive Parental Pressure'),
      prompt('z62-810-physical-history', 'Z62', 'Childhood abuse, neglect, relational problems', 'Z62.810*', 'Personal History (Past History) of Physical Abuse in Childhood', 'Z62.810'),
      prompt('z62-810-sexual-history', 'Z62', 'Childhood abuse, neglect, relational problems', 'Z62.810*', 'Personal History (Past History) of Sexual Abuse in Childhood', 'Z62.810'),
      prompt('z62-810-combined', 'Z62', 'Childhood abuse, neglect, relational problems', 'Z62.810', 'Personal History of Physical and Sexual Abuse in Childhood'),
      prompt('z62-811', 'Z62', 'Childhood abuse, neglect, relational problems', 'Z62.811', 'Personal History of Psychological Abuse in Childhood'),
      prompt('z62-812', 'Z62', 'Childhood abuse, neglect, relational problems', 'Z62.812', 'Personal History of Neglect in Childhood'),
      prompt('z62-819', 'Z62', 'Childhood abuse, neglect, relational problems', 'Z62.819', 'Personal History of Unspecified Abuse in Childhood'),
      prompt('z62-820', 'Z62', 'Childhood abuse, neglect, relational problems', 'Z62.820', 'Parent-Child Relational Problem'),
      prompt('z62-821', 'Z62', 'Childhood abuse, neglect, relational problems', 'Z62.821', 'Parent-Adopted Child Conflict'),
      prompt('z62-822', 'Z62', 'Childhood abuse, neglect, relational problems', 'Z62.822', 'Parent-Foster Child Conflict'),
      prompt('z62-890', 'Z62', 'Childhood abuse, neglect, relational problems', 'Z62.890', 'Parent-Child Estrangement NEC'),
      prompt('z62-9', 'Z62', 'Childhood abuse, neglect, relational problems', 'Z62.9', 'Problem Related to Upbringing')
    ]
  },
  {
    parentCode: 'Z63',
    theme: 'Family-related stress and loss',
    prompts: [
      prompt('z63-0', 'Z63', 'Family-related stress and loss', 'Z63.0', 'Relationship Distress with Spouse or Intimate Partner'),
      prompt('z63-1', 'Z63', 'Family-related stress and loss', 'Z63.1', 'Problems in Relationships with In-Laws'),
      prompt('z63-31', 'Z63', 'Family-related stress and loss', 'Z63.31', 'Absence of Family Member Due to Military Deployment'),
      prompt('z63-32', 'Z63', 'Family-related stress and loss', 'Z63.32', 'Other Absence of Family Member'),
      prompt('z63-4-bereavement', 'Z63', 'Family-related stress and loss', 'Z63.4*', 'Uncomplicated Bereavement', 'Z63.4'),
      prompt('z63-4-death', 'Z63', 'Family-related stress and loss', 'Z63.4', 'Disappearance and Death of Family Member'),
      prompt('z63-6', 'Z63', 'Family-related stress and loss', 'Z63.6', 'Dependent Relative Needing Care at Home'),
      prompt('z63-5', 'Z63', 'Family-related stress and loss', 'Z63.5', 'Disruption of Family by Separation and/or Divorce'),
      prompt('z63-72', 'Z63', 'Family-related stress and loss', 'Z63.72', 'Alcoholism and Drug Addiction in Family'),
      prompt('z63-79', 'Z63', 'Family-related stress and loss', 'Z63.79', 'Other Stressful Life Events Affecting Family and Household'),
      prompt('z63-8', 'Z63', 'Family-related stress and loss', 'Z63.8', 'High Expressed Emotion Level Within Family'),
      prompt('z63-9', 'Z63', 'Family-related stress and loss', 'Z63.9', 'Problem Related to Primary Support Group, Unspecified')
    ]
  },
  {
    parentCode: 'Z64',
    theme: 'Unwanted pregnancy multiparity social discord',
    prompts: [
      prompt('z64-0', 'Z64', 'Unwanted pregnancy multiparity social discord', 'Z64.0', 'Problems Related to Unwanted Pregnancy'),
      prompt('z64-1', 'Z64', 'Unwanted pregnancy multiparity social discord', 'Z64.1', 'Problems Related to Multiparity'),
      prompt('z64-4', 'Z64', 'Unwanted pregnancy multiparity social discord', 'Z64.4', 'Discord with Social Service Provider, Including Probation Officer, Case Manager, or Social Service Worker')
    ]
  },
  {
    parentCode: 'Z65',
    theme: 'Legal issues and victimization experiences',
    prompts: [
      prompt('z65-0', 'Z65', 'Legal issues and victimization experiences', 'Z65.0', 'Conviction in Civil or Criminal Proceedings Without Imprisonment'),
      prompt('z65-1', 'Z65', 'Legal issues and victimization experiences', 'Z65.1', 'Imprisonment or Other Incarceration'),
      prompt('z65-2', 'Z65', 'Legal issues and victimization experiences', 'Z65.2', 'Problems Related to Release from Prison'),
      prompt('z65-3', 'Z65', 'Legal issues and victimization experiences', 'Z65.3', 'Problems Related to Other Legal Circumstances'),
      prompt('z65-4-crime', 'Z65', 'Legal issues and victimization experiences', 'Z65.4*', 'Victim of Crime', 'Z65.4'),
      prompt('z65-4-terror', 'Z65', 'Legal issues and victimization experiences', 'Z65.4*', 'Victim of Terrorism or Torture', 'Z65.4'),
      prompt('z65-4-combined', 'Z65', 'Legal issues and victimization experiences', 'Z65.4', 'Victim of Crime and Terrorism'),
      prompt('z65-5', 'Z65', 'Legal issues and victimization experiences', 'Z65.5', 'Exposure to Disaster War or Other Hostilities')
    ]
  }
]

export const SERVICE_CAPACITY_SURVEY_PROMPTS = SERVICE_CAPACITY_SURVEY_SECTIONS.flatMap((section) => section.prompts)

export function buildDefaultPartnerServiceCapacityAnswers(): PartnerServiceCapacityAnswer[] {
  return SERVICE_CAPACITY_SURVEY_PROMPTS.map((item) => ({
    promptId: item.id,
    parentCode: item.parentCode,
    zCode: item.zCode,
    normalizedZCode: item.normalizedZCode,
    title: item.title,
    description: item.description,
    score: 5
  }))
}

export function getScaleOption(value: number) {
  return SERVICE_CAPACITY_SCALE.find((option) => option.value === value) || SERVICE_CAPACITY_SCALE[4]
}
