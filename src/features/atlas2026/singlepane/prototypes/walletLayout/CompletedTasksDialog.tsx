/**
 * The completed list: the same legal pad in a modal overlay, listing only the
 * tasks checked on an earlier day. Pressing a row's checkbox opens the reason
 * field under the pad; the row is unchecked when a reason is submitted.
 */
import React from 'react'
import {
  Close as RadixDialogClose,
  Content as RadixDialogContent,
  type DialogDescriptionProps,
  type DialogOverlayProps,
  type DialogTitleProps
} from '@radix-ui/react-dialog'
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog'
import { AtlasCloseButton, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import LegalPad, { PadCheckRow, PadNoteRow } from './LegalPad'
import ScrollTrack from './ScrollTrack'
import type { CompletedTask } from './taskCompletion'
import TaskText from './TaskText'
import { filterTasksByTab, taskFlag, type PrototypePerson, type ReadinessTab } from './walletLayoutModel'

// The shared wrapper is a `.jsx` file, so its components reach TypeScript with no props.
// These names are the same components read with the Radix prop types.
// The wrapper's `DialogContent` is not used: `.atlas-sign-button` sets `position: relative` on its close
// button, which then prints in the content's flow, under the pad. This file places the Radix content and
// the close button itself.
const PadDialogOverlay = DialogOverlay as React.ComponentType<DialogOverlayProps>
const PadDialogTitle = DialogTitle as React.ComponentType<DialogTitleProps>
const PadDialogDescription = DialogDescription as React.ComponentType<DialogDescriptionProps>

const CHECKED_ON_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

interface CompletedTasksDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The button that opened the overlay; it takes focus when the overlay closes. */
  returnFocusRef: React.RefObject<HTMLElement>
  tabs: ReadinessTab[]
  flagTabs: ReadinessTab[]
  completed: CompletedTask[]
  peopleById: ReadonlyMap<string, PrototypePerson>
  onReopenTask: (taskId: string, reason: string) => void
}

export default function CompletedTasksDialog({
  open,
  onOpenChange,
  returnFocusRef,
  tabs,
  flagTabs,
  completed,
  peopleById,
  onReopenTask
}: CompletedTasksDialogProps) {
  const pageRef = React.useRef<HTMLDivElement>(null)
  const pageId = React.useId()
  const reasonInputId = React.useId()
  const [activeTabKey, setActiveTabKey] = React.useState(tabs[0]?.key ?? '')
  const [pendingTaskId, setPendingTaskId] = React.useState<string | null>(null)
  const [reason, setReason] = React.useState('')
  const activeTab = tabs.find((tab) => tab.key === activeTabKey) ?? tabs[0] ?? null
  const visibleTaskIds = new Set(
    activeTab
      ? filterTasksByTab(
          completed.map((entry) => entry.task),
          activeTab
        ).map((task) => task.id)
      : []
  )
  const visibleCompleted = completed.filter((entry) => visibleTaskIds.has(entry.task.id))
  const pending = completed.find((entry) => entry.task.id === pendingTaskId) ?? null
  const trimmedReason = reason.trim()

  function closeReasonField() {
    setPendingTaskId(null)
    setReason('')
  }

  function handleOpenChange(nextOpen: boolean) {
    // Closing the overlay drops a reason that was typed and not submitted.
    if (!nextOpen) closeReasonField()
    onOpenChange(nextOpen)
  }

  function submitReason(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!pending || !trimmedReason) return
    onReopenTask(pending.task.id, trimmedReason)
    closeReasonField()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <PadDialogOverlay />
        <RadixDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnFocusRef.current?.focus()
          }}
          className="atlas-surface-panel fixed left-1/2 top-1/2 z-50 flex h-[min(88vh,760px)] w-[calc(100vw-2rem)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 p-5 text-white"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <PadDialogTitle className="text-[20px] font-medium text-white">completed tasks</PadDialogTitle>
              <PadDialogDescription className="atlas-caption mt-1 text-[#b1bcc8]">
                checked on an earlier day · unchecking one needs a reason
              </PadDialogDescription>
            </div>
            <RadixDialogClose asChild>
              <AtlasCloseButton />
            </RadixDialogClose>
          </div>
          <div className="relative min-h-0 flex-1">
            <div className="absolute inset-0 flex gap-3">
              <LegalPad tabs={tabs} activeTabKey={activeTab?.key ?? ''} onSelectTab={setActiveTabKey} pageRef={pageRef} pageId={pageId}>
                {visibleCompleted.length ? (
                  visibleCompleted.map(({ task, doneAtIso }) => (
                    <PadCheckRow
                      key={task.id}
                      checked
                      fadeWhenChecked={false}
                      // The box stays checked; the press opens the reason field for this row.
                      onToggle={() => {
                        setPendingTaskId(task.id)
                        setReason('')
                      }}
                      trailing={CHECKED_ON_FORMAT.format(new Date(doneAtIso))}
                      flag={taskFlag(task, flagTabs)}
                    >
                      <TaskText task={task} peopleById={peopleById} />
                    </PadCheckRow>
                  ))
                ) : (
                  <PadNoteRow>no completed tasks on this tab</PadNoteRow>
                )}
              </LegalPad>
              <ScrollTrack listRef={pageRef} listId={pageId} contentKey={visibleCompleted.map((entry) => entry.task.id).join('|')} />
            </div>
          </div>
          {pending ? (
            <form onSubmit={submitReason} className="flex flex-col gap-2">
              <label htmlFor={reasonInputId} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="atlas-field-label">reason for unchecking</span>
                <span className="flex min-w-0 items-center gap-2 text-[15px] text-white">
                  <TaskText task={pending.task} peopleById={peopleById} />
                </span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  // Keyed by task, so choosing another row mounts a fresh field and moves focus into it.
                  key={pending.task.id}
                  id={reasonInputId}
                  autoFocus
                  required
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="atlas-input min-w-[180px] flex-1"
                />
                <AtlasTextButton type="submit" disabled={!trimmedReason} className="px-3 text-[14px]">
                  uncheck
                </AtlasTextButton>
                <AtlasTextButton onClick={closeReasonField} className="px-3 text-[14px]" style={{ ['--button-border-color' as const]: '#ffffff30' } as React.CSSProperties}>
                  cancel
                </AtlasTextButton>
              </div>
            </form>
          ) : null}
        </RadixDialogContent>
      </DialogPortal>
    </Dialog>
  )
}
