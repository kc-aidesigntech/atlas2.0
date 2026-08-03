import React from 'react'
import type {
  AccountSettings,
  CreateSessionRecord,
  DomainLoad,
  EnrolleeProfile,
  IntervalAssessmentDueItem,
  IpsCompetencySelfAssessmentRecord,
  IpsccCompetencyAggregate,
  IpsccEncounterSubmissionRecord,
  IpsccEnrolleeFeedbackPrivacy,
  IpsccSelfAwarenessCorrelationRow,
  IpsccSelfAwarenessSummary,
  NavigatorCreateReflectionRecord,
  NavigatorEnrollmentAssignmentRecord,
  RegulationReviewDueItem,
  SupervisorIpsAssessmentRecord,
  SupervisionSessionRecord,
  SupervisorNavigatorCompetencySummary
} from '@/features/atlas2026/shared/contracts'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import NavigatorEnrollmentAssignmentsPanel from './NavigatorEnrollmentAssignmentsPanel'
import NavigatorCompetencyDashboard from './NavigatorCompetencyDashboard'
import IpsccStrainRadarChart from './IpsccStrainRadarChart'
import IpsCompetencySurvey, {
  isIpsCompetencySurveyComplete,
  scoresMapToCompetencyRecord,
  scoresMapToItemArray,
  type IpsCompetencyScoreMap
} from './IpsCompetencySurvey'
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
  ipsccEnrolleeFeedbackPrivacy: IpsccEnrolleeFeedbackPrivacy
  selfAwarenessCorrelationRows: IpsccSelfAwarenessCorrelationRow[]
  selfAwarenessSummary: IpsccSelfAwarenessSummary
  ipsSelfAssessments: IpsCompetencySelfAssessmentRecord[]
  navigatorSupervisorIpsAssessments: SupervisorIpsAssessmentRecord[]
  createSessions: CreateSessionRecord[]
  createReflection: NavigatorCreateReflectionRecord | null
  supervisionSessions: SupervisionSessionRecord[]
  dueItems: IntervalAssessmentDueItem[]
  regulationReviewDueItems?: RegulationReviewDueItem[]
  programError?: string | null
  onOpenLoadTable?: () => void
  isUploadingAvatar?: boolean
  avatarUploadError?: string | null
  onReplaceAvatar?: (file: File) => Promise<unknown> | unknown
  onOpenEnrolleeSurvey?: (enrolleeId: string) => void
  // Forced weekly Stress Vulnerability Scale (SVS) / Mental Health Self-Care Agency
  // (MH-SCA) review: open items must be actionable — selecting one jumps the navigator
  // into that enrollee's regulation assessment flow.
  onOpenRegulationReview?: (enrolleeId: string, missingInstruments?: Array<'mh_sca' | 'svs'>) => void
  onOpenAssignmentBoardReferral?: () => void
  onToggleEnrollmentAssignment: (enrollmentId: string, mode: 'accept' | 'archive' | 'assign' | 'unassign') => Promise<void> | void
  onSaveIpsSelfAssessment: (record: IpsCompetencySelfAssessmentRecord) => Promise<unknown> | unknown
  onSaveIpsccEncounterSubmission: (record: IpsccEncounterSubmissionRecord) => Promise<unknown> | unknown
  onSaveSupervisionSession: (record: SupervisionSessionRecord) => Promise<unknown> | unknown
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
  // Only the three-prong supervision cards ship on My Profile for now;
  // later sections stay defined for overlays/docs but stay off the rail.
  isActiveOnProfileRail: boolean
}> = [
  { key: 'section_1_ipscc', title: 'Section 1: IPSCC ratings and reviews', cardTitle: 'enrollee', cardSubtitle: 'ipscc', actionLabel: 'view feedback', variant: 'green', illustration: 'feedback', isActiveOnProfileRail: true },
  { key: 'section_2_awareness', title: 'Section 2: Self-awareness correlation', cardTitle: 'self-reflection', cardSubtitle: 'ips', actionLabel: 'start reflection', variant: 'blue', illustration: 'reflection', isActiveOnProfileRail: true },
  { key: 'section_3_create', title: 'Section 3: C.R.E.A.T.E. supervision history', cardTitle: 'c.r.e.a.t.e', cardSubtitle: 'session history', actionLabel: 'view history', variant: 'green', illustration: 'create', isActiveOnProfileRail: true },
  { key: 'section_4_assignments', title: 'Section 4: Enrollment assignment board', cardTitle: 'assignment board', cardSubtitle: 'enrollment', actionLabel: 'view board', variant: 'blue', illustration: 'feedback', isActiveOnProfileRail: false },
  { key: 'section_5_zcode_updates', title: 'Section 5: Enrollee z-code updates', cardTitle: 'z-code updates', cardSubtitle: 'enrollee', actionLabel: 'update z-codes', variant: 'green', illustration: 'reflection', isActiveOnProfileRail: false },
  { key: 'section_6_competency', title: 'Section 6: Navigator competency', cardTitle: 'competency', cardSubtitle: 'navigator', actionLabel: 'open competency', variant: 'blue', illustration: 'create', isActiveOnProfileRail: false },
  { key: 'section_7_schedule', title: 'Section 7: Scheduled assessments', cardTitle: 'schedule', cardSubtitle: 'assessments', actionLabel: 'view schedule', variant: 'green', illustration: 'feedback', isActiveOnProfileRail: false },
  { key: 'section_8_archive', title: 'Section 8: Supervision archive', cardTitle: 'archive', cardSubtitle: 'supervision', actionLabel: 'open archive', variant: 'blue', illustration: 'reflection', isActiveOnProfileRail: false }
]

const ACTIVE_PROFILE_RAIL_CARDS = CARD_DEFS.filter((card) => card.isActiveOnProfileRail)

const CREATE_HISTORY_FIELDS: Array<{
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

function formatSupervisionMode(mode: CreateSessionRecord['supervisionMode']) {
  switch (mode) {
    case 'in_person':
      return 'in-person'
    case 'online':
      return 'online'
    case 'phone_call':
      return 'phone call'
    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}

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
    ipsccEnrolleeFeedbackPrivacy,
    selfAwarenessCorrelationRows,
    selfAwarenessSummary,
    ipsSelfAssessments,
    navigatorSupervisorIpsAssessments,
    createSessions,
    createReflection,
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
    onSaveSupervisionSession
  } = props

  const [activeOverlay, setActiveOverlay] = React.useState<OverlayKey | null>(null)
  const assignmentBoardRef = React.useRef<HTMLElement | null>(null)
  const [overlaySaveState, setOverlaySaveState] = React.useState<OverlaySaveState>('idle')
  const [overlaySaveMessage, setOverlaySaveMessage] = React.useState<string | null>(null)
  const [selectedIpsccEnrolleeId, setSelectedIpsccEnrolleeId] = React.useState<string>('')
  // Pass-the-tablet mode: enrollee completes Likert items without seeing averages or navigator chrome.
  const [ipsccTabletHandoffActive, setIpsccTabletHandoffActive] = React.useState(false)
  // Scores stay null until rated so the BurdenCard-style survey does not pretend a default Likert answer.
  const [ipsccDraftScores, setIpsccDraftScores] = React.useState<IpsCompetencyScoreMap>({})
  const [ipsccNoteDraft, setIpsccNoteDraft] = React.useState('')
  const [ipsSelfDraftScores, setIpsSelfDraftScores] = React.useState<IpsCompetencyScoreMap>({})
  const [ipsSelfDraftNote, setIpsSelfDraftNote] = React.useState('')
  // Navigators may expand historical C.R.E.A.T.E. entries but cannot author new ones here.
  const [expandedCreateSessionId, setExpandedCreateSessionId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (assignedEnrollees.length && !selectedIpsccEnrolleeId) {
      setSelectedIpsccEnrolleeId(assignedEnrollees[0].id)
    }
  }, [assignedEnrollees, selectedIpsccEnrolleeId])

  React.useEffect(() => {
    setOverlaySaveState('idle')
    setOverlaySaveMessage(null)
    setExpandedCreateSessionId(null)
  }, [activeOverlay])

  const navigatorDisplayName = currentNavigatorName.trim() || accountSettings.fullName.trim() || 'navigator'
  const fallbackAvatarSrc = React.useMemo(() => createFallbackAvatarDataUrl(navigatorDisplayName), [navigatorDisplayName])
  const avatarSrc = accountSettings.avatarUrl || fallbackAvatarSrc
  // Open weekly regulation reviews are non-skippable action items: both SVS and MH-SCA
  // must be completed for each listed enrollee before the cycle clears (cannot skip).
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
          {/* Profile chrome: photo + assignment board sit above the first divider so
              claim/triage stays immediately under identity before supervision signals. */}
          <div
            className="border-b pb-4"
            style={{ borderColor: '#ffffff55', borderBottomWidth: '2px' }}
          >
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
                  <small className="atlas-meta block text-white">Active sections: {ACTIVE_PROFILE_RAIL_CARDS.length}</small>
                </div>
              </div>
              {programError ? (
                <div className="mt-3 rounded-[14px] border px-3 py-2 text-[12px]" style={{ borderColor: `${SP_COLORS.red}80`, color: SP_COLORS.red }}>
                  {programError}
                </div>
              ) : null}
              {/* C.R.E.A.T.E. reflection sits just above the assignment board so
                  workshop focus is visible before claim/triage work. */}
              <section className="atlas-surface-raised mt-4 space-y-2 px-3 py-3" aria-label="C.R.E.A.T.E. supervision reflection">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <small className="atlas-overline block text-[#9eacb9]">section 3 · what is being workshopped</small>
                    <div className="text-[14px] font-medium text-white">C.R.E.A.T.E. supervision reflection</div>
                  </div>
                  <AtlasTextButton
                    onClick={() => setActiveOverlay('section_3_create')}
                    className="px-3 py-1 text-[12px]"
                  >
                    view history
                  </AtlasTextButton>
                </div>
                {createReflection?.reflectionText?.trim() ? (
                  <div className="rounded-[10px] border border-white/10 px-2.5 py-2 text-[12px]">
                    <p className="whitespace-pre-wrap leading-relaxed text-[#d7e0e9]">
                      {createReflection.reflectionText.trim()}
                    </p>
                    <small className="atlas-meta mt-2 block text-[#9eacb9]">
                      Updated after latest C.R.E.A.T.E. · based on last{' '}
                      {createReflection.sourceSessionIds?.length || 1} session
                      {(createReflection.sourceSessionIds?.length || 1) === 1 ? '' : 's'}
                      {createReflection.supervisorOverriddenAtIso
                        ? ` · edited by ${createReflection.supervisorOverriddenBy || 'supervisor'}`
                        : createReflection.usedFallback
                          ? ' · offline summary'
                          : ''}
                    </small>
                  </div>
                ) : (
                  <div className="text-[12px] text-[#9eacb9]">
                    No C.R.E.A.T.E. reflection yet. A 3–4 sentence supervisor reflection appears here after the
                    first saved supervision session on this navigator profile.
                  </div>
                )}
              </section>
              {/* Keep assignment controls tucked under the photo and above the
                  first profile chrome divider so claim/triage stays in identity context. */}
              <section ref={assignmentBoardRef} className="mt-4">
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
          </div>
          {/* Competency dashboard stays below the first divider so IPSCC /
              thermometer averages remain glanceable afterward. Section 2 is
              covered by the dual radar; Section 3 sits above the assignment board. */}
          <NavigatorCompetencyDashboard
            ipsccCompetencyAverages={ipsccCompetencyAverages}
            ipsccEnrolleeFeedbackPrivacy={ipsccEnrolleeFeedbackPrivacy}
            onOpenSection={(section) => setActiveOverlay(section)}
          />
        </div>
        <div className="atlas-navigator-profile-rail">
          {/* Dual radar sits above the three supervision cards so strain is visible
              before opening enrollee / self-reflection / C.R.E.A.T.E. overlays. */}
          <IpsccStrainRadarChart
            correlationRows={selfAwarenessCorrelationRows}
            enrolleeFeedbackPrivacy={ipsccEnrolleeFeedbackPrivacy}
            onOpenAwareness={() => setActiveOverlay('section_2_awareness')}
          />
          {/* Rail shows only enrollee / self-reflection / C.R.E.A.T.E. until later
              supervision sections are commissioned for this surface. */}
          {ACTIVE_PROFILE_RAIL_CARDS.map((card, index) => (
            <ProfileNavigationCard
              key={card.key}
              sequenceNumber={index + 1}
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
              <AtlasTextButton
                onClick={() => {
                  setIpsccTabletHandoffActive(false)
                  setActiveOverlay(null)
                }}
                className="px-3 py-1 text-[12px]"
              >
                close
              </AtlasTextButton>
            </div>

            {activeOverlay === 'section_1_ipscc' ? (
              <IpsCompetencySurvey
                scores={ipsccDraftScores}
                onChangeScore={(key, score) => setIpsccDraftScores((current) => ({ ...current, [key]: score }))}
                assignmentLabel={
                  ipsccTabletHandoffActive
                    ? 'how did this encounter show the competency?'
                    : 'rate how this encounter showed the competency'
                }
                accentColor={SP_COLORS.green}
                headerSlot={
                  <div className="space-y-3">
                    {ipsccTabletHandoffActive ? (
                      <div className="atlas-surface-raised px-3 py-3 text-[12px] text-white">
                        <div className="font-medium">Enrollee feedback — Intentional Peer Support Core Competencies (IPSCC)</div>
                        <div className="mt-1 text-[#9eacb9]">
                          Tap a number for each competency. When finished, submit and hand the tablet back to your
                          navigator. Your answers stay anonymous in group averages.
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="atlas-surface-raised px-3 py-3 text-[12px] text-white">
                          <div className="font-medium">Pass-the-tablet IPSCC encounter survey</div>
                          <div className="mt-1 text-[#9eacb9]">
                            Select an enrollee, start handoff, then pass the tablet. The enrollee rates the encounter
                            on the 1–5 Intentional Peer Support Core Competencies (IPSCC) scale and returns the
                            device. Navigators never see individual enrollee submissions — only accumulated averages
                            after about {ipsccEnrolleeFeedbackPrivacy.minEntriesToRevealAverages} entries.
                          </div>
                        </div>
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
                              <option key={enrollee.id} value={enrollee.id} className="bg-black text-white">
                                {enrollee.fullName}
                              </option>
                            ))}
                          </select>
                        </PersistentField>
                        <AtlasTextButton
                          disabled={!selectedIpsccEnrolleeId}
                          onClick={() => setIpsccTabletHandoffActive(true)}
                          className="px-4 py-2 text-[12px]"
                        >
                          hand tablet to enrollee
                        </AtlasTextButton>
                      </>
                    )}
                  </div>
                }
                footerSlot={
                  <div className="space-y-3">
                    {!ipsccTabletHandoffActive ? (
                      <PersistentField label="Service user note (navigator only)">
                        <textarea
                          className="atlas-textarea min-h-[90px] bg-transparent text-white"
                          value={ipsccNoteDraft}
                          onChange={(event) => setIpsccNoteDraft(event.target.value)}
                        />
                      </PersistentField>
                    ) : null}
                    <div className="flex items-center justify-between gap-3">
                      {overlaySaveMessage ? (
                        <small style={{ color: overlaySaveState === 'error' ? SP_COLORS.red : '#9eacb9' }}>
                          {overlaySaveMessage}
                        </small>
                      ) : (
                        <span />
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        {ipsccTabletHandoffActive ? (
                          <AtlasTextButton
                            onClick={() => setIpsccTabletHandoffActive(false)}
                            className="px-4 py-2 text-[12px]"
                          >
                            cancel handoff
                          </AtlasTextButton>
                        ) : null}
                        <AtlasTextButton
                          disabled={
                            overlaySaveState === 'saving' ||
                            !assignedEnrollees.length ||
                            !isIpsCompetencySurveyComplete(ipsccDraftScores) ||
                            (ipsccTabletHandoffActive ? false : !selectedIpsccEnrolleeId)
                          }
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
                                submittedBy: 'enrollee',
                                itemScores: scoresMapToItemArray(ipsccDraftScores),
                                note: ipsccTabletHandoffActive ? '' : ipsccNoteDraft
                              })
                              setIpsccDraftScores({})
                              setIpsccNoteDraft('')
                              setIpsccTabletHandoffActive(false)
                            }, ipsccTabletHandoffActive
                              ? 'Thank you. Please hand the tablet back to your navigator.'
                              : 'IPSCC encounter survey saved.')
                          }
                          className="px-4 py-2 text-[12px]"
                        >
                          {overlaySaveState === 'saving'
                            ? 'saving...'
                            : ipsccTabletHandoffActive
                              ? 'submit feedback'
                              : 'save IPSCC survey'}
                        </AtlasTextButton>
                      </div>
                    </div>
                  </div>
                }
              />
            ) : null}

            {activeOverlay === 'section_2_awareness' ? (
              <div className="space-y-3">
                <IpsCompetencySurvey
                  scores={ipsSelfDraftScores}
                  onChangeScore={(key, score) => setIpsSelfDraftScores((current) => ({ ...current, [key]: score }))}
                  assignmentLabel="rate your practice on this competency"
                  accentColor={SP_COLORS.yellow}
                  headerSlot={
                    <div className="atlas-surface-raised px-3 py-3 text-[12px] text-white">
                      <div className="font-medium">Weekly Intentional Peer Support Core Competencies (IPSCC) self-assessment</div>
                      <div className="mt-1 text-[#9eacb9]">
                        Complete all ten competencies using the rating-scale text under each number from the IPSCC
                        tool. Correlation with point-of-care ratings appears beneath after save.
                      </div>
                    </div>
                  }
                  footerSlot={
                    <div className="space-y-3">
                      <PersistentField label="Weekly self-assessment note">
                        <textarea
                          className="atlas-textarea min-h-[90px] bg-transparent text-white"
                          value={ipsSelfDraftNote}
                          onChange={(event) => setIpsSelfDraftNote(event.target.value)}
                        />
                      </PersistentField>
                      <div className="flex items-center justify-between gap-3">
                        {overlaySaveMessage ? (
                          <small style={{ color: overlaySaveState === 'error' ? SP_COLORS.red : '#9eacb9' }}>
                            {overlaySaveMessage}
                          </small>
                        ) : (
                          <span />
                        )}
                        <AtlasTextButton
                          disabled={overlaySaveState === 'saving' || !isIpsCompetencySurveyComplete(ipsSelfDraftScores)}
                          onClick={() =>
                            void runOverlaySave(async () => {
                              const now = new Date().toISOString()
                              await onSaveIpsSelfAssessment({
                                id: createRecordId(),
                                navigatorName: currentNavigatorName,
                                weekStartIso: getWeekStartIso(new Date(now)),
                                submittedAtIso: now,
                                competencyScores: scoresMapToCompetencyRecord(ipsSelfDraftScores),
                                note: ipsSelfDraftNote
                              })
                              setIpsSelfDraftScores({})
                              setIpsSelfDraftNote('')
                            }, 'Weekly IPSCC self-assessment saved.')
                          }
                          className="px-4 py-2 text-[12px]"
                        >
                          {overlaySaveState === 'saving' ? 'saving...' : 'save weekly IPSCC'}
                        </AtlasTextButton>
                      </div>
                    </div>
                  }
                />
                <div className="atlas-surface-raised px-3 py-3">
                  <div className="text-[13px] font-medium text-white">Historical IPSCC results</div>
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
                  {/* Correlate enrollee IPSCC averages with weekly pre-supervision self-ratings. */}
                  <div className="text-[13px] font-medium text-white">Enrollee IPSCC vs self-assessment strain</div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <MetricCard label="compared" value={String(selfAwarenessSummary.comparedCompetencyCount)} />
                    <MetricCard
                      label="avg strain"
                      value={selfAwarenessSummary.averageStrain == null ? '—' : selfAwarenessSummary.averageStrain.toFixed(2)}
                    />
                    <MetricCard
                      label="alignment"
                      value={
                        selfAwarenessSummary.overallAlignmentScore == null
                          ? '—'
                          : selfAwarenessSummary.overallAlignmentScore.toFixed(2)
                      }
                    />
                  </div>
                  {!ipsccEnrolleeFeedbackPrivacy.averagesRevealed ? (
                    <div className="mt-2 text-[12px] text-[#9eacb9]">
                      Enrollee averages remain locked until {ipsccEnrolleeFeedbackPrivacy.minEntriesToRevealAverages}{' '}
                      encounter submissions protect anonymity. Individual enrollee responses are never listed here.
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {selfAwarenessCorrelationRows.map((row) => (
                        <div
                          key={row.key}
                          className="atlas-surface-raised grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 px-3 py-2 text-[12px]"
                        >
                          <span className="text-white">{row.label}</span>
                          <span style={{ color: SP_COLORS.red }}>
                            Enrollee {row.ipsccAverage?.toFixed(2) || '—'}
                          </span>
                          <span style={{ color: SP_COLORS.blue }}>Self {row.selfAverage?.toFixed(2) || '—'}</span>
                          <span style={{ color: '#d7e0e9' }}>Strain {row.strain?.toFixed(2) || '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {activeOverlay === 'section_3_create' ? (
              <div className="space-y-3">
                <div className="atlas-surface-raised px-3 py-3 text-[12px] text-white">
                  <div className="font-medium">
                    Connect, Recognize, Encourage, Acknowledge, Train, and Empower (C.R.E.A.T.E.) session history
                  </div>
                  <div className="mt-1 text-[#9eacb9]">
                    Read-only view of supervision entries recorded with your supervisor. New C.R.E.A.T.E. sessions are
                    authored during supervision, not from this navigator profile.
                  </div>
                </div>
                {createSessions.length ? (
                  createSessions
                    .slice()
                    .sort(
                      (left, right) =>
                        new Date(right.sessionAtIso).getTime() - new Date(left.sessionAtIso).getTime()
                    )
                    .map((session) => {
                      const isExpanded = expandedCreateSessionId === session.id
                      return (
                        <div key={session.id} className="atlas-surface-raised space-y-2 px-3 py-3 text-[12px]">
                          <button
                            type="button"
                            className="flex w-full items-start justify-between gap-3 text-left"
                            onClick={() =>
                              setExpandedCreateSessionId((current) =>
                                current === session.id ? null : session.id
                              )
                            }
                            aria-expanded={isExpanded}
                          >
                            <div className="min-w-0">
                              <div className="font-medium text-white">
                                {formatDateLabel(session.sessionAtIso)} · {session.supervisorName}
                              </div>
                              <small className="atlas-meta mt-0.5 block text-[#9eacb9]">
                                {formatSupervisionMode(session.supervisionMode)}
                                {session.sessionDurationMinutes != null
                                  ? ` · ${session.sessionDurationMinutes} min`
                                  : ''}
                                {session.connectFocusedListening ? ' · focused listening' : ''}
                              </small>
                            </div>
                            <small className="shrink-0 text-[#9eacb9]">
                              {isExpanded ? 'click to collapse' : 'click to expand'}
                            </small>
                          </button>
                          {isExpanded ? (
                            <div className="space-y-2 border-t border-white/10 pt-2">
                              {CREATE_HISTORY_FIELDS.map((field) => {
                                const value = String(session[field.key] || '').trim()
                                if (!value) return null
                                return (
                                  <div key={field.key}>
                                    <small className="atlas-overline block text-[#9eacb9]">{field.label}</small>
                                    <p className="mt-0.5 whitespace-pre-wrap leading-relaxed text-[#d7e0e9]">
                                      {value}
                                    </p>
                                  </div>
                                )
                              })}
                              <small className="atlas-meta block text-[#9eacb9]">
                                Signed: {session.peerSpecialistSignature || 'navigator'}
                                {session.peerSpecialistSignedAtIso
                                  ? ` (${formatDateLabel(session.peerSpecialistSignedAtIso)})`
                                  : ''}
                                {' · '}
                                {session.supervisorSignature || 'supervisor'}
                                {session.supervisorSignedAtIso
                                  ? ` (${formatDateLabel(session.supervisorSignedAtIso)})`
                                  : ''}
                              </small>
                            </div>
                          ) : null}
                        </div>
                      )
                    })
                ) : (
                  <div className="text-[12px] text-[#9eacb9]">
                    No C.R.E.A.T.E. supervision sessions are on record for this navigator yet.
                  </div>
                )}
              </div>
            ) : null}

            {activeOverlay === 'section_4_assignments' ? (
              <div className="atlas-surface-raised space-y-3 px-3 py-3 text-white">
                <div className="text-[13px]">
                  assignment board is tucked under the profile photo (above the first divider) so you can pick up enrollees without opening a card.
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
