import type {
  CreateInsightRow,
  CreateSessionRecord,
  IpsCompetencySelfAssessmentRecord,
  IpsccCompetencyAggregate,
  IpsccCompetencyKey,
  IpsccEncounterSubmissionRecord,
  IpsccSelfAwarenessCorrelationRow,
  IpsccSelfAwarenessSummary,
  NavigatorSelfAssessmentRecord,
  NavigatorSelfAssessmentSummary
} from '@/features/atlas2026/shared/contracts'
import { IPSCC_COMPETENCY_DEFINITIONS } from '@/features/atlas2026/singlepane/data/intentionalPeerSupportCatalog'
import { mapItemScoresToCompetencyScores } from '@/features/atlas2026/singlepane/domain/ipsccSeeds'

// Intentional Peer Support Core Competencies (IPSCC) aggregates preserve privacy and comparison semantics.
export function buildNavigatorSelfAssessmentSummary(records: NavigatorSelfAssessmentRecord[]): NavigatorSelfAssessmentSummary {
  if (!records.length) {
    return {
      responseCount: 0,
      averageStressLoad: 0,
      averageConfidence: 0,
      averageSupport: 0,
      averageComposite: 0,
      latestSubmittedAtIso: null
    }
  }
  const totals = records.reduce(
    (sum, record) => {
      sum.stress += record.stressLoadScore
      sum.confidence += record.confidenceScore
      sum.support += record.supportScore
      return sum
    },
    { stress: 0, confidence: 0, support: 0 }
  )
  const count = records.length
  const latest = records
    .slice()
    .sort((left, right) => new Date(right.submittedAtIso).getTime() - new Date(left.submittedAtIso).getTime())[0]
  const averageStressLoad = Number((totals.stress / count).toFixed(2))
  const averageConfidence = Number((totals.confidence / count).toFixed(2))
  const averageSupport = Number((totals.support / count).toFixed(2))
  return {
    responseCount: count,
    averageStressLoad,
    averageConfidence,
    averageSupport,
    averageComposite: Number(((averageStressLoad + averageConfidence + averageSupport) / 3).toFixed(2)),
    latestSubmittedAtIso: latest?.submittedAtIso || null
  }
}

export function buildIpsccCompetencyAggregates(records: IpsccEncounterSubmissionRecord[]): IpsccCompetencyAggregate[] {
  return IPSCC_COMPETENCY_DEFINITIONS.map((definition) => {
    const perEncounter = records
      .map((record) => mapItemScoresToCompetencyScores(record.itemScores)[definition.key])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    const averageScore = perEncounter.length
      ? Number((perEncounter.reduce((sum, value) => sum + value, 0) / perEncounter.length).toFixed(2))
      : null
    const latestSubmittedAtIso = records
      .slice()
      .sort((left, right) => new Date(right.submittedAtIso).getTime() - new Date(left.submittedAtIso).getTime())[0]?.submittedAtIso || null
    return {
      key: definition.key,
      label: definition.label,
      sampleSize: perEncounter.length,
      averageScore,
      latestSubmittedAtIso
    }
  })
}

/**
 * Strip enrollee IPSCC averages until the anonymity threshold is met.
 * Sample sizes remain visible so navigators can see progress toward unlock.
 */
export function gateIpsccAggregatesForNavigatorPrivacy(
  aggregates: IpsccCompetencyAggregate[],
  totalEncounterSubmissions: number,
  minEntries: number
): IpsccCompetencyAggregate[] {
  if (totalEncounterSubmissions >= minEntries) return aggregates
  return aggregates.map((row) => ({
    ...row,
    averageScore: null
  }))
}

export function buildIpsSelfAssessmentAverages(records: IpsCompetencySelfAssessmentRecord[]): Record<IpsccCompetencyKey, number | null> {
  return Object.fromEntries(
    IPSCC_COMPETENCY_DEFINITIONS.map((definition) => {
      const values = records
        .map((record) => record.competencyScores[definition.key])
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      const average = values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null
      return [definition.key, average]
    })
  ) as Record<IpsccCompetencyKey, number | null>
}

/**
 * Self-awareness = alignment between enrollee Intentional Peer Support Core
 * Competencies (IPSCC) point-of-care averages and the navigator's weekly IPSCC
 * self-assessment averages (completed before supervision).
 * Positive gap means the navigator self-rates higher than enrollees report.
 * Strain is absolute gap — larger strain extends care-disruption risk on that competency.
 */
export function buildIpsccVsSelfAwarenessCorrelation(
  ipsccAggregates: IpsccCompetencyAggregate[],
  selfAverages: Record<IpsccCompetencyKey, number | null>
): { rows: IpsccSelfAwarenessCorrelationRow[]; summary: IpsccSelfAwarenessSummary } {
  const ipsccByKey = Object.fromEntries(
    ipsccAggregates.map((row) => [row.key, row.averageScore])
  ) as Record<IpsccCompetencyKey, number | null>
  const rows = IPSCC_COMPETENCY_DEFINITIONS.map((definition) => {
    const selfAverage = selfAverages[definition.key] ?? null
    const ipsccAverage = ipsccByKey[definition.key] ?? null
    const hasPair = typeof ipsccAverage === 'number' && typeof selfAverage === 'number'
    const gap = hasPair ? Number((selfAverage - ipsccAverage).toFixed(2)) : null
    const strain = hasPair ? Number(Math.abs(gap || 0).toFixed(2)) : null
    // Alignment compresses absolute gap into 0..1 where 1 means exact agreement.
    const alignmentScore = hasPair ? Number((Math.max(0, 1 - Math.abs(gap || 0) / 4)).toFixed(2)) : null
    return {
      key: definition.key,
      label: definition.label,
      ipsccAverage,
      selfAverage,
      gap,
      strain,
      alignmentScore
    }
  })
  const comparableRows = rows.filter((row) => typeof row.gap === 'number' && typeof row.alignmentScore === 'number')
  const averageGap = comparableRows.length
    ? Number((comparableRows.reduce((sum, row) => sum + Math.abs(row.gap || 0), 0) / comparableRows.length).toFixed(2))
    : null
  const averageStrain = averageGap
  const overallAlignmentScore = comparableRows.length
    ? Number((comparableRows.reduce((sum, row) => sum + (row.alignmentScore || 0), 0) / comparableRows.length).toFixed(2))
    : null
  return {
    rows,
    summary: {
      comparedCompetencyCount: comparableRows.length,
      averageGap,
      overallAlignmentScore,
      averageStrain
    }
  }
}

export function buildCreateInsights(records: CreateSessionRecord[]): CreateInsightRow[] {
  const pillars: Array<{ key: CreateInsightRow['pillar']; label: string; pick: (record: CreateSessionRecord) => string }> = [
    { key: 'connect', label: 'Connect', pick: (record) => (record.connectFocusedListening ? 'Yes - focused listening documented.' : 'No - follow-up needed.') },
    { key: 'recognize', label: 'Recognize', pick: (record) => record.recognizeNotes },
    { key: 'encourage', label: 'Encourage', pick: (record) => record.encourageNotes },
    { key: 'acknowledge', label: 'Acknowledge', pick: (record) => record.acknowledgeNotes },
    { key: 'train', label: 'Train', pick: (record) => record.trainNotes },
    { key: 'empower', label: 'Empower', pick: (record) => record.empowerNotes }
  ]
  const sorted = records
    .slice()
    .sort((left, right) => new Date(right.sessionAtIso).getTime() - new Date(left.sessionAtIso).getTime())
  return pillars.map((pillar) => {
    const allSummaries = sorted.map((record) => pillar.pick(record).trim()).filter(Boolean)
    return {
      pillar: pillar.key,
      label: pillar.label,
      latestSummary: allSummaries[0] || 'No notes recorded yet.',
      sessionCount: allSummaries.length
    }
  })
}
