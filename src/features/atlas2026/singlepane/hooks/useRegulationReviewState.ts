import { useEffect, useMemo, useState } from 'react'
import type {
  EnrolleeProfile,
  RegulationReviewSettings,
  RegulationTestSubmissionInput,
  RegulationTestSubmissionRecord,
  RegulationTestStripMarker,
  ResolvedZCodeStripMarker,
  RouteLogEvent
} from '@/features/atlas2026/shared/contracts'
import {
  deleteRegulationTestDraft,
  loadLatestCompletedRegulationReviewTimes,
  loadRegulationTestHistory,
  saveRegulationTestSubmission
} from '@/features/atlas2026/singlepane/data-access/regulationTestsRepository'
import {
  getDefaultRegulationReviewSettings,
  loadRegulationReviewSettings,
  saveRegulationReviewSettings as persistRegulationReviewSettings
} from '@/features/atlas2026/singlepane/data-access/localStateRepository'
import { toSupabaseErrorMessage } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'
import {
  buildForcedRegulationReviewDueItems,
  buildRegulationMilestoneRouteLog,
  buildRegulationZ75StripMarker,
  hasOpenRegulationMilestoneForStabilization,
  isRegulationCadenceInstrument,
  type RegulationInstrumentCompletionMap
} from '@/features/atlas2026/singlepane/data/regulationCadence'
import { getRegulationTestLabel } from '@/features/atlas2026/singlepane/domain/phaseAndZCodes'
import { upsertRegulationTestHistory } from '@/features/atlas2026/singlepane/useSinglePaneDataTransforms'

interface RegulationReviewStateInput {
  scopedEnrollees: EnrolleeProfile[]
  selectedEnrollee: EnrolleeProfile | null
  viewerRole: string
  resolvedZCodeStripMarkersFromActiveCodes: ResolvedZCodeStripMarker[]
  logs: RouteLogEvent[]
  ensureReviewWriteAllowed: () => void
  ensureTestWriteAllowed: () => void
  appendRouteLogRecord: (logs: RouteLogEvent[], next: RouteLogEvent) => Promise<RouteLogEvent[]>
  setLogs: (logs: RouteLogEvent[]) => void
  setNavigatorProgramError: (message: string) => void
}

/**
 * Owns regulation policy, assessment history, due-state derivation, and strip markers.
 * Milestone logging remains best-effort after a successful assessment save so the durable
 * clinical record is never rolled back by a secondary timeline failure.
 */
export function useRegulationReviewState({
  scopedEnrollees,
  selectedEnrollee,
  viewerRole,
  resolvedZCodeStripMarkersFromActiveCodes,
  logs,
  ensureReviewWriteAllowed,
  ensureTestWriteAllowed,
  appendRouteLogRecord,
  setLogs,
  setNavigatorProgramError
}: RegulationReviewStateInput) {
  const [regulationReviewSettings, setRegulationReviewSettings] = useState<RegulationReviewSettings | null>(null)
  const [regulationReviewError, setRegulationReviewError] = useState<string | null>(null)
  const [latestCompletionByEnrolleeId, setLatestCompletionByEnrolleeId] =
    useState<RegulationInstrumentCompletionMap>({})
  const [regulationTestHistory, setRegulationTestHistory] = useState<RegulationTestSubmissionRecord[]>([])
  const [isSavingRegulationTest, setIsSavingRegulationTest] = useState(false)
  const [regulationTestError, setRegulationTestError] = useState<string | null>(null)

  const effectiveRegulationReviewSettings = useMemo(
    () => regulationReviewSettings ?? getDefaultRegulationReviewSettings(),
    [regulationReviewSettings]
  )
  const enrolleeIdsKey = useMemo(
    () => scopedEnrollees.map((enrollee) => enrollee.id).sort().join('|'),
    [scopedEnrollees]
  )

  useEffect(() => {
    let isMounted = true
    loadRegulationReviewSettings()
      .then((settings) => {
        if (!isMounted) return
        setRegulationReviewSettings(settings)
        setRegulationReviewError(null)
      })
      .catch((error) => {
        if (!isMounted) return
        setRegulationReviewError(toSupabaseErrorMessage(error, 'Unable to load regulation review settings.'))
      })
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    const enrolleeIds = enrolleeIdsKey ? enrolleeIdsKey.split('|') : []
    if (!enrolleeIds.length) {
      setLatestCompletionByEnrolleeId({})
      return
    }
    loadLatestCompletedRegulationReviewTimes(enrolleeIds)
      .then((times) => {
        if (isMounted) setLatestCompletionByEnrolleeId(times)
      })
      .catch((error) => {
        if (isMounted) {
          setRegulationReviewError(toSupabaseErrorMessage(error, 'Unable to load regulation review completion history.'))
        }
      })
    return () => {
      isMounted = false
    }
  }, [enrolleeIdsKey])

  useEffect(() => {
    if (viewerRole !== 'navigator' || !selectedEnrollee?.id) {
      setRegulationTestHistory([])
      setRegulationTestError(null)
      return
    }
    let isMounted = true
    Promise.all([
      loadRegulationTestHistory(selectedEnrollee.id, 'mh_sca'),
      loadRegulationTestHistory(selectedEnrollee.id, 'svs'),
      loadRegulationTestHistory(selectedEnrollee.id, 'ipf'),
      loadRegulationTestHistory(selectedEnrollee.id, 'b_ipf')
    ])
      .then((histories) => {
        if (!isMounted) return
        setRegulationTestHistory(histories.flat())
        setRegulationTestError(null)
      })
      .catch((error) => {
        if (isMounted) {
          setRegulationTestError(error instanceof Error ? error.message : 'Unable to load regulation test history.')
        }
      })
    return () => {
      isMounted = false
    }
  }, [selectedEnrollee?.id, viewerRole])

  const regulationReviewDueItems = useMemo(
    () =>
      buildForcedRegulationReviewDueItems(
        effectiveRegulationReviewSettings,
        scopedEnrollees,
        latestCompletionByEnrolleeId
      ),
    [effectiveRegulationReviewSettings, latestCompletionByEnrolleeId, scopedEnrollees]
  )
  const completedRegulationTests = useMemo(
    () =>
      regulationTestHistory
        .filter(
          (record) =>
            record.status === 'completed' &&
            record.passed !== null &&
            (record.testType === 'mh_sca' || record.testType === 'svs')
        )
        .slice()
        .sort((left, right) => new Date(left.updatedAtIso).getTime() - new Date(right.updatedAtIso).getTime()),
    [regulationTestHistory]
  )
  const latestCompletedMhSca = useMemo(
    () => [...completedRegulationTests].reverse().find((record) => record.testType === 'mh_sca') || null,
    [completedRegulationTests]
  )
  const latestCompletedSvs = useMemo(
    () => [...completedRegulationTests].reverse().find((record) => record.testType === 'svs') || null,
    [completedRegulationTests]
  )
  const isRegulationCleared = Boolean(latestCompletedMhSca?.passed && latestCompletedSvs?.passed)
  const resolvedZCodeStripMarkers = useMemo(() => {
    if (!selectedEnrollee || !latestCompletedMhSca?.passed || !latestCompletedSvs?.passed) {
      return resolvedZCodeStripMarkersFromActiveCodes
    }
    const stabilizedAtIso =
      [latestCompletedMhSca.updatedAtIso, latestCompletedSvs.updatedAtIso]
        .slice()
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ||
      latestCompletedSvs.updatedAtIso
    const regulationMarker = buildRegulationZ75StripMarker({ enrolleeId: selectedEnrollee.id, stabilizedAtIso })
    return [
      ...resolvedZCodeStripMarkersFromActiveCodes.filter(
        (marker) => marker.id !== regulationMarker.id && marker.zCode !== regulationMarker.zCode
      ),
      regulationMarker
    ].sort((left, right) => new Date(left.resolvedAtIso).getTime() - new Date(right.resolvedAtIso).getTime())
  }, [
    latestCompletedMhSca,
    latestCompletedSvs,
    resolvedZCodeStripMarkersFromActiveCodes,
    selectedEnrollee
  ])
  const regulationTestStripMarkers = useMemo<RegulationTestStripMarker[]>(
    () =>
      completedRegulationTests.map((record) => ({
        id: record.id,
        label: getRegulationTestLabel(record.testType),
        testType: record.testType,
        attemptedAtIso: record.updatedAtIso,
        passed: Boolean(record.passed),
        isLatestCompleted:
          (record.testType === 'mh_sca' && record.id === latestCompletedMhSca?.id) ||
          (record.testType === 'svs' && record.id === latestCompletedSvs?.id)
      })),
    [completedRegulationTests, latestCompletedMhSca?.id, latestCompletedSvs?.id]
  )

  async function saveRegulationReviewSettings(settings: RegulationReviewSettings) {
    ensureReviewWriteAllowed()
    try {
      const saved = await persistRegulationReviewSettings(settings)
      setRegulationReviewSettings(saved)
      setRegulationReviewError(null)
      return saved
    } catch (error) {
      setRegulationReviewError(toSupabaseErrorMessage(error, 'Unable to save regulation review settings.'))
      throw error
    }
  }

  async function ensureRegulationReviewSettingForEnrollee(enrolleeId: string, enrolleeName: string) {
    const trimmedId = enrolleeId.trim()
    if (!trimmedId) return
    const current = regulationReviewSettings ?? getDefaultRegulationReviewSettings()
    if (current.enrolleeSettings[trimmedId]) return
    const next: RegulationReviewSettings = {
      ...current,
      enrolleeSettings: {
        ...current.enrolleeSettings,
        [trimmedId]: {
          enrolleeId: trimmedId,
          enrolleeName: enrolleeName.trim(),
          isActive: current.isActiveForNewEnrollees,
          cadence: null,
          updatedAtIso: new Date().toISOString()
        }
      }
    }
    try {
      setRegulationReviewSettings(await persistRegulationReviewSettings(next))
    } catch (error) {
      // Enrollee creation remains successful; the default-active policy still covers
      // records whose explicit setting could not be provisioned.
      setRegulationReviewError(toSupabaseErrorMessage(error, 'Unable to auto-provision the regulation review setting.'))
    }
  }

  async function saveNavigatorRegulationTest(input: RegulationTestSubmissionInput) {
    ensureTestWriteAllowed()
    setIsSavingRegulationTest(true)
    setRegulationTestError(null)
    try {
      const saved = await saveRegulationTestSubmission(input)
      const nextHistory = upsertRegulationTestHistory(regulationTestHistory, saved)
      setRegulationTestHistory(nextHistory)
      if (saved.status === 'completed' && isRegulationCadenceInstrument(saved.testType)) {
        setLatestCompletionByEnrolleeId((current) => {
          const existingForEnrollee = current[saved.enrolleeId] || {}
          const existingForType = existingForEnrollee[saved.testType]
          if (existingForType && new Date(existingForType).getTime() >= new Date(saved.submittedAtIso).getTime()) {
            return current
          }
          return {
            ...current,
            [saved.enrolleeId]: { ...existingForEnrollee, [saved.testType]: saved.submittedAtIso }
          }
        })
      }
      if (saved.status === 'completed' && isRegulationCadenceInstrument(saved.testType) && saved.passed) {
        const completedForEnrollee = nextHistory
          .filter(
            (record) =>
              record.enrolleeId === saved.enrolleeId &&
              record.status === 'completed' &&
              record.passed !== null &&
              isRegulationCadenceInstrument(record.testType)
          )
          .slice()
          .sort((left, right) => new Date(left.updatedAtIso).getTime() - new Date(right.updatedAtIso).getTime())
        const latestMhSca = [...completedForEnrollee].reverse().find((record) => record.testType === 'mh_sca')
        const latestSvs = [...completedForEnrollee].reverse().find((record) => record.testType === 'svs')
        if (latestMhSca?.passed && latestSvs?.passed) {
          const stabilizedAtIso =
            [latestMhSca.updatedAtIso, latestSvs.updatedAtIso]
              .slice()
              .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ||
            saved.submittedAtIso
          if (!hasOpenRegulationMilestoneForStabilization(logs, saved.enrolleeId, stabilizedAtIso)) {
            try {
              setLogs(
                await appendRouteLogRecord(
                  logs,
                  buildRegulationMilestoneRouteLog({ enrolleeId: saved.enrolleeId, stabilizedAtIso })
                )
              )
            } catch (milestoneError) {
              setNavigatorProgramError(
                toSupabaseErrorMessage(milestoneError, 'Unable to log the Z75 / Lucid regulation milestone stop.')
              )
            }
          }
        }
      }
      return saved
    } catch (error) {
      setRegulationTestError(error instanceof Error ? error.message : 'Unable to save regulation test.')
      throw error
    } finally {
      setIsSavingRegulationTest(false)
    }
  }

  async function deleteNavigatorRegulationTestDraft(submissionId: string) {
    ensureTestWriteAllowed()
    setIsSavingRegulationTest(true)
    setRegulationTestError(null)
    try {
      const deleted = await deleteRegulationTestDraft(submissionId)
      if (!deleted) return
      setRegulationTestHistory((current) =>
        current.filter((record) => record.id !== deleted.id && record.draftKey !== deleted.draftKey)
      )
    } catch (error) {
      setRegulationTestError(error instanceof Error ? error.message : 'Unable to delete regulation test draft.')
      throw error
    } finally {
      setIsSavingRegulationTest(false)
    }
  }

  return {
    regulationReviewSettings: effectiveRegulationReviewSettings,
    regulationReviewDueItems,
    regulationReviewError,
    regulationTestHistory,
    regulationTestStripMarkers,
    latestCompletedMhSca,
    latestCompletedSvs,
    isRegulationCleared,
    shouldHideReadinessProgress: !isRegulationCleared,
    resolvedZCodeStripMarkers,
    isSavingRegulationTest,
    regulationTestError,
    saveRegulationReviewSettings,
    ensureRegulationReviewSettingForEnrollee,
    saveNavigatorRegulationTest,
    deleteNavigatorRegulationTestDraft
  }
}
