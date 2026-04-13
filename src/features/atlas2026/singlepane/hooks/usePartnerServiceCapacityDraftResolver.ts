import { useEffect, useState } from 'react'
import type { PartnerServiceCapacitySubmissionRecord } from '@/features/atlas2026/singlepane/types'
import {
  getPersistedDraftSortTime,
  getRecordSortTime,
  loadPersistedSurveyDraft,
  type PersistedSurveyDraft
} from '@/features/atlas2026/singlepane/components/serviceCapacitySurvey/draft'
import { loadPartnerServiceCapacitySurvey } from '@/features/atlas2026/singlepane/data-access/partnerServiceCapacityRepository'

interface PartnerServiceCapacityDraftResolverState {
  persistedDraft: PersistedSurveyDraft | null
  resumeDraftRecord: PartnerServiceCapacitySubmissionRecord | null
  isResolvingResumeDraft: boolean
  resumeDraftError: string | null
}

function chooseNewestDraftRecord(
  records: Array<PartnerServiceCapacitySubmissionRecord | null | undefined>
) {
  return records
    .filter((record): record is PartnerServiceCapacitySubmissionRecord => Boolean(record))
    .sort((left, right) => getRecordSortTime(right) - getRecordSortTime(left))[0] || null
}

function getResumeDraftSortTime(record: PartnerServiceCapacitySubmissionRecord | null) {
  return record ? getRecordSortTime(record) : 0
}

export function usePartnerServiceCapacityDraftResolver(
  organizationName: string | undefined,
  submissionHistory: PartnerServiceCapacitySubmissionRecord[],
  resolutionKey: number
) {
  const [state, setState] = useState<PartnerServiceCapacityDraftResolverState>({
    persistedDraft: null,
    resumeDraftRecord: null,
    isResolvingResumeDraft: false,
    resumeDraftError: null
  })

  useEffect(() => {
    let isMounted = true
    const persistedDraft = loadPersistedSurveyDraft()

    if (!persistedDraft?.draftKey) {
      setState({
        persistedDraft: null,
        resumeDraftRecord: null,
        isResolvingResumeDraft: false,
        resumeDraftError: null
      })
      return () => {
        isMounted = false
      }
    }

    const historyDraftRecord =
      submissionHistory.find((record) => record.draftKey === persistedDraft.draftKey || record.id === persistedDraft.draftKey) || null
    const lookupOrganizationName = organizationName?.trim() || persistedDraft.header.organizationName.trim()

    setState({
      persistedDraft,
      resumeDraftRecord: historyDraftRecord,
      isResolvingResumeDraft: true,
      resumeDraftError: null
    })

    loadPartnerServiceCapacitySurvey(lookupOrganizationName, persistedDraft.draftKey)
      .then((loadedDraftRecord) => {
        if (!isMounted) return
        setState({
          persistedDraft,
          resumeDraftRecord: chooseNewestDraftRecord([historyDraftRecord, loadedDraftRecord]),
          isResolvingResumeDraft: false,
          resumeDraftError: null
        })
      })
      .catch((error) => {
        if (!isMounted) return
        setState({
          persistedDraft,
          resumeDraftRecord: historyDraftRecord,
          isResolvingResumeDraft: false,
          resumeDraftError: error instanceof Error ? error.message : 'Unable to resolve active draft.'
        })
      })

    return () => {
      isMounted = false
    }
  }, [organizationName, resolutionKey, submissionHistory])

  const resumeDraftUpdatedAtIso =
    getPersistedDraftSortTime(state.persistedDraft) > getResumeDraftSortTime(state.resumeDraftRecord)
      ? state.persistedDraft?.persistedAtIso || null
      : state.resumeDraftRecord?.updatedAtIso || state.resumeDraftRecord?.submittedAtIso || state.persistedDraft?.persistedAtIso || null

  return {
    ...state,
    resumeDraftUpdatedAtIso
  }
}
