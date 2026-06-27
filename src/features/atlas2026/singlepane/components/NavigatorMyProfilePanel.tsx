/**
 * Navigator-facing "my profile" workspace combining load telemetry, pickup
 * queue operations, self-assessment capture, and supervision notes.
 */
import React from 'react'
import AtlasImageUploadTile from '../../components/AtlasImageUploadTile'
import { createFallbackAvatarDataUrl } from '../../components/avatarFallback'
import type {
  AccountSettings,
  DomainLoad,
  EnrolleeProfile,
  IntervalAssessmentDueItem,
  NavigatorEnrollmentAssignmentRecord,
  NavigatorSelfAssessmentRecord,
  NavigatorSelfAssessmentSummary,
  RegulationReviewDueItem,
  SupervisionSessionRecord,
  SupervisorNavigatorCompetencySummary
} from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import RadialLoadChart from './RadialLoadChart'
import NavigatorEnrollmentAssignmentsPanel from './NavigatorEnrollmentAssignmentsPanel'

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
  selfAssessmentSummary: NavigatorSelfAssessmentSummary
  selfAssessments: NavigatorSelfAssessmentRecord[]
  supervisionSessions: SupervisionSessionRecord[]
  dueItems: IntervalAssessmentDueItem[]
  // Forced regulation review action items for enrollees this navigator owns, recurring
  // per the admin cadence and cleared by completed regulation test submissions.
  regulationReviewDueItems?: RegulationReviewDueItem[]
  programError?: string | null
  onOpenLoadTable?: () => void
  isUploadingAvatar?: boolean
  avatarUploadError?: string | null
  onReplaceAvatar?: (file: File) => Promise<unknown> | unknown
  onOpenEnrolleeSurvey?: (enrolleeId: string) => void
  onOpenAssignmentBoardReferral?: () => void
  onToggleEnrollmentAssignment: (
    enrollmentId: string,
    mode: 'accept' | 'archive' | 'assign' | 'unassign'
  ) => Promise<void> | void
  onSaveSelfAssessment: (record: NavigatorSelfAssessmentRecord) => Promise<unknown> | unknown
  onSaveSupervisionSession: (record: SupervisionSessionRecord) => Promise<unknown> | unknown
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return 'not recorded'
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed)
}

function formatRelativeRoleValue(value: number) {
  return Number.isFinite(value) ? value.toFixed(1) : '--'
}

export default function NavigatorMyProfilePanel({
  accountSettings,
  currentNavigatorName,
  aggregateLoad,
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
  selfAssessmentSummary,
  selfAssessments,
  supervisionSessions,
  dueItems,
  regulationReviewDueItems = [],
  programError = null,
  onOpenLoadTable,
  isUploadingAvatar = false,
  avatarUploadError = null,
  onReplaceAvatar,
  onOpenEnrolleeSurvey,
  onOpenAssignmentBoardReferral,
  onToggleEnrollmentAssignment,
  onSaveSelfAssessment,
  onSaveSupervisionSession
}: NavigatorMyProfilePanelProps) {
  const fallbackAvatarSrc = React.useMemo(() => createFallbackAvatarDataUrl(currentNavigatorName), [currentNavigatorName])
  const avatarSrc = accountSettings.avatarUrl || fallbackAvatarSrc
  const [draftAssessment, setDraftAssessment] = React.useState(() => {
    const now = new Date().toISOString()
    return {
      id: `self-assessment-${Date.now()}`,
      navigatorName: currentNavigatorName,
      weekStartIso: now,
      submittedAtIso: now,
      stressLoadScore: 3,
      confidenceScore: 3,
      supportScore: 3,
      note: ''
    } satisfies NavigatorSelfAssessmentRecord
  })
  const [isSavingAssessment, setIsSavingAssessment] = React.useState(false)
  const [savingSessionId, setSavingSessionId] = React.useState<string | null>(null)
  const [sessionDrafts, setSessionDrafts] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    setDraftAssessment((current) => ({ ...current, navigatorName: currentNavigatorName }))
  }, [currentNavigatorName])

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex min-h-[282px] flex-wrap items-start gap-x-4 gap-y-5 border-b pb-[12px] lg:gap-x-8 xl:gap-x-12"
        style={{ borderColor: '#ffffff55', borderBottomWidth: '2px' }}
      >
        <div className="min-w-0 flex-1 basis-[520px]">
          <div className="flex flex-wrap items-start gap-3 pt-0.5 sm:flex-nowrap">
            <div>
              <AtlasImageUploadTile
                imageSrc={avatarSrc}
                alt={`${currentNavigatorName} profile`}
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
              <div className="mt-4 flex flex-wrap items-center gap-[10px]">
                <span className="inline-flex h-11 items-center rounded-full border px-4 text-[15px] font-medium text-white" style={{ borderColor: '#ffffff35' }}>
                  navigator
                </span>
              </div>
            </div>
            <div className="min-w-[220px] flex-1 space-y-0.5 pt-[2px] text-white">
              <h2 className="atlas-h3 text-[34px] font-medium leading-[1.1]">{currentNavigatorName}</h2>
              <small className="atlas-meta block text-white">E: {accountSettings.email || 'not recorded'}</small>
              <small className="atlas-meta block text-white">Org: {accountSettings.organization || 'not recorded'}</small>
              <small className="atlas-meta block text-white">Assigned enrollees: {assignedEnrolleeCount}</small>
              <small className="atlas-meta block text-white">Profile view: my profile</small>
            </div>
          </div>
        </div>
        <div className="flex w-full justify-center md:ml-auto md:w-auto md:flex-none md:justify-end md:pr-5 md:pl-2 lg:pr-8">
          <RadialLoadChart load={aggregateLoad} onClick={onOpenLoadTable} />
        </div>
      </div>

      {programError ? (
        <div className="rounded-[18px] border px-4 py-3 text-[12px]" style={{ borderColor: `${SP_COLORS.red}80`, color: SP_COLORS.red }}>
          {programError}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
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

        <div className="grid gap-4">
          <section className="atlas-surface-panel px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <small className="atlas-overline block" style={{ color: SP_COLORS.muted }}>
                  enrollees
                </small>
                {/* Entry point now opens the streamlined Z-code override (burden survey preserved for later). */}
                <div className="atlas-h4 mt-1 text-[24px] font-medium text-white">enrollee z-code updates</div>
              </div>
              <span className="rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.1em]" style={{ borderColor: '#ffffff24', color: '#d7e0e9' }}>
                {assignedEnrollees.length} assigned
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {assignedEnrollees.length ? (
                assignedEnrollees.slice(0, 6).map((enrollee) => (
                  <div key={enrollee.id} className="atlas-surface-raised flex items-center justify-between gap-3 px-3 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium text-white">{enrollee.fullName}</div>
                      <small style={{ color: '#9eacb9' }}>{enrollee.caseId || 'pending case id'}</small>
                    </div>
                    <AtlasTextButton
                      onClick={() => onOpenEnrolleeSurvey?.(enrollee.id)}
                      className="px-[14px] py-[7px] text-[13px] font-medium"
                      disabled={!onOpenEnrolleeSurvey}
                      style={{ backgroundColor: '#ffffff', color: '#111111', borderColor: '#ffffff' } as React.CSSProperties}
                    >
                      update z-codes
                    </AtlasTextButton>
                  </div>
                ))
              ) : (
                <div className="atlas-empty-state">
                  No assigned enrollees are available for z-code updates yet.
                </div>
              )}
            </div>
          </section>

          <section className="atlas-surface-panel px-4 py-4">
            <small className="atlas-overline block" style={{ color: SP_COLORS.muted }}>
              competency
            </small>
            <div className="atlas-h4 mt-1 text-[24px] font-medium text-white">navigator competency</div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <MetricCard label="weighted avg" value={competencySummary ? formatRelativeRoleValue(competencySummary.weightedRollingAverage) : '--'} accent={SP_COLORS.yellow} />
              <MetricCard label="assessments" value={String(competencySummary?.assessmentCount || 0)} accent={SP_COLORS.blue} />
              <MetricCard label="last review" value={competencySummary?.lastAssessmentAtIso ? formatDateLabel(competencySummary.lastAssessmentAtIso) : 'none'} accent={SP_COLORS.deepGreen} />
            </div>
          </section>

          <section className="atlas-surface-panel px-4 py-4">
            <small className="atlas-overline block" style={{ color: SP_COLORS.muted }}>
              intervals
            </small>
            <div className="atlas-h4 mt-1 text-[24px] font-medium text-white">scheduled assessments</div>
            <div className="mt-4 space-y-2">
              {dueItems.map((item) => (
                <div key={item.id} className="atlas-surface-raised flex items-center justify-between px-3 py-2 text-[12px]">
                  <div>
                    <div className="text-white">{item.title}</div>
                    <small style={{ color: '#9eacb9' }}>{formatDateLabel(item.dueAtIso)} · {item.cadence}</small>
                  </div>
                  <span style={{ color: item.status === 'completed' ? SP_COLORS.deepGreen : SP_COLORS.yellow }}>
                    {item.status}
                  </span>
                </div>
              ))}
              {/* Forced regulation review items reuse the same due-card motif so the list
                  reads as one schedule; each row is scoped to a single owned enrollee. */}
              {regulationReviewDueItems.map((item) => (
                <div key={item.id} className="atlas-surface-raised flex items-center justify-between px-3 py-2 text-[12px]">
                  <div>
                    <div className="text-white">regulation review · {item.enrolleeName}</div>
                    <small style={{ color: '#9eacb9' }}>
                      due {formatDateLabel(item.dueAtIso)} · {item.cadence}
                      {item.lastCompletedAtIso ? ` · last completed ${formatDateLabel(item.lastCompletedAtIso)}` : ' · never completed'}
                    </small>
                  </div>
                  <span style={{ color: item.status === 'completed' ? SP_COLORS.deepGreen : SP_COLORS.yellow }}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="atlas-surface-panel px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <small className="atlas-overline block" style={{ color: SP_COLORS.muted }}>
                weekly self assessment
              </small>
              <div className="atlas-h4 mt-1 text-[24px] font-medium text-white">weekly averages</div>
            </div>
            <span className="rounded-full border px-3 py-1 text-[11px]" style={{ borderColor: '#ffffff24', color: '#d7e0e9' }}>
              {selfAssessmentSummary.responseCount} responses
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MetricCard label="stress load" value={formatRelativeRoleValue(selfAssessmentSummary.averageStressLoad)} accent={SP_COLORS.red} />
            <MetricCard label="confidence" value={formatRelativeRoleValue(selfAssessmentSummary.averageConfidence)} accent={SP_COLORS.yellow} />
            <MetricCard label="support" value={formatRelativeRoleValue(selfAssessmentSummary.averageSupport)} accent={SP_COLORS.deepGreen} />
            <MetricCard label="composite" value={formatRelativeRoleValue(selfAssessmentSummary.averageComposite)} accent={SP_COLORS.blue} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <AssessmentSelect
              label="stress load"
              value={draftAssessment.stressLoadScore}
              onChange={(value) => setDraftAssessment((current) => ({ ...current, stressLoadScore: value }))}
            />
            <AssessmentSelect
              label="confidence"
              value={draftAssessment.confidenceScore}
              onChange={(value) => setDraftAssessment((current) => ({ ...current, confidenceScore: value }))}
            />
            <AssessmentSelect
              label="support"
              value={draftAssessment.supportScore}
              onChange={(value) => setDraftAssessment((current) => ({ ...current, supportScore: value }))}
            />
          </div>
          <textarea
            value={draftAssessment.note}
            onChange={(event) => setDraftAssessment((current) => ({ ...current, note: event.target.value }))}
            className="atlas-textarea mt-3 min-h-[82px] bg-transparent text-[13px] text-white"
            placeholder="Record weekly self assessment notes..."
          />
          <div className="mt-3 flex justify-end">
            <AtlasTextButton
              onClick={async () => {
                setIsSavingAssessment(true)
                try {
                  const submittedAtIso = new Date().toISOString()
                  await onSaveSelfAssessment({
                    ...draftAssessment,
                    id: `self-assessment-${Date.now()}`,
                    submittedAtIso,
                    weekStartIso: draftAssessment.weekStartIso || submittedAtIso
                  })
                  setDraftAssessment({
                    id: `self-assessment-${Date.now() + 1}`,
                    navigatorName: currentNavigatorName,
                    weekStartIso: submittedAtIso,
                    submittedAtIso,
                    stressLoadScore: 3,
                    confidenceScore: 3,
                    supportScore: 3,
                    note: ''
                  })
                } finally {
                  setIsSavingAssessment(false)
                }
              }}
              disabled={isSavingAssessment}
              className="px-[14px] py-[7px] text-[13px] font-medium"
              style={{
                ['--button-border-color' as const]: SP_COLORS.yellow,
                ['--button-line-color' as const]: SP_COLORS.bg,
                color: SP_COLORS.bg,
                backgroundColor: SP_COLORS.yellow
              } as React.CSSProperties}
            >
              save weekly check-in
            </AtlasTextButton>
          </div>
          <div className="mt-4 space-y-2">
            {selfAssessments.slice(0, 4).map((record) => (
              <div key={record.id} className="atlas-surface-raised px-3 py-3 text-[12px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white">{formatDateLabel(record.submittedAtIso)}</span>
                  <span style={{ color: '#9eacb9' }}>
                    {record.stressLoadScore}/{record.confidenceScore}/{record.supportScore}
                  </span>
                </div>
                {record.note ? <div className="mt-2 text-[12px] leading-[1.4]" style={{ color: '#d7e0e9' }}>{record.note}</div> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="atlas-surface-panel px-4 py-4">
          <small className="atlas-overline block" style={{ color: SP_COLORS.muted }}>
            supervision archive
          </small>
          <div className="atlas-h4 mt-1 text-[24px] font-medium text-white">session notes</div>
          <div className="mt-4 space-y-3">
            {supervisionSessions.length ? (
              supervisionSessions.map((session) => (
                <div key={session.id} className="atlas-surface-raised px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[16px] text-white">{formatDateLabel(session.sessionAtIso)}</div>
                      <small style={{ color: '#9eacb9' }}>
                        {session.supervisorName} · {session.status}
                      </small>
                    </div>
                    <span className="rounded-full border px-3 py-1 text-[11px]" style={{ borderColor: '#ffffff24', color: '#d7e0e9' }}>
                      archived
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <small className="atlas-overline block" style={{ color: SP_COLORS.muted }}>
                        supervisor note
                      </small>
                      <div className="mt-1 text-[13px] leading-[1.45] text-white">{session.supervisorNote || 'No supervisor note recorded.'}</div>
                    </div>
                    <div>
                      <small className="atlas-overline block" style={{ color: SP_COLORS.muted }}>
                        navigator note
                      </small>
                      <textarea
                        value={sessionDrafts[session.id] ?? session.navigatorNote}
                        onChange={(event) => {
                          const value = event.target.value
                          setSessionDrafts((current) => ({ ...current, [session.id]: value }))
                        }}
                        onFocus={() => setSavingSessionId(session.id)}
                        onBlur={() => {
                          const nextValue = sessionDrafts[session.id] ?? session.navigatorNote
                          setSavingSessionId(null)
                          if (nextValue === session.navigatorNote) return
                          void onSaveSupervisionSession({ ...session, navigatorNote: nextValue })
                        }}
                        className="atlas-textarea mt-1 min-h-[78px] bg-transparent text-[13px] text-white"
                      />
                    </div>
                  </div>
                  {session.actionItems ? (
                    <div className="atlas-surface-raised mt-3 px-3 py-2 text-[12px]" style={{ color: '#d7e0e9' }}>
                      next steps: {session.actionItems}
                    </div>
                  ) : null}
                  {savingSessionId === session.id ? (
                    <small className="mt-2 block" style={{ color: '#9eacb9' }}>
                      saving on blur or edit...
                    </small>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="atlas-empty-state">
                No supervision sessions have been archived yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="atlas-surface-raised px-3 py-3">
      <small className="atlas-overline block" style={{ color: SP_COLORS.muted }}>
        {label}
      </small>
      <div className="mt-2 text-[22px] font-medium" style={{ color: accent }}>
        {value}
      </div>
    </div>
  )
}

function AssessmentSelect({
  label,
  value,
  onChange
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <small className="atlas-overline block" style={{ color: SP_COLORS.muted }}>
        {label}
      </small>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="atlas-select mt-1 h-10 bg-transparent text-[13px] text-white"
      >
        {[1, 2, 3, 4, 5].map((option) => (
          <option key={option} value={option} className="bg-black text-white">
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}
