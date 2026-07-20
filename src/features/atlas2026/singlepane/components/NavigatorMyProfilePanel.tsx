import React from 'react'
import type {
  AccountSettings,
  CreateInsightRow,
  CreateSessionRecord,
  DomainLoad,
  EnrolleeProfile,
  IntervalAssessmentDueItem,
  IpsCompetencySelfAssessmentRecord,
  IpsccCompetencyAggregate,
  IpsccCompetencyKey,
  IpsccEncounterSubmissionRecord,
  IpsccSelfAwarenessCorrelationRow,
  IpsccSelfAwarenessSummary,
  NavigatorEnrollmentAssignmentRecord,
  RegulationReviewDueItem,
  SupervisorIpsAssessmentRecord,
  SupervisionSessionRecord,
  SupervisorNavigatorCompetencySummary
} from '@/features/atlas2026/shared/contracts'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import NavigatorEnrollmentAssignmentsPanel from './NavigatorEnrollmentAssignmentsPanel'
import ProfileNavigationCard from './ProfileNavigationCard'
import AtlasImageUploadTile from '@/features/atlas2026/components/AtlasImageUploadTile'
import { createFallbackAvatarDataUrl } from '@/features/atlas2026/components/avatarFallback'

interface NavigatorMyProfilePanelProps {
  accountSettings: AccountSettings
  currentNavigatorName: string
  aggregateLoad: DomainLoad | null
  assignedEnrolleeCount: number
  assignedEnrollees: EnrolleeProfile[]
  navigatorEnrollmentAssignments: NavigatorEnrollmentAssignmentRecord[]
  navigatorEnrollmentAssignmentsError: string | null
  isLoadingNavigatorEnrollmentAssignments: boolean
  assigningEnrollmentId: string | null
  canViewNavigatorAssignmentNames: boolean
  canToggleAssignmentActions: boolean
  canOpenAssignmentBoardReferral: boolean
  competencySummary: SupervisorNavigatorCompetencySummary | null
  ipsccCompetencyAverages: IpsccCompetencyAggregate[]
  selfAwarenessCorrelationRows: IpsccSelfAwarenessCorrelationRow[]
  selfAwarenessSummary: IpsccSelfAwarenessSummary
  ipsSelfAssessments: IpsCompetencySelfAssessmentRecord[]
  navigatorSupervisorIpsAssessments: SupervisorIpsAssessmentRecord[]
  createInsights: CreateInsightRow[]
  createSessions: CreateSessionRecord[]
  supervisionSessions: SupervisionSessionRecord[]
  dueItems: IntervalAssessmentDueItem[]
  regulationReviewDueItems?: RegulationReviewDueItem[]
  programError?: string | null
  onOpenLoadTable?: () => void
  isUploadingAvatar?: boolean
  avatarUploadError?: string | null
  onReplaceAvatar?: (file: File) => Promise<unknown> | unknown
  onOpenEnrolleeSurvey?: (enrolleeId: string) => void
  // Forced weekly SVS / MH-SCA review: open items must be actionable — selecting one
  // jumps the navigator into that enrollee's regulation assessment flow.
  onOpenRegulationReview?: (enrolleeId: string, missingInstruments?: Array<'mh_sca' | 'svs'>) => void
  onOpenAssignmentBoardReferral?: () => void
  onToggleEnrollmentAssignment: (enrollmentId: string, mode: 'accept' | 'archive' | 'assign' | 'unassign') => Promise<void> | void
  onSaveIpsSelfAssessment: (record: IpsCompetencySelfAssessmentRecord) => Promise<unknown> | unknown
  onSaveIpsccEncounterSubmission: (record: IpsccEncounterSubmissionRecord) => Promise<unknown> | unknown
  onSaveSupervisionSession: (record: SupervisionSessionRecord) => Promise<unknown> | unknown
  onSaveCreateSession: (record: CreateSessionRecord) => Promise<unknown> | unknown
}

type OverlayKey =
  | 'section_1_ipscc'
  | 'section_2_awareness'
  | 'section_3_create'
  | 'section_4_assignments'
  | 'section_5_zcode_updates'
  | 'section_6_competency'
  | 'section_7_schedule'
  | 'section_8_archive'

type OverlaySaveState = 'idle' | 'saving' | 'saved' | 'error'

const CARD_DEFS: Array<{
  key: OverlayKey
  title: string
  cardTitle: string
  cardSubtitle: string
  actionLabel: string
  variant: 'green' | 'blue'
  illustration: 'feedback' | 'reflection' | 'create'
}> = [
  { key: 'section_1_ipscc', title: 'Section 1: IPSCC ratings and reviews', cardTitle: 'enrollee feedback', cardSubtitle: 'ipscc', actionLabel: 'view feedback', variant: 'green', illustration: 'feedback' },
  { key: 'section_2_awareness', title: 'Section 2: Self-awareness correlation', cardTitle: 'self-reflection', cardSubtitle: 'ips', actionLabel: 'start reflection', variant: 'blue', illustration: 'reflection' },
  { key: 'section_3_create', title: 'Section 3: C.R.E.A.T.E. supervision form', cardTitle: 'c.r.e.a.t.e', cardSubtitle: 'create & share', actionLabel: 'create & share', variant: 'green', illustration: 'create' },
  { key: 'section_4_assignments', title: 'Section 4: Enrollment assignment board', cardTitle: 'assignment board', cardSubtitle: 'enrollment', actionLabel: 'view board', variant: 'blue', illustration: 'feedback' },
  { key: 'section_5_zcode_updates', title: 'Section 5: Enrollee z-code updates', cardTitle: 'z-code updates', cardSubtitle: 'enrollee', actionLabel: 'update z-codes', variant: 'green', illustration: 'reflection' },
  { key: 'section_6_competency', title: 'Section 6: Navigator competency', cardTitle: 'competency', cardSubtitle: 'navigator', actionLabel: 'open competency', variant: 'blue', illustration: 'create' },
  { key: 'section_7_schedule', title: 'Section 7: Scheduled assessments', cardTitle: 'schedule', cardSubtitle: 'assessments', actionLabel: 'view schedule', variant: 'green', illustration: 'feedback' },
  { key: 'section_8_archive', title: 'Section 8: Supervision archive', cardTitle: 'archive', cardSubtitle: 'supervision', actionLabel: 'open archive', variant: 'blue', illustration: 'reflection' }
]

const IPS_COMPETENCY_OPTIONS: Array<{ key: IpsccCompetencyKey; label: string }> = [
  { key: 'competency_1_connection', label: '1. Connection' },
  { key: 'competency_2_learning_together', label: '2. Helping to learning together' },
  { key: 'competency_3_worldview_awareness', label: '3. Worldview awareness' },
  { key: 'competency_4_relationship_focus', label: '4. Individual to relationship' },
  { key: 'competency_5_mutuality', label: '5. Mutuality' },
  { key: 'competency_6_hope_and_possibility', label: '6. Fear to hope and possibility' },
  { key: 'competency_7_moving_towards', label: '7. Moving towards' },
  { key: 'competency_8_self_reflection', label: '8. Self-reflection' },
  { key: 'competency_9_feedback', label: '9. Give and receive feedback' },
  { key: 'competency_10_co_reflection', label: '10. Co-reflection' }
]

const IPSCC_ITEM_LABELS = [
  'Item 1',
  'Item 2',
  'Item 3',
  'Item 4',
  'Item 5',
  'Item 6',
  'Item 7',
  'Item 8',
  'Item 9',
  'Item 10'
] as const

const LIKERT_OPTIONS = [
  { value: 1, label: '1 · strongly disagree' },
  { value: 2, label: '2 · disagree' },
  { value: 3, label: '3 · unsure' },
  { value: 4, label: '4 · agree' },
  { value: 5, label: '5 · strongly agree' }
] as const

const CREATE_NOTE_FIELDS: Array<{
  key: 'recognizeNotes' | 'encourageNotes' | 'acknowledgeNotes' | 'trainNotes' | 'empowerNotes' | 'createActionPlan' | 'superviseeSubmission' | 'supervisorSubmission'
  label: string
}> = [
  { key: 'recognizeNotes', label: 'Recognize: success, achievements, etc.' },
  { key: 'encourageNotes', label: 'Encourage: challenges, difficulties, etc.' },
  { key: 'acknowledgeNotes', label: 'Acknowledge: initiative, leadership, advocacy, etc.' },
  { key: 'trainNotes', label: 'Train: learning opportunities and support needed' },
  { key: 'empowerNotes', label: 'Empower: time, tools, transportation, materials, etc.' },
  { key: 'createActionPlan', label: 'C.R.E.A.T.E. action plan for implementation' },
  { key: 'superviseeSubmission', label: 'Peer specialist submission' },
  { key: 'supervisorSubmission', label: 'Supervisor submission' }
]

function createRecordId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0').slice(-12)}`
}

function getWeekStartIso(date = new Date()) {
  const next = new Date(date)
  const day = next.getUTCDay()
  const diff = (day + 6) % 7
  next.setUTCDate(next.getUTCDate() - diff)
  next.setUTCHours(0, 0, 0, 0)
  return next.toISOString()
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return 'not recorded'
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed)
}

function PersistentField({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <small className="atlas-overline block text-[#9eacb9]">{label}</small>
      <div className="mt-1">{children}</div>
    </label>
  )
}

export default function NavigatorMyProfilePanel(props: NavigatorMyProfilePanelProps) {
  const {
    accountSettings,
    currentNavigatorName,
    assignedEnrolleeCount,
    assignedEnrollees,
    navigatorEnrollmentAssignments,
    navigatorEnrollmentAssignmentsError,
    isLoadingNavigatorEnrollmentAssignments,
    assigningEnrollmentId,
    canViewNavigatorAssignmentNames,
    canToggleAssignmentActions,
    canOpenAssignmentBoardReferral,
    competencySummary,
    ipsccCompetencyAverages,
    selfAwarenessCorrelationRows,
    selfAwarenessSummary,
    ipsSelfAssessments,
    navigatorSupervisorIpsAssessments,
    createInsights,
    createSessions,
    supervisionSessions,
    dueItems,
    regulationReviewDueItems = [],
    programError = null,
    isUploadingAvatar = false,
    avatarUploadError = null,
    onReplaceAvatar,
    onOpenEnrolleeSurvey,
    onOpenRegulationReview,
    onOpenAssignmentBoardReferral,
    onToggleEnrollmentAssignment,
    onSaveIpsSelfAssessment,
    onSaveIpsccEncounterSubmission,
    onSaveSupervisionSession,
    onSaveCreateSession
  } = props

  const [activeOverlay, setActiveOverlay] = React.useState<OverlayKey | null>(null)
  const assignmentBoardRef = React.useRef<HTMLElement | null>(null)
  const [overlaySaveState, setOverlaySaveState] = React.useState<OverlaySaveState>('idle')
  const [overlaySaveMessage, setOverlaySaveMessage] = React.useState<string | null>(null)
  const [selectedIpsccEnrolleeId, setSelectedIpsccEnrolleeId] = React.useState<string>('')
  const [ipsccItemScores, setIpsccItemScores] = React.useState<number[]>(() => Array.from({ length: 10 }, () => 4))
  const [ipsccNoteDraft, setIpsccNoteDraft] = React.useState('')
  const [ipsSelfDraftScores, setIpsSelfDraftScores] = React.useState<Record<string, number>>(
    () => Object.fromEntries(IPS_COMPETENCY_OPTIONS.map((item) => [item.key, 3]))
  )
  const [ipsSelfDraftNote, setIpsSelfDraftNote] = React.useState('')
  const [createDraft, setCreateDraft] = React.useState({
    supervisionMode: 'in_person' as 'in_person' | 'online' | 'phone_call',
    sessionDurationMinutes: '50',
    connectFocusedListening: true,
    recognizeNotes: '',
    encourageNotes: '',
    acknowledgeNotes: '',
    trainNotes: '',
    empowerNotes: '',
    createActionPlan: '',
    supervisorSubmission: '',
    superviseeSubmission: '',
    peerSpecialistSignature: currentNavigatorName,
    supervisorSignature: 'peer supervisor'
  })

  React.useEffect(() => {
    if (assignedEnrollees.length && !selectedIpsccEnrolleeId) {
      setSelectedIpsccEnrolleeId(assignedEnrollees[0].id)
    }
  }, [assignedEnrollees, selectedIpsccEnrolleeId])

  React.useEffect(() => {
    setOverlaySaveState('idle')
    setOverlaySaveMessage(null)
  }, [activeOverlay])

  const navigatorDisplayName = currentNavigatorName.trim() || accountSettings.fullName.trim() || 'navigator'
  const fallbackAvatarSrc = React.useMemo(() => createFallbackAvatarDataUrl(navigatorDisplayName), [navigatorDisplayName])
  const avatarSrc = accountSettings.avatarUrl || fallbackAvatarSrc
  // Open weekly regulation reviews are non-skippable action items: both SVS and MH-SCA
  // must be completed for each listed enrollee before the cycle clears.
  const openRegulationReviews = React.useMemo(
    () => regulationReviewDueItems.filter((item) => item.status === 'open'),
    [regulationReviewDueItems]
  )

  async function runOverlaySave(action: () => Promise<void>, successMessage: string) {
    setOverlaySaveState('saving')
    setOverlaySaveMessage(null)
    try {
      await action()
      setOverlaySaveState('saved')
      setOverlaySaveMessage(successMessage)
    } catch (error) {
      setOverlaySaveState('error')
      setOverlaySaveMessage(error instanceof Error ? error.message : 'Unable to save this entry.')
    }
  }

  return (
    <div className="relative flex flex-col gap-4">
      {openRegulationReviews.length ? (
        <div
          className="atlas-surface-panel px-4 py-3"
          style={{ borderColor: `${SP_COLORS.red}80`, borderWidth: 1, borderStyle: 'solid' }}
        >
          <small className="atlas-overline block" style={{ color: SP_COLORS.red }}>
            required weekly regulation review
          </small>
          <div className="mt-1 text-[15px] font-medium text-white">
            {openRegulationReviews.length} enrollee{openRegulationReviews.length === 1 ? '' : 's'} need Stress
            Vulnerability Scale (SVS) and Mental Health Self-Care Agency (MH-SCA) this cycle — cadence cannot be skipped.
          </div>
          <div className="mt-3 space-y-2">
            {openRegulationReviews.map((item) => {
              const missingLabel = (item.missingInstruments || ['mh_sca', 'svs'])
                .map((instrument) => (instrument === 'mh_sca' ? 'MH-SCA' : 'SVS'))
                .join(' + ')
              return (
                <div key={item.id} className="atlas-surface-raised flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div className="text-[13px] text-white">
                    {item.enrolleeName}
                    <span className="ml-2 text-[#9eacb9]">
                      due {formatDateLabel(item.dueAtIso)} · missing {missingLabel}
                    </span>
                  </div>
                  <AtlasTextButton
                    onClick={() => onOpenRegulationReview?.(item.enrolleeId, item.missingInstruments)}
                    className="px-3 py-1 text-[12px]"
                    style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
                  >
                    start review
                  </AtlasTextButton>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
      <div className="atlas-navigator-profile-layout">
        <div className="atlas-navigator-profile-main space-y-4">
          <div className="atlas-surface-panel px-5 py-4">
            <div className="flex flex-wrap items-start gap-3 pt-0.5 sm:flex-nowrap">
              <AtlasImageUploadTile
                imageSrc={avatarSrc}
                alt={`${navigatorDisplayName} profile`}
                onSelectFile={onReplaceAvatar}
                disabled={!onReplaceAvatar}
                buttonTitle={onReplaceAvatar ? 'Replace profile image' : 'Profile image upload unavailable'}
                statusText={isUploadingAvatar ? 'uploading image...' : null}
                errorText={avatarUploadError}
                onImageError={(event) => {
                  if (event.currentTarget.src !== fallbackAvatarSrc) {
                    event.currentTarget.src = fallbackAvatarSrc
                  }
                }}
              />
              <div className="min-w-[220px] flex-1 space-y-0.5 pt-[2px] text-white" style={{ textTransform: 'none' }}>
                <h2 className="atlas-h3 text-[34px] font-medium leading-[1.1]" style={{ textTransform: 'none' }}>
                  {navigatorDisplayName}
                </h2>
                <small className="atlas-meta block text-white">Role: navigator</small>
                <small className="atlas-meta block text-white">Org: {accountSettings.organization || 'not recorded'}</small>
                <small className="atlas-meta block text-white" style={{ textTransform: 'none' }}>
                  E: {accountSettings.email || 'not recorded'}
                </small>
                <small className="atlas-meta block text-white">Assigned enrollees: {assignedEnrolleeCount}</small>
                <small className="atlas-meta block text-white">Active sections: {CARD_DEFS.length}</small>
              </div>
            </div>
            {programError ? (
              <div className="mt-3 rounded-[14px] border px-3 py-2 text-[12px]" style={{ borderColor: `${SP_COLORS.red}80`, color: SP_COLORS.red }}>
                {programError}
              </div>
            ) : null}
          </div>
          {/* Keep assignment controls always visible so navigators can claim/triage work
              without switching context through a card overlay. */}
          <section ref={assignmentBoardRef} className="atlas-surface-panel p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <small className="atlas-overline block text-[#9eacb9]">navigator workflow</small>
                <div className="text-[18px] font-medium text-white">enrollment assignment board</div>
              </div>
            </div>
            <NavigatorEnrollmentAssignmentsPanel
              rows={navigatorEnrollmentAssignments}
              isLoading={isLoadingNavigatorEnrollmentAssignments}
              error={navigatorEnrollmentAssignmentsError}
              assigningEnrollmentId={assigningEnrollmentId}
              canViewNavigatorAssignmentNames={canViewNavigatorAssignmentNames}
              canToggleAssignments={canToggleAssignmentActions}
              canOpenReferralComposer={canOpenAssignmentBoardReferral}
              onOpenReferralComposer={onOpenAssignmentBoardReferral}
              onToggleAssignment={onToggleEnrollmentAssignment}
            />
          </section>
        </div>
        <div className="atlas-navigator-profile-rail">
          {CARD_DEFS.map((card) => (
            <ProfileNavigationCard
              key={card.key}
              sequenceNumber={Number(card.key.replace('section_', '').split('_')[0])}
              title={card.cardTitle}
              subtitle={card.cardSubtitle}
              actionLabel={card.actionLabel}
              variant={card.variant}
              illustration={card.illustration}
              onClick={() => setActiveOverlay(card.key)}
            />
          ))}
        </div>
      </div>

      {activeOverlay ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="atlas-surface-panel max-h-[90vh] w-full max-w-[980px] overflow-y-auto p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[18px] font-medium text-white">
                {CARD_DEFS.find((card) => card.key === activeOverlay)?.title || 'section'}
              </div>
              <AtlasTextButton onClick={() => setActiveOverlay(null)} className="px-3 py-1 text-[12px]">
                close
              </AtlasTextButton>
            </div>

            {activeOverlay === 'section_1_ipscc' ? (
              <div className="space-y-3">
                <div className="atlas-surface-raised px-3 py-3 text-[12px] text-white">
                  <div className="font-medium">Individual Placement and Support Core Competencies (IPSCC) encounter survey</div>
                  <div className="mt-1 text-[#9eacb9]">
                    Capture service-user ratings after each encounter (1 = strongly disagree … 5 = strongly agree).
                  </div>
                </div>
                {ipsccCompetencyAverages.map((row) => (
                  <div key={row.key} className="atlas-surface-raised flex items-center justify-between px-3 py-2 text-[12px]">
                    <span className="text-white">{row.label}</span>
                    <span style={{ color: '#d7e0e9' }}>{row.averageScore == null ? '--' : row.averageScore.toFixed(2)} · n={row.sampleSize}</span>
                  </div>
                ))}
                <PersistentField label="Enrollee">
                  <select
                    className="atlas-select h-10 w-full bg-transparent text-white"
                    value={selectedIpsccEnrolleeId}
                    onChange={(event) => setSelectedIpsccEnrolleeId(event.target.value)}
                    disabled={!assignedEnrollees.length}
                  >
                    {!assignedEnrollees.length ? (
                      <option value="" className="bg-black text-white">No assigned enrollees</option>
                    ) : null}
                    {assignedEnrollees.map((enrollee) => (
                      <option key={enrollee.id} value={enrollee.id} className="bg-black text-white">{enrollee.fullName}</option>
                    ))}
                  </select>
                </PersistentField>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {IPSCC_ITEM_LABELS.map((label, index) => (
                    <PersistentField key={label} label={label}>
                      <select
                        className="atlas-select h-10 w-full bg-transparent text-white"
                        value={ipsccItemScores[index]}
                        onChange={(event) => {
                          const nextScore = Number(event.target.value)
                          setIpsccItemScores((current) => current.map((score, scoreIndex) => (scoreIndex === index ? nextScore : score)))
                        }}
                      >
                        {LIKERT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value} className="bg-black text-white">{option.label}</option>
                        ))}
                      </select>
                    </PersistentField>
                  ))}
                </div>
                <PersistentField label="Service user note">
                  <textarea
                    className="atlas-textarea min-h-[90px] bg-transparent text-white"
                    value={ipsccNoteDraft}
                    onChange={(event) => setIpsccNoteDraft(event.target.value)}
                  />
                </PersistentField>
                <div className="flex items-center justify-between gap-3">
                  {overlaySaveMessage ? (
                    <small style={{ color: overlaySaveState === 'error' ? SP_COLORS.red : '#9eacb9' }}>{overlaySaveMessage}</small>
                  ) : (
                    <span />
                  )}
                  <AtlasTextButton
                    disabled={overlaySaveState === 'saving' || !assignedEnrollees.length}
                    onClick={() =>
                      void runOverlaySave(async () => {
                        const enrollee = assignedEnrollees.find((item) => item.id === selectedIpsccEnrolleeId)
                        if (!enrollee) throw new Error('Select an enrollee before saving IPSCC feedback.')
                        await onSaveIpsccEncounterSubmission({
                          id: createRecordId(),
                          navigatorName: currentNavigatorName,
                          enrolleeId: enrollee.id,
                          enrolleeName: enrollee.fullName,
                          enrollmentId: enrollee.enrollmentId || null,
                          submittedAtIso: new Date().toISOString(),
                          submittedBy: 'service user',
                          itemScores: ipsccItemScores.map((score) => Math.max(1, Math.min(5, Math.round(score || 3)))),
                          note: ipsccNoteDraft
                        })
                        setIpsccNoteDraft('')
                      }, 'IPSCC encounter survey saved.')
                    }
                    className="px-4 py-2 text-[12px]"
                  >
                    {overlaySaveState === 'saving' ? 'saving...' : 'save IPSCC survey'}
                  </AtlasTextButton>
                </div>
              </div>
            ) : null}

            {activeOverlay === 'section_2_awareness' ? (
              <div className="space-y-3">
                <div className="atlas-surface-raised px-3 py-3 text-[12px] text-white">
                  <div className="font-medium">Weekly Individual Placement and Support (IPS) self-assessment</div>
                  <div className="mt-1 text-[#9eacb9]">
                    Complete the weekly IPS self-assessment below. Historical results and correlation are shown beneath.
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {IPS_COMPETENCY_OPTIONS.map((item) => (
                    <PersistentField key={item.key} label={item.label}>
                      <select
                        className="atlas-select h-10 w-full bg-transparent text-white"
                        value={ipsSelfDraftScores[item.key]}
                        onChange={(event) => setIpsSelfDraftScores((current) => ({ ...current, [item.key]: Number(event.target.value) }))}
                      >
                        {LIKERT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value} className="bg-black text-white">{option.label}</option>
                        ))}
                      </select>
                    </PersistentField>
                  ))}
                </div>
                <PersistentField label="Weekly self-assessment note">
                  <textarea
                    className="atlas-textarea min-h-[90px] bg-transparent text-white"
                    value={ipsSelfDraftNote}
                    onChange={(event) => setIpsSelfDraftNote(event.target.value)}
                  />
                </PersistentField>
                <div className="flex items-center justify-between gap-3">
                  {overlaySaveMessage ? (
                    <small style={{ color: overlaySaveState === 'error' ? SP_COLORS.red : '#9eacb9' }}>{overlaySaveMessage}</small>
                  ) : (
                    <span />
                  )}
                  <AtlasTextButton
                    disabled={overlaySaveState === 'saving'}
                    onClick={() =>
                      void runOverlaySave(async () => {
                        const now = new Date().toISOString()
                        await onSaveIpsSelfAssessment({
                          id: createRecordId(),
                          navigatorName: currentNavigatorName,
                          weekStartIso: getWeekStartIso(new Date(now)),
                          submittedAtIso: now,
                          competencyScores: ipsSelfDraftScores,
                          note: ipsSelfDraftNote
                        })
                        setIpsSelfDraftNote('')
                      }, 'Weekly IPS self-assessment saved.')
                    }
                    className="px-4 py-2 text-[12px]"
                  >
                    {overlaySaveState === 'saving' ? 'saving...' : 'save weekly IPS'}
                  </AtlasTextButton>
                </div>
                <div className="atlas-surface-raised px-3 py-3">
                  <div className="text-[13px] font-medium text-white">Historical IPS results</div>
                  <div className="mt-2 space-y-2">
                    {[
                      ...ipsSelfAssessments.map((record) => ({
                        id: `self-${record.id}`,
                        submittedAtIso: record.submittedAtIso,
                        roleLabel: 'self',
                        note: record.note
                      })),
                      ...navigatorSupervisorIpsAssessments.map((record) => ({
                        id: `supervisor-${record.id}`,
                        submittedAtIso: record.submittedAtIso,
                        roleLabel: 'supervisor',
                        note: record.note
                      }))
                    ]
                      .sort((left, right) => new Date(right.submittedAtIso).getTime() - new Date(left.submittedAtIso).getTime())
                      .slice(0, 12)
                      .map((entry) => (
                        <div key={entry.id} className="atlas-surface-raised grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 px-3 py-2 text-[12px]">
                          <span className="text-white">{formatDateLabel(entry.submittedAtIso)}</span>
                          <span style={{ color: '#9eacb9' }}>{entry.roleLabel}</span>
                          <span className="truncate" style={{ color: '#d7e0e9' }}>{entry.note || 'no note'}</span>
                        </div>
                      ))}
                  </div>
                </div>
                <div className="atlas-surface-raised px-3 py-3">
                  <div className="text-[13px] font-medium text-white">Self vs supervisor correlation</div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <MetricCard label="compared" value={String(selfAwarenessSummary.comparedCompetencyCount)} />
                    <MetricCard label="avg gap" value={selfAwarenessSummary.averageGap == null ? '--' : selfAwarenessSummary.averageGap.toFixed(2)} />
                    <MetricCard label="alignment" value={selfAwarenessSummary.overallAlignmentScore == null ? '--' : selfAwarenessSummary.overallAlignmentScore.toFixed(2)} />
                  </div>
                  <div className="mt-2 space-y-2">
                    {selfAwarenessCorrelationRows.map((row) => (
                      <div key={row.key} className="atlas-surface-raised grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 px-3 py-2 text-[12px]">
                        <span className="text-white">{row.label}</span>
                        <span style={{ color: '#9eacb9' }}>Supervisor {row.ipsccAverage?.toFixed(2) || '--'}</span>
                        <span style={{ color: '#9eacb9' }}>Self {row.selfAverage?.toFixed(2) || '--'}</span>
                        <span style={{ color: '#d7e0e9' }}>Gap {row.gap?.toFixed(2) || '--'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {activeOverlay === 'section_3_create' ? (
              <div className="space-y-3">
                <div className="atlas-surface-raised px-3 py-3 text-[12px] text-white">
                  <div className="font-medium">Connect, Recognize, Encourage, Acknowledge, Train, and Empower (C.R.E.A.T.E.) supervision notes</div>
                  <div className="mt-1 text-[#9eacb9]">Field labels stay visible while typing so mid-session context is never lost.</div>
                </div>
                {createInsights.map((insight) => (
                  <div key={insight.pillar} className="atlas-surface-raised px-3 py-2 text-[12px] text-white">
                    <strong>{insight.label}:</strong> {insight.latestSummary}
                  </div>
                ))}
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <PersistentField label="Mode of supervision">
                    <select
                      className="atlas-select h-10 w-full bg-transparent text-white"
                      value={createDraft.supervisionMode}
                      onChange={(event) =>
                        setCreateDraft((current) => ({
                          ...current,
                          supervisionMode: event.target.value as 'in_person' | 'online' | 'phone_call'
                        }))
                      }
                    >
                      <option value="in_person" className="bg-black text-white">In-person</option>
                      <option value="online" className="bg-black text-white">Online</option>
                      <option value="phone_call" className="bg-black text-white">Phone call</option>
                    </select>
                  </PersistentField>
                  <PersistentField label="Duration (minutes)">
                    <input
                      className="atlas-input h-10 w-full bg-transparent text-white"
                      value={createDraft.sessionDurationMinutes}
                      onChange={(event) => setCreateDraft((current) => ({ ...current, sessionDurationMinutes: event.target.value }))}
                    />
                  </PersistentField>
                </div>
                <label className="inline-flex items-center gap-2 text-[12px] text-white">
                  <input
                    type="checkbox"
                    checked={createDraft.connectFocusedListening}
                    onChange={(event) => setCreateDraft((current) => ({ ...current, connectFocusedListening: event.target.checked }))}
                  />
                  Connect: focused listening and minimized distractions
                </label>
                {CREATE_NOTE_FIELDS.map((field) => (
                  <PersistentField key={field.key} label={field.label}>
                    <textarea
                      className="atlas-textarea min-h-[72px] bg-transparent text-white"
                      value={createDraft[field.key]}
                      onChange={(event) => setCreateDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                    />
                  </PersistentField>
                ))}
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <PersistentField label="Peer specialist signature">
                    <input
                      className="atlas-input h-10 w-full bg-transparent text-white"
                      value={createDraft.peerSpecialistSignature}
                      onChange={(event) => setCreateDraft((current) => ({ ...current, peerSpecialistSignature: event.target.value }))}
                    />
                  </PersistentField>
                  <PersistentField label="Supervisor signature">
                    <input
                      className="atlas-input h-10 w-full bg-transparent text-white"
                      value={createDraft.supervisorSignature}
                      onChange={(event) => setCreateDraft((current) => ({ ...current, supervisorSignature: event.target.value }))}
                    />
                  </PersistentField>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <small style={{ color: overlaySaveState === 'error' ? SP_COLORS.red : '#9eacb9' }}>
                    {overlaySaveMessage || `${createSessions.length} C.R.E.A.T.E. sessions recorded`}
                  </small>
                  <AtlasTextButton
                    disabled={overlaySaveState === 'saving'}
                    onClick={() =>
                      void runOverlaySave(async () => {
                        const now = new Date().toISOString()
                        await onSaveCreateSession({
                          id: createRecordId(),
                          navigatorName: currentNavigatorName,
                          supervisorName: createDraft.supervisorSignature || 'supervisor',
                          sessionAtIso: now,
                          submittedAtIso: now,
                          supervisionMode: createDraft.supervisionMode,
                          sessionDurationMinutes: Number(createDraft.sessionDurationMinutes) || null,
                          connectFocusedListening: createDraft.connectFocusedListening,
                          recognizeNotes: createDraft.recognizeNotes,
                          encourageNotes: createDraft.encourageNotes,
                          acknowledgeNotes: createDraft.acknowledgeNotes,
                          trainNotes: createDraft.trainNotes,
                          empowerNotes: createDraft.empowerNotes,
                          createActionPlan: createDraft.createActionPlan,
                          supervisorSubmission: createDraft.supervisorSubmission,
                          superviseeSubmission: createDraft.superviseeSubmission,
                          peerSpecialistSignature: createDraft.peerSpecialistSignature,
                          peerSpecialistSignedAtIso: now,
                          supervisorSignature: createDraft.supervisorSignature,
                          supervisorSignedAtIso: now
                        })
                      }, 'C.R.E.A.T.E. supervision notes saved.')
                    }
                    className="px-4 py-2 text-[12px]"
                  >
                    {overlaySaveState === 'saving' ? 'saving...' : 'save C.R.E.A.T.E. notes'}
                  </AtlasTextButton>
                </div>
              </div>
            ) : null}

            {activeOverlay === 'section_4_assignments' ? (
              <div className="atlas-surface-raised space-y-3 px-3 py-3 text-white">
                <div className="text-[13px]">
                  assignment board is pinned to the left column so you can pick up enrollees without opening a card.
                </div>
                <div className="flex justify-end">
                  <AtlasTextButton
                    className="px-3 py-1 text-[12px]"
                    onClick={() => {
                      setActiveOverlay(null)
                      assignmentBoardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                  >
                    jump to assignment board
                  </AtlasTextButton>
                </div>
              </div>
            ) : null}

            {activeOverlay === 'section_5_zcode_updates' ? (
              <div className="space-y-2">
                {assignedEnrollees.map((enrollee) => (
                  <div key={enrollee.id} className="atlas-surface-raised flex items-center justify-between px-3 py-2">
                    <div className="text-white">{enrollee.fullName}</div>
                    <AtlasTextButton onClick={() => onOpenEnrolleeSurvey?.(enrollee.id)} className="px-3 py-1 text-[12px]">update z-codes</AtlasTextButton>
                  </div>
                ))}
              </div>
            ) : null}

            {activeOverlay === 'section_6_competency' ? (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <MetricCard label="weighted avg" value={competencySummary?.weightedRollingAverage?.toFixed(2) || '--'} />
                <MetricCard label="assessments" value={String(competencySummary?.assessmentCount || 0)} />
                <MetricCard label="last review" value={competencySummary?.lastAssessmentAtIso ? formatDateLabel(competencySummary.lastAssessmentAtIso) : 'none'} />
              </div>
            ) : null}

            {activeOverlay === 'section_7_schedule' ? (
              <div className="space-y-2">
                {dueItems.map((item) => (
                  <div key={item.id} className="atlas-surface-raised flex items-center justify-between px-3 py-2 text-[12px]">
                    <span className="text-white">{item.title}</span>
                    <span style={{ color: '#9eacb9' }}>{formatDateLabel(item.dueAtIso)} · {item.status}</span>
                  </div>
                ))}
                {regulationReviewDueItems.map((item) => {
                  const missingLabel = (item.missingInstruments || [])
                    .map((instrument) => (instrument === 'mh_sca' ? 'MH-SCA' : 'SVS'))
                    .join(' + ')
                  return (
                    <div key={item.id} className="atlas-surface-raised flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[12px]">
                      <div>
                        <span className="text-white">regulation review · {item.enrolleeName}</span>
                        <span className="ml-2" style={{ color: '#9eacb9' }}>
                          {formatDateLabel(item.dueAtIso)} · {item.status}
                          {item.status === 'open' && missingLabel ? ` · missing ${missingLabel}` : ''}
                        </span>
                      </div>
                      {item.status === 'open' ? (
                        <AtlasTextButton
                          onClick={() => {
                            onOpenRegulationReview?.(item.enrolleeId, item.missingInstruments)
                            setActiveOverlay(null)
                          }}
                          className="px-3 py-1 text-[12px]"
                        >
                          start review
                        </AtlasTextButton>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : null}

            {activeOverlay === 'section_8_archive' ? (
              <div className="space-y-2">
                {supervisionSessions.map((session) => (
                  <div key={session.id} className="atlas-surface-raised px-3 py-2 text-[12px]">
                    <div className="text-white">{formatDateLabel(session.sessionAtIso)} · {session.supervisorName}</div>
                    <textarea
                      className="atlas-textarea mt-2 min-h-[70px] bg-transparent text-white"
                      value={session.navigatorNote}
                      onChange={(event) => onSaveSupervisionSession({ ...session, navigatorNote: event.target.value })}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="atlas-surface-raised px-3 py-3">
      <small className="atlas-overline block text-[#9eacb9]">{label}</small>
      <div className="mt-1 text-[18px] font-medium text-white">{value}</div>
    </div>
  )
}
