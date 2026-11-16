import React from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type {
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
import NavigatorProfileOverview from './NavigatorProfileOverview'
import { RegulationReviewRow } from './NavigatorProfileScheduleSections'

/**
 * Props for the navigator parts of My Wallet. `MyWalletPanel` reads the
 * records for the task pad, `NavigatorCardOverlay` reads the three card forms'
 * records and save handlers, and this panel, printed inside
 * `WalletAssignmentsOverlay`, keeps the enrollee claim circles and the weekly
 * review queue.
 */
export interface NavigatorMyProfilePanelProps {
  currentNavigatorName: string
  aggregateLoad: DomainLoad | null
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
  onOpenEnrolleeSurvey?: (enrolleeId: string) => void
  // Forced weekly review actions jump directly into the selected enrollee's assessment flow.
  onOpenRegulationReview?: (enrolleeId: string, missingInstruments?: Array<'mh_sca' | 'svs'>) => void
  onOpenAssignmentBoardReferral?: () => void
  onToggleEnrollmentAssignment: (enrollmentId: string, mode: 'accept' | 'archive' | 'assign' | 'unassign') => Promise<void> | void
  onSaveIpsSelfAssessment: (record: IpsCompetencySelfAssessmentRecord) => Promise<unknown> | unknown
  onSaveIpsccEncounterSubmission: (record: IpsccEncounterSubmissionRecord) => Promise<unknown> | unknown
  onSaveCreateSession: (record: CreateSessionRecord) => Promise<unknown> | unknown
  onSaveSupervisionSession: (record: SupervisionSessionRecord) => Promise<unknown> | unknown
  /** The viewer's point-of-care records; My Wallet's task pad reads the latest one per enrollee. */
  ipsccEncounterSubmissions?: IpsccEncounterSubmissionRecord[]
}

export default function NavigatorProfileExperience(props: NavigatorMyProfilePanelProps) {
  const {
    navigatorEnrollmentAssignments,
    navigatorEnrollmentAssignmentsError,
    isLoadingNavigatorEnrollmentAssignments,
    assigningEnrollmentId,
    canViewNavigatorAssignmentNames,
    canToggleAssignmentActions,
    canOpenAssignmentBoardReferral,
    regulationReviewDueItems = [],
    programError = null,
    onOpenRegulationReview,
    onOpenAssignmentBoardReferral,
    onToggleEnrollmentAssignment
  } = props
  // Weekly regulation reviews stay collapsed behind a calendar badge until opened.
  const [reviewModalOpen, setReviewModalOpen] = React.useState(false)
  const assignmentBoardRef = React.useRef<HTMLElement | null>(null)
  const openReviews = React.useMemo(
    () => regulationReviewDueItems.filter((item) => item.status === 'open'),
    [regulationReviewDueItems]
  )

  React.useEffect(() => {
    if (!openReviews.length && reviewModalOpen) setReviewModalOpen(false)
  }, [openReviews.length, reviewModalOpen])

  return (
    <div className="relative flex flex-col gap-4">
      <NavigatorProfileOverview
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
        onOpenReviewQueue={() => setReviewModalOpen(true)}
        onOpenReferral={onOpenAssignmentBoardReferral}
        onToggleAssignment={onToggleEnrollmentAssignment}
      />

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

