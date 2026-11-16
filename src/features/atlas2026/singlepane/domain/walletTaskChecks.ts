/**
 * Completion rules for the My Wallet task pad.
 *
 * Checking a task stores the task and the time of the check. For the rest of
 * that business day the task stays on the pad, checked, and unchecking it
 * needs no reason. From the next business day on it is on the completed list,
 * and unchecking it there needs a reason.
 *
 * A business day here is the viewer's local calendar day; it ends at local
 * midnight.
 */
import type { WalletTask } from './walletTasks'

/** One checked task: the task as it read when it was checked, and the time of the check. */
export interface WalletTaskCheck {
  taskId: string
  task: WalletTask
  doneAtIso: string
}

/** One task on the completed list, with the time it was checked. */
export interface CompletedTask {
  task: WalletTask
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

/** The ids of the tasks checked during the business day `now` is in. */
export function checkedTodayIds(checks: WalletTaskCheck[], now: Date): Set<string> {
  return new Set(checks.filter((check) => isSameBusinessDay(check.doneAtIso, now)).map((check) => check.taskId))
}

/**
 * The pad's tasks. First the due tasks, in their given order, that are
 * unchecked or were checked today. Then the tasks checked today that are no
 * longer due, as they read when they were checked. A due task checked on an
 * earlier day is left off; it is on the completed list.
 */
export function padTasks(dueTasks: WalletTask[], checks: WalletTaskCheck[], now: Date): WalletTask[] {
  const checkedIds = new Set(checks.map((check) => check.taskId))
  const todayIds = checkedTodayIds(checks, now)
  const dueIds = new Set(dueTasks.map((task) => task.id))
  return [
    ...dueTasks.filter((task) => !checkedIds.has(task.id) || todayIds.has(task.id)),
    ...checks.filter((check) => todayIds.has(check.taskId) && !dueIds.has(check.taskId)).map((check) => check.task)
  ]
}

/** The completed list: the tasks checked on an earlier business day, latest check first. */
export function completedTasks(checks: WalletTaskCheck[], now: Date): CompletedTask[] {
  return checks
    .filter((check) => !isSameBusinessDay(check.doneAtIso, now))
    .map((check) => ({ task: check.task, doneAtIso: check.doneAtIso }))
    .sort((left, right) => right.doneAtIso.localeCompare(left.doneAtIso))
}

/** The first moment of the local calendar day after the one `now` is in. */
export function startOfNextBusinessDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
}
