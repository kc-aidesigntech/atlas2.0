import React from 'react'
import { History } from 'lucide-react'
import AtlasArrowIcon from '@/features/atlas2026/components/AtlasArrowIcon'
import { AtlasIconButton, AtlasPanel } from '@/features/atlas2026/components/AtlasPrimitives'
import ColumnHeading from './ColumnHeading'
import CompletedTasksDialog from './CompletedTasksDialog'
import LegalPad, { PadCheckRow, PadNoteRow } from './LegalPad'
import PersonFilterRow from './PersonFilterRow'
import ScrollTrack from './ScrollTrack'
import type { CompletedTask } from './taskCompletion'
import TaskText from './TaskText'
import {
  filterTasksByPerson,
  filterTasksByTab,
  taskFlag,
  type PrototypePerson,
  type ReadinessTab,
  type ReadinessTask
} from './walletLayoutModel'

// Black fill, white icon, and a faint white border that keeps the button's edge visible on the pad's black header.
const HISTORY_BUTTON_STYLE = {
  '--button-fill-color': '#000000',
  '--button-border-color': '#ffffff59',
  color: '#ffffff'
} as React.CSSProperties

interface ReadinessColumnProps {
  people: PrototypePerson[]
  /** The tabs the viewer is shown. */
  tabs: ReadinessTab[]
  /** Every tab, shown or not; a row's flag takes its color from this list. */
  flagTabs: ReadinessTab[]
  /** The pad's tasks: the unchecked ones and the ones checked today. */
  tasks: ReadinessTask[]
  checkedTaskIds: ReadonlySet<string>
  onToggleTask: (taskId: string) => void
  /** The tasks checked on an earlier day. */
  completed: CompletedTask[]
  onReopenTask: (taskId: string, reason: string) => void
  selectedPersonId: string | null
  onSelectPerson: (personId: string | null) => void
}

/**
 * Column 2: the person filter row when people are given, then the legal pad with its tabs and the
 * scroll track beside it. The button in the pad's header opens the completed
 * list.
 */
export default function ReadinessColumn({
  people,
  tabs,
  flagTabs,
  tasks,
  checkedTaskIds,
  onToggleTask,
  completed,
  onReopenTask,
  selectedPersonId,
  onSelectPerson
}: ReadinessColumnProps) {
  const pageRef = React.useRef<HTMLDivElement>(null)
  const historyButtonRef = React.useRef<HTMLButtonElement>(null)
  const pageId = React.useId()
  const [activeTabKey, setActiveTabKey] = React.useState(tabs[0]?.key ?? '')
  const [isCompletedOpen, setIsCompletedOpen] = React.useState(false)
  const peopleById = React.useMemo(() => new Map(people.map((person) => [person.id, person])), [people])
  const activeTab = tabs.find((tab) => tab.key === activeTabKey) ?? tabs[0] ?? null
  const visibleTasks = activeTab ? filterTasksByPerson(filterTasksByTab(tasks, activeTab), selectedPersonId) : []

  return (
    <AtlasPanel className="flex h-full flex-col" contentClassName="flex min-h-0 flex-1 flex-col gap-5">
      <ColumnHeading
        sequenceNumber={2}
        title="advance some routes"
        titleTrailing={<AtlasArrowIcon direction="right" invert className="h-5 w-5 shrink-0" />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5">
        {/* With no people given, the column prints no filter row. */}
        {people.length ? (
          <PersonFilterRow
            label="Filter readiness tasks by person"
            people={people}
            selectedPersonId={selectedPersonId}
            onSelectPerson={onSelectPerson}
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
                    onToggle={() => onToggleTask(task.id)}
                    flag={taskFlag(task, flagTabs)}
                  >
                    <TaskText task={task} peopleById={peopleById} />
                  </PadCheckRow>
                ))
              ) : (
                <PadNoteRow>nothing on this tab{selectedPersonId ? ' for the chosen person' : ''}</PadNoteRow>
              )}
            </LegalPad>
            <ScrollTrack listRef={pageRef} listId={pageId} contentKey={visibleTasks.map((task) => task.id).join('|')} />
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
        peopleById={peopleById}
        onReopenTask={onReopenTask}
      />
    </AtlasPanel>
  )
}
