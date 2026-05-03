import type { RegulationTestType } from '@/features/atlas2026/singlepane/types'

/**
 * Assessment catalog + scoring engine.
 *
 * Purpose:
 * - defines instrument metadata/prompt contracts for regulation and renewal stages.
 * - computes both app-gate and official scoring summaries from response payloads.
 */

export type AssessmentStage = 'regulation' | 'renewal'
export type AssessmentPromptKind = 'number' | 'applicability'
export type AssessmentScoringDirection = 'functioning' | 'impairment' | 'none'

export interface AssessmentScaleOption {
  value: number
  label: string
  description: string
}

export interface AssessmentPromptDefinition {
  id: string
  kind: AssessmentPromptKind
  label: string
  description: string
  sectionId: string
  min: number
  max: number
  scoringDirection: AssessmentScoringDirection
  allowsNotApplicable?: boolean
}

export interface AssessmentSectionDefinition {
  id: string
  title: string
  description: string
  applicabilityPromptId?: string
  minAnsweredRatioForOfficialScore?: number
  prompts: AssessmentPromptDefinition[]
}

export interface AssessmentDefinition {
  type: RegulationTestType
  stage: AssessmentStage
  label: string
  shortLabel: string
  description: string
  passThreshold: number
  passThresholdLabel: string
  passScoreLabel: string
  officialScoreLabel: string | null
  officialRules: string[]
  answerScale: AssessmentScaleOption[]
  applicabilityScale?: AssessmentScaleOption[]
  sections: AssessmentSectionDefinition[]
}

export interface AssessmentDerivedMetric {
  id: string
  label: string
  answeredCount: number
  totalCount: number
  isApplicable: boolean
  isOfficiallyScored: boolean
  officialImpairmentScore: number | null
  appGateScore: number | null
}

export interface AssessmentScoreSummary {
  gateScore: number | null
  passThreshold: number
  passed: boolean | null
  officialScore: number | null
  officialScoreLabel: string | null
  gateScoreLabel: string
  detailMetrics: AssessmentDerivedMetric[]
}

export const APPLICABILITY_NO = 0
export const APPLICABILITY_YES = 1
export const NOT_APPLICABLE_SENTINEL = -1

const APPLICABILITY_SCALE: AssessmentScaleOption[] = [
  { value: APPLICABILITY_YES, label: 'yes', description: 'This section applied in the past 30 days.' },
  { value: APPLICABILITY_NO, label: 'no', description: 'This section did not apply in the past 30 days.' }
]

const IPF_SCALE: AssessmentScaleOption[] = [
  { value: 0, label: 'never', description: 'Never' },
  { value: 1, label: '1', description: 'Between never and sometimes' },
  { value: 2, label: '2', description: 'Between never and sometimes' },
  { value: 3, label: 'sometimes', description: 'Sometimes' },
  { value: 4, label: '4', description: 'Between sometimes and always' },
  { value: 5, label: '5', description: 'Between sometimes and always' },
  { value: 6, label: 'always', description: 'Always' }
]

const B_IPF_SCALE: AssessmentScaleOption[] = [
  { value: 0, label: 'not at all', description: 'No trouble in this domain.' },
  { value: 1, label: '1', description: 'Very mild trouble in this domain.' },
  { value: 2, label: '2', description: 'Mild trouble in this domain.' },
  { value: 3, label: '3', description: 'Moderate trouble in this domain.' },
  { value: 4, label: '4', description: 'Noticeable trouble in this domain.' },
  { value: 5, label: '5', description: 'Marked trouble in this domain.' },
  { value: 6, label: 'very much', description: 'Severe trouble in this domain.' }
]

function regulationPrompt(id: string, label: string, description: string): AssessmentPromptDefinition {
  return {
    id,
    kind: 'number',
    label,
    description,
    sectionId: 'regulation',
    min: 0,
    max: 100,
    scoringDirection: 'none'
  }
}

function applicabilityPrompt(id: string, label: string, description: string, sectionId: string): AssessmentPromptDefinition {
  return {
    id,
    kind: 'applicability',
    label,
    description,
    sectionId,
    min: APPLICABILITY_NO,
    max: APPLICABILITY_YES,
    scoringDirection: 'none'
  }
}

function ipfPrompt(
  id: string,
  label: string,
  description: string,
  sectionId: string,
  scoringDirection: Exclude<AssessmentScoringDirection, 'none'>
): AssessmentPromptDefinition {
  return {
    id,
    kind: 'number',
    label,
    description,
    sectionId,
    min: 0,
    max: 6,
    scoringDirection
  }
}

function bipfPrompt(id: string, label: string, description: string, sectionId: string): AssessmentPromptDefinition {
  return {
    id,
    kind: 'number',
    label,
    description,
    sectionId,
    min: 0,
    max: 6,
    scoringDirection: 'impairment',
    allowsNotApplicable: true
  }
}

export const ASSESSMENT_DEFINITIONS: AssessmentDefinition[] = [
  // Regulation instruments are currently placeholder-compatible and intentionally
  // minimal, while renewal instruments preserve richer official scoring semantics.
  {
    type: 'mh_sca',
    stage: 'regulation',
    label: 'MH-SCA',
    shortLabel: 'MH-SCA',
    description: 'Regulation-stage placeholder instrument until the full MH-SCA is supplied.',
    passThreshold: 126,
    passThresholdLabel: 'Pass threshold: 126+',
    passScoreLabel: 'Total score',
    officialScoreLabel: null,
    officialRules: ['Internal ATLAS regulation-stage threshold only.'],
    answerScale: [],
    sections: [
      {
        id: 'regulation',
        title: 'MH-SCA',
        description: 'Placeholder items awaiting the full instrument.',
        prompts: [
          regulationPrompt('mhsca-1', 'Emotional regulation baseline', 'Placeholder item until full instrument is supplied.'),
          regulationPrompt('mhsca-2', 'Behavioral stability baseline', 'Placeholder item until full instrument is supplied.'),
          regulationPrompt('mhsca-3', 'Social coping baseline', 'Placeholder item until full instrument is supplied.')
        ]
      }
    ]
  },
  {
    type: 'svs',
    stage: 'regulation',
    label: 'Stress Vulnerability Scale (SVS)',
    shortLabel: 'SVS',
    description: 'Regulation-stage placeholder instrument until the full SVS is supplied.',
    passThreshold: 60,
    passThresholdLabel: 'Pass threshold: 60%+',
    passScoreLabel: 'Average score',
    officialScoreLabel: null,
    officialRules: ['Internal ATLAS regulation-stage threshold only.'],
    answerScale: [],
    sections: [
      {
        id: 'regulation',
        title: 'SVS',
        description: 'Placeholder items awaiting the full instrument.',
        prompts: [
          regulationPrompt('svs-1', 'Current stress load', 'Placeholder item until full instrument is supplied.'),
          regulationPrompt('svs-2', 'Protective supports', 'Placeholder item until full instrument is supplied.'),
          regulationPrompt('svs-3', 'Recent vulnerability events', 'Placeholder item until full instrument is supplied.')
        ]
      }
    ]
  },
  {
    type: 'ipf',
    stage: 'renewal',
    label: 'Inventory of Psychosocial Functioning (IPF)',
    shortLabel: 'IPF',
    description: '80-item National Center for PTSD measure of psychosocial functioning over the past 30 days.',
    passThreshold: 4,
    passThresholdLabel: 'App gate: 4.0+ functioning average',
    passScoreLabel: 'ATLAS app gate mean functioning',
    officialScoreLabel: 'Official IPF grand mean impairment',
    officialRules: [
      'Official IPF scoring uses only applicable subscales and only scores a subscale when 80% or more of its items are answered.',
      'Each official subscale score is converted to a 0-100 impairment range; higher scores indicate greater impairment.',
      'The official IPF grand mean is the mean of all completed official subscale scores.',
      'The ATLAS app gate is separate from the PTSD standard and uses a 0-6 functioning mean with a 4.0 minimum threshold.'
    ],
    answerScale: IPF_SCALE,
    applicabilityScale: APPLICABILITY_SCALE,
    sections: [
      {
        id: 'romantic_relationships',
        title: 'Romantic relationship with spouse or partner',
        description: 'Have you been in a romantic relationship with a spouse or partner in the past 30 days?',
        applicabilityPromptId: 'ipf-romantic-applicability',
        minAnsweredRatioForOfficialScore: 0.8,
        prompts: [
          applicabilityPrompt(
            'ipf-romantic-applicability',
            'Have you been in a romantic relationship with a spouse or partner in the past 30 days?',
            'If no, skip this section.',
            'romantic_relationships'
          ),
          ipfPrompt('ipf-1', '1. When necessary, I cooperated on tasks with my spouse or partner.', 'Over the past 30 days', 'romantic_relationships', 'functioning'),
          ipfPrompt('ipf-2', '2. I shared household chores or duties with my spouse or partner.', 'Over the past 30 days', 'romantic_relationships', 'functioning'),
          ipfPrompt('ipf-3', '3. I had trouble sharing thoughts or feelings with my spouse or partner.', 'Over the past 30 days', 'romantic_relationships', 'impairment'),
          ipfPrompt('ipf-4', '4. I showed interest in my spouse or partner’s activities.', 'Over the past 30 days', 'romantic_relationships', 'functioning'),
          ipfPrompt('ipf-5', '5. I had trouble settling arguments or disagreements with my spouse or partner.', 'Over the past 30 days', 'romantic_relationships', 'impairment'),
          ipfPrompt('ipf-6', '6. I was patient with my spouse or partner.', 'Over the past 30 days', 'romantic_relationships', 'functioning'),
          ipfPrompt('ipf-7', '7. I had trouble giving emotional support to my spouse or partner.', 'Over the past 30 days', 'romantic_relationships', 'impairment'),
          ipfPrompt('ipf-8', '8. I was affectionate with my spouse or partner.', 'Over the past 30 days', 'romantic_relationships', 'functioning'),
          ipfPrompt('ipf-9', '9. My partner or spouse and I did activities that brought us closer together.', 'Over the past 30 days', 'romantic_relationships', 'functioning'),
          ipfPrompt('ipf-10', '10. I was interested in sexual activity with my spouse or partner.', 'Over the past 30 days', 'romantic_relationships', 'functioning'),
          ipfPrompt('ipf-11', '11. I had trouble becoming sexually aroused with my spouse or partner.', 'Over the past 30 days', 'romantic_relationships', 'impairment')
        ]
      },
      {
        id: 'family',
        title: 'Family',
        description: 'Have you been in contact with family members in the past 30 days?',
        applicabilityPromptId: 'ipf-family-applicability',
        minAnsweredRatioForOfficialScore: 0.8,
        prompts: [
          applicabilityPrompt(
            'ipf-family-applicability',
            'Have you been in contact with family members (parents, brothers, sisters, grandparents, etc.) in the past 30 days?',
            'If no, skip this section.',
            'family'
          ),
          ipfPrompt('ipf-12', '12. I stayed in touch with family members (e.g. phone calls, e-mails, texts).', 'Over the past 30 days', 'family', 'functioning'),
          ipfPrompt('ipf-13', '13. My family and I did activities that brought us closer together.', 'Over the past 30 days', 'family', 'functioning'),
          ipfPrompt('ipf-14', '14. I was affectionate with my family members.', 'Over the past 30 days', 'family', 'functioning'),
          ipfPrompt('ipf-15', '15. I had trouble being patient with family members.', 'Over the past 30 days', 'family', 'impairment'),
          ipfPrompt('ipf-16', '16. I had trouble communicating thoughts or feelings to family members.', 'Over the past 30 days', 'family', 'impairment'),
          ipfPrompt('ipf-17', '17. I had trouble giving emotional support to family members.', 'Over the past 30 days', 'family', 'impairment'),
          ipfPrompt('ipf-18', '18. I had trouble settling arguments or disagreements with family members.', 'Over the past 30 days', 'family', 'impairment')
        ]
      },
      {
        id: 'work',
        title: 'Work (including home-based work)',
        description: 'Have you worked either for pay or as a volunteer in the past 30 days?',
        applicabilityPromptId: 'ipf-work-applicability',
        minAnsweredRatioForOfficialScore: 0.8,
        prompts: [
          applicabilityPrompt(
            'ipf-work-applicability',
            'Have you worked (either for pay or as a volunteer) in the past 30 days?',
            'If no, skip this section.',
            'work'
          ),
          ipfPrompt('ipf-19', '19. I had trouble showing up on time for work.', 'Over the past 30 days', 'work', 'impairment'),
          ipfPrompt('ipf-20', '20. I reported for work when I was supposed to.', 'Over the past 30 days', 'work', 'functioning'),
          ipfPrompt('ipf-21', '21. I got along well with others at work.', 'Over the past 30 days', 'work', 'functioning'),
          ipfPrompt('ipf-22', '22. I stayed interested in my work.', 'Over the past 30 days', 'work', 'functioning'),
          ipfPrompt('ipf-23', '23. I had trouble being patient with others at work.', 'Over the past 30 days', 'work', 'impairment'),
          ipfPrompt('ipf-24', '24. I performed my job to the best of my ability.', 'Over the past 30 days', 'work', 'functioning'),
          ipfPrompt('ipf-25', '25. I completed my work on time.', 'Over the past 30 days', 'work', 'functioning'),
          ipfPrompt('ipf-26', '26. I had trouble settling arguments or disagreements with others at work.', 'Over the past 30 days', 'work', 'impairment'),
          ipfPrompt('ipf-27', '27. I solved problems or challenges at work without much difficulty.', 'Over the past 30 days', 'work', 'functioning'),
          ipfPrompt('ipf-28', '28. I maintained a reasonable balance between work and home.', 'Over the past 30 days', 'work', 'functioning'),
          ipfPrompt('ipf-29', '29. I was able to perform my work duties without needing any extra help.', 'Over the past 30 days', 'work', 'functioning'),
          ipfPrompt('ipf-30', '30. When necessary, I cooperated on work-related tasks with others.', 'Over the past 30 days', 'work', 'functioning'),
          ipfPrompt('ipf-31', '31. I showed my skills and knowledge of the job.', 'Over the past 30 days', 'work', 'functioning'),
          ipfPrompt('ipf-32', '32. I showed others at work that they could depend on me.', 'Over the past 30 days', 'work', 'functioning'),
          ipfPrompt('ipf-33', '33. I came up with ideas and put them into action at work.', 'Over the past 30 days', 'work', 'functioning'),
          ipfPrompt('ipf-34', '34. I took responsibility for my work.', 'Over the past 30 days', 'work', 'functioning'),
          ipfPrompt('ipf-35', '35. I prioritized work-related tasks appropriately.', 'Over the past 30 days', 'work', 'functioning'),
          ipfPrompt('ipf-36', '36. I worked hard every day.', 'Over the past 30 days', 'work', 'functioning'),
          ipfPrompt('ipf-37', '37. I made sure that the work environment was pleasant for others.', 'Over the past 30 days', 'work', 'functioning'),
          ipfPrompt('ipf-38', '38. I had trouble expressing my ideas, thoughts or feelings to others at work.', 'Over the past 30 days', 'work', 'impairment'),
          ipfPrompt('ipf-39', '39. I had trouble being supportive of others at work.', 'Over the past 30 days', 'work', 'impairment')
        ]
      },
      {
        id: 'friendships_and_socializing',
        title: 'Friendships and socializing',
        description: 'Have you been in contact with friends in the past 30 days?',
        applicabilityPromptId: 'ipf-friends-applicability',
        minAnsweredRatioForOfficialScore: 0.8,
        prompts: [
          applicabilityPrompt(
            'ipf-friends-applicability',
            'Have you been in contact with friends in the past 30 days?',
            'If no, skip this section.',
            'friendships_and_socializing'
          ),
          ipfPrompt('ipf-40', '40. I was willing to meet new people.', 'Over the past 30 days', 'friendships_and_socializing', 'functioning'),
          ipfPrompt('ipf-41', '41. I stayed in touch with friends (returning phone calls, emails, visiting).', 'Over the past 30 days', 'friendships_and_socializing', 'functioning'),
          ipfPrompt('ipf-42', '42. My friends and I did activities that brought us closer together.', 'Over the past 30 days', 'friendships_and_socializing', 'functioning'),
          ipfPrompt('ipf-43', '43. I had trouble being patient with my friends.', 'Over the past 30 days', 'friendships_and_socializing', 'impairment'),
          ipfPrompt('ipf-44', '44. I had trouble settling arguments or disagreements with my friends.', 'Over the past 30 days', 'friendships_and_socializing', 'impairment'),
          ipfPrompt('ipf-45', '45. I had trouble sharing my thoughts or feelings with my friends.', 'Over the past 30 days', 'friendships_and_socializing', 'impairment'),
          ipfPrompt('ipf-46', '46. I had trouble giving emotional support to my friends.', 'Over the past 30 days', 'friendships_and_socializing', 'impairment'),
          ipfPrompt('ipf-47', '47. I showed affection for my friends.', 'Over the past 30 days', 'friendships_and_socializing', 'functioning')
        ]
      },
      {
        id: 'parenting',
        title: 'Parenting',
        description: 'Do you have children with whom you lived or had regular contact during the past 30 days?',
        applicabilityPromptId: 'ipf-parenting-applicability',
        minAnsweredRatioForOfficialScore: 0.8,
        prompts: [
          applicabilityPrompt(
            'ipf-parenting-applicability',
            'Do you have children with whom you lived or had regular contact during the past 30 days?',
            'If no, skip this section.',
            'parenting'
          ),
          ipfPrompt('ipf-48', '48. My children were able to depend on me for whatever they needed.', 'Over the past 30 days', 'parenting', 'functioning'),
          ipfPrompt('ipf-49', '49. I was interested in my children’s activities.', 'Over the past 30 days', 'parenting', 'functioning'),
          ipfPrompt('ipf-50', '50. I had trouble communicating with my children.', 'Over the past 30 days', 'parenting', 'impairment'),
          ipfPrompt('ipf-51', '51. I was affectionate with my children.', 'Over the past 30 days', 'parenting', 'functioning'),
          ipfPrompt('ipf-52', '52. I appropriately shared thoughts or feelings with my children.', 'Over the past 30 days', 'parenting', 'functioning'),
          ipfPrompt('ipf-53', '53. My children and I did activities that brought us closer together.', 'Over the past 30 days', 'parenting', 'functioning'),
          ipfPrompt('ipf-54', '54. I talked with, or taught, my children about important life issues.', 'Over the past 30 days', 'parenting', 'functioning'),
          ipfPrompt('ipf-55', '55. I was a good role model for my children.', 'Over the past 30 days', 'parenting', 'functioning'),
          ipfPrompt('ipf-56', '56. I had trouble giving emotional support to my children.', 'Over the past 30 days', 'parenting', 'impairment'),
          ipfPrompt('ipf-57', '57. I had trouble settling conflicts or disagreements with my children.', 'Over the past 30 days', 'parenting', 'impairment')
        ]
      },
      {
        id: 'education',
        title: 'Education (including distance learning)',
        description: 'Have you been involved in a formal educational experience, either in or outside of the school setting, during the past 30 days?',
        applicabilityPromptId: 'ipf-education-applicability',
        minAnsweredRatioForOfficialScore: 0.8,
        prompts: [
          applicabilityPrompt(
            'ipf-education-applicability',
            'Have you been involved in a formal educational experience, either in or outside of the school setting, during the past 30 days?',
            'If no, skip this section.',
            'education'
          ),
          ipfPrompt('ipf-58', '58. I attended classes regularly.', 'Over the past 30 days', 'education', 'functioning'),
          ipfPrompt('ipf-59', '59. I stayed interested in my classes and schoolwork.', 'Over the past 30 days', 'education', 'functioning'),
          ipfPrompt('ipf-60', '60. I arrived on time for my classes.', 'Over the past 30 days', 'education', 'functioning'),
          ipfPrompt('ipf-61', '61. I had trouble being supportive of my classmates’ achievements.', 'Over the past 30 days', 'education', 'impairment'),
          ipfPrompt('ipf-62', '62. I turned in assignments late.', 'Over the past 30 days', 'education', 'impairment'),
          ipfPrompt('ipf-63', '63. I solved problems and challenges in class without much difficulty.', 'Over the past 30 days', 'education', 'functioning'),
          ipfPrompt('ipf-64', '64. I took responsibility for my schoolwork.', 'Over the past 30 days', 'education', 'functioning'),
          ipfPrompt('ipf-65', '65. I was patient with my classmates and/or instructors.', 'Over the past 30 days', 'education', 'functioning'),
          ipfPrompt('ipf-66', '66. I had trouble settling disagreements or arguments with instructors and/or classmates.', 'Over the past 30 days', 'education', 'impairment'),
          ipfPrompt('ipf-67', '67. I had trouble remembering what the instructor said.', 'Over the past 30 days', 'education', 'impairment'),
          ipfPrompt('ipf-68', '68. I could easily remember what I read.', 'Over the past 30 days', 'education', 'functioning'),
          ipfPrompt('ipf-69', '69. I understood course material.', 'Over the past 30 days', 'education', 'functioning'),
          ipfPrompt('ipf-70', '70. When necessary, I cooperated with classmates.', 'Over the past 30 days', 'education', 'functioning'),
          ipfPrompt('ipf-71', '71. I got along with classmates and/or instructors.', 'Over the past 30 days', 'education', 'functioning'),
          ipfPrompt('ipf-72', '72. I completed my schoolwork to the best of my ability.', 'Over the past 30 days', 'education', 'functioning')
        ]
      },
      {
        id: 'self_care',
        title: 'Self care',
        description: 'Over the past 30 days',
        minAnsweredRatioForOfficialScore: 0.8,
        prompts: [
          ipfPrompt('ipf-73', '73. I had trouble keeping up with household chores (for example, cleaning, cooking, yard work, etc).', 'Over the past 30 days', 'self_care', 'impairment'),
          ipfPrompt('ipf-74', '74. I maintained good personal hygiene and grooming (for example, showering, brushing teeth, etc).', 'Over the past 30 days', 'self_care', 'functioning'),
          ipfPrompt('ipf-75', '75. I had trouble managing my medical care (for example, medications, doctors’ appointments, physical therapy, etc).', 'Over the past 30 days', 'self_care', 'impairment'),
          ipfPrompt('ipf-76', '76. I ate healthy and nutritious meals.', 'Over the past 30 days', 'self_care', 'functioning'),
          ipfPrompt('ipf-77', '77. I had trouble keeping up with chores outside the house (shopping, appointments, other errands).', 'Over the past 30 days', 'self_care', 'impairment'),
          ipfPrompt('ipf-78', '78. I had trouble managing my finances.', 'Over the past 30 days', 'self_care', 'impairment'),
          ipfPrompt('ipf-79', '79. I was physically active (for example, walking, exercising, playing sports, gardening, etc).', 'Over the past 30 days', 'self_care', 'functioning'),
          ipfPrompt('ipf-80', '80. I spent time doing activities or hobbies that were fun or relaxing.', 'Over the past 30 days', 'self_care', 'functioning')
        ]
      }
    ]
  },
  {
    type: 'b_ipf',
    stage: 'renewal',
    label: 'Brief Inventory of Psychosocial Functioning (B-IPF)',
    shortLabel: 'B-IPF',
    description: '7-item National Center for PTSD measure of psychosocial functioning over the past 30 days.',
    passThreshold: 4,
    passThresholdLabel: 'App gate: 4.0+ functioning average',
    passScoreLabel: 'ATLAS app gate mean functioning',
    officialScoreLabel: 'Official B-IPF total impairment',
    officialRules: [
      'Official B-IPF scoring sums only completed applicable items, divides by the highest possible score for those items, and multiplies by 100.',
      'B-IPF higher official scores indicate greater functional impairment.',
      'Use N/A when a domain has not been relevant in the past 30 days; N/A items are excluded from the official denominator.',
      'The ATLAS app gate is separate from the PTSD standard and uses a 0-6 functioning mean with a 4.0 minimum threshold.'
    ],
    answerScale: B_IPF_SCALE,
    sections: [
      {
        id: 'bipf_overall',
        title: 'B-IPF',
        description: 'Overall, in the past 30 days',
        minAnsweredRatioForOfficialScore: 0,
        prompts: [
          bipfPrompt('bipf-1', '1. I had trouble in my romantic relationship with my spouse or partner.', 'Overall, in the past 30 days', 'bipf_overall'),
          bipfPrompt('bipf-2', '2. I had trouble in my relationship with my children.', 'Overall, in the past 30 days', 'bipf_overall'),
          bipfPrompt('bipf-3', '3. I had trouble with my family relationships.', 'Overall, in the past 30 days', 'bipf_overall'),
          bipfPrompt('bipf-4', '4. I had trouble with my friendships and socializing.', 'Overall, in the past 30 days', 'bipf_overall'),
          bipfPrompt('bipf-5', '5. I had trouble at work.', 'Overall, in the past 30 days', 'bipf_overall'),
          bipfPrompt('bipf-6', '6. I had trouble with my training and education.', 'Overall, in the past 30 days', 'bipf_overall'),
          bipfPrompt('bipf-7', '7. I had trouble with day to day activities, such as doing household chores, running errands and managing my medical care.', 'Overall, in the past 30 days', 'bipf_overall')
        ]
      }
    ]
  }
]

const DEFINITION_BY_TYPE = new Map(ASSESSMENT_DEFINITIONS.map((definition) => [definition.type, definition]))

export function getAssessmentDefinition(testType: RegulationTestType) {
  return DEFINITION_BY_TYPE.get(testType) || null
}

export function isRenewalAssessmentType(testType: RegulationTestType) {
  const definition = getAssessmentDefinition(testType)
  return definition?.stage === 'renewal'
}

export function flattenAssessmentPrompts(definition: AssessmentDefinition) {
  return definition.sections.flatMap((section) => section.prompts)
}

function roundMetric(value: number) {
  return Number(value.toFixed(2))
}

function getPromptNumericValue(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isPromptAnswered(prompt: AssessmentPromptDefinition, value: number | null | undefined) {
  const numericValue = getPromptNumericValue(value)
  if (numericValue === null) return false
  if (prompt.kind === 'applicability') {
    return numericValue === APPLICABILITY_NO || numericValue === APPLICABILITY_YES
  }
  if (prompt.allowsNotApplicable && numericValue === NOT_APPLICABLE_SENTINEL) return true
  return numericValue >= prompt.min && numericValue <= prompt.max
}

function toFunctioningValue(prompt: AssessmentPromptDefinition, value: number) {
  if (prompt.scoringDirection === 'functioning') return value
  if (prompt.scoringDirection === 'impairment') return prompt.max - value
  return value
}

function toImpairmentValue(prompt: AssessmentPromptDefinition, value: number) {
  if (prompt.scoringDirection === 'functioning') return prompt.max - value
  if (prompt.scoringDirection === 'impairment') return value
  return value
}

function computeRegulationScoreSummary(definition: AssessmentDefinition, answerMap: Map<string, number | null>): AssessmentScoreSummary {
  const prompts = flattenAssessmentPrompts(definition)
  const numericValues = prompts
    .map((prompt) => getPromptNumericValue(answerMap.get(prompt.id)))
    .filter((value): value is number => typeof value === 'number')
  if (!numericValues.length) {
    return {
      gateScore: null,
      passThreshold: definition.passThreshold,
      passed: null,
      officialScore: null,
      officialScoreLabel: null,
      gateScoreLabel: definition.passScoreLabel,
      detailMetrics: []
    }
  }

  const gateScore =
    definition.type === 'mh_sca'
      ? numericValues.reduce((sum, value) => sum + value, 0)
      : roundMetric(numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length)

  return {
    gateScore,
    passThreshold: definition.passThreshold,
    passed: gateScore >= definition.passThreshold,
    officialScore: null,
    officialScoreLabel: null,
    gateScoreLabel: definition.passScoreLabel,
    detailMetrics: []
  }
}

function computeIpfScoreSummary(definition: AssessmentDefinition, answerMap: Map<string, number | null>): AssessmentScoreSummary {
  // Section-level detail metrics preserve official Post-Traumatic Stress Disorder (PTSD) scoring constraints while
  // also providing app-gate values used by Atlas (ATLAS) routing decisions.
  const detailMetrics = definition.sections.map((section) => {
    const sectionPrompts = section.prompts.filter((prompt) => prompt.kind === 'number')
    const applicabilityPrompt = section.applicabilityPromptId
      ? section.prompts.find((prompt) => prompt.id === section.applicabilityPromptId) || null
      : null
    const applicabilityValue = applicabilityPrompt ? getPromptNumericValue(answerMap.get(applicabilityPrompt.id)) : APPLICABILITY_YES
    const isApplicable = applicabilityPrompt ? applicabilityValue === APPLICABILITY_YES : true
    const answeredValues = sectionPrompts
      .map((prompt) => ({ prompt, value: getPromptNumericValue(answerMap.get(prompt.id)) }))
      .filter((entry): entry is { prompt: AssessmentPromptDefinition; value: number } => typeof entry.value === 'number')
    const answeredCount = answeredValues.length
    const totalCount = sectionPrompts.length
    const ratio = totalCount ? answeredCount / totalCount : 0
    const isOfficiallyScored = isApplicable && answeredCount > 0 && ratio >= (section.minAnsweredRatioForOfficialScore || 0)
    const officialImpairmentScore = isOfficiallyScored
      ? roundMetric(
          (answeredValues.reduce((sum, entry) => sum + toImpairmentValue(entry.prompt, entry.value), 0) / (answeredCount * 6)) * 100
        )
      : null
    const appGateScore = isOfficiallyScored
      ? roundMetric(answeredValues.reduce((sum, entry) => sum + toFunctioningValue(entry.prompt, entry.value), 0) / answeredCount)
      : null

    return {
      id: section.id,
      label: section.title,
      answeredCount,
      totalCount,
      isApplicable,
      isOfficiallyScored,
      officialImpairmentScore,
      appGateScore
    } satisfies AssessmentDerivedMetric
  })

  const scoredSections = detailMetrics.filter((metric) => metric.isOfficiallyScored)
  const officialScore = scoredSections.length
    ? roundMetric(
        scoredSections.reduce((sum, metric) => sum + (metric.officialImpairmentScore || 0), 0) / scoredSections.length
      )
    : null
  const gateScore = scoredSections.length
    ? roundMetric(scoredSections.reduce((sum, metric) => sum + (metric.appGateScore || 0), 0) / scoredSections.length)
    : null

  return {
    gateScore,
    passThreshold: definition.passThreshold,
    passed: typeof gateScore === 'number' ? gateScore >= definition.passThreshold : null,
    officialScore,
    officialScoreLabel: definition.officialScoreLabel,
    gateScoreLabel: definition.passScoreLabel,
    detailMetrics
  }
}

function computeBipfScoreSummary(definition: AssessmentDefinition, answerMap: Map<string, number | null>): AssessmentScoreSummary {
  const prompts = flattenAssessmentPrompts(definition)
  const answeredValues = prompts
    .map((prompt) => ({ prompt, value: getPromptNumericValue(answerMap.get(prompt.id)) }))
    .filter(
      (entry): entry is { prompt: AssessmentPromptDefinition; value: number } =>
        typeof entry.value === 'number' && entry.value >= entry.prompt.min && entry.value <= entry.prompt.max
    )
  const detailMetrics: AssessmentDerivedMetric[] = [
    {
      id: 'bipf-total',
      label: 'B-IPF total',
      answeredCount: answeredValues.length,
      totalCount: prompts.length,
      isApplicable: true,
      isOfficiallyScored: answeredValues.length > 0,
      officialImpairmentScore: answeredValues.length
        ? roundMetric((answeredValues.reduce((sum, entry) => sum + entry.value, 0) / (answeredValues.length * 6)) * 100)
        : null,
      appGateScore: answeredValues.length
        ? roundMetric(answeredValues.reduce((sum, entry) => sum + toFunctioningValue(entry.prompt, entry.value), 0) / answeredValues.length)
        : null
    }
  ]

  return {
    gateScore: detailMetrics[0].appGateScore,
    passThreshold: definition.passThreshold,
    passed: typeof detailMetrics[0].appGateScore === 'number' ? detailMetrics[0].appGateScore >= definition.passThreshold : null,
    officialScore: detailMetrics[0].officialImpairmentScore,
    officialScoreLabel: definition.officialScoreLabel,
    gateScoreLabel: definition.passScoreLabel,
    detailMetrics
  }
}

export function computeAssessmentScoreSummary(
  testType: RegulationTestType,
  answers: Array<{ promptId: string; responseValue: number | null }>
): AssessmentScoreSummary {
  const definition = getAssessmentDefinition(testType)
  if (!definition) {
    return {
      gateScore: null,
      passThreshold: 0,
      passed: null,
      officialScore: null,
      officialScoreLabel: null,
      gateScoreLabel: 'Score',
      detailMetrics: []
    }
  }

  const answerMap = new Map(answers.map((answer) => [answer.promptId, answer.responseValue]))

  switch (testType) {
    case 'mh_sca':
    case 'svs':
      return computeRegulationScoreSummary(definition, answerMap)
    case 'ipf':
      return computeIpfScoreSummary(definition, answerMap)
    case 'b_ipf':
      return computeBipfScoreSummary(definition, answerMap)
    default:
      return {
        gateScore: null,
        passThreshold: definition.passThreshold,
        passed: null,
        officialScore: null,
        officialScoreLabel: definition.officialScoreLabel,
        gateScoreLabel: definition.passScoreLabel,
        detailMetrics: []
      }
  }
}

export function isAssessmentPromptComplete(prompt: AssessmentPromptDefinition, responseValue: number | null | undefined) {
  return isPromptAnswered(prompt, responseValue)
}
