import type {
  DomainLoad,
  DomainLoadBreakdown,
  DomainLoadBreakdownRow,
  DomainLoadBucket,
  PartnerServiceCapacitySubmissionRecord,
  PartnerStationSpecialtyGroup
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

function sortCodes(left: string, right: string) {
  return left.localeCompare(right, undefined, { numeric: true })
}

function normalizeParentCode(value: string) {
  const trimmed = value.trim().toUpperCase()
  const match = trimmed.match(/^Z?(\d{2})$/)
  return match ? `Z${match[1]}` : ''
}

function normalizeZCode(value: string) {
  return value.trim().toUpperCase()
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

export function derivePartnerStationSpecialtyGroups(
  submission: PartnerServiceCapacitySubmissionRecord | null
): PartnerStationSpecialtyGroup[] {
  if (!submission) return []

  const grouped = new Map<string, PartnerStationSpecialtyGroup['zCodes']>()
  submission.answers.forEach((answer) => {
    if (answer.notEncountered || typeof answer.score !== 'number' || answer.score <= 6) return
    const parentCode = normalizeParentCode(answer.parentCode)
    const normalizedZCode = normalizeZCode(answer.normalizedZCode || answer.zCode)
    if (!parentCode || !normalizedZCode) return
    const current = grouped.get(parentCode) || []
    const existingIndex = current.findIndex((item) => item.normalizedZCode === normalizedZCode)
    const nextItem = {
      promptId: answer.promptId,
      zCode: answer.zCode,
      normalizedZCode,
      title: answer.title,
      description: answer.description,
      score: answer.score
    }
    if (existingIndex === -1) {
      current.push(nextItem)
    } else if (current[existingIndex].score < answer.score) {
      current[existingIndex] = nextItem
    }
    grouped.set(parentCode, current)
  })

  return Array.from(grouped.entries())
    .sort(([left], [right]) => sortCodes(left, right))
    .map(([parentCode, zCodes]) => {
      const sortedZCodes = [...zCodes].sort((left, right) => sortCodes(left.normalizedZCode, right.normalizedZCode))
      return {
        parentCode,
        childCodes: sortedZCodes.map((item) => item.zCode),
        zCodes: sortedZCodes
      }
    })
}

export function buildPartnerBurdenBreakdownFromHistory(
  submissions: PartnerServiceCapacitySubmissionRecord[],
  options: { subjectId: string; subjectLabel: string }
): DomainLoadBreakdown | null {
  const selectedSubmissions = [...submissions]
    .filter((record) => record.status === 'completed')
    .sort((left, right) => {
      const leftTime = new Date(left.completedAtIso || left.updatedAtIso || left.submittedAtIso).getTime()
      const rightTime = new Date(right.completedAtIso || right.updatedAtIso || right.submittedAtIso).getTime()
      return rightTime - leftTime
    })
    .slice(0, 3)

  if (!selectedSubmissions.length) return null

  const burdenByZCode = new Map<
    string,
    {
      zCodeGroup: string
      parentCode: string
      mappedDomain: DomainLoadBucket
      total: number
      count: number
    }
  >()

  selectedSubmissions.forEach((submission) => {
    submission.answers.forEach((answer) => {
      if (answer.notEncountered || typeof answer.score !== 'number') return
      const normalizedZCode = normalizeZCode(answer.normalizedZCode || answer.zCode)
      const parentCode = normalizeParentCode(answer.parentCode)
      if (!normalizedZCode || !parentCode) return
      const burdenScore = 10 - answer.score
      const current = burdenByZCode.get(normalizedZCode) || {
        zCodeGroup: answer.zCode,
        parentCode,
        mappedDomain: mapZCodeToDomainBucket(parentCode, normalizedZCode),
        total: 0,
        count: 0
      }
      current.total += burdenScore
      current.count += 1
      burdenByZCode.set(normalizedZCode, current)
    })
  })

  const rows = Array.from(burdenByZCode.entries())
    .map<DomainLoadBreakdownRow>(([normalizedZCode, entry]) => ({
      id: normalizedZCode,
      zCodeGroup: entry.zCodeGroup,
      parentCode: entry.parentCode,
      mappedDomain: entry.mappedDomain,
      rawCount: entry.count ? entry.total / entry.count : 0,
      responseCount: entry.count
    }))
    .sort((left, right) => {
      const parentOrder = sortCodes(left.parentCode || '', right.parentCode || '')
      return parentOrder || sortCodes(left.zCodeGroup, right.zCodeGroup)
    })

  if (!rows.length) return null

  const totals = toDomainTotals(rows)
  return {
    subjectId: options.subjectId,
    subjectLabel: options.subjectLabel,
    sourceKind: 'partnerSurvey',
    sourceLabel: `partner burden survey average · last ${selectedSubmissions.length} completed`,
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
