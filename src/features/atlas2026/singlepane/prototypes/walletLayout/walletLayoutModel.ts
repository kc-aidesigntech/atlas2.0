/**
 * Types and pure functions for the wallet layout prototype's people, queue
 * tasks and tabs. The cards carry no weekly state: a thing that falls due
 * becomes a task in the queue. Nothing here reads the network or the live
 * wallet state.
 */
import { tierAtLeast, type TierKey } from '@/features/atlas2026/shared/tiers'

export interface PrototypePerson {
  id: string
  name: string
}

/** One enrollee assigned to the viewer, with the one fact the queue reads. */
export interface AssignedEnrollee extends PrototypePerson {
  /** Whole days since the viewer's last Intentional Peer Support Core Competencies (IPSCC) record with this enrollee. */
  daysSinceLastIpscc: number
}

/** The viewer's own two forms, with the one fact each that the queue reads. */
export interface ViewerFormAges {
  daysSinceLastSelfReflection: number
  /** Whole days since the viewer's last supervisor C.R.E.A.T.E. session. */
  daysSinceLastCreateSession: number
}

/** Days without a record after which a form's task enters the queue. One count serves all three forms. */
export const DUE_AFTER_DAYS = 7

export type RegulationInstrument = 'mh_sca' | 'svs'

export type TaskCategory = 'enrollees' | 'leads' | 'sponsees' | 'supervision'

export type ReadinessTask =
  | { kind: 'ipscc_due'; id: string; personId: string; daysWaiting: number }
  | { kind: 'self_reflection_due'; id: string; daysWaiting: number }
  | { kind: 'create_session_due'; id: string; daysWaiting: number }
  | { kind: 'instrument_due'; id: string; personId: string; instrument: RegulationInstrument }
  | { kind: 'contact_bridgeline'; id: string; zCodes: string[] }
  | { kind: 'pick_up_leads'; id: string; availableCount: number }
  | { kind: 'pick_up_respite_shift'; id: string }
  | { kind: 'follow_up'; id: string; category: TaskCategory; text: string }

export interface ReadinessTab {
  key: string
  label: string
  /** Fill color of the tab. */
  color: string
  /** The one category this tab lists; null lists every task. */
  category: TaskCategory | null
  /** The lowest tier that is shown this tab; null shows it to every tier. */
  minimumTier: TierKey | null
}

/** Keeps the tabs with no minimum tier, and the tabs whose minimum tier the viewer's tier reaches. */
export function tabsForTier(tabs: ReadinessTab[], viewerTier: TierKey): ReadinessTab[] {
  return tabs.filter((tab) => tab.minimumTier === null || tierAtLeast(viewerTier, tab.minimumTier))
}

/**
 * Drops each task whose category has a tab the viewer's tier is not shown.
 * A viewer below that tab's minimum tier is then shown none of that category's
 * tasks, on any tab or on the completed list.
 */
export function tasksForTier(tasks: ReadinessTask[], tabs: ReadinessTab[], viewerTier: TierKey): ReadinessTask[] {
  const shownTabs = new Set(tabsForTier(tabs, viewerTier))
  const hiddenCategories = new Set(tabs.filter((tab) => tab.category && !shownTabs.has(tab)).map((tab) => tab.category))
  return tasks.filter((task) => !hiddenCategories.has(taskCategory(task)))
}

type DueTask = Extract<ReadinessTask, { daysWaiting: number }>

/**
 * One task per form that is at or past the due-after day count: an IPSCC task
 * per enrollee, the viewer's self-reflection, the viewer's supervisor session.
 * Longest wait first.
 */
export function dueTasks(enrollees: AssignedEnrollee[], viewer: ViewerFormAges): ReadinessTask[] {
  const candidates: DueTask[] = [
    ...enrollees.map(
      (enrollee): DueTask => ({
        kind: 'ipscc_due',
        id: `task-ipscc-${enrollee.id}`,
        personId: enrollee.id,
        daysWaiting: enrollee.daysSinceLastIpscc
      })
    ),
    { kind: 'self_reflection_due', id: 'task-self-reflection', daysWaiting: viewer.daysSinceLastSelfReflection },
    { kind: 'create_session_due', id: 'task-create-session', daysWaiting: viewer.daysSinceLastCreateSession }
  ]
  return candidates
    .filter((task) => task.daysWaiting >= DUE_AFTER_DAYS)
    .sort((left, right) => right.daysWaiting - left.daysWaiting)
}

/** The queue: the form tasks that are due, then the other tasks in their given order. */
export function buildQueue(enrollees: AssignedEnrollee[], viewer: ViewerFormAges, otherTasks: ReadinessTask[]): ReadinessTask[] {
  return [...dueTasks(enrollees, viewer), ...otherTasks]
}

/** The person a task belongs to, or null for a task that carries no person. */
export function taskPersonId(task: ReadinessTask): string | null {
  switch (task.kind) {
    case 'ipscc_due':
    case 'instrument_due':
      return task.personId
    case 'self_reflection_due':
    case 'create_session_due':
    case 'contact_bridgeline':
    case 'pick_up_leads':
    case 'pick_up_respite_shift':
    case 'follow_up':
      return null
    default: {
      const exhaustive: never = task
      return exhaustive
    }
  }
}

/** The category a task files under, or null for a task that only the all-tasks tab lists. */
export function taskCategory(task: ReadinessTask): TaskCategory | null {
  switch (task.kind) {
    case 'ipscc_due':
    case 'instrument_due':
    case 'contact_bridgeline':
      return 'enrollees'
    case 'create_session_due':
      return 'supervision'
    case 'pick_up_leads':
      return 'leads'
    case 'self_reflection_due':
    case 'pick_up_respite_shift':
      return null
    case 'follow_up':
      return task.category
    default: {
      const exhaustive: never = task
      return exhaustive
    }
  }
}

/** The flag a task's row prints: the color and label of the tab that lists the task's category; null for a task with no category. */
export function taskFlag(task: ReadinessTask, tabs: ReadinessTab[]): { color: string; label: string } | null {
  const category = taskCategory(task)
  if (!category) return null
  const tab = tabs.find((candidate) => candidate.category === category)
  return tab ? { color: tab.color, label: tab.label } : null
}

/** With a person chosen, keeps only that person's tasks. */
export function filterTasksByPerson(tasks: ReadinessTask[], personId: string | null): ReadinessTask[] {
  if (!personId) return tasks
  return tasks.filter((task) => taskPersonId(task) === personId)
}

/** A tab with a category keeps that category's tasks; the all-tasks tab keeps every task. */
export function filterTasksByTab(tasks: ReadinessTask[], tab: ReadinessTab): ReadinessTask[] {
  if (!tab.category) return tasks
  return tasks.filter((task) => taskCategory(task) === tab.category)
}

/** First word of the name, printed inside the expanded filter pill. */
export function personFirstName(person: PrototypePerson): string {
  return person.name.trim().split(/\s+/)[0] || person.name
}
