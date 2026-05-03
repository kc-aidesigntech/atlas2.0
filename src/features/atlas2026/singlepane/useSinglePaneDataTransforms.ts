import type {
  AccountSettings,
  AtlasRole,
  EnrolleeProfile,
  NavigatorCompetencyAssessmentRecord,
  PartnerServiceCapacityHeader,
  PartnerServiceCapacitySubmissionRecord,
  RegulationTestSubmissionRecord,
  SupervisorNavigatorCompetencySummary
} from '@/features/atlas2026/singlepane/types'
import { splitFullName } from '@/features/atlas2026/singlepane/personNameUtils'

function sortByIsoDesc(leftIso: string, rightIso: string) {
  return new Date(rightIso).getTime() - new Date(leftIso).getTime()
}

function upsertAndSortNewestFirst<T extends { id: string; draftKey: string }>(
  current: T[],
  incoming: T,
  getSortIso: (record: T) => string
) {
  const next = current.filter((record) => record.id !== incoming.id && record.draftKey !== incoming.draftKey)
  return [incoming, ...next].sort((left, right) => sortByIsoDesc(getSortIso(left), getSortIso(right)))
}

/**
 * Keep service-capacity form defaults aligned with account profile fields so a
 * returning partner starts with prefilled identity metadata.
 */
export function buildPartnerServiceCapacityDefaultHeader(
  accountSettings: AccountSettings,
  role: AtlasRole
): PartnerServiceCapacityHeader {
  const splitName = splitFullName(accountSettings.fullName)
  return {
    firstName: splitName.firstName,
    lastName: splitName.lastName,
    email: accountSettings.email || '',
    organizationName: accountSettings.organization || '',
    jobTitle: '',
    respondentRoles: role === 'administrator' ? ['administrator'] : ['direct_service_provider'],
    otherRoleText: ''
  }
}

/**
 * Applies weighted rolling averages for supervisor scorecards while preserving
 * deterministic ordering and null-safe behavior for sparse history.
 */
export function buildSupervisorNavigatorCompetencySummaries(
  enrollees: EnrolleeProfile[],
  navigatorCompetencyAssessments: NavigatorCompetencyAssessmentRecord[]
): SupervisorNavigatorCompetencySummary[] {
  const navigatorNames = Array.from(new Set(enrollees.map((enrollee) => enrollee.assignedNavigator).filter(Boolean)))
  return navigatorNames.map((navigatorName) => {
    const records = navigatorCompetencyAssessments
      .filter((assessment) => assessment.navigatorName === navigatorName)
      .sort((left, right) => sortByIsoDesc(left.submittedAtIso, right.submittedAtIso))
    const weightMap = [3, 2, 1]
    const weighted = records.slice(0, 3).map((record, index) => {
      const avg = record.answers.length
        ? record.answers.reduce((sum, answer) => sum + answer.score, 0) / record.answers.length
        : 0
      return { avg, weight: weightMap[index] || 1 }
    })
    const weightedScore = weighted.reduce((sum, item) => sum + item.avg * item.weight, 0)
    const weightTotal = weighted.reduce((sum, item) => sum + item.weight, 0)
    return {
      navigatorName,
      assessmentCount: records.length,
      weightedRollingAverage: weightTotal ? Number((weightedScore / weightTotal).toFixed(2)) : 0,
      lastAssessmentAtIso: records[0]?.submittedAtIso || null
    } satisfies SupervisorNavigatorCompetencySummary
  })
}

export function upsertServiceCapacitySubmissionHistory(
  current: PartnerServiceCapacitySubmissionRecord[],
  saved: PartnerServiceCapacitySubmissionRecord
) {
  return upsertAndSortNewestFirst(current, saved, (record) => record.updatedAtIso || record.submittedAtIso)
}

export function upsertRegulationTestHistory(
  current: RegulationTestSubmissionRecord[],
  saved: RegulationTestSubmissionRecord
) {
  return upsertAndSortNewestFirst(current, saved, (record) => record.updatedAtIso)
}
