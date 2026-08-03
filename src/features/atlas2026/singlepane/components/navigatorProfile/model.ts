import type { CreateSessionRecord } from '@/features/atlas2026/shared/contracts'

export type NavigatorProfileOverlayKey =
  | 'section_1_ipscc'
  | 'section_2_awareness'
  | 'section_3_create'
  | 'section_4_assignments'
  | 'section_5_zcode_updates'
  | 'section_6_competency'
  | 'section_7_schedule'
  | 'section_8_archive'

export type OverlaySaveState = 'idle' | 'saving' | 'saved' | 'error'

export const NAVIGATOR_PROFILE_CARDS: Array<{
  // overlayId (not "key") avoids gitleaks generic-api-key false positives on section ids.
  overlayId: NavigatorProfileOverlayKey
  title: string
  cardTitle: string
  cardSubtitle: string
  actionLabel: string
  variant: 'green' | 'blue'
  illustration: 'feedback' | 'reflection' | 'create'
  // Only the three-prong supervision cards ship on My Profile for now.
  isActiveOnProfileRail: boolean
}> = [
  { overlayId: 'section_1_ipscc', title: 'Section 1: IPSCC ratings and reviews', cardTitle: 'enrollee', cardSubtitle: 'ipscc', actionLabel: 'view feedback', variant: 'green', illustration: 'feedback', isActiveOnProfileRail: true },
  { overlayId: 'section_2_awareness', title: 'Section 2: Self-awareness correlation', cardTitle: 'self-reflection', cardSubtitle: 'ips', actionLabel: 'start reflection', variant: 'blue', illustration: 'reflection', isActiveOnProfileRail: true },
  { overlayId: 'section_3_create', title: 'Section 3: C.R.E.A.T.E. supervision history', cardTitle: 'c.r.e.a.t.e', cardSubtitle: 'session history', actionLabel: 'view history', variant: 'green', illustration: 'create', isActiveOnProfileRail: true },
  { overlayId: 'section_4_assignments', title: 'Section 4: Enrollment assignment board', cardTitle: 'assignment board', cardSubtitle: 'enrollment', actionLabel: 'view board', variant: 'blue', illustration: 'feedback', isActiveOnProfileRail: false },
  { overlayId: 'section_5_zcode_updates', title: 'Section 5: Enrollee z-code updates', cardTitle: 'z-code updates', cardSubtitle: 'enrollee', actionLabel: 'update z-codes', variant: 'green', illustration: 'reflection', isActiveOnProfileRail: false },
  { overlayId: 'section_6_competency', title: 'Section 6: Navigator competency', cardTitle: 'competency', cardSubtitle: 'navigator', actionLabel: 'open competency', variant: 'blue', illustration: 'create', isActiveOnProfileRail: false },
  { overlayId: 'section_7_schedule', title: 'Section 7: Scheduled assessments', cardTitle: 'schedule', cardSubtitle: 'assessments', actionLabel: 'view schedule', variant: 'green', illustration: 'feedback', isActiveOnProfileRail: false },
  { overlayId: 'section_8_archive', title: 'Section 8: Supervision archive', cardTitle: 'archive', cardSubtitle: 'supervision', actionLabel: 'open archive', variant: 'blue', illustration: 'reflection', isActiveOnProfileRail: false }
]

export const ACTIVE_NAVIGATOR_PROFILE_CARDS = NAVIGATOR_PROFILE_CARDS.filter((card) => card.isActiveOnProfileRail)

export const CREATE_HISTORY_FIELDS: Array<{
  key: 'recognizeNotes' | 'encourageNotes' | 'acknowledgeNotes' | 'trainNotes' | 'empowerNotes' | 'createActionPlan' | 'superviseeSubmission' | 'supervisorSubmission'
  label: string
}> = [
  { key: 'recognizeNotes', label: 'Recognize' },
  { key: 'encourageNotes', label: 'Encourage' },
  { key: 'acknowledgeNotes', label: 'Acknowledge' },
  { key: 'trainNotes', label: 'Train' },
  { key: 'empowerNotes', label: 'Empower' },
  { key: 'createActionPlan', label: 'Action plan' },
  { key: 'superviseeSubmission', label: 'Peer specialist submission' },
  { key: 'supervisorSubmission', label: 'Supervisor submission' }
]

export function formatSupervisionMode(mode: CreateSessionRecord['supervisionMode']) {
  switch (mode) {
    case 'in_person':
      return 'in-person'
    case 'online':
      return 'online'
    case 'phone_call':
      return 'phone call'
    default: {
      const exhaustiveMode: never = mode
      return exhaustiveMode
    }
  }
}

export function createRecordId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0').slice(-12)}`
}

export function getWeekStartIso(date = new Date()) {
  const next = new Date(date)
  const day = next.getUTCDay()
  next.setUTCDate(next.getUTCDate() - ((day + 6) % 7))
  next.setUTCHours(0, 0, 0, 0)
  return next.toISOString()
}

export function formatDateLabel(value: string | null | undefined) {
  if (!value) return 'not recorded'
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed)
}
