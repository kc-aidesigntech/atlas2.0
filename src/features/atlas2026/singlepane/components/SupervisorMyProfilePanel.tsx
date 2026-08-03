import React from 'react'
import type {
  NavigatorCreateReflectionRecord,
  SupervisorIpsAssessmentRecord,
  SupervisorNavigatorCompetencySummary
} from '@/features/atlas2026/shared/contracts'
import ProfileNavigationCard from './ProfileNavigationCard'
import SupervisorProfileOverlay, {
  type SupervisorNavigatorDirectoryEntry,
  type SupervisorProfileOverlayKey
} from './supervisorProfile/SupervisorProfileOverlay'

interface SupervisorMyProfilePanelProps {
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

  return (
    <div className="relative flex flex-col gap-4">
      <div className="atlas-surface-panel px-5 py-4">
        <div className="atlas-h4 text-[24px] font-medium text-white">supervisor my profile</div>
        <small className="mt-1 block text-[#9eacb9]">{props.currentSupervisorName}</small>
      </div>
      <div className="atlas-profile-nav-grid">
        {CARD_DEFS.map((card) => (
          <ProfileNavigationCard
            key={card.overlayId}
            sequenceNumber={Number(card.overlayId.replace('section_', '').split('_')[0])}
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
        <SupervisorProfileOverlay
          {...props}
          activeOverlay={activeOverlay}
          title={CARD_DEFS.find((card) => card.overlayId === activeOverlay)?.title || 'section'}
          isSavingAssignments={props.isSavingAssignments ?? false}
          onClose={() => setActiveOverlay(null)}
        />
      ) : null}
    </div>
  )
}
