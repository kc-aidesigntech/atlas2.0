import React from 'react'
import type {
  CreateSessionRecord,
  NavigatorCreateReflectionRecord,
  SupervisorIpsAssessmentRecord,
  SupervisorNavigatorCompetencySummary
} from '@/features/atlas2026/shared/contracts'
import {
  claimSupervisorNavigator,
  loadSupervisorNavigatorClaimCards,
  releaseSupervisorNavigator
} from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'
import ProfileNavigationCard from './ProfileNavigationCard'
import SupervisorCompetencyPanel from './SupervisorCompetencyPanel'
import WalletClaimCircles from './WalletClaimCircles'
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
  createSessions?: CreateSessionRecord[]
  onSaveCreateSession?: (record: CreateSessionRecord) => Promise<unknown> | unknown
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
  const [claimCards, setClaimCards] = React.useState<Array<{ id: string; label: string; selected: boolean }>>([])
  const [claimError, setClaimError] = React.useState<string | null>(null)
  const [busyNavigatorId, setBusyNavigatorId] = React.useState<string | null>(null)
  const walletCards = CARD_DEFS.filter((card) => card.overlayId !== 'section_2_assigned_navigators')
  const assignedNavigators = props.navigatorDirectory.filter((row) => row.isManagedByCurrentSupervisor)

  React.useEffect(() => {
    let cancelled = false
    void loadSupervisorNavigatorClaimCards()
      .then((rows) => {
        if (cancelled) return
        setClaimCards(rows.map((row) => ({ id: row.personId, label: row.displayName, selected: row.isMine })))
        setClaimError(null)
      })
      .catch((error) => {
        if (cancelled) return
        setClaimError(error instanceof Error ? error.message : 'Unable to load navigators.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function toggleNavigator(personId: string, nextSelected: boolean) {
    const previous = claimCards
    setClaimCards((current) => current.map((card) => (card.id === personId ? { ...card, selected: nextSelected } : card)))
    setBusyNavigatorId(personId)
    setClaimError(null)
    try {
      if (nextSelected) await claimSupervisorNavigator(personId)
      else await releaseSupervisorNavigator(personId)
    } catch (error) {
      setClaimCards(previous)
      setClaimError(error instanceof Error ? error.message : 'Unable to update this navigator.')
    } finally {
      setBusyNavigatorId(null)
    }
  }

  return (
    <div className="relative flex flex-col gap-4">
      <div className="atlas-surface-panel px-5 py-4">
        <div className="atlas-h4 text-[24px] font-medium text-white">my wallet</div>
        <small className="mt-1 block text-[#9eacb9]">{props.currentSupervisorName}</small>
      </div>
      <WalletClaimCircles
        title="navigators"
        description="Tap a circle, then assign them to you or remove them."
        cards={claimCards}
        emptyLabel="No navigators are available to claim yet."
        error={claimError}
        busyId={busyNavigatorId}
        onToggle={(personId, nextSelected) => void toggleNavigator(personId, nextSelected)}
      />
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
