import { useMemo } from 'react'

import {
  IPSCC_ENROLLEE_FEEDBACK_PRIVACY_MIN_ENTRIES,
  type NavigatorCompetencyAssessmentRecord,
  type NavigatorProgramState
} from '@/features/atlas2026/shared/contracts'
import {
  buildCreateInsights,
  buildIpsSelfAssessmentAverages,
  buildIpsccCompetencyAggregates,
  buildIpsccVsSelfAwarenessCorrelation,
  buildNavigatorSelfAssessmentSummary,
  gateIpsccAggregatesForNavigatorPrivacy
} from '@/features/atlas2026/singlepane/domain/ipsccAggregates'
import { buildIntervalDueItems } from '@/features/atlas2026/singlepane/domain/loadsRoutes'

interface UseNavigatorCompetencyDerivedInput {
  currentNavigatorName: string
  mergedNavigatorProgramState: NavigatorProgramState
  navigatorCompetencyAssessments: NavigatorCompetencyAssessmentRecord[]
}

/**
 * Derives navigator-facing Intentional Peer Support Core Competencies (IPSCC),
 * Intentional Peer Support (IPS), Connect, Recognize, Encourage, Acknowledge,
 * Train, and Empower (C.R.E.A.T.E.), self-assessment, and interval-due views.
 */
export function useNavigatorCompetencyDerived({
  currentNavigatorName,
  mergedNavigatorProgramState,
  navigatorCompetencyAssessments
}: UseNavigatorCompetencyDerivedInput) {
  const navigatorSelfAssessments = useMemo(
    () =>
      mergedNavigatorProgramState.selfAssessments
        .filter((record) => record.navigatorName === currentNavigatorName)
        .slice()
        .sort((left, right) => new Date(right.submittedAtIso).getTime() - new Date(left.submittedAtIso).getTime()),
    [currentNavigatorName, mergedNavigatorProgramState.selfAssessments]
  )
  const navigatorSelfAssessmentSummary = useMemo(
    () => buildNavigatorSelfAssessmentSummary(navigatorSelfAssessments),
    [navigatorSelfAssessments]
  )
  const navigatorIpsccEncounterSubmissions = useMemo(
    () =>
      mergedNavigatorProgramState.ipsccEncounterSubmissions
        .filter((record) => record.navigatorName === currentNavigatorName)
        .slice()
        .sort((left, right) => new Date(right.submittedAtIso).getTime() - new Date(left.submittedAtIso).getTime()),
    [currentNavigatorName, mergedNavigatorProgramState.ipsccEncounterSubmissions]
  )
  const navigatorIpsSelfAssessments = useMemo(
    () =>
      mergedNavigatorProgramState.ipsSelfAssessments
        .filter((record) => record.navigatorName === currentNavigatorName)
        .slice()
        .sort((left, right) => new Date(right.submittedAtIso).getTime() - new Date(left.submittedAtIso).getTime()),
    [currentNavigatorName, mergedNavigatorProgramState.ipsSelfAssessments]
  )
  const allSupervisorIpsAssessments = useMemo(
    () =>
      mergedNavigatorProgramState.supervisorIpsAssessments
        .slice()
        .sort((left, right) => new Date(right.submittedAtIso).getTime() - new Date(left.submittedAtIso).getTime()),
    [mergedNavigatorProgramState.supervisorIpsAssessments]
  )
  const navigatorSupervisorIpsAssessments = useMemo(
    () => allSupervisorIpsAssessments.filter((record) => record.navigatorName === currentNavigatorName),
    [allSupervisorIpsAssessments, currentNavigatorName]
  )
  const navigatorCreateSessions = useMemo(
    () =>
      mergedNavigatorProgramState.createSessions
        .filter((record) => record.navigatorName === currentNavigatorName)
        .slice()
        .sort((left, right) => new Date(right.sessionAtIso).getTime() - new Date(left.sessionAtIso).getTime()),
    [currentNavigatorName, mergedNavigatorProgramState.createSessions]
  )
  const navigatorIpsccCompetencyAggregatesRaw = useMemo(
    () => buildIpsccCompetencyAggregates(navigatorIpsccEncounterSubmissions),
    [navigatorIpsccEncounterSubmissions]
  )
  const navigatorIpsccEnrolleeFeedbackPrivacy = useMemo(() => {
    const totalEncounterSubmissions = navigatorIpsccEncounterSubmissions.length
    return {
      totalEncounterSubmissions,
      minEntriesToRevealAverages: IPSCC_ENROLLEE_FEEDBACK_PRIVACY_MIN_ENTRIES,
      averagesRevealed: totalEncounterSubmissions >= IPSCC_ENROLLEE_FEEDBACK_PRIVACY_MIN_ENTRIES
    }
  }, [navigatorIpsccEncounterSubmissions])
  // Navigator-facing aggregates never expose enrollee means below the privacy floor.
  const navigatorIpsccCompetencyAggregates = useMemo(
    () =>
      gateIpsccAggregatesForNavigatorPrivacy(
        navigatorIpsccCompetencyAggregatesRaw,
        navigatorIpsccEnrolleeFeedbackPrivacy.totalEncounterSubmissions,
        navigatorIpsccEnrolleeFeedbackPrivacy.minEntriesToRevealAverages
      ),
    [navigatorIpsccCompetencyAggregatesRaw, navigatorIpsccEnrolleeFeedbackPrivacy]
  )
  const navigatorIpsSelfAverages = useMemo(
    () => buildIpsSelfAssessmentAverages(navigatorIpsSelfAssessments),
    [navigatorIpsSelfAssessments]
  )
  const navigatorSelfAwarenessCorrelation = useMemo(
    () => buildIpsccVsSelfAwarenessCorrelation(navigatorIpsccCompetencyAggregates, navigatorIpsSelfAverages),
    [navigatorIpsccCompetencyAggregates, navigatorIpsSelfAverages]
  )
  const navigatorCreateInsights = useMemo(
    () => buildCreateInsights(navigatorCreateSessions),
    [navigatorCreateSessions]
  )
  const navigatorSupervisionSessions = useMemo(
    () =>
      mergedNavigatorProgramState.supervisionSessions
        .filter((record) => record.navigatorName === currentNavigatorName)
        .slice()
        .sort((left, right) => new Date(right.sessionAtIso).getTime() - new Date(left.sessionAtIso).getTime()),
    [currentNavigatorName, mergedNavigatorProgramState.supervisionSessions]
  )
  const navigatorIntervalRules = useMemo(
    () =>
      mergedNavigatorProgramState.intervalAssessmentRules.filter(
        (rule) => !rule.navigatorName || rule.navigatorName === currentNavigatorName
      ),
    [currentNavigatorName, mergedNavigatorProgramState.intervalAssessmentRules]
  )
  const navigatorIntervalDueItems = useMemo(
    () =>
      buildIntervalDueItems(
        navigatorIntervalRules,
        navigatorSelfAssessments,
        navigatorSupervisionSessions,
        navigatorCompetencyAssessments.filter((record) => record.navigatorName === currentNavigatorName)
      ),
    [
      currentNavigatorName,
      navigatorCompetencyAssessments,
      navigatorIntervalRules,
      navigatorSelfAssessments,
      navigatorSupervisionSessions
    ]
  )

  return {
    navigatorSelfAssessments,
    navigatorSelfAssessmentSummary,
    navigatorIpsccEncounterSubmissions,
    navigatorIpsSelfAssessments,
    allSupervisorIpsAssessments,
    navigatorSupervisorIpsAssessments,
    navigatorCreateSessions,
    navigatorIpsccCompetencyAggregates,
    navigatorIpsccEnrolleeFeedbackPrivacy,
    navigatorSelfAwarenessCorrelation,
    navigatorCreateInsights,
    navigatorSupervisionSessions,
    navigatorIntervalRules,
    navigatorIntervalDueItems
  }
}
