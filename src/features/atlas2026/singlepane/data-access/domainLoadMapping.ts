import type {
  DomainLoad,
  DomainLoadBreakdown,
  DomainLoadBreakdownRow,
  DomainLoadBucket
} from '@/features/atlas2026/singlepane/types'

interface BurdenAnswerLike {
  parentCode: string
  zCode: string
  normalizedZCode: string
  title: string
  description: string
  score: number | null
  notEncountered: boolean
}

interface SurveyBreakdownOptions<TAnswer extends BurdenAnswerLike> {
  subjectId: string
  subjectLabel: string
  sourceKind: DomainLoadBreakdown['sourceKind']
  sourceLabel: string
  answers: TAnswer[]
}

const WORK_PARENT_CODES = new Set(['Z55', 'Z56', 'Z57'])
const HABITAT_PARENT_CODES = new Set(['Z58', 'Z59'])

export function mapZCodeToDomainBucket(parentCode: string, normalizedZCode?: string): DomainLoadBucket {
  const normalizedParentCode = (parentCode || normalizedZCode || '').trim().toUpperCase().slice(0, 3)
  if (WORK_PARENT_CODES.has(normalizedParentCode)) return 'work'
  if (HABITAT_PARENT_CODES.has(normalizedParentCode)) return 'habitat'
  return 'socialNetworks'
}

function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function toDomainTotals(rows: DomainLoadBreakdownRow[]) {
  const habitatValues = rows.filter((row) => row.mappedDomain === 'habitat').map((row) => row.rawCount)
  const workValues = rows.filter((row) => row.mappedDomain === 'work').map((row) => row.rawCount)
  const socialValues = rows.filter((row) => row.mappedDomain === 'socialNetworks').map((row) => row.rawCount)

  return {
    habitatTotal: average(habitatValues),
    workTotal: average(workValues),
    socialNetworksTotal: average(socialValues)
  }
}

export function buildSurveyDomainLoadBreakdown<TAnswer extends BurdenAnswerLike>(
  options: SurveyBreakdownOptions<TAnswer>
): DomainLoadBreakdown {
  const strongestAnswerByZCode = new Map<string, TAnswer>()
  options.answers.forEach((answer) => {
    if (answer.notEncountered || typeof answer.score !== 'number') return
    const normalizedZCode = answer.normalizedZCode.trim().toUpperCase()
    const existing = strongestAnswerByZCode.get(normalizedZCode)
    if (!existing || (existing.score ?? 0) < answer.score) {
      strongestAnswerByZCode.set(normalizedZCode, answer)
    }
  })

  const rows = Array.from(strongestAnswerByZCode.values()).map<DomainLoadBreakdownRow>((answer) => ({
    id: answer.normalizedZCode,
    zCodeGroup: answer.zCode,
    mappedDomain: mapZCodeToDomainBucket(answer.parentCode, answer.normalizedZCode),
    rawCount: answer.score ?? 0,
    responseCount: 1
  }))

  const totals = toDomainTotals(rows)
  return {
    subjectId: options.subjectId,
    subjectLabel: options.subjectLabel,
    sourceKind: options.sourceKind,
    sourceLabel: options.sourceLabel,
    rows,
    ...totals
  }
}

/**
 * Domain load mapping helpers shared by repositories/hooks.
 *
 * Purpose:
 * - centralize raw domain aggregation from breakdown totals.
 * - keep radial-chart values aligned to the same mapped-domain rows used in overlays.
 */
export function toNormalizedRadialDomainLoad(breakdown: DomainLoadBreakdown | null): DomainLoad | null {
  if (!breakdown) return null
  return {
    enrolleeId: breakdown.subjectId,
    habitat: breakdown.habitatTotal,
    work: breakdown.workTotal,
    socialNetworks: breakdown.socialNetworksTotal
  }
}
