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
  IpsccEncounterSubmissionRecord,
  IpsccSelfAwarenessCorrelationRow,
  IpsccSelfAwarenessSummary,
  NavigatorEnrollmentAssignmentRecord,
  RegulationReviewDueItem,
  SupervisorIpsAssessmentRecord,
  SupervisionSessionRecord,
  SupervisorNavigatorCompetencySummary
} from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import NavigatorEnrollmentAssignmentsPanel from './NavigatorEnrollmentAssignmentsPanel'
import ProfileNavigationCard from './ProfileNavigationCard'

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

const IPS_KEYS = [
  'competency_1_connection',
  'competency_2_learning_together',
  'competency_3_worldview_awareness',
  'competency_4_relationship_focus',
  'competency_5_mutuality',
  'competency_6_hope_and_possibility',
  'competency_7_moving_towards',
  'competency_8_self_reflection',
  'competency_9_feedback',
  'competency_10_co_reflection'
] as const

function formatDateLabel(value: string | null | undefined) {
  if (!value) return 'not recorded'
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed)
}

export default function NavigatorMyProfilePanel(props: NavigatorMyProfilePanelProps) {
  const {
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
    onOpenEnrolleeSurvey,
    onOpenAssignmentBoardReferral,
    onToggleEnrollmentAssignment,
    onSaveIpsSelfAssessment,
    onSaveIpsccEncounterSubmission,
    onSaveSupervisionSession,
    onSaveCreateSession
  } = props

  const [activeOverlay, setActiveOverlay] = React.useState<OverlayKey | null>(null)
  const [selectedIpsccEnrolleeId, setSelectedIpsccEnrolleeId] = React.useState<string>('')
  const [ipsccScoreDraft, setIpsccScoreDraft] = React.useState('4,4,4,4,4,4,4,4,4,4')
  const [ipsccNoteDraft, setIpsccNoteDraft] = React.useState('')
  const [ipsSelfDraftScores, setIpsSelfDraftScores] = React.useState<Record<string, number>>(
    () => Object.fromEntries(IPS_KEYS.map((key) => [key, 3]))
  )
  const [ipsSelfDraftNote, setIpsSelfDraftNote] = React.useState('')
  const [createDraft, setCreateDraft] = React.useState({
    supervisionMode: 'in_person' as const,
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

  return (
    <div className="relative flex flex-col gap-4">
      <div className="atlas-surface-panel px-5 py-4">
        <div className="atlas-h4 text-[24px] font-medium text-white">navigator my profile</div>
        <small className="mt-1 block text-[#9eacb9]">
          {currentNavigatorName} · {assignedEnrolleeCount} assigned enrollees
        </small>
        {programError ? (
          <div className="mt-3 rounded-[14px] border px-3 py-2 text-[12px]" style={{ borderColor: `${SP_COLORS.red}80`, color: SP_COLORS.red }}>
            {programError}
          </div>
        ) : null}
      </div>

      <div className="atlas-profile-nav-grid">
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
                {ipsccCompetencyAverages.map((row) => (
                  <div key={row.key} className="atlas-surface-raised flex items-center justify-between px-3 py-2 text-[12px]">
                    <span className="text-white">{row.label}</span>
                    <span style={{ color: '#d7e0e9' }}>{row.averageScore == null ? '--' : row.averageScore.toFixed(2)} · n={row.sampleSize}</span>
                  </div>
                ))}
                <select className="atlas-select h-10 w-full bg-transparent text-white" value={selectedIpsccEnrolleeId} onChange={(event) => setSelectedIpsccEnrolleeId(event.target.value)}>
                  {assignedEnrollees.map((enrollee) => (
                    <option key={enrollee.id} value={enrollee.id} className="bg-black text-white">{enrollee.fullName}</option>
                  ))}
                </select>
                <input className="atlas-input h-10 w-full bg-transparent text-white" value={ipsccScoreDraft} onChange={(event) => setIpsccScoreDraft(event.target.value)} placeholder="4,4,4,4,4,4,4,4,4,4" />
                <textarea className="atlas-textarea min-h-[90px] bg-transparent text-white" value={ipsccNoteDraft} onChange={(event) => setIpsccNoteDraft(event.target.value)} placeholder="service user note" />
                <div className="flex justify-end">
                  <AtlasTextButton
                    onClick={async () => {
                      const enrollee = assignedEnrollees.find((item) => item.id === selectedIpsccEnrolleeId)
                      if (!enrollee) return
                      const itemScores = ipsccScoreDraft.split(',').map((value) => Math.max(1, Math.min(5, Math.round(Number(value.trim()) || 3)))).slice(0, 10)
                      if (itemScores.length !== 10) return
                      await onSaveIpsccEncounterSubmission({
                        id: `ipscc-${Date.now()}`,
                        navigatorName: currentNavigatorName,
                        enrolleeId: enrollee.id,
                        enrolleeName: enrollee.fullName,
                        enrollmentId: enrollee.enrollmentId || null,
                        submittedAtIso: new Date().toISOString(),
                        submittedBy: 'service user',
                        itemScores,
                        note: ipsccNoteDraft
                      })
                    }}
                    className="px-4 py-2 text-[12px]"
                  >
                    save section 1 entry
                  </AtlasTextButton>
                </div>
              </div>
            ) : null}

            {activeOverlay === 'section_2_awareness' ? (
              <div className="space-y-3">
                <div className="atlas-surface-raised px-3 py-3 text-[12px] text-white">
                  <div className="font-medium">Start a new IPS assessment</div>
                  <div className="mt-1 text-[#9eacb9]">
                    Complete the weekly IPS self-assessment below. Historical results and correlation are shown beneath.
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {IPS_KEYS.map((key) => (
                    <label key={key} className="block">
                      <small className="atlas-overline block text-[#9eacb9]">{key.replace('competency_', 'comp ').replaceAll('_', ' ')}</small>
                      <select className="atlas-select h-10 w-full bg-transparent text-white" value={ipsSelfDraftScores[key]} onChange={(event) => setIpsSelfDraftScores((current) => ({ ...current, [key]: Number(event.target.value) }))}>
                        {[1, 2, 3, 4, 5].map((option) => <option key={option} value={option} className="bg-black text-white">{option}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
                <textarea className="atlas-textarea min-h-[90px] bg-transparent text-white" value={ipsSelfDraftNote} onChange={(event) => setIpsSelfDraftNote(event.target.value)} placeholder="weekly self-assessment note" />
                <div className="flex justify-end">
                  <AtlasTextButton
                    onClick={async () => {
                      const now = new Date().toISOString()
                      await onSaveIpsSelfAssessment({
                        id: `ips-self-${Date.now()}`,
                        navigatorName: currentNavigatorName,
                        weekStartIso: now,
                        submittedAtIso: now,
                        competencyScores: ipsSelfDraftScores,
                        note: ipsSelfDraftNote
                      })
                    }}
                    className="px-4 py-2 text-[12px]"
                  >
                    save section 2 entry
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
                {createInsights.map((insight) => (
                  <div key={insight.pillar} className="atlas-surface-raised px-3 py-2 text-[12px] text-white">
                    <strong>{insight.label}:</strong> {insight.latestSummary}
                  </div>
                ))}
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <label className="block"><small className="atlas-overline block text-[#9eacb9]">Mode of supervision</small><select className="atlas-select h-10 w-full bg-transparent text-white" value={createDraft.supervisionMode} onChange={(event) => setCreateDraft((current) => ({ ...current, supervisionMode: event.target.value as 'in_person' | 'online' | 'phone_call' }))}><option value="in_person" className="bg-black text-white">In-person</option><option value="online" className="bg-black text-white">Online</option><option value="phone_call" className="bg-black text-white">Phone call</option></select></label>
                  <label className="block"><small className="atlas-overline block text-[#9eacb9]">Duration (minutes)</small><input className="atlas-input h-10 w-full bg-transparent text-white" value={createDraft.sessionDurationMinutes} onChange={(event) => setCreateDraft((current) => ({ ...current, sessionDurationMinutes: event.target.value }))} /></label>
                </div>
                <label className="inline-flex items-center gap-2 text-[12px] text-white"><input type="checkbox" checked={createDraft.connectFocusedListening} onChange={(event) => setCreateDraft((current) => ({ ...current, connectFocusedListening: event.target.checked }))} /> Connect: focused listening and minimized distractions</label>
                <textarea className="atlas-textarea min-h-[72px] bg-transparent text-white" value={createDraft.recognizeNotes} onChange={(event) => setCreateDraft((current) => ({ ...current, recognizeNotes: event.target.value }))} placeholder="Recognize: success, achievements, etc." />
                <textarea className="atlas-textarea min-h-[72px] bg-transparent text-white" value={createDraft.encourageNotes} onChange={(event) => setCreateDraft((current) => ({ ...current, encourageNotes: event.target.value }))} placeholder="Encourage: challenges, difficulties, etc." />
                <textarea className="atlas-textarea min-h-[72px] bg-transparent text-white" value={createDraft.acknowledgeNotes} onChange={(event) => setCreateDraft((current) => ({ ...current, acknowledgeNotes: event.target.value }))} placeholder="Acknowledge: initiative, leadership, advocacy, etc." />
                <textarea className="atlas-textarea min-h-[72px] bg-transparent text-white" value={createDraft.trainNotes} onChange={(event) => setCreateDraft((current) => ({ ...current, trainNotes: event.target.value }))} placeholder="Train: learning opportunities and support needed." />
                <textarea className="atlas-textarea min-h-[72px] bg-transparent text-white" value={createDraft.empowerNotes} onChange={(event) => setCreateDraft((current) => ({ ...current, empowerNotes: event.target.value }))} placeholder="Empower: time, tools, transportation, materials, etc." />
                <textarea className="atlas-textarea min-h-[72px] bg-transparent text-white" value={createDraft.createActionPlan} onChange={(event) => setCreateDraft((current) => ({ ...current, createActionPlan: event.target.value }))} placeholder="C.R.E.A.T.E. action plan for implementation." />
                <textarea className="atlas-textarea min-h-[72px] bg-transparent text-white" value={createDraft.superviseeSubmission} onChange={(event) => setCreateDraft((current) => ({ ...current, superviseeSubmission: event.target.value }))} placeholder="Peer specialist submission" />
                <textarea className="atlas-textarea min-h-[72px] bg-transparent text-white" value={createDraft.supervisorSubmission} onChange={(event) => setCreateDraft((current) => ({ ...current, supervisorSubmission: event.target.value }))} placeholder="Supervisor submission" />
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <label className="block"><small className="atlas-overline block text-[#9eacb9]">Peer specialist signature</small><input className="atlas-input h-10 w-full bg-transparent text-white" value={createDraft.peerSpecialistSignature} onChange={(event) => setCreateDraft((current) => ({ ...current, peerSpecialistSignature: event.target.value }))} /></label>
                  <label className="block"><small className="atlas-overline block text-[#9eacb9]">Supervisor signature</small><input className="atlas-input h-10 w-full bg-transparent text-white" value={createDraft.supervisorSignature} onChange={(event) => setCreateDraft((current) => ({ ...current, supervisorSignature: event.target.value }))} /></label>
                </div>
                <div className="flex justify-end">
                  <AtlasTextButton
                    onClick={async () => {
                      const now = new Date().toISOString()
                      await onSaveCreateSession({
                        id: `create-${Date.now()}`,
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
                    }}
                    className="px-4 py-2 text-[12px]"
                  >
                    save section 3 entry
                  </AtlasTextButton>
                </div>
                <small className="block text-[#9eacb9]">{createSessions.length} C.R.E.A.T.E. sessions recorded</small>
              </div>
            ) : null}

            {activeOverlay === 'section_4_assignments' ? (
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
                {[...dueItems, ...regulationReviewDueItems.map((item) => ({
                  id: item.id,
                  title: `regulation review · ${item.enrolleeName}`,
                  dueAtIso: item.dueAtIso,
                  cadence: item.cadence,
                  status: item.status
                }))].map((item) => (
                  <div key={item.id} className="atlas-surface-raised flex items-center justify-between px-3 py-2 text-[12px]">
                    <span className="text-white">{item.title}</span>
                    <span style={{ color: '#9eacb9' }}>{formatDateLabel(item.dueAtIso)} · {item.status}</span>
                  </div>
                ))}
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
