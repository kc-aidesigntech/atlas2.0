import { useEffect, useMemo, useState } from 'react'
import type {
  DomainLoad,
  DomainLoadBreakdown,
  EnrolleeIntakeRecord,
  EnrolleeProfile,
  RouteLogEvent,
  TimelineConfig
} from '@/features/atlas2026/shared/contracts'
import { normalizeTimelineConfig } from '@/features/atlas2026/singlepane/timelineConfigUtils'
import {
  SESSION_SELECTED_ENROLLEE_KEY,
  readSessionStorageValue,
  writeSessionStorageValue
} from '@/features/atlas2026/singlepane/domain/sessionStorage'

interface ScopedEnrolleeSelectionInput {
  enrollees: EnrolleeProfile[]
  scopedEnrollmentIds: Set<string> | null
  loads: DomainLoad[]
  loadBreakdownsByEnrolleeId: Record<string, DomainLoadBreakdown>
  isPartnerStationView: boolean
  partnerLoad: DomainLoad | null
  partnerLoadBreakdown: DomainLoadBreakdown | null
  timelineConfig: TimelineConfig | null
  timelineConfigsByEnrolleeId: Record<string, TimelineConfig>
  intakeFormsByEnrolleeId: Record<string, EnrolleeIntakeRecord>
  logs: RouteLogEvent[]
}

/**
 * Owns the session-persisted enrollee selection and all directly selected records.
 * Keeping these derivations together prevents consumers from observing mismatched scope,
 * load, timeline, intake, or log state during role changes.
 */
export function useScopedEnrolleeSelection({
  enrollees,
  scopedEnrollmentIds,
  loads,
  loadBreakdownsByEnrolleeId,
  isPartnerStationView,
  partnerLoad,
  partnerLoadBreakdown,
  timelineConfig,
  timelineConfigsByEnrolleeId,
  intakeFormsByEnrolleeId,
  logs
}: ScopedEnrolleeSelectionInput) {
  const [selectedEnrolleeId, setSelectedEnrolleeId] = useState<string>(
    () => readSessionStorageValue(SESSION_SELECTED_ENROLLEE_KEY) || ''
  )
  const scopedEnrollees = useMemo(
    () =>
      scopedEnrollmentIds
        ? enrollees.filter((enrollee) => enrollee.enrollmentId && scopedEnrollmentIds.has(enrollee.enrollmentId))
        : enrollees,
    [enrollees, scopedEnrollmentIds]
  )
  const scopedEnrolleeIdSet = useMemo(
    () => new Set(scopedEnrollees.map((enrollee) => enrollee.id)),
    [scopedEnrollees]
  )
  const scopedLoads = useMemo(
    () => loads.filter((item) => scopedEnrolleeIdSet.has(item.enrolleeId)),
    [loads, scopedEnrolleeIdSet]
  )
  const scopedLoadBreakdownsByEnrolleeId = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(loadBreakdownsByEnrolleeId).filter(([enrolleeId]) => scopedEnrolleeIdSet.has(enrolleeId))
      ),
    [loadBreakdownsByEnrolleeId, scopedEnrolleeIdSet]
  )
  const selectedEnrollee = useMemo(
    () => scopedEnrollees.find((item) => item.id === selectedEnrolleeId) || scopedEnrollees[0] || null,
    [scopedEnrollees, selectedEnrolleeId]
  )
  const selectedLoad = useMemo(() => {
    if (isPartnerStationView && partnerLoad) return partnerLoad
    return scopedLoads.find((item) => item.enrolleeId === selectedEnrollee?.id) || scopedLoads[0] || null
  }, [isPartnerStationView, partnerLoad, scopedLoads, selectedEnrollee])
  const selectedLoadBreakdown = useMemo(() => {
    if (isPartnerStationView && partnerLoadBreakdown) return partnerLoadBreakdown
    return (
      scopedLoadBreakdownsByEnrolleeId[selectedEnrollee?.id || ''] ||
      Object.values(scopedLoadBreakdownsByEnrolleeId)[0] ||
      null
    )
  }, [isPartnerStationView, partnerLoadBreakdown, scopedLoadBreakdownsByEnrolleeId, selectedEnrollee])
  const selectedTimelineConfig = useMemo(() => {
    const activeTimelineConfig = selectedEnrollee
      ? timelineConfigsByEnrolleeId[selectedEnrollee.id] || timelineConfig
      : timelineConfig
    return activeTimelineConfig ? normalizeTimelineConfig(activeTimelineConfig) : null
  }, [selectedEnrollee, timelineConfig, timelineConfigsByEnrolleeId])
  const selectedIntake = useMemo(() => {
    if (!selectedEnrollee) return null
    const existing = intakeFormsByEnrolleeId[selectedEnrollee.id]
    if (existing) return existing
    return {
      enrolleeId: selectedEnrollee.id,
      fullName: selectedEnrollee.fullName,
      dob: selectedEnrollee.dob,
      caseId: selectedEnrollee.caseId,
      email: selectedEnrollee.email,
      assignedNavigator: selectedEnrollee.assignedNavigator,
      enrollmentStartIso: selectedTimelineConfig?.planStartIso || new Date().toISOString(),
      zCodeTags: selectedEnrollee.zCodeTags
    } satisfies EnrolleeIntakeRecord
  }, [intakeFormsByEnrolleeId, selectedEnrollee, selectedTimelineConfig])
  const hasSavedIntake = useMemo(
    () => Boolean(selectedEnrollee && intakeFormsByEnrolleeId[selectedEnrollee.id]),
    [intakeFormsByEnrolleeId, selectedEnrollee]
  )
  const selectedLogs = useMemo(
    () =>
      logs
        .filter((item) => item.enrolleeId === selectedEnrollee?.id)
        .slice()
        .sort((a, b) => new Date(a.timestampIso).getTime() - new Date(b.timestampIso).getTime()),
    [logs, selectedEnrollee]
  )

  useEffect(() => {
    if (!scopedEnrollees[0]?.id) return
    if (!selectedEnrolleeId || !scopedEnrollees.some((enrollee) => enrollee.id === selectedEnrolleeId)) {
      setSelectedEnrolleeId(scopedEnrollees[0].id)
    }
  }, [scopedEnrollees, selectedEnrolleeId])

  useEffect(() => {
    writeSessionStorageValue(SESSION_SELECTED_ENROLLEE_KEY, selectedEnrolleeId || null)
  }, [selectedEnrolleeId])

  return {
    selectedEnrolleeId,
    setSelectedEnrolleeId,
    scopedEnrollees,
    scopedEnrolleeIdSet,
    scopedLoads,
    scopedLoadBreakdownsByEnrolleeId,
    selectedEnrollee,
    selectedLoad,
    selectedLoadBreakdown,
    selectedTimelineConfig,
    selectedIntake,
    hasSavedIntake,
    selectedLogs
  }
}
