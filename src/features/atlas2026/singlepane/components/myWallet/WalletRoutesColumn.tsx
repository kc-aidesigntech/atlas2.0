import React from 'react'
import { History } from 'lucide-react'
import AtlasArrowIcon from '@/features/atlas2026/components/AtlasArrowIcon'
import { AtlasIconButton, AtlasPanel } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type { CompletedTask } from '@/features/atlas2026/singlepane/domain/walletTaskChecks'
import {
  filterTasksByPerson,
  filterTasksByTab,
  taskFlag,
  type WalletPerson,
  type WalletTab,
  type WalletTask
} from '@/features/atlas2026/singlepane/domain/walletTasks'
import CompletedTasksDialog from './CompletedTasksDialog'
import LegalPad, { PadCheckRow, PadNoteRow } from './LegalPad'
import PadPersonFilterRow from './PadPersonFilterRow'
import PadScrollTrack from './PadScrollTrack'
import WalletColumnHeading from './WalletColumnHeading'
import WalletTaskText from './WalletTaskText'

// Black fill, white icon, and a faint white border that keeps the button's edge visible on the pad's black header.
const HISTORY_BUTTON_STYLE = {
  '--button-fill-color': '#000000',
  '--button-border-color': '#ffffff59',
  color: '#ffffff'
} as React.CSSProperties

export interface WalletRoutesColumnProps {
  /** The people the circles above the pad filter by. */
  people: WalletPerson[]
  /** Printed after the last person circle; with no people and no trailing node the column prints no circle row. */
  peopleTrailing?: React.ReactNode
  /** The tabs the viewer is shown. */
  tabs: WalletTab[]
  /** Every tab, shown or not; a row's flag takes its color from this list. */
  flagTabs: WalletTab[]
  /** The pad's tasks: the unchecked ones and the ones checked today. */
  tasks: WalletTask[]
  checkedTaskIds: ReadonlySet<string>
  onToggleTask: (task: WalletTask) => void
  /** The tasks checked on an earlier day. */
  completed: CompletedTask[]
  onReopenTask: (taskId: string, reason: string) => void
  selectedPersonId: string | null
  onSelectPerson: (personId: string | null) => void
  /** Printed in red under the heading: a check that was not saved. */
  errorNote?: string | null
  /** Printed under the heading: where the checks are being kept when that is not the database. */
  storageNote?: string | null
}

/**
 * Column 2 of My Wallet: the person filter row, then the legal pad with its
 * tabs and the scroll track beside it. The button in the pad's header opens
 * the completed list.
 */
export default function WalletRoutesColumn({
  people,
  peopleTrailing,
  tabs,
  flagTabs,
  tasks,
  checkedTaskIds,
  onToggleTask,
  completed,
  onReopenTask,
  selectedPersonId,
  onSelectPerson,
  errorNote = null,
  storageNote = null
}: WalletRoutesColumnProps) {
  const pageRef = React.useRef<HTMLDivElement>(null)
  const historyButtonRef = React.useRef<HTMLButtonElement>(null)
  const pageId = React.useId()
  const [activeTabKey, setActiveTabKey] = React.useState(tabs[0]?.key ?? '')
  const [isCompletedOpen, setIsCompletedOpen] = React.useState(false)
  const activeTab = tabs.find((tab) => tab.key === activeTabKey) ?? tabs[0] ?? null
  const visibleTasks = activeTab ? filterTasksByPerson(filterTasksByTab(tasks, activeTab), selectedPersonId) : []

  return (
    <AtlasPanel className="flex h-full flex-col" contentClassName="flex min-h-0 flex-1 flex-col gap-5">
      <WalletColumnHeading
        sequenceNumber={2}
        title="advance some routes"
        titleTrailing={<AtlasArrowIcon direction="right" invert className="h-5 w-5 shrink-0" />}
      />
      {errorNote ? (
        <small role="alert" className="block text-[12px]" style={{ color: SP_COLORS.red }}>
          {errorNote}
        </small>
      ) : null}
      {storageNote ? <small className="atlas-caption block text-[#b1bcc8]">{storageNote}</small> : null}
      <div className="flex min-h-0 flex-1 flex-col gap-5">
        {people.length || peopleTrailing ? (
          <PadPersonFilterRow
            label="Filter tasks by person"
            people={people}
            selectedPersonId={selectedPersonId}
            onSelectPerson={onSelectPerson}
            trailing={peopleTrailing}
          />
        ) : null}
        {/* The pad fills the height column 1 gives the row, and its page scrolls inside it. */}
        <div className="relative min-h-[520px] flex-1">
          <div className="absolute inset-0 flex gap-3">
            <LegalPad
              tabs={tabs}
              activeTabKey={activeTab?.key ?? ''}
              onSelectTab={setActiveTabKey}
              pageRef={pageRef}
              pageId={pageId}
              headerTrailing={
                <AtlasIconButton
                  ref={historyButtonRef}
                  aria-label="Completed tasks"
                  title="completed tasks"
                  onClick={() => setIsCompletedOpen(true)}
                  style={HISTORY_BUTTON_STYLE}
                >
                  <History className="h-5 w-5" strokeWidth={2.4} />
                </AtlasIconButton>
              }
            >
              {visibleTasks.length ? (
                visibleTasks.map((task) => (
                  <PadCheckRow
                    key={task.id}
                    checked={checkedTaskIds.has(task.id)}
                    onToggle={() => onToggleTask(task)}
                    flag={taskFlag(task, flagTabs)}
                  >
                    <WalletTaskText task={task} />
                  </PadCheckRow>
                ))
              ) : (
                <PadNoteRow>nothing on this tab{selectedPersonId ? ' for the chosen person' : ''}</PadNoteRow>
              )}
            </LegalPad>
            <PadScrollTrack listRef={pageRef} listId={pageId} contentKey={visibleTasks.map((task) => task.id).join('|')} />
          </div>
        </div>
      </div>
      <CompletedTasksDialog
        open={isCompletedOpen}
        onOpenChange={setIsCompletedOpen}
        returnFocusRef={historyButtonRef}
        tabs={tabs}
        flagTabs={flagTabs}
        completed={completed}
        onReopenTask={onReopenTask}
      />
    </AtlasPanel>
  )
}
