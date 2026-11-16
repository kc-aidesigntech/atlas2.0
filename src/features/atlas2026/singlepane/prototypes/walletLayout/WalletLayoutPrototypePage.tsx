/**
 * Wallet layout prototype, served by the dev server at `/prototype/wallet`.
 * It renders `WalletLayout`, the component the live My Wallet renders, from
 * fixture props: the identity band, the three cards, and the task pad. The
 * control strip's clock decides which checked tasks are on the pad and which
 * are on the completed list. The page holds all of its state in memory and
 * sends no request.
 */
import React from 'react'
import { AtlasInsetCard, AtlasOverline, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { createFallbackAvatarDataUrl } from '@/features/atlas2026/components/avatarFallback'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import { tierHasDefaultPermission, type AtlasPermissionKey, type TierKey } from '@/features/atlas2026/shared/tiers'
import {
  checkedTodayIds,
  completedTasks,
  isSameBusinessDay,
  padTasks,
  startOfNextBusinessDay,
  type WalletTaskCheck
} from '@/features/atlas2026/singlepane/domain/walletTaskChecks'
import {
  tabsForViewer,
  tasksForViewer,
  WALLET_TABS,
  type WalletPerson,
  type WalletTask
} from '@/features/atlas2026/singlepane/domain/walletTasks'
import { NAVIGATOR_WALLET_CARD_ENTRIES } from '../../components/myWallet/walletCards'
import WalletLayout from '../../components/myWallet/WalletLayout'
import WorkspaceFrame from '../../shell/WorkspaceFrame'
import {
  FIXTURE_DEFAULT_VIEWER_TIER,
  FIXTURE_DISPLAY_NAME,
  FIXTURE_DUE_TASKS,
  FIXTURE_ENROLLEES,
  FIXTURE_LOAD,
  FIXTURE_VIEWER_TIERS,
  fixtureAccount,
  fixtureEarlierChecks,
  fixtureMetaLines,
  fixtureStanding,
  fixtureTierLabel
} from './walletLayoutFixtures'

const NO_PEOPLE: WalletPerson[] = []
const FIXTURE_CARDS = NAVIGATOR_WALLET_CARD_ENTRIES.map((entry) => entry.card)

const TODAY_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

export default function WalletLayoutPrototypePage() {
  const [viewerTier, setViewerTier] = React.useState<TierKey>(FIXTURE_DEFAULT_VIEWER_TIER)
  const [queuePersonId, setQueuePersonId] = React.useState<string | null>(null)
  // The prototype's clock: the moment the page opened, until the control strip moves it to the next day.
  const [now, setNow] = React.useState(() => new Date())
  const [checks, setChecks] = React.useState<WalletTaskCheck[]>(() => fixtureEarlierChecks(new Date()))
  const fallbackAvatar = React.useMemo(() => createFallbackAvatarDataUrl(FIXTURE_DISPLAY_NAME), [])
  const account = React.useMemo(() => fixtureAccount(viewerTier), [viewerTier])
  const standing = React.useMemo(() => fixtureStanding(viewerTier), [viewerTier])
  // The fixture viewer holds the permission keys the chosen tier seeds.
  const hasPermission = React.useCallback((key: AtlasPermissionKey) => tierHasDefaultPermission(viewerTier, key), [viewerTier])
  const tabs = React.useMemo(() => tabsForViewer(WALLET_TABS, hasPermission), [hasPermission])
  // True for a viewer who is shown the enrollees tab: Peer Navigator and above.
  const seesEnrollees = tabs.some((tab) => tab.category === 'enrollees')
  // Below Peer Navigator these two lists hold no enrollee task, so none reaches the pad or the completed list.
  const dueTasks = React.useMemo(() => tasksForViewer(FIXTURE_DUE_TASKS, WALLET_TABS, hasPermission), [hasPermission])
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

  // A press on an unchecked row stores the task with `now` as its check time; a press on a row checked today removes that check.
  function toggleTask(task: WalletTask) {
    setChecks((current) => {
      const check = current.find((entry) => entry.taskId === task.id)
      if (!check) return [...current, { taskId: task.id, task, doneAtIso: now.toISOString() }]
      if (!isSameBusinessDay(check.doneAtIso, now)) return current
      return current.filter((entry) => entry.taskId !== task.id)
    })
  }

  // Removes the check, so the task returns to the pad unchecked. This page keeps the reason nowhere.
  function reopenTask(taskId: string, _reason: string) {
    setChecks((current) => current.filter((entry) => entry.taskId !== taskId))
  }

  return (
    <WorkspaceFrame navigation={null}>
      <div className="relative flex flex-col gap-4">
        <AtlasInsetCard className="flex flex-wrap items-center gap-3">
          <AtlasOverline className="mr-auto">prototype controls · not part of the design</AtlasOverline>
          {FIXTURE_VIEWER_TIERS.map((tierKey) => (
            <AtlasTextButton
              key={tierKey}
              aria-pressed={tierKey === viewerTier}
              // Choosing a tier also clears the person filter.
              onClick={() => {
                setViewerTier(tierKey)
                setQueuePersonId(null)
              }}
              className="px-3 py-1 text-[12px]"
              // The chosen tier's button takes a green border; the other takes a faint white one.
              style={
                { ['--button-border-color' as const]: tierKey === viewerTier ? SP_COLORS.deepGreen : '#ffffff30' } as React.CSSProperties
              }
            >
              view as {fixtureTierLabel(tierKey)}
            </AtlasTextButton>
          ))}
          <span aria-hidden className="h-5 w-px bg-white/30" />
          <span data-prototype-today>
            <AtlasOverline>today is {TODAY_FORMAT.format(now)}</AtlasOverline>
          </span>
          <AtlasTextButton
            // Moves the clock to the first moment of the next day; rows checked before then leave the pad for the completed list.
            onClick={() => setNow((current) => startOfNextBusinessDay(current))}
            className="px-3 py-1 text-[12px]"
            style={{ ['--button-border-color' as const]: '#ffffff30' } as React.CSSProperties}
          >
            skip to the next day
          </AtlasTextButton>
        </AtlasInsetCard>

        <WalletLayout
          band={{
            accountSettings: account,
            displayName: FIXTURE_DISPLAY_NAME,
            fallbackAvatar,
            standing,
            metaLines: fixtureMetaLines(seesEnrollees),
            isUploadingAvatar: false,
            avatarUploadError: null,
            load: FIXTURE_LOAD
          }}
          cards={FIXTURE_CARDS}
          // The live wallet opens the card's form on this press; this page opens none.
          onOpenCard={() => undefined}
          routes={{
            // The person circles name enrollees, so a viewer who is shown no enrollee tasks is given none.
            people: seesEnrollees ? FIXTURE_ENROLLEES : NO_PEOPLE,
            tabs,
            flagTabs: WALLET_TABS,
            tasks: tasksOnPad,
            checkedTaskIds,
            onToggleTask: toggleTask,
            completed,
            onReopenTask: reopenTask,
            selectedPersonId: queuePersonId,
            onSelectPerson: setQueuePersonId
          }}
        />
      </div>
    </WorkspaceFrame>
  )
}
