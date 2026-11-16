/**
 * Types and pure functions for the My Wallet task pad: the people it filters
 * by, its tasks and its tabs. Nothing here reads the network.
 */
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type { AtlasPermissionKey } from '@/features/atlas2026/shared/tiers'

export interface WalletPerson {
  id: string
  name: string
}

/** Days without a record after which a form's task enters the pad. One count serves every form. */
export const DUE_AFTER_DAYS = 7

/** Mental Health Self-Care Agency (MH-SCA) and Stress Vulnerability Scale (SVS). */
export type RegulationInstrument = 'mh_sca' | 'svs'

export type TaskCategory = 'enrollees' | 'leads' | 'sponsees' | 'supervision'

const TASK_CATEGORIES: readonly TaskCategory[] = ['enrollees', 'leads', 'sponsees', 'supervision']
const REGULATION_INSTRUMENTS: readonly RegulationInstrument[] = ['mh_sca', 'svs']

/**
 * One row on the pad. `id` names the task and the period it belongs to, so the
 * same form falling due in a later period is a different task. `daysWaiting`
 * is null when no record exists yet. `personName` is stored on the task, so a
 * row on the completed list prints the name after the assignment has ended.
 *
 * `buildWalletTasks` in `walletTaskBuilder.ts` writes no `contact_bridgeline`
 * and no `follow_up` task; the prototype fixtures do.
 */
export type WalletTask =
  /** Intentional Peer Support Core Competencies (IPSCC) record with one enrollee. */
  | { kind: 'ipscc_due'; id: string; personId: string; personName: string; daysWaiting: number | null }
  | { kind: 'self_reflection_due'; id: string; daysWaiting: number | null }
  | { kind: 'create_session_due'; id: string; daysWaiting: number | null }
  | { kind: 'instrument_due'; id: string; personId: string; personName: string; instrument: RegulationInstrument }
  | { kind: 'navigator_review_due'; id: string; personId: string; personName: string; daysWaiting: number | null }
  | { kind: 'navigator_create_session_due'; id: string; personId: string; personName: string; daysWaiting: number | null }
  | { kind: 'contact_bridgeline'; id: string; zCodes: string[] }
  | { kind: 'pick_up_leads'; id: string; availableCount: number }
  | { kind: 'pick_up_respite_shift'; id: string; availableCount: number | null }
  | { kind: 'follow_up'; id: string; category: TaskCategory; text: string }

export interface WalletTab {
  key: string
  label: string
  /** Fill color of the tab. */
  color: string
  /** The one category this tab lists; null lists every task. */
  category: TaskCategory | null
  /** The permission key a viewer must hold to be shown this tab; null shows it to every viewer. */
  permission: AtlasPermissionKey | null
}

/** The pad's five tabs. The enrollees tab is shown to holders of `enrollee_profile.write`: Peer Navigator and above. */
export const WALLET_TABS: WalletTab[] = [
  { key: 'all', label: 'all', color: SP_COLORS.white, category: null, permission: null },
  { key: 'enrollees', label: 'enrollees', color: SP_COLORS.deepGreen, category: 'enrollees', permission: 'enrollee_profile.write' },
  { key: 'leads', label: 'leads', color: SP_COLORS.blue, category: 'leads', permission: null },
  { key: 'sponsees', label: 'sponsees', color: SP_COLORS.yellow, category: 'sponsees', permission: null },
  { key: 'supervision', label: 'supervision', color: SP_COLORS.orange, category: 'supervision', permission: null }
]

type HasPermission = (key: AtlasPermissionKey) => boolean

/** Keeps the tabs with no permission key, and the tabs whose key the viewer holds. */
export function tabsForViewer(tabs: WalletTab[], hasPermission: HasPermission): WalletTab[] {
  return tabs.filter((tab) => tab.permission === null || hasPermission(tab.permission))
}

/**
 * Drops each task whose category has a tab the viewer is not shown. A viewer
 * without that tab's key is then shown none of that category's tasks, on any
 * tab or on the completed list.
 */
export function tasksForViewer(tasks: WalletTask[], tabs: WalletTab[], hasPermission: HasPermission): WalletTask[] {
  const shownTabs = new Set(tabsForViewer(tabs, hasPermission))
  const hiddenCategories = new Set(tabs.filter((tab) => tab.category && !shownTabs.has(tab)).map((tab) => tab.category))
  return tasks.filter((task) => !hiddenCategories.has(taskCategory(task)))
}

/** The enrollee a task belongs to, or null for a task that carries no enrollee. The person circles filter by this id. */
export function taskPersonId(task: WalletTask): string | null {
  switch (task.kind) {
    case 'ipscc_due':
    case 'instrument_due':
      return task.personId
    case 'self_reflection_due':
    case 'create_session_due':
    case 'navigator_review_due':
    case 'navigator_create_session_due':
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
export function taskCategory(task: WalletTask): TaskCategory | null {
  switch (task.kind) {
    case 'ipscc_due':
    case 'instrument_due':
    case 'contact_bridgeline':
      return 'enrollees'
    case 'create_session_due':
    case 'navigator_review_due':
    case 'navigator_create_session_due':
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
export function taskFlag(task: WalletTask, tabs: WalletTab[]): { color: string; label: string } | null {
  const category = taskCategory(task)
  if (!category) return null
  const tab = tabs.find((candidate) => candidate.category === category)
  return tab ? { color: tab.color, label: tab.label } : null
}

/** With a person chosen, keeps only that person's tasks. */
export function filterTasksByPerson(tasks: WalletTask[], personId: string | null): WalletTask[] {
  if (!personId) return tasks
  return tasks.filter((task) => taskPersonId(task) === personId)
}

/** A tab with a category keeps that category's tasks; the all-tasks tab keeps every task. */
export function filterTasksByTab(tasks: WalletTask[], tab: WalletTab): WalletTask[] {
  if (!tab.category) return tasks
  return tasks.filter((task) => taskCategory(task) === tab.category)
}

/** First word of the name, printed inside the expanded filter pill. */
export function personFirstName(person: WalletPerson): string {
  return person.name.trim().split(/\s+/)[0] || person.name
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readDaysWaiting(value: unknown): number | null | undefined {
  if (value === null) return null
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

/**
 * Reads one stored task back from JavaScript Object Notation (JSON). Returns
 * null for a value that is not a task of a kind this file lists, so a row
 * written by a later version of the app is left off the pad.
 */
export function parseWalletTask(value: unknown): WalletTask | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id || typeof value.kind !== 'string') return null
  const id = value.id
  const kind = value.kind as WalletTask['kind']
  const person =
    typeof value.personId === 'string' && value.personId && typeof value.personName === 'string'
      ? { personId: value.personId, personName: value.personName }
      : null
  const daysWaiting = readDaysWaiting(value.daysWaiting)
  switch (kind) {
    case 'ipscc_due':
    case 'navigator_review_due':
    case 'navigator_create_session_due':
      return person && daysWaiting !== undefined ? { kind, id, ...person, daysWaiting } : null
    case 'self_reflection_due':
    case 'create_session_due':
      return daysWaiting !== undefined ? { kind, id, daysWaiting } : null
    case 'instrument_due': {
      const instrument = REGULATION_INSTRUMENTS.find((candidate) => candidate === value.instrument)
      return person && instrument ? { kind, id, ...person, instrument } : null
    }
    case 'contact_bridgeline':
      return Array.isArray(value.zCodes) && value.zCodes.every((code) => typeof code === 'string')
        ? { kind, id, zCodes: value.zCodes as string[] }
        : null
    case 'pick_up_leads':
      return typeof value.availableCount === 'number' && Number.isFinite(value.availableCount)
        ? { kind, id, availableCount: value.availableCount }
        : null
    case 'pick_up_respite_shift':
      return {
        kind,
        id,
        availableCount: typeof value.availableCount === 'number' && Number.isFinite(value.availableCount) ? value.availableCount : null
      }
    case 'follow_up': {
      const category = TASK_CATEGORIES.find((candidate) => candidate === value.category)
      return category && typeof value.text === 'string' ? { kind, id, category, text: value.text } : null
    }
    default: {
      // A kind this version does not list reaches here at run time; the row is dropped.
      const unlisted: never = kind
      void unlisted
      return null
    }
  }
}
