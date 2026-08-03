import type { Dispatch, SetStateAction } from 'react'
import type {
  EnrolleeIntakeRecord,
  EnrolleeProfile,
  RouteLogEvent,
  StabilizationPhase,
  TimelineConfig
} from '@/features/atlas2026/shared/contracts'
import {
  appendRouteLog as appendRouteLogRecord,
  saveRouteLogs as persistRouteLogs,
  saveTimelineConfig as persistTimelineConfig
} from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'
import { toSupabaseErrorMessage } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'
import type { SinglePaneBootstrapState } from '@/features/atlas2026/singlepane/hooks/useSinglePaneBootstrapState'
import {
  extendTimelinePhaseByMonth,
  normalizeTimelineConfig
} from '@/features/atlas2026/singlepane/timelineConfigUtils'
import { nextPhase } from '@/features/atlas2026/singlepane/domain/phaseAndZCodes'
import { DOMAIN_BY_ACTION } from '@/features/atlas2026/singlepane/domain/loadsRoutes'

type EnsureWriteAllowed = (actionKey: 'routeLogs.write' | 'timeline.write', actionLabel: string) => void

interface UseRouteLogTimelineActionsInput {
  logs: RouteLogEvent[]
  selectedEnrollee: EnrolleeProfile | null
  selectedLogs: RouteLogEvent[]
  selectedTimelineConfig: TimelineConfig | null
  selectedIntake: EnrolleeIntakeRecord | null
  setBootstrapState: Dispatch<SetStateAction<SinglePaneBootstrapState>>
  setNavigatorProgramError: Dispatch<SetStateAction<string | null>>
  ensureWriteAllowed: EnsureWriteAllowed
  saveEnrolleeIntake: (nextIntake: EnrolleeIntakeRecord) => void
}

/**
 * Owns route-log and timeline mutations so the single-pane facade only wires
 * selected enrollee state into this cohesive persistence boundary.
 */
export function useRouteLogTimelineActions({
  logs,
  selectedEnrollee,
  selectedLogs,
  selectedTimelineConfig,
  selectedIntake,
  setBootstrapState,
  setNavigatorProgramError,
  ensureWriteAllowed,
  saveEnrolleeIntake
}: UseRouteLogTimelineActionsInput) {
  function setLogs(nextLogs: RouteLogEvent[] | ((current: RouteLogEvent[]) => RouteLogEvent[])) {
    setBootstrapState((current) => ({
      ...current,
      logs: typeof nextLogs === 'function' ? nextLogs(current.logs) : nextLogs
    }))
  }

  function reportPersistenceError(error: unknown, fallback: string) {
    setNavigatorProgramError(toSupabaseErrorMessage(error, fallback))
  }

  function appendRouteLog(label: string) {
    ensureWriteAllowed('routeLogs.write', 'append route logs')
    if (!selectedEnrollee || !label.trim()) return
    const last = selectedLogs[selectedLogs.length - 1]
    const newPhase = nextPhase(last?.phase)
    const domains = DOMAIN_BY_ACTION[label.trim().toLowerCase()] || ['social']
    const currentLogs =
      last?.status === 'active'
        ? logs.map((item) => (item.id === last.id ? { ...item, status: 'completed' as const } : item))
        : logs
    const next: RouteLogEvent = {
      id: `log-${Date.now().toString(36)}`,
      enrolleeId: selectedEnrollee.id,
      label: label.trim(),
      timestampIso: new Date().toISOString(),
      status: 'active',
      phase: last ? newPhase : 'regulation',
      milestoneType: 'intervention',
      domainsRelieved: domains
    }
    appendRouteLogRecord(currentLogs, next)
      .then(setLogs)
      .catch((error) =>
        reportPersistenceError(error, 'Unable to append route log. The write did not persist to the canonical store.')
      )
  }

  function updateRouteLogTimelinePosition(logId: string, timelinePositionRatio: number | null) {
    ensureWriteAllowed('routeLogs.write', 'update route log timeline positions')
    setLogs((current) => {
      const nextLogs = current.map((log) =>
        log.id === logId
          ? {
              ...log,
              timelinePositionRatio:
                typeof timelinePositionRatio === 'number' && Number.isFinite(timelinePositionRatio)
                  ? Math.max(0, Math.min(1, timelinePositionRatio))
                  : null
            }
          : log
      )
      persistRouteLogs(nextLogs).catch((error) =>
        reportPersistenceError(error, 'Unable to persist route-log timeline position to the canonical store.')
      )
      return nextLogs
    })
  }

  function updateRouteLogDate(logId: string, nextTimestampIso: string) {
    ensureWriteAllowed('routeLogs.write', 'update route log dates')
    setLogs((current) => {
      const nextLogs = current.map((log) =>
        log.id === logId ? { ...log, timestampIso: nextTimestampIso, timelinePositionRatio: null } : log
      )
      persistRouteLogs(nextLogs).catch((error) =>
        reportPersistenceError(error, 'Unable to persist route-log date updates to the canonical store.')
      )
      return nextLogs
    })
  }

  function deleteRouteLog(logId: string) {
    ensureWriteAllowed('routeLogs.write', 'delete route logs')
    setLogs((current) => {
      const nextLogs = current.filter((log) => log.id !== logId)
      persistRouteLogs(nextLogs).catch((error) =>
        reportPersistenceError(error, 'Unable to persist route-log deletion to the canonical store.')
      )
      return nextLogs
    })
  }

  function updateTimelineConfig(nextConfig: TimelineConfig) {
    ensureWriteAllowed('timeline.write', 'update timeline configuration')
    if (!selectedEnrollee) return
    const normalizedTimelineConfig = normalizeTimelineConfig(nextConfig)
    setBootstrapState((current) => ({
      ...current,
      timelineConfig: normalizedTimelineConfig,
      timelineConfigsByEnrolleeId: {
        ...current.timelineConfigsByEnrolleeId,
        [selectedEnrollee.id]: normalizedTimelineConfig
      }
    }))
    if (selectedIntake && selectedIntake.enrollmentStartIso !== normalizedTimelineConfig.planStartIso) {
      saveEnrolleeIntake({ ...selectedIntake, enrollmentStartIso: normalizedTimelineConfig.planStartIso })
    }
    persistTimelineConfig(
      { enrolleeId: selectedEnrollee.id, enrollmentId: selectedEnrollee.enrollmentId },
      normalizedTimelineConfig
    ).catch((error) =>
      reportPersistenceError(error, 'Unable to persist timeline configuration to the canonical store.')
    )
  }

  function updateTimelineStartDate(nextStartIso: string) {
    if (selectedTimelineConfig) {
      updateTimelineConfig({ ...selectedTimelineConfig, planStartIso: nextStartIso })
    }
  }

  function updateTimelinePhaseDuration(phase: StabilizationPhase) {
    if (selectedTimelineConfig) {
      updateTimelineConfig(extendTimelinePhaseByMonth(selectedTimelineConfig, phase))
    }
  }

  return {
    setLogs,
    appendRouteLog,
    deleteRouteLog,
    updateRouteLogTimelinePosition,
    updateRouteLogDate,
    updateTimelineStartDate,
    updateTimelinePhaseDuration,
    updateTimelineConfig
  }
}
