import { createPartnerServiceCapacityDraftKey } from '@atlas/shared'
import { buildDefaultPartnerServiceCapacityAnswers } from '@/features/atlas2026/singlepane/data/serviceCapacitySurveyCatalog'
import type {
  PartnerServiceCapacityAnswer,
  PartnerServiceCapacityHeader,
  PartnerServiceCapacitySubmissionRecord
} from '@/features/atlas2026/singlepane/types'

export const SERVICE_CAPACITY_DRAFT_STORAGE_KEY = 'atlas2026.service-capacity.active-draft.v1'

export type DraftAnswer = Omit<PartnerServiceCapacityAnswer, 'score'> & { score: number | null }

export interface DraftState {
  header: PartnerServiceCapacityHeader
  answers: DraftAnswer[]
}

export interface PersistedSurveyDraft {
  draftKey: string
  isSurveyStarted: boolean
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
    answers.some((answer) => typeof answer.score === 'number')
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
  window.localStorage.setItem(SERVICE_CAPACITY_DRAFT_STORAGE_KEY, JSON.stringify(draft))
}

export function buildDraftAnswers(savedSubmission: PartnerServiceCapacitySubmissionRecord | null) {
  const defaults = buildDefaultPartnerServiceCapacityAnswers().map((answer) => ({ ...answer, score: null as number | null }))
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
