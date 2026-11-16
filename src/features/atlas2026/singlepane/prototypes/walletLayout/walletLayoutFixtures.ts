/**
 * Fixture data for the wallet layout prototype. Every person and task below
 * is invented. The page reads this module and sends no request.
 */
import type { AccountSettings, DomainLoad } from '@/features/atlas2026/shared/contracts'
import { TIER_DEFINITIONS, type TierKey, type TierStanding } from '@/features/atlas2026/shared/tiers'
import type { WalletTaskCheck } from '@/features/atlas2026/singlepane/domain/walletTaskChecks'
import { DUE_AFTER_DAYS, type WalletPerson, type WalletTask } from '@/features/atlas2026/singlepane/domain/walletTasks'

export const FIXTURE_DISPLAY_NAME = 'Alex Rivera'

/** The tiers the control strip can show the page as: one below Peer Navigator, and Peer Navigator. */
export const FIXTURE_VIEWER_TIERS: TierKey[] = ['t2b', 't3a']

export const FIXTURE_DEFAULT_VIEWER_TIER: TierKey = 't3a'

export function fixtureTierLabel(tierKey: TierKey): string {
  return TIER_DEFINITIONS[tierKey].identity
}

export function fixtureAccount(tierKey: TierKey): AccountSettings {
  return {
    fullName: FIXTURE_DISPLAY_NAME,
    email: 'alex.rivera@example.org',
    organization: 'Lucid Living',
    avatarUrl: null,
    enabledRoles: [tierKey]
  }
}

export function fixtureStanding(tierKey: TierKey): TierStanding {
  return { tierKey, tierStatus: 'active', isLucidEmployee: false, designations: [] }
}

export const FIXTURE_LOAD: DomainLoad = {
  enrolleeId: 'prototype-aggregate',
  habitat: 4.2,
  work: 3.1,
  socialNetworks: 5.4
}

/** The top band's count lines. The enrollee count is left out for a viewer who is shown no enrollee tasks. */
export function fixtureMetaLines(seesEnrollees: boolean) {
  const competencyCards = { label: 'Competency cards', value: 3 }
  return seesEnrollees ? [{ label: 'Assigned enrollees', value: FIXTURE_ENROLLEES.length }, competencyCards] : [competencyCards]
}

/** One enrollee assigned to the viewer, with the one fact the fixture queue reads. */
interface FixtureEnrollee extends WalletPerson {
  /** Whole days since the viewer's last Intentional Peer Support Core Competencies (IPSCC) record with this enrollee. */
  daysSinceLastIpscc: number
}

/** The viewer's assigned enrollees. Eleanor and Joe are at or past seven days without an IPSCC record. */
export const FIXTURE_ENROLLEES: FixtureEnrollee[] = [
  { id: 'person-monica', name: 'Monica L.', daysSinceLastIpscc: 2 },
  { id: 'person-sandra', name: 'Sandra P.', daysSinceLastIpscc: 5 },
  { id: 'person-joe', name: 'Joe M.', daysSinceLastIpscc: 7 },
  { id: 'person-andre', name: 'Andre W.', daysSinceLastIpscc: 3 },
  { id: 'person-eleanor', name: 'Eleanor R.', daysSinceLastIpscc: 9 }
]

function fixturePersonName(personId: string): string {
  return FIXTURE_ENROLLEES.find((enrollee) => enrollee.id === personId)?.name ?? 'unknown person'
}

function instrumentTask(id: string, personId: string, instrument: 'mh_sca' | 'svs'): WalletTask {
  return { kind: 'instrument_due', id, personId, personName: fixturePersonName(personId), instrument }
}

type FixtureFormTask = Extract<WalletTask, { daysWaiting: number | null }>

/**
 * The form tasks at or past the due-after day count, longest wait first: one
 * IPSCC task per enrollee, the self-reflection (8 days) and the supervisor
 * session (12 days).
 */
const FIXTURE_FORM_TASKS: FixtureFormTask[] = [
  ...FIXTURE_ENROLLEES.filter((enrollee) => enrollee.daysSinceLastIpscc >= DUE_AFTER_DAYS).map(
    (enrollee): FixtureFormTask => ({
      kind: 'ipscc_due',
      id: `task-ipscc-${enrollee.id}`,
      personId: enrollee.id,
      personName: enrollee.name,
      daysWaiting: enrollee.daysSinceLastIpscc
    })
  ),
  { kind: 'self_reflection_due', id: 'task-self-reflection', daysWaiting: 8 },
  { kind: 'create_session_due', id: 'task-create-session', daysWaiting: 12 }
]

/** The fixture queue: the form tasks above, then the other tasks in the order written here. */
const FIXTURE_QUEUE: WalletTask[] = [
  ...FIXTURE_FORM_TASKS.slice().sort((left, right) => (right.daysWaiting ?? 0) - (left.daysWaiting ?? 0)),
  instrumentTask('task-sandra-mh-sca', 'person-sandra', 'mh_sca'),
  instrumentTask('task-monica-svs', 'person-monica', 'svs'),
  { kind: 'contact_bridgeline', id: 'task-bridgeline', zCodes: ['Z56', 'Z59'] },
  { kind: 'pick_up_leads', id: 'task-leads', availableCount: 4 },
  { kind: 'pick_up_respite_shift', id: 'task-respite', availableCount: null },
  instrumentTask('task-joe-svs', 'person-joe', 'svs'),
  { kind: 'follow_up', id: 'task-sponsee-dana', category: 'sponsees', text: 'check in with dana k.' },
  { kind: 'follow_up', id: 'task-supervision-create', category: 'supervision', text: 'book c.r.e.a.t.e. session with your supervisor' },
  { kind: 'follow_up', id: 'task-lead-marcus', category: 'leads', text: 'call marcus t. back' },
  instrumentTask('task-andre-mh-sca', 'person-andre', 'mh_sca'),
  { kind: 'follow_up', id: 'task-sponsee-ravi', category: 'sponsees', text: 'review ravi s. referral' },
  instrumentTask('task-sandra-svs', 'person-sandra', 'svs'),
  { kind: 'follow_up', id: 'task-supervision-notes', category: 'supervision', text: 'read supervisor notes from last session' },
  instrumentTask('task-joe-mh-sca', 'person-joe', 'mh_sca'),
  { kind: 'follow_up', id: 'task-lead-priya', category: 'leads', text: 'send intake link to priya n.' },
  instrumentTask('task-andre-svs', 'person-andre', 'svs'),
  { kind: 'follow_up', id: 'task-sponsee-cohort', category: 'sponsees', text: 'confirm cohort seat for dana k.' },
  instrumentTask('task-monica-mh-sca', 'person-monica', 'mh_sca')
]

/** Three tasks that are still due and that the viewer checked on earlier days. */
const FIXTURE_EARLIER_TASKS: WalletTask[] = [
  { kind: 'follow_up', id: 'task-earlier-lena', category: 'leads', text: 'call lena o. back' },
  { kind: 'follow_up', id: 'task-earlier-welcome', category: 'sponsees', text: 'welcome ravi s. to the cohort' },
  { kind: 'follow_up', id: 'task-earlier-reflection', category: 'supervision', text: 'send reflection to your supervisor' }
]

/** Every fixture task that is due: the queue, then the earlier tasks. An earlier task that is unchecked returns to the end of the pad. */
export const FIXTURE_DUE_TASKS: WalletTask[] = [...FIXTURE_QUEUE, ...FIXTURE_EARLIER_TASKS]

const DAY_MS = 24 * 60 * 60 * 1000

/** Checks for the earlier tasks: one day, one day and three days before `now`. */
export function fixtureEarlierChecks(now: Date): WalletTaskCheck[] {
  const daysBefore = [1, 1, 3]
  return FIXTURE_EARLIER_TASKS.map((task, index) => ({
    taskId: task.id,
    task,
    doneAtIso: new Date(now.getTime() - daysBefore[index] * DAY_MS).toISOString()
  }))
}
