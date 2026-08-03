import React from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { createFallbackAvatarDataUrl } from '@/features/atlas2026/components/avatarFallback'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
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
import IpsccStrainRadarChart from '../IpsccStrainRadarChart'
import NavigatorCompetencyDashboard from '../NavigatorCompetencyDashboard'
import ProfileNavigationCard from '../ProfileNavigationCard'
import NavigatorProfileOverview from './NavigatorProfileOverview'
import {
  NavigatorScheduleSection,
  RegulationReviewRow
} from './NavigatorProfileScheduleSections'
import {
  ACTIVE_NAVIGATOR_PROFILE_CARDS,
  NAVIGATOR_PROFILE_CARDS,
  formatDateLabel,
  type NavigatorProfileOverlayKey
} from './model'
import {
  NavigatorCreateHistorySection,
  NavigatorIpsccFeedbackSection,
  NavigatorSelfAwarenessSection
} from './NavigatorProfilePrimarySections'

export interface NavigatorMyProfilePanelProps {
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
  // Forced weekly review actions jump directly into the selected enrollee's assessment flow.
  onOpenRegulationReview?: (enrolleeId: string, missingInstruments?: Array<'mh_sca' | 'svs'>) => void
  onOpenAssignmentBoardReferral?: () => void
  onToggleEnrollmentAssignment: (enrollmentId: string, mode: 'accept' | 'archive' | 'assign' | 'unassign') => Promise<void> | void
  onSaveIpsSelfAssessment: (record: IpsCompetencySelfAssessmentRecord) => Promise<unknown> | unknown
  onSaveIpsccEncounterSubmission: (record: IpsccEncounterSubmissionRecord) => Promise<unknown> | unknown
  onSaveSupervisionSession: (record: SupervisionSessionRecord) => Promise<unknown> | unknown
}

export default function NavigatorProfileExperience(props: NavigatorMyProfilePanelProps) {
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
  const [activeOverlay, setActiveOverlay] = React.useState<NavigatorProfileOverlayKey | null>(null)
  // Weekly regulation reviews stay collapsed behind a calendar badge until opened.
  const [reviewModalOpen, setReviewModalOpen] = React.useState(false)
  const assignmentBoardRef = React.useRef<HTMLElement | null>(null)
  const displayName = currentNavigatorName.trim() || accountSettings.fullName.trim() || 'navigator'
  const fallbackAvatar = React.useMemo(() => createFallbackAvatarDataUrl(displayName), [displayName])
  const openReviews = React.useMemo(
    () => regulationReviewDueItems.filter((item) => item.status === 'open'),
    [regulationReviewDueItems]
  )

  React.useEffect(() => {
    if (!openReviews.length && reviewModalOpen) setReviewModalOpen(false)
  }, [openReviews.length, reviewModalOpen])

  return (
    <div className="relative flex flex-col gap-4">
      {/* Border under the whole identity+radar band keeps both surface bottoms even. */}
      <div className="border-b pb-4" style={{ borderColor: '#ffffff55', borderBottomWidth: '2px' }}>
        <div className="atlas-navigator-profile-layout">
          <div className="atlas-navigator-profile-main">
            <NavigatorProfileOverview
              accountSettings={accountSettings}
              displayName={displayName}
              fallbackAvatar={fallbackAvatar}
              assignedEnrolleeCount={assignedEnrolleeCount}
              openReviewCount={openReviews.length}
              programError={programError}
              assignmentBoardRef={assignmentBoardRef}
              assignments={navigatorEnrollmentAssignments}
              assignmentsError={navigatorEnrollmentAssignmentsError}
              isLoadingAssignments={isLoadingNavigatorEnrollmentAssignments}
              assigningEnrollmentId={assigningEnrollmentId}
              canViewAssignmentNames={canViewNavigatorAssignmentNames}
              canToggleAssignments={canToggleAssignmentActions}
              canOpenReferral={canOpenAssignmentBoardReferral}
              isUploadingAvatar={isUploadingAvatar}
              avatarUploadError={avatarUploadError}
              onReplaceAvatar={onReplaceAvatar}
              onOpenReviewQueue={() => setReviewModalOpen(true)}
              onOpenReferral={onOpenAssignmentBoardReferral}
              onToggleAssignment={onToggleEnrollmentAssignment}
            />
          </div>
          <div className="atlas-navigator-profile-rail">
            {/* Dual radar fills rail height so its bottom stays even with the main pane. */}
            <IpsccStrainRadarChart
              correlationRows={selfAwarenessCorrelationRows}
              enrolleeFeedbackPrivacy={ipsccEnrolleeFeedbackPrivacy}
              onOpenAwareness={() => setActiveOverlay('section_2_awareness')}
            />
          </div>
        </div>
      </div>

      {/* Section 1 spans the full profile width under identity + radar. */}
      <div className="atlas-navigator-profile-section-span">
        <NavigatorCompetencyDashboard
          ipsccCompetencyAverages={ipsccCompetencyAverages}
          ipsccEnrolleeFeedbackPrivacy={ipsccEnrolleeFeedbackPrivacy}
          onOpenSection={setActiveOverlay}
        />
      </div>

      {/* Supervision cards sit in one centered row under the main pane. */}
      <div className="atlas-navigator-profile-card-row" aria-label="Navigator supervision sections">
        {ACTIVE_NAVIGATOR_PROFILE_CARDS.map((card, index) => (
          <ProfileNavigationCard
            key={card.overlayId}
            sequenceNumber={index + 1}
            title={card.cardTitle}
            subtitle={card.cardSubtitle}
            actionLabel={card.actionLabel}
            variant={card.variant}
            illustration={card.illustration}
            onClick={() => setActiveOverlay(card.overlayId)}
          />
        ))}
      </div>

      {activeOverlay ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="atlas-surface-panel max-h-[90vh] w-full max-w-[980px] overflow-y-auto p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[18px] font-medium text-white">
                {NAVIGATOR_PROFILE_CARDS.find((card) => card.overlayId === activeOverlay)?.title || 'section'}
              </div>
              <AtlasTextButton onClick={() => setActiveOverlay(null)} className="px-3 py-1 text-[12px]">
                close
              </AtlasTextButton>
            </div>
            {activeOverlay === 'section_1_ipscc' ? (
              <NavigatorIpsccFeedbackSection
                assignedEnrollees={assignedEnrollees}
                currentNavigatorName={currentNavigatorName}
                privacy={ipsccEnrolleeFeedbackPrivacy}
                onSave={onSaveIpsccEncounterSubmission}
              />
            ) : null}
            {activeOverlay === 'section_2_awareness' ? (
              <NavigatorSelfAwarenessSection
                currentNavigatorName={currentNavigatorName}
                assessments={ipsSelfAssessments}
                supervisorAssessments={navigatorSupervisorIpsAssessments}
                correlationRows={selfAwarenessCorrelationRows}
                summary={selfAwarenessSummary}
                privacy={ipsccEnrolleeFeedbackPrivacy}
                onSave={onSaveIpsSelfAssessment}
              />
            ) : null}
            {activeOverlay === 'section_3_create' ? (
              <div className="space-y-3">
                {/* Current reflection travels with session history so Section 3 stays off chrome. */}
                <div className="atlas-surface-raised space-y-2 px-3 py-3 text-[12px] text-white">
                  <div>
                    <small className="atlas-overline block text-[#9eacb9]">section 3 · what is being workshopped</small>
                    <div className="mt-0.5 text-[14px] font-medium text-white">C.R.E.A.T.E. supervision reflection</div>
                  </div>
                  {createReflection?.reflectionText?.trim() ? (
                    <div className="rounded-[10px] border border-white/10 px-2.5 py-2">
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
                    <div className="text-[#9eacb9]">
                      No C.R.E.A.T.E. reflection yet. A supervisor reflection appears after the first saved supervision
                      session.
                    </div>
                  )}
                </div>
                <NavigatorCreateHistorySection sessions={createSessions} />
              </div>
            ) : null}
            {activeOverlay === 'section_4_assignments' ? (
              <div className="atlas-surface-raised space-y-3 px-3 py-3 text-white">
                <div className="text-[13px]">
                  assignment board is tucked under the profile photo so you can pick up enrollees without opening a
                  card.
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
                    <AtlasTextButton
                      onClick={() => onOpenEnrolleeSurvey?.(enrollee.id)}
                      className="px-3 py-1 text-[12px]"
                    >
                      update z-codes
                    </AtlasTextButton>
                  </div>
                ))}
              </div>
            ) : null}
            {activeOverlay === 'section_6_competency' ? (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <MetricCard label="weighted avg" value={competencySummary?.weightedRollingAverage?.toFixed(2) || '--'} />
                <MetricCard label="assessments" value={String(competencySummary?.assessmentCount || 0)} />
                <MetricCard
                  label="last review"
                  value={
                    competencySummary?.lastAssessmentAtIso
                      ? formatDateLabel(competencySummary.lastAssessmentAtIso)
                      : 'none'
                  }
                />
              </div>
            ) : null}
            {activeOverlay === 'section_7_schedule' ? (
              <NavigatorScheduleSection
                dueItems={dueItems}
                regulationItems={regulationReviewDueItems}
                onStart={(item) => {
                  onOpenRegulationReview?.(item.enrolleeId, item.missingInstruments)
                  setActiveOverlay(null)
                }}
              />
            ) : null}
            {activeOverlay === 'section_8_archive' ? (
              <div className="space-y-2">
                {supervisionSessions.map((session) => (
                  <div key={session.id} className="atlas-surface-raised px-3 py-2 text-[12px]">
                    <div className="text-white">
                      {formatDateLabel(session.sessionAtIso)} · {session.supervisorName}
                    </div>
                    <textarea
                      className="atlas-textarea mt-2 min-h-[70px] bg-transparent text-white"
                      value={session.navigatorNote}
                      onChange={(event) =>
                        onSaveSupervisionSession({ ...session, navigatorNote: event.target.value })
                      }
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {reviewModalOpen && openReviews.length ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Required weekly regulation review"
        >
          <div
            className="atlas-surface-panel w-full max-w-[720px] overflow-y-auto px-4 py-3"
            style={{ borderColor: `${SP_COLORS.red}80`, borderWidth: 1, borderStyle: 'solid', maxHeight: '90vh' }}
          >
            <div className="mb-1 flex items-start justify-between gap-3">
              <small className="atlas-overline block" style={{ color: SP_COLORS.red }}>
                required weekly regulation review
              </small>
              <AtlasTextButton onClick={() => setReviewModalOpen(false)} className="px-3 py-1 text-[12px]">
                close
              </AtlasTextButton>
            </div>
            <div className="mt-1 text-[15px] font-medium text-white">
              {openReviews.length} enrollee{openReviews.length === 1 ? '' : 's'} need Stress Vulnerability Scale (SVS)
              and Mental Health Self-Care Agency (MH-SCA) this cycle — cadence cannot be skipped.
            </div>
            <div className="mt-3 space-y-2">
              {openReviews.map((item) => (
                <RegulationReviewRow
                  key={item.id}
                  item={item}
                  onStart={() => {
                    setReviewModalOpen(false)
                    onOpenRegulationReview?.(item.enrolleeId, item.missingInstruments)
                  }}
                />
              ))}
            </div>
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

