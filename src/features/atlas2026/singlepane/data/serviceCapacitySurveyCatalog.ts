import type {
  PartnerServiceCapacityAnswer,
  PartnerServiceCapacityScaleOption,
  ZCodeSurveyPrompt,
  ZCodeSurveySection
} from '@/features/atlas2026/singlepane/types'

export const SERVICE_CAPACITY_FORM_VERSION = '2026-z-burden-v1'
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
    score: 5
  }))
}

export function getScaleOption(scale: PartnerServiceCapacityScaleOption[], value: number) {
  return scale.find((option) => option.value === value) || scale[4] || { value: 5, label: 'mixed fit', description: '' }
}
