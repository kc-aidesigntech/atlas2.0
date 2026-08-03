import { useState, type Dispatch, type SetStateAction } from 'react'
import type {
  AccountSettings,
  EnrolleeBurdenSurveySubmissionInput,
  EnrolleeBurdenSurveySubmissionRecord,
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord
} from '@/features/atlas2026/shared/contracts'
import {
  deleteEnrolleeBurdenSurveyDraftRecord,
  deletePartnerServiceCapacityDraftRecord,
  loadEnrolleeBurdenSurveyHistory,
  loadPartnerServiceCapacitySurveyHistory,
  loadPartnerStationProfile,
  saveAccountSettings,
  saveEnrolleeBurdenSurvey,
  savePartnerServiceCapacitySurvey
} from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'
import {
  buildPartnerBurdenBreakdownFromHistory,
  buildSurveyDomainLoadBreakdown,
  derivePartnerStationSpecialtyGroups,
  selectCompletedPartnerSurveysNewestFirst,
  toNormalizedRadialDomainLoad
} from '@/features/atlas2026/singlepane/data-access/domainLoadMapping'
import { toSupabaseErrorMessage } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'
import type { SinglePaneBootstrapState } from '@/features/atlas2026/singlepane/hooks/useSinglePaneBootstrapState'
import { upsertServiceCapacitySubmissionHistory } from '@/features/atlas2026/singlepane/useSinglePaneDataTransforms'
import { upsertEnrolleeBurdenSurveyHistory } from '@/features/atlas2026/singlepane/domain/loadsRoutes'

interface PartnerSurveyActionsInput {
  viewerRole: string
  effectivePartnerOrganizationName: string
  accountSettings: AccountSettings
  partnerServiceCapacitySurveyHistory: PartnerServiceCapacitySubmissionRecord[]
  setPartnerServiceCapacitySurveyHistory: Dispatch<SetStateAction<PartnerServiceCapacitySubmissionRecord[]>>
  setPartnerServiceCapacitySurveyError: Dispatch<SetStateAction<string | null>>
  setBootstrapState: Dispatch<SetStateAction<SinglePaneBootstrapState>>
  ensurePartnerSurveyWriteAllowed: () => void
  ensureEnrolleeSurveyWriteAllowed: (actionLabel: string) => void
}

/**
 * Owns partner capacity and enrollee burden survey commands. Both workflows update
 * their persisted history and the radial-load bootstrap projection atomically in memory.
 */
export function usePartnerSurveyActions({
  viewerRole,
  effectivePartnerOrganizationName,
  accountSettings,
  partnerServiceCapacitySurveyHistory,
  setPartnerServiceCapacitySurveyHistory,
  setPartnerServiceCapacitySurveyError,
  setBootstrapState,
  ensurePartnerSurveyWriteAllowed,
  ensureEnrolleeSurveyWriteAllowed
}: PartnerSurveyActionsInput) {
  const [isSavingPartnerServiceCapacitySurvey, setIsSavingPartnerServiceCapacitySurvey] = useState(false)
  const [isSavingEnrolleeBurdenSurvey, setIsSavingEnrolleeBurdenSurvey] = useState(false)
  const [enrolleeBurdenSurveyError, setEnrolleeBurdenSurveyError] = useState<string | null>(null)
  const [enrolleeBurdenSurveyHistoryByEnrollmentId, setEnrolleeBurdenSurveyHistoryByEnrollmentId] = useState<
    Record<string, EnrolleeBurdenSurveySubmissionRecord[]>
  >({})

  async function savePartnerCapacitySurvey(input: PartnerServiceCapacitySubmissionInput) {
    ensurePartnerSurveyWriteAllowed()
    setIsSavingPartnerServiceCapacitySurvey(true)
    setPartnerServiceCapacitySurveyError(null)
    try {
      const saved = await savePartnerServiceCapacitySurvey(input)
      setPartnerServiceCapacitySurveyHistory((current) => {
        const nextHistory = upsertServiceCapacitySubmissionHistory(current, saved)
        if (saved.status === 'completed') {
          const completedHistory = selectCompletedPartnerSurveysNewestFirst(nextHistory)
          const latestCompleted = completedHistory[0] || null
          const nextBreakdown = buildPartnerBurdenBreakdownFromHistory(completedHistory, {
            subjectId: latestCompleted?.partnerId || input.header.organizationName,
            subjectLabel: latestCompleted?.header.organizationName || input.header.organizationName
          })
          setBootstrapState((bootstrapCurrent) => ({
            ...bootstrapCurrent,
            partnerLoadBreakdown: nextBreakdown,
            partnerLoad: toNormalizedRadialDomainLoad(nextBreakdown),
            partnerStationSpecialties: derivePartnerStationSpecialtyGroups(latestCompleted)
          }))
        }
        return nextHistory
      })
      const nextAccountSettings = {
        ...accountSettings,
        fullName: `${input.header.firstName} ${input.header.lastName}`.trim() || accountSettings.fullName,
        email: input.header.email || accountSettings.email,
        organization: input.header.organizationName
      }
      const refreshedStationProfile = await loadPartnerStationProfile(input.header.organizationName, {
        fullName: nextAccountSettings.fullName,
        email: nextAccountSettings.email
      })
      setBootstrapState((current) => ({
        ...current,
        accountSettings: nextAccountSettings,
        partnerStationProfile: refreshedStationProfile
      }))
      void saveAccountSettings(nextAccountSettings)
      return saved
    } catch (error) {
      setPartnerServiceCapacitySurveyError(toSupabaseErrorMessage(error, 'Unable to save service capacity survey.'))
      throw error
    } finally {
      setIsSavingPartnerServiceCapacitySurvey(false)
    }
  }

  async function reloadEnrolleeBurdenSurveyHistoryForEnrollment(enrollmentId: string) {
    const trimmedEnrollmentId = enrollmentId.trim()
    if (!trimmedEnrollmentId) return []
    setEnrolleeBurdenSurveyError(null)
    try {
      const rows = await loadEnrolleeBurdenSurveyHistory(trimmedEnrollmentId)
      setEnrolleeBurdenSurveyHistoryByEnrollmentId((current) => ({ ...current, [trimmedEnrollmentId]: rows }))
      return rows
    } catch (error) {
      setEnrolleeBurdenSurveyError(error instanceof Error ? error.message : 'Unable to load enrollee burden survey.')
      throw error
    }
  }

  async function saveEnrolleeSurvey(input: EnrolleeBurdenSurveySubmissionInput) {
    ensureEnrolleeSurveyWriteAllowed('save enrollee burden surveys')
    setIsSavingEnrolleeBurdenSurvey(true)
    setEnrolleeBurdenSurveyError(null)
    try {
      const saved = await saveEnrolleeBurdenSurvey(input)
      setEnrolleeBurdenSurveyHistoryByEnrollmentId((current) => ({
        ...current,
        [input.header.enrollmentId]: upsertEnrolleeBurdenSurveyHistory(current[input.header.enrollmentId] || [], saved)
      }))
      if (saved.status === 'completed') {
        const breakdown = buildSurveyDomainLoadBreakdown({
          subjectId: saved.header.enrolleeId,
          subjectLabel: saved.header.enrolleeName,
          sourceKind: 'enrolleeSurvey',
          sourceLabel: `${saved.header.respondentRole} burden survey`,
          answers: saved.answers
        })
        const normalized = toNormalizedRadialDomainLoad(breakdown)
        setBootstrapState((current) => {
          const nextLoadMap = new Map(current.loads.map((load) => [load.enrolleeId, load]))
          if (normalized) nextLoadMap.set(normalized.enrolleeId, normalized)
          return {
            ...current,
            loads: Array.from(nextLoadMap.values()),
            loadBreakdownsByEnrolleeId: {
              ...current.loadBreakdownsByEnrolleeId,
              [saved.header.enrolleeId]: breakdown
            }
          }
        })
      }
      return saved
    } catch (error) {
      setEnrolleeBurdenSurveyError(error instanceof Error ? error.message : 'Unable to save enrollee burden survey.')
      throw error
    } finally {
      setIsSavingEnrolleeBurdenSurvey(false)
    }
  }

  async function reloadPartnerServiceCapacitySurveyHistory() {
    if (viewerRole !== 'partner') return
    const organizationName = effectivePartnerOrganizationName.trim()
    if (!organizationName) return
    setPartnerServiceCapacitySurveyError(null)
    try {
      setPartnerServiceCapacitySurveyHistory(await loadPartnerServiceCapacitySurveyHistory(organizationName))
    } catch (error) {
      setPartnerServiceCapacitySurveyError(toSupabaseErrorMessage(error, 'Unable to load service capacity survey.'))
    }
  }

  async function deletePartnerServiceCapacityDraft(submissionId: string) {
    ensurePartnerSurveyWriteAllowed()
    setIsSavingPartnerServiceCapacitySurvey(true)
    setPartnerServiceCapacitySurveyError(null)
    try {
      const deleted = await deletePartnerServiceCapacityDraftRecord(submissionId)
      setPartnerServiceCapacitySurveyHistory((current) =>
        current.filter((record) => record.id !== deleted.id && record.draftKey !== deleted.draftKey)
      )
      return deleted
    } catch (error) {
      setPartnerServiceCapacitySurveyError(toSupabaseErrorMessage(error, 'Unable to delete service capacity draft.'))
      throw error
    } finally {
      setIsSavingPartnerServiceCapacitySurvey(false)
    }
  }

  async function deleteEnrolleeBurdenSurveyDraft(submissionId: string, enrollmentId: string) {
    ensureEnrolleeSurveyWriteAllowed('delete enrollee burden drafts')
    setIsSavingEnrolleeBurdenSurvey(true)
    setEnrolleeBurdenSurveyError(null)
    try {
      const deleted = await deleteEnrolleeBurdenSurveyDraftRecord(submissionId)
      setEnrolleeBurdenSurveyHistoryByEnrollmentId((current) => ({
        ...current,
        [enrollmentId]: (current[enrollmentId] || []).filter(
          (record) => record.id !== deleted?.id && record.draftKey !== deleted?.draftKey
        )
      }))
      return deleted
    } catch (error) {
      setEnrolleeBurdenSurveyError(error instanceof Error ? error.message : 'Unable to delete enrollee burden draft.')
      throw error
    } finally {
      setIsSavingEnrolleeBurdenSurvey(false)
    }
  }

  return {
    isSavingPartnerServiceCapacitySurvey,
    isSavingEnrolleeBurdenSurvey,
    enrolleeBurdenSurveyError,
    enrolleeBurdenSurveyHistoryByEnrollmentId,
    savePartnerServiceCapacitySurvey: savePartnerCapacitySurvey,
    reloadEnrolleeBurdenSurveyHistoryForEnrollment,
    saveEnrolleeBurdenSurvey: saveEnrolleeSurvey,
    reloadPartnerServiceCapacitySurveyHistory,
    deletePartnerServiceCapacityDraft,
    deleteEnrolleeBurdenSurveyDraft
  }
}
