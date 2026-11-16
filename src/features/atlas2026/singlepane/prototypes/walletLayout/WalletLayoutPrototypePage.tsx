/**
 * Wallet layout prototype, served by the dev server at `/prototype/wallet`.
 * The top band is the live wallet's `WalletTierHeader` and `RadialLoadChart`
 * on fixture props. Under it sit the two prototype columns: the three cards,
 * and the queue on the pad. The control strip's clock decides which checked
 * tasks are on the pad and which are on the completed list. The page holds all of its state in memory and
 * sends no request.
 */
import React from 'react'
import { AtlasInsetCard, AtlasOverline, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { createFallbackAvatarDataUrl } from '@/features/atlas2026/components/avatarFallback'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type { TierKey } from '@/features/atlas2026/shared/tiers'
import WalletTierHeader from '../../components/myWallet/WalletTierHeader'
import RadialLoadChart from '../../components/RadialLoadChart'
import WorkspaceFrame from '../../shell/WorkspaceFrame'
import ReadinessColumn from './ReadinessColumn'
import RegulationColumn from './RegulationColumn'
import {
  FIXTURE_CARDS,
  FIXTURE_DEFAULT_VIEWER_TIER,
  FIXTURE_DISPLAY_NAME,
  FIXTURE_EARLIER_TASKS,
  FIXTURE_ENROLLEES,
  FIXTURE_LOAD,
  FIXTURE_OTHER_TASKS,
  FIXTURE_TABS,
  FIXTURE_VIEWER_FORM_AGES,
  FIXTURE_VIEWER_TIERS,
  fixtureAccount,
  fixtureDoneAtByTaskId,
  fixtureMetaLines,
  fixtureStanding,
  fixtureTierLabel
} from './walletLayoutFixtures'
import { completedTasks, isCheckedToday, padTasks, startOfNextBusinessDay, type DoneAtByTaskId } from './taskCompletion'
import { buildQueue, tabsForTier, tasksForTier, type AssignedEnrollee } from './walletLayoutModel'

const NO_PEOPLE: AssignedEnrollee[] = []

const TODAY_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

export default function WalletLayoutPrototypePage() {
  const [viewerTier, setViewerTier] = React.useState<TierKey>(FIXTURE_DEFAULT_VIEWER_TIER)
  const [queuePersonId, setQueuePersonId] = React.useState<string | null>(null)
  // The prototype's clock: the moment the page opened, until the control strip moves it to the next day.
  const [now, setNow] = React.useState(() => new Date())
  const [doneAtByTaskId, setDoneAtByTaskId] = React.useState<DoneAtByTaskId>(() => fixtureDoneAtByTaskId(new Date()))
  const fallbackAvatar = React.useMemo(() => createFallbackAvatarDataUrl(FIXTURE_DISPLAY_NAME), [])
  const account = React.useMemo(() => fixtureAccount(viewerTier), [viewerTier])
  const standing = React.useMemo(() => fixtureStanding(viewerTier), [viewerTier])
  const tabs = React.useMemo(() => tabsForTier(FIXTURE_TABS, viewerTier), [viewerTier])
  // True for a viewer who is shown the enrollees tab: Peer Navigator and above.
  const seesEnrollees = tabs.some((tab) => tab.category === 'enrollees')
  // Every task the viewer's tier is shown: the queue, then the tasks the fixture checked on earlier days.
  // Below Peer Navigator this list holds no enrollee task, so none reaches the pad or the completed list.
  const allTasks = React.useMemo(
    () =>
      tasksForTier(
        [...buildQueue(FIXTURE_ENROLLEES, FIXTURE_VIEWER_FORM_AGES, FIXTURE_OTHER_TASKS), ...FIXTURE_EARLIER_TASKS],
        FIXTURE_TABS,
        viewerTier
      ),
    [viewerTier]
  )
  const tasksOnPad = React.useMemo(() => padTasks(allTasks, doneAtByTaskId, now), [allTasks, doneAtByTaskId, now])
  const completed = React.useMemo(() => completedTasks(allTasks, doneAtByTaskId, now), [allTasks, doneAtByTaskId, now])
  const checkedTaskIds = React.useMemo(
    () => new Set(tasksOnPad.filter((task) => isCheckedToday(task.id, doneAtByTaskId, now)).map((task) => task.id)),
    [tasksOnPad, doneAtByTaskId, now]
  )

  // A press on an unchecked row stores `now` as its check time; a press on a row checked today removes that time.
  function toggleTask(taskId: string) {
    setDoneAtByTaskId((current) => {
      if (!current[taskId]) return { ...current, [taskId]: now.toISOString() }
      if (!isCheckedToday(taskId, current, now)) return current
      const { [taskId]: _removed, ...rest } = current
      return rest
    })
  }

  // Removes the check time, so the task returns to the pad unchecked. This page keeps the reason nowhere.
  function reopenTask(taskId: string, _reason: string) {
    setDoneAtByTaskId((current) => {
      const { [taskId]: _removed, ...rest } = current
      return rest
    })
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

        {/* Same wrapper markup as the top band in `MyWalletPanel`. */}
        <div className="border-b pb-4" style={{ borderColor: '#ffffff55', borderBottomWidth: '2px' }}>
          <div className="atlas-navigator-profile-layout">
            <div className="atlas-navigator-profile-main">
              <WalletTierHeader
                accountSettings={account}
                displayName={FIXTURE_DISPLAY_NAME}
                fallbackAvatar={fallbackAvatar}
                standing={standing}
                metaLines={fixtureMetaLines(seesEnrollees)}
                isUploadingAvatar={false}
                avatarUploadError={null}
              />
            </div>
            <div className="atlas-navigator-profile-rail items-center justify-center">
              <RadialLoadChart load={FIXTURE_LOAD} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
          <RegulationColumn cards={FIXTURE_CARDS} />
          <ReadinessColumn
            // The person circles name enrollees, so a viewer who is shown no enrollee tasks is given none.
            people={seesEnrollees ? FIXTURE_ENROLLEES : NO_PEOPLE}
            tabs={tabs}
            flagTabs={FIXTURE_TABS}
            tasks={tasksOnPad}
            checkedTaskIds={checkedTaskIds}
            onToggleTask={toggleTask}
            completed={completed}
            onReopenTask={reopenTask}
            selectedPersonId={queuePersonId}
            onSelectPerson={setQueuePersonId}
          />
        </div>
      </div>
    </WorkspaceFrame>
  )
}
