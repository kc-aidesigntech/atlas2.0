import React from 'react'
import type {
  NavigatorCreateReflectionRecord,
  SupervisorIpsAssessmentRecord,
  SupervisorNavigatorCompetencySummary
} from '@/features/atlas2026/shared/contracts'
import ProfileNavigationCard from './ProfileNavigationCard'
import SupervisorCompetencyPanel from './SupervisorCompetencyPanel'
import SupervisorProfileOverlay, {
  type SupervisorNavigatorDirectoryEntry,
  type SupervisorProfileOverlayKey
} from './supervisorProfile/SupervisorProfileOverlay'

interface SupervisorMyProfilePanelProps {
  mode: 'profile' | 'wallet'
  currentSupervisorName: string
  navigatorDirectory: SupervisorNavigatorDirectoryEntry[]
  competencyByNavigator: SupervisorNavigatorCompetencySummary[]
  allSupervisorIpsAssessments: SupervisorIpsAssessmentRecord[]
  managedCreateReflections: NavigatorCreateReflectionRecord[]
  isSavingAssignments?: boolean
  onToggleManagedNavigator?: (navigatorPersonId: string, isManaged: boolean) => Promise<void> | void
  onSaveSupervisorIpsAssessment: (record: SupervisorIpsAssessmentRecord) => Promise<unknown> | unknown
  onSaveCreateReflectionOverride: (input: { navigatorName: string; reflectionText: string }) => Promise<unknown> | unknown
  onRestoreCreateReflectionGenerated: (navigatorName: string) => Promise<unknown> | unknown
}

const CARD_DEFS: Array<{
  // overlayId (not "key") avoids gitleaks generic-api-key false positives on section ids.
  overlayId: SupervisorProfileOverlayKey
  title: string
  cardTitle: string
  cardSubtitle: string
  actionLabel: string
  variant: 'green' | 'blue'
  illustration: 'feedback' | 'reflection' | 'create'
}> = [
  { overlayId: 'section_1_weekly_ips', title: 'Section 1: Weekly IPSCC assessment by supervisor', cardTitle: 'weekly review', cardSubtitle: 'ipscc', actionLabel: 'start reflection', variant: 'blue', illustration: 'reflection' },
  { overlayId: 'section_2_assigned_navigators', title: 'Section 2: Assigned navigators', cardTitle: 'navigator roster', cardSubtitle: 'assignments', actionLabel: 'view feedback', variant: 'green', illustration: 'feedback' },
  { overlayId: 'section_3_assessment_rollup', title: 'Section 3: Navigator assessment rollup', cardTitle: 'assessment rollup', cardSubtitle: 'competency', actionLabel: 'create & share', variant: 'green', illustration: 'create' },
  { overlayId: 'section_4_create_reflections', title: 'Section 4: C.R.E.A.T.E. reflection review', cardTitle: 'c.r.e.a.t.e.', cardSubtitle: 'review & override', actionLabel: 'review reflections', variant: 'blue', illustration: 'reflection' }
]

export default function SupervisorMyProfilePanel(props: SupervisorMyProfilePanelProps) {
  const [activeOverlay, setActiveOverlay] = React.useState<SupervisorProfileOverlayKey | null>(null)
  const { mode, ...overlayProps } = props
  const walletCards = CARD_DEFS.filter((card) => card.overlayId !== 'section_2_assigned_navigators')
  // Profile lists the supervisor's navigators. Wallet keeps the assessment tools.
  const assignedNavigators = props.navigatorDirectory.filter((row) => row.isManagedByCurrentSupervisor)

  return (
    <div className="relative flex flex-col gap-4">
      <div className="atlas-surface-panel px-5 py-4">
        <div className="atlas-h4 text-[24px] font-medium text-white">{mode === 'profile' ? 'my profile' : 'my wallet'}</div>
        <small className="mt-1 block text-[#9eacb9]">{props.currentSupervisorName}</small>
      </div>
      {mode === 'profile' ? (
        <SupervisorCompetencyPanel
          mode="assigned-navigators"
          navigatorDirectory={assignedNavigators}
          competencyByNavigator={props.competencyByNavigator}
          isSavingAssignments={props.isSavingAssignments ?? false}
        />
      ) : (
        <>
          <SupervisorCompetencyPanel
            mode="navigator-assessments"
            navigatorDirectory={assignedNavigators}
            competencyByNavigator={props.competencyByNavigator}
          />
          <div className="atlas-profile-nav-grid">
            {walletCards.map((card, index) => (
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
        </>
      )}
      {activeOverlay ? (
        <SupervisorProfileOverlay
          {...overlayProps}
          activeOverlay={activeOverlay}
          title={CARD_DEFS.find((card) => card.overlayId === activeOverlay)?.title || 'section'}
          isSavingAssignments={props.isSavingAssignments ?? false}
          onClose={() => setActiveOverlay(null)}
        />
      ) : null}
    </div>
  )
}
