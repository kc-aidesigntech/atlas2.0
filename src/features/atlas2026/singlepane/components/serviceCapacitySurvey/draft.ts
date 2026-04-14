import { createPartnerServiceCapacityDraftKey, normalizeOrganizationName } from '@atlas/shared'
import {
  buildDefaultPartnerServiceCapacityAnswers,
  SERVICE_CAPACITY_FORM_VERSION
} from '@/features/atlas2026/singlepane/data/serviceCapacitySurveyCatalog'
import type {
  PartnerServiceCapacityAnswer,
  PartnerServiceCapacityHeader,
  PartnerServiceCapacitySubmissionRecord,
  ZCodeSurveyPrompt
} from '@/features/atlas2026/singlepane/types'

export const SERVICE_CAPACITY_DRAFT_STORAGE_KEY = 'atlas2026.service-capacity.active-draft.v1'

export type DraftAnswer = PartnerServiceCapacityAnswer

export interface DraftState {
  header: PartnerServiceCapacityHeader
  answers: DraftAnswer[]
}

export interface PersistedSurveyDraft {
  draftKey: string
  isSurveyStarted: boolean
  persistedAtIso?: string
  header: PartnerServiceCapacityHeader
  answers: DraftAnswer[]
}

export function createBlankHeader(): PartnerServiceCapacityHeader {
  return {
    firstName: '',
    lastName: '',
    email: '',
    organizationName: '',
    jobTitle: '',
    respondentRoles: [],
    otherRoleText: ''
  }
}

export function createDraftKey() {
  return createPartnerServiceCapacityDraftKey('service-capacity')
}

export function hasMeaningfulDraftContent(header: PartnerServiceCapacityHeader, answers: DraftAnswer[]) {
  return (
    Boolean(header.firstName.trim()) ||
    Boolean(header.lastName.trim()) ||
    Boolean(header.email.trim()) ||
    Boolean(header.organizationName.trim()) ||
    Boolean(header.jobTitle.trim()) ||
    header.respondentRoles.length > 0 ||
    Boolean(header.otherRoleText.trim()) ||
    answers.some((answer) => typeof answer.score === 'number' || answer.notEncountered)
  )
}

export function loadPersistedSurveyDraft(): PersistedSurveyDraft | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(SERVICE_CAPACITY_DRAFT_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PersistedSurveyDraft
    if (!parsed || typeof parsed !== 'object' || !parsed.draftKey) return null
    return parsed
  } catch {
    return null
  }
}

export function persistSurveyDraft(draft: PersistedSurveyDraft | null) {
  if (typeof window === 'undefined') return
  if (!draft) {
    window.localStorage.removeItem(SERVICE_CAPACITY_DRAFT_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(
    SERVICE_CAPACITY_DRAFT_STORAGE_KEY,
    JSON.stringify({
      ...draft,
      persistedAtIso: new Date().toISOString()
    } satisfies PersistedSurveyDraft)
  )
}

export function buildDraftAnswers(savedSubmission: PartnerServiceCapacitySubmissionRecord | null, prompts: ZCodeSurveyPrompt[]) {
  const defaults = buildDefaultPartnerServiceCapacityAnswers(prompts)
  const answersByPromptId = new Map(savedSubmission?.answers.map((answer) => [answer.promptId, answer]) || [])
  return defaults.map((answer) => answersByPromptId.get(answer.promptId) || answer)
}

export function formatDateTimeLabel(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

export function getRecordSortTime(record: PartnerServiceCapacitySubmissionRecord) {
  return new Date(record.updatedAtIso || record.submittedAtIso).getTime()
}

export function getPersistedDraftSortTime(draft: PersistedSurveyDraft | null) {
  if (!draft?.persistedAtIso) return 0
  const timestamp = new Date(draft.persistedAtIso).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function submissionMatchesPersistedDraftKey(record: PartnerServiceCapacitySubmissionRecord, persistedDraftKey: string) {
  const key = persistedDraftKey.trim()
  if (!key) return false
  return record.draftKey === key || record.id === key
}

export function listHistoryRecordsForDraftKey(
  history: PartnerServiceCapacitySubmissionRecord[],
  persistedDraftKey: string
): PartnerServiceCapacitySubmissionRecord[] {
  return history.filter((record) => submissionMatchesPersistedDraftKey(record, persistedDraftKey))
}

export function pickFreshestPartnerServiceCapacityRecord(
  records: Array<PartnerServiceCapacitySubmissionRecord | null | undefined>
): PartnerServiceCapacitySubmissionRecord | null {
  const present = records.filter((record): record is PartnerServiceCapacitySubmissionRecord => Boolean(record))
  if (!present.length) return null
  return present.sort((left, right) => getRecordSortTime(right) - getRecordSortTime(left))[0] || null
}

/** When Supabase has no row yet, expose a draft-shaped record so history/resume share the same draftKey identity. */
export function buildLocalOnlyResumeSubmissionRecord(persisted: PersistedSurveyDraft): PartnerServiceCapacitySubmissionRecord {
  const nowIso = new Date().toISOString()
  const timestampIso = persisted.persistedAtIso && Number.isFinite(new Date(persisted.persistedAtIso).getTime())
    ? persisted.persistedAtIso
    : nowIso
  return {
    id: persisted.draftKey,
    draftKey: persisted.draftKey,
    status: 'draft',
    completedAtIso: null,
    partnerId: null,
    organizationNameNormalized: normalizeOrganizationName(persisted.header.organizationName) || null,
    submittedAtIso: timestampIso,
    updatedAtIso: timestampIso,
    formVersion: SERVICE_CAPACITY_FORM_VERSION,
    header: persisted.header,
    answers: persisted.answers
  }
}

export function isPartnerServiceCapacityDraftEditable(record: PartnerServiceCapacitySubmissionRecord | null) {
  return Boolean(record && record.status === 'draft')
}

export function getResumeDraftDisplayTimestampIso(
  persisted: PersistedSurveyDraft | null,
  record: PartnerServiceCapacitySubmissionRecord | null
) {
  const persistedMs = getPersistedDraftSortTime(persisted)
  const recordMs = record ? getRecordSortTime(record) : 0
  if (persistedMs > recordMs) return persisted?.persistedAtIso || null
  return record?.updatedAtIso || record?.submittedAtIso || persisted?.persistedAtIso || null
}
