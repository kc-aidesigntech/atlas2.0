import React from 'react'
import { AtlasPlusButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { createFallbackAvatarDataUrl } from '@/features/atlas2026/components/avatarFallback'
import type { AccountSettings, AtlasRole } from '@/features/atlas2026/shared/contracts'
import {
  isTierKey,
  tierHasDefaultPermission,
  type AtlasPermissionKey,
  type TierStanding
} from '@/features/atlas2026/shared/tiers'
import { isSeedProgramRecordId } from '@/features/atlas2026/singlepane/domain/ipsccSeeds'
import { buildWalletTasks } from '@/features/atlas2026/singlepane/domain/walletTaskBuilder'
import {
  checkedTodayIds,
  completedTasks,
  isSameBusinessDay,
  padTasks
} from '@/features/atlas2026/singlepane/domain/walletTaskChecks'
import {
  tabsForViewer,
  tasksForViewer,
  WALLET_TABS,
  type WalletPerson,
  type WalletTask
} from '@/features/atlas2026/singlepane/domain/walletTasks'
import { useWalletOverview } from '@/features/atlas2026/singlepane/hooks/useWalletOverview'
import { useBusinessDayClock, useWalletTaskChecks } from '@/features/atlas2026/singlepane/hooks/useWalletTaskChecks'
import type { NavigatorMyProfilePanelProps } from './NavigatorMyProfilePanel'
import NavigatorCardOverlay from './myWallet/NavigatorCardOverlay'
import WalletAssignmentsOverlay from './myWallet/WalletAssignmentsOverlay'
import {
  NAVIGATOR_WALLET_CARD_ENTRIES,
  SUPERVISOR_WALLET_CARD_ENTRIES,
  type WalletCardTarget
} from './myWallet/walletCards'
import WalletLayout from './myWallet/WalletLayout'
import { SUPERVISOR_PROFILE_CARDS, type SupervisorWalletProps } from './supervisorProfile/model'
import SupervisorProfileOverlay from './supervisorProfile/SupervisorProfileOverlay'

export interface MyWalletPanelProps {
  viewerRole: AtlasRole
  /** `fn_my_tier` for the signed-in account; null until it answers or when no tier row exists. */
  viewerTier: TierStanding | null
  hasPermission: (key: AtlasPermissionKey) => boolean
  accountSettings: AccountSettings
  displayName: string
  isUploadingAvatar: boolean
  avatarUploadError: string | null
  onReplaceAvatar?: (file: File) => Promise<unknown> | unknown
  /** The viewer's enrollees and own records, the three card forms' save handlers, and the enrollee claim surface. */
  navigator: NavigatorMyProfilePanelProps
  /** The supervisor cards' records and save handlers (`supervision.give`). */
  supervisor: SupervisorWalletProps
}

const ALL_CARD_ENTRIES = [...NAVIGATOR_WALLET_CARD_ENTRIES, ...SUPERVISOR_WALLET_CARD_ENTRIES]

/**
 * One My Wallet for every tier: the identity band beside the load chart, then
 * two columns. Column 1 holds the cards; a press opens the card's form in an
 * overlay. Column 2 holds the task pad. This component builds the pad's tasks
 * from the viewer's records, keeps the checked tasks, and passes both to
 * `WalletLayout`, which prints the screen.
 */
export default function MyWalletPanel({
  viewerRole,
  viewerTier,
  hasPermission,
  accountSettings,
  displayName,
  isUploadingAvatar,
  avatarUploadError,
  onReplaceAvatar,
  navigator,
  supervisor
}: MyWalletPanelProps) {
  const showEnrollees = hasPermission('enrollee_profile.write')
  const showSupervisees = hasPermission('supervision.give')
  const canReceiveSupervision = hasPermission('supervision.receive')
  const canEngageLeads = hasPermission('leads.engage')
  const canTakeRespiteShifts = hasPermission('respite_shifts.take')
  const { overview, pickupCounts, isLoading } = useWalletOverview({
    enabled: true,
    countLeads: canEngageLeads,
    countRespiteShifts: canTakeRespiteShifts
  })
  const now = useBusinessDayClock()
  const { checks, storage, error: checkError, checkTask, uncheckTask, reopenTask } = useWalletTaskChecks()
  const fallbackAvatar = React.useMemo(() => createFallbackAvatarDataUrl(displayName), [displayName])
  const [openCard, setOpenCard] = React.useState<WalletCardTarget | null>(null)
  const [isAssignmentsOpen, setIsAssignmentsOpen] = React.useState(false)
  const [selectedPersonId, setSelectedPersonId] = React.useState<string | null>(null)

  // The same fn_my_tier row the role view uses. The pane role fills in until that call answers.
  const standing: TierStanding | null = React.useMemo(() => {
    if (viewerTier) return viewerTier
    if (isTierKey(viewerRole)) return { tierKey: viewerRole, tierStatus: 'active', isLucidEmployee: false, designations: [] }
    return null
  }, [viewerRole, viewerTier])
  const tierKey = standing?.tierKey ?? null

  const competencyCards = overview?.competencyCards ?? []
  // The count line prints when the viewer holds the key and either the tier seeds it or the viewer has earned a card.
  const showCompetencyCards =
    hasPermission('competency_cards.view') && (tierHasDefaultPermission(tierKey, 'competency_cards.view') || competencyCards.length > 0)

  const metaLines: Array<{ label: string; value: React.ReactNode }> = []
  if (showEnrollees) metaLines.push({ label: 'Assigned enrollees', value: navigator.assignedEnrollees.length })
  if (showCompetencyCards) metaLines.push({ label: 'Competency cards', value: isLoading && !overview ? '…' : competencyCards.length })

  // The person circles name the viewer's enrollees; a viewer without `enrollee_profile.write` is given none.
  const people: WalletPerson[] = React.useMemo(
    () => (showEnrollees ? navigator.assignedEnrollees.map((enrollee) => ({ id: enrollee.id, name: enrollee.fullName })) : []),
    [navigator.assignedEnrollees, showEnrollees]
  )
  const managedNavigators: WalletPerson[] = React.useMemo(
    () =>
      supervisor.navigatorDirectory
        .filter((row) => row.isManagedByCurrentSupervisor)
        .map((row) => ({ id: row.navigatorPersonId, name: row.navigatorName })),
    [supervisor.navigatorDirectory]
  )

  // A chosen person who is no longer among the circles filters nothing.
  const shownSelectedPersonId = people.some((person) => person.id === selectedPersonId) ? selectedPersonId : null

  // The workspace merges pilot seed records into these four lists. The pad reads only the records a person saved,
  // so a seed dated today does not hide a form that has no record.
  const savedRecords = React.useMemo(() => {
    const saved = <T extends { id: string }>(records: T[]) => records.filter((record) => !isSeedProgramRecordId(record.id))
    return {
      ipsccSubmissions: saved(navigator.ipsccEncounterSubmissions ?? []),
      selfAssessments: saved(navigator.ipsSelfAssessments),
      createSessions: saved(navigator.createSessions),
      supervisorAssessments: saved(supervisor.allSupervisorIpsAssessments)
    }
  }, [navigator.createSessions, navigator.ipsSelfAssessments, navigator.ipsccEncounterSubmissions, supervisor.allSupervisorIpsAssessments])

  const tabs = React.useMemo(() => tabsForViewer(WALLET_TABS, hasPermission), [hasPermission])
  // Every task that is due now, less the categories whose tab the viewer is not shown.
  const dueTasks = React.useMemo(
    () =>
      tasksForViewer(
        buildWalletTasks({
          now,
          canWorkEnrollees: showEnrollees,
          canReceiveSupervision,
          canGiveSupervision: showSupervisees,
          canEngageLeads,
          canTakeRespiteShifts,
          viewerName: navigator.currentNavigatorName,
          supervisorName: supervisor.currentSupervisorName,
          assignedEnrollees: people,
          ipsccSubmissions: savedRecords.ipsccSubmissions,
          regulationReviews: navigator.regulationReviewDueItems ?? [],
          selfAssessments: savedRecords.selfAssessments,
          createSessions: savedRecords.createSessions,
          managedNavigators,
          supervisorAssessments: savedRecords.supervisorAssessments,
          availableLeadCount: pickupCounts.availableLeadCount,
          openRespiteShiftCount: pickupCounts.openRespiteShiftCount
        }),
        WALLET_TABS,
        hasPermission
      ),
    [
      canEngageLeads,
      canReceiveSupervision,
      canTakeRespiteShifts,
      hasPermission,
      managedNavigators,
      navigator.currentNavigatorName,
      navigator.regulationReviewDueItems,
      now,
      people,
      pickupCounts.availableLeadCount,
      pickupCounts.openRespiteShiftCount,
      savedRecords,
      showEnrollees,
      showSupervisees,
      supervisor.currentSupervisorName
    ]
  )
  // The viewer's checks, less the ones whose task is in a category the viewer is no longer shown.
  const shownChecks = React.useMemo(() => {
    const shownTaskIds = new Set(
      tasksForViewer(
        checks.map((check) => check.task),
        WALLET_TABS,
        hasPermission
      ).map((task) => task.id)
    )
    return checks.filter((check) => shownTaskIds.has(check.taskId))
  }, [checks, hasPermission])
  const tasksOnPad = React.useMemo(() => padTasks(dueTasks, shownChecks, now), [dueTasks, shownChecks, now])
  const completed = React.useMemo(() => completedTasks(shownChecks, now), [shownChecks, now])
  const checkedTaskIds = React.useMemo(() => checkedTodayIds(shownChecks, now), [shownChecks, now])

  // A press on an unchecked row checks it; a press on a row checked today unchecks it with no reason.
  function toggleTask(task: WalletTask) {
    const check = checks.find((entry) => entry.taskId === task.id)
    if (!check) {
      checkTask(task)
      return
    }
    if (isSameBusinessDay(check.doneAtIso, now)) uncheckTask(check)
  }

  function reopenCompletedTask(taskId: string, reason: string) {
    const check = checks.find((entry) => entry.taskId === taskId)
    if (check) reopenTask(check, reason)
  }

  const cardEntries = showSupervisees ? ALL_CARD_ENTRIES : NAVIGATOR_WALLET_CARD_ENTRIES
  const cards = React.useMemo(() => cardEntries.map((entry) => entry.card), [cardEntries])
  const canManageAssignments = showEnrollees || showSupervisees
  const assignmentsLabel =
    showEnrollees && showSupervisees ? 'Assign enrollees and navigators' : showEnrollees ? 'Assign enrollees' : 'Assign navigators'

  return (
    <>
      <WalletLayout
        band={{
          accountSettings,
          displayName,
          fallbackAvatar,
          standing,
          metaLines,
          isUploadingAvatar,
          avatarUploadError,
          onReplaceAvatar,
          load: navigator.aggregateLoad,
          onOpenLoadTable: navigator.onOpenLoadTable
        }}
        cards={cards}
        onOpenCard={(cardId) => setOpenCard(cardEntries.find((entry) => entry.card.id === cardId)?.target ?? null)}
        routes={{
          people,
          // The plus button opens the claim circles; it prints for a viewer who can claim enrollees or navigators.
          peopleTrailing: canManageAssignments ? (
            <AtlasPlusButton label={assignmentsLabel} title="assignments" onClick={() => setIsAssignmentsOpen(true)} />
          ) : null,
          tabs,
          flagTabs: WALLET_TABS,
          tasks: tasksOnPad,
          checkedTaskIds,
          onToggleTask: toggleTask,
          completed,
          onReopenTask: reopenCompletedTask,
          selectedPersonId: shownSelectedPersonId,
          onSelectPerson: setSelectedPersonId,
          errorNote: checkError,
          storageNote: storage === 'memory' ? 'checked tasks are kept on this page only, until it reloads' : null
        }}
      />
      {openCard?.kind === 'navigator' ? (
        <NavigatorCardOverlay activeOverlay={openCard.overlayId} navigator={navigator} onClose={() => setOpenCard(null)} />
      ) : null}
      {openCard?.kind === 'supervisor' ? (
        <SupervisorProfileOverlay
          {...supervisor}
          activeOverlay={openCard.overlayId}
          title={SUPERVISOR_PROFILE_CARDS.find((card) => card.overlayId === openCard.overlayId)?.title || 'section'}
          isSavingAssignments={supervisor.isSavingAssignments ?? false}
          onClose={() => setOpenCard(null)}
        />
      ) : null}
      {isAssignmentsOpen ? (
        <WalletAssignmentsOverlay
          showEnrollees={showEnrollees}
          showNavigators={showSupervisees}
          navigator={navigator}
          onClose={() => setIsAssignmentsOpen(false)}
        />
      ) : null}
    </>
  )
}
