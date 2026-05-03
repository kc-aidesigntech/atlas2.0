import { useEffect, useMemo, useState } from 'react'
import type { PartnerServiceCapacitySubmissionRecord } from '@/features/atlas2026/singlepane/types'
import {
  buildLocalOnlyResumeSubmissionRecord,
  getResumeDraftDisplayTimestampIso,
  isPartnerServiceCapacityDraftEditable,
  listHistoryRecordsForDraftKey,
  loadPersistedSurveyDraft,
  pickFreshestPartnerServiceCapacityRecord,
  type PersistedSurveyDraft
} from '@/features/atlas2026/singlepane/components/serviceCapacitySurvey/draft'
import { loadPartnerServiceCapacitySurvey } from '@/features/atlas2026/singlepane/data-access/partnerServiceCapacityRepository'

/**
 * Resolves resumable partner survey draft state.
 *
 * Contract:
 * - emits a best available draft immediately from local/history sources.
 * - reconciles with server state without blocking editing.
 */

interface PartnerServiceCapacityDraftResolverState {
  persistedDraft: PersistedSurveyDraft | null
  resumeDraftRecord: PartnerServiceCapacitySubmissionRecord | null
  isResolvingResumeDraft: boolean
  resumeDraftError: string | null
  resumeDraftIsEditable: boolean
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
    resumeDraftError: null,
    resumeDraftIsEditable: false
  })

  const submissionHistorySignature = useMemo(
    () =>
      submissionHistory
        .map((record) => `${record.id}\t${record.draftKey}\t${record.updatedAtIso}\t${record.status}`)
        .join('\n'),
    [submissionHistory]
  )

  useEffect(() => {
    let isMounted = true
    const persistedDraft = loadPersistedSurveyDraft()
    const draftKey = persistedDraft?.draftKey?.trim()

    if (!draftKey) {
      setState({
        persistedDraft: null,
        resumeDraftRecord: null,
        isResolvingResumeDraft: false,
        resumeDraftError: null,
        resumeDraftIsEditable: false
      })
      return () => {
        isMounted = false
      }
    }

    const historyMatches = listHistoryRecordsForDraftKey(submissionHistory, draftKey)
    const historyBest = pickFreshestPartnerServiceCapacityRecord(historyMatches)
    const lookupOrganizationName = organizationName?.trim() || persistedDraft.header.organizationName.trim()

    // Resolve order is intentional:
    // 1) show fastest local/history candidate immediately
    // 2) reconcile with server snapshot for canonical status and timestamps
    setState({
      persistedDraft,
      resumeDraftRecord: historyBest,
      isResolvingResumeDraft: true,
      resumeDraftError: null,
      resumeDraftIsEditable: isPartnerServiceCapacityDraftEditable(historyBest)
    })

    loadPartnerServiceCapacitySurvey(lookupOrganizationName, draftKey)
      .then((fetched) => {
        if (!isMounted) return
        const serverBest = pickFreshestPartnerServiceCapacityRecord([historyBest, fetched])
        const resumeDraftRecord =
          serverBest ?? buildLocalOnlyResumeSubmissionRecord(persistedDraft)
        setState({
          persistedDraft,
          resumeDraftRecord,
          isResolvingResumeDraft: false,
          resumeDraftError: null,
          resumeDraftIsEditable: isPartnerServiceCapacityDraftEditable(resumeDraftRecord)
        })
      })
      .catch((error) => {
        if (!isMounted) return
        // Degrade to local/history draft so users can keep editing while backend is unavailable.
        const resumeDraftRecord =
          historyBest ?? buildLocalOnlyResumeSubmissionRecord(persistedDraft)
        setState({
          persistedDraft,
          resumeDraftRecord,
          isResolvingResumeDraft: false,
          resumeDraftError: error instanceof Error ? error.message : 'Unable to resolve active draft.',
          resumeDraftIsEditable: isPartnerServiceCapacityDraftEditable(resumeDraftRecord)
        })
      })

    return () => {
      isMounted = false
    }
  }, [organizationName, resolutionKey, submissionHistorySignature, submissionHistory])

  const resumeDraftUpdatedAtIso = getResumeDraftDisplayTimestampIso(state.persistedDraft, state.resumeDraftRecord)

  return {
    ...state,
    resumeDraftUpdatedAtIso
  }
}