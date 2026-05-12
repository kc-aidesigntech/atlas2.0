import type {
  DomainLoad,
  DomainLoadBreakdown,
  DomainLoadBreakdownRow,
  DomainLoadBucket,
  PartnerServiceCapacitySubmissionRecord,
  PartnerStationSpecialtyGroup
} from '@/features/atlas2026/singlepane/types'
import {
  ZCODE_DOMAIN_SCORE_RANGE,
  ZCODE_DOMAIN_SURVEY_FORM_VERSION
} from '@/features/atlas2026/singlepane/data/serviceCapacitySurveyCatalog'

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

function isDomainSpectrumSurveyForm(formVersion: string | null | undefined) {
  return (formVersion || '').trim() === ZCODE_DOMAIN_SURVEY_FORM_VERSION
}

function clampDomainSpectrumScore(score: number) {
  return Math.max(ZCODE_DOMAIN_SCORE_RANGE.min, Math.min(ZCODE_DOMAIN_SCORE_RANGE.max, score))
}

function projectDomainSpectrumScore(score: number) {
  const clampedScore = clampDomainSpectrumScore(score)
  if (clampedScore <= 33) {
    const t = (clampedScore - 1) / 32
    return {
      habitat: 1 - t,
      socialNetworks: t,
      work: 0
    }
  }
  if (clampedScore <= 66) {
    const t = (clampedScore - 33) / 33
    return {
      habitat: 0,
      socialNetworks: 1 - t,
      work: t
    }
  }
  const t = (clampedScore - 66) / 33
  return {
    habitat: t,
    socialNetworks: 0,
    work: 1 - t
  }
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
    parentCode: normalizeParentCode(answer.parentCode),
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
  if (isDomainSpectrumSurveyForm(submission.formVersion)) {
    // Domain-spectrum submissions model chart placement instead of specialty burden thresholds.
    // Existing specialty chips remain tied to classic burden-form submissions only.
    return []
  }

  const grouped = new Map<string, PartnerStationSpecialtyGroup['zCodes']>()
  const totalByParent = new Map<string, Set<string>>()
  const strengthByParent = new Map<string, Set<string>>()
  submission.answers.forEach((answer) => {
    const parentCode = normalizeParentCode(answer.parentCode)
    const normalizedZCode = normalizeZCode(answer.normalizedZCode || answer.zCode)
    if (!parentCode || !normalizedZCode) return
    const totalCodes = totalByParent.get(parentCode) || new Set<string>()
    totalCodes.add(normalizedZCode)
    totalByParent.set(parentCode, totalCodes)
    if (answer.notEncountered || typeof answer.score !== 'number' || answer.score <= 6) return
    const strengthCodes = strengthByParent.get(parentCode) || new Set<string>()
    strengthCodes.add(normalizedZCode)
    strengthByParent.set(parentCode, strengthCodes)
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
        zCodes: sortedZCodes,
        strengthCount: strengthByParent.get(parentCode)?.size || sortedZCodes.length,
        totalCount: totalByParent.get(parentCode)?.size || sortedZCodes.length
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
  const domainSpectrumByZCode = new Map<
    string,
    {
      zCodeGroup: string
      parentCode: string
      habitatTotal: number
      socialNetworksTotal: number
      workTotal: number
      count: number
    }
  >()

  selectedSubmissions.forEach((submission) => {
    submission.answers.forEach((answer) => {
      if (answer.notEncountered || typeof answer.score !== 'number') return
      const normalizedZCode = normalizeZCode(answer.normalizedZCode || answer.zCode)
      const parentCode = normalizeParentCode(answer.parentCode)
      if (!normalizedZCode || !parentCode) return
      if (isDomainSpectrumSurveyForm(submission.formVersion)) {
        // Domain-spectrum submissions encode a cyclic position across habitat, social networks,
        // and work, so each answer contributes weighted signal to all three radial axes.
        const projected = projectDomainSpectrumScore(answer.score)
        const current = domainSpectrumByZCode.get(normalizedZCode) || {
          zCodeGroup: answer.zCode,
          parentCode,
          habitatTotal: 0,
          socialNetworksTotal: 0,
          workTotal: 0,
          count: 0
        }
        current.habitatTotal += projected.habitat * 9
        current.socialNetworksTotal += projected.socialNetworks * 9
        current.workTotal += projected.work * 9
        current.count += 1
        domainSpectrumByZCode.set(normalizedZCode, current)
        return
      }
      const burdenScore = Math.max(0, 9 - answer.score)
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

  const domainSpectrumRows = Array.from(domainSpectrumByZCode.entries()).flatMap(([normalizedZCode, entry]) => {
    if (!entry.count) return []
    return [
      {
        id: `${normalizedZCode}-habitat`,
        zCodeGroup: entry.zCodeGroup,
        parentCode: entry.parentCode,
        mappedDomain: 'habitat' as const,
        rawCount: entry.habitatTotal / entry.count,
        responseCount: entry.count
      },
      {
        id: `${normalizedZCode}-social`,
        zCodeGroup: entry.zCodeGroup,
        parentCode: entry.parentCode,
        mappedDomain: 'socialNetworks' as const,
        rawCount: entry.socialNetworksTotal / entry.count,
        responseCount: entry.count
      },
      {
        id: `${normalizedZCode}-work`,
        zCodeGroup: entry.zCodeGroup,
        parentCode: entry.parentCode,
        mappedDomain: 'work' as const,
        rawCount: entry.workTotal / entry.count,
        responseCount: entry.count
      }
    ] satisfies DomainLoadBreakdownRow[]
  })

  const burdenRows = Array.from(burdenByZCode.entries()).map<DomainLoadBreakdownRow>(([normalizedZCode, entry]) => ({
    id: normalizedZCode,
    zCodeGroup: entry.zCodeGroup,
    parentCode: entry.parentCode,
    mappedDomain: entry.mappedDomain,
    rawCount: entry.count ? entry.total / entry.count : 0,
    responseCount: entry.count
  }))

  const rows = (domainSpectrumRows.length ? domainSpectrumRows : burdenRows).sort((left, right) => {
    const parentOrder = sortCodes(left.parentCode || '', right.parentCode || '')
    return parentOrder || sortCodes(left.zCodeGroup, right.zCodeGroup)
  })

  if (!rows.length) return null

  const totals = toDomainTotals(rows)
  return {
    subjectId: options.subjectId,
    subjectLabel: options.subjectLabel,
    sourceKind: 'partnerSurvey',
    sourceLabel: domainSpectrumRows.length
      ? `partner domain spectrum average · last ${selectedSubmissions.length} completed`
      : `partner burden survey average · last ${selectedSubmissions.length} completed`,
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
