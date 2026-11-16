/**
 * Completion rules for the task pad.
 *
 * Checking a task stores the time of the check. For the rest of that business
 * day the task stays on the pad, checked, and unchecking it needs no reason.
 * From the next business day on it is on the completed list, and unchecking
 * it there needs a reason.
 *
 * A business day here is the viewer's local calendar day; it ends at local
 * midnight.
 */
import type { ReadinessTask } from './walletLayoutModel'

/** The time each checked task was checked, by task id. An unchecked task has no entry. */
export type DoneAtByTaskId = Readonly<Record<string, string>>

/** One task on the completed list, with the time it was checked. */
export interface CompletedTask {
  task: ReadinessTask
  doneAtIso: string
}

/** True when `iso` falls on the same local calendar day as `now`. */
export function isSameBusinessDay(iso: string, now: Date): boolean {
  const date = new Date(iso)
  return (
    Number.isFinite(date.getTime()) &&
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

/** True for a task checked during the business day `now` is in. */
export function isCheckedToday(taskId: string, doneAtByTaskId: DoneAtByTaskId, now: Date): boolean {
  const doneAtIso = doneAtByTaskId[taskId]
  return Boolean(doneAtIso) && isSameBusinessDay(doneAtIso, now)
}

/** The pad's tasks, in their given order: the unchecked ones and the ones checked today. */
export function padTasks(tasks: ReadinessTask[], doneAtByTaskId: DoneAtByTaskId, now: Date): ReadinessTask[] {
  return tasks.filter((task) => !doneAtByTaskId[task.id] || isCheckedToday(task.id, doneAtByTaskId, now))
}

/** The completed list: the tasks checked on an earlier business day, latest check first. */
export function completedTasks(tasks: ReadinessTask[], doneAtByTaskId: DoneAtByTaskId, now: Date): CompletedTask[] {
  return tasks
    .filter((task) => doneAtByTaskId[task.id] && !isCheckedToday(task.id, doneAtByTaskId, now))
    .map((task) => ({ task, doneAtIso: doneAtByTaskId[task.id] }))
    .sort((left, right) => right.doneAtIso.localeCompare(left.doneAtIso))
}

/** The first moment of the local calendar day after the one `now` is in. */
export function startOfNextBusinessDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
}
