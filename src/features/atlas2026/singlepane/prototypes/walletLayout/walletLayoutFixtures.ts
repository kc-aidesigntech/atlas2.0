/**
 * Fixture data for the wallet layout prototype. Every person, card and task
 * below is invented. The page reads this module and sends no request.
 */
import type { AccountSettings, DomainLoad } from '@/features/atlas2026/shared/contracts'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import { TIER_DEFINITIONS, type TierKey, type TierStanding } from '@/features/atlas2026/shared/tiers'
import type { NavigatorProfileOverlayKey } from '../../components/navigatorProfile/model'
import type { DoneAtByTaskId } from './taskCompletion'
import type { AssignedEnrollee, ReadinessTab, ReadinessTask, ViewerFormAges } from './walletLayoutModel'

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

/** The viewer's assigned enrollees. Eleanor and Joe are at or past seven days without an IPSCC record. */
export const FIXTURE_ENROLLEES: AssignedEnrollee[] = [
  { id: 'person-monica', name: 'Monica L.', daysSinceLastIpscc: 2 },
  { id: 'person-sandra', name: 'Sandra P.', daysSinceLastIpscc: 5 },
  { id: 'person-joe', name: 'Joe M.', daysSinceLastIpscc: 7 },
  { id: 'person-andre', name: 'Andre W.', daysSinceLastIpscc: 3 },
  { id: 'person-eleanor', name: 'Eleanor R.', daysSinceLastIpscc: 9 }
]

/** Both of the viewer's own forms are past seven days without a record. */
export const FIXTURE_VIEWER_FORM_AGES: ViewerFormAges = {
  daysSinceLastSelfReflection: 8,
  daysSinceLastCreateSession: 12
}

export interface PrototypeWalletCard {
  id: string
  /** The `NAVIGATOR_PROFILE_CARDS` row whose variant, illustration and action label print on this card. */
  overlayId: NavigatorProfileOverlayKey
  title: string
  subtitle: string
}

/**
 * The three wallet cards, one per form. The Intentional Peer Support Core
 * Competencies (IPSCC) card names no enrollee; its form holds that choice.
 */
export const FIXTURE_CARDS: PrototypeWalletCard[] = [
  { id: 'ipscc', overlayId: 'section_1_ipscc', title: 'enrollee', subtitle: 'ipscc' },
  { id: 'self-reflection', overlayId: 'section_2_awareness', title: 'self-reflection', subtitle: 'ips' },
  { id: 'create-session', overlayId: 'section_3_create', title: 'supervisor c.r.e.a.t.e.', subtitle: 'sessions' }
]

export const FIXTURE_TABS: ReadinessTab[] = [
  { key: 'all', label: 'all', color: SP_COLORS.white, category: null, minimumTier: null },
  { key: 'enrollees', label: 'enrollees', color: SP_COLORS.deepGreen, category: 'enrollees', minimumTier: 't3a' },
  { key: 'leads', label: 'leads', color: SP_COLORS.blue, category: 'leads', minimumTier: null },
  { key: 'sponsees', label: 'sponsees', color: SP_COLORS.yellow, category: 'sponsees', minimumTier: null },
  { key: 'supervision', label: 'supervision', color: SP_COLORS.orange, category: 'supervision', minimumTier: null }
]

/** The queue's tasks other than form tasks; `buildQueue` puts the form tasks that are due above these. */
export const FIXTURE_OTHER_TASKS: ReadinessTask[] = [
  { kind: 'instrument_due', id: 'task-sandra-mh-sca', personId: 'person-sandra', instrument: 'mh_sca' },
  { kind: 'instrument_due', id: 'task-monica-svs', personId: 'person-monica', instrument: 'svs' },
  { kind: 'contact_bridgeline', id: 'task-bridgeline', zCodes: ['Z56', 'Z59'] },
  { kind: 'pick_up_leads', id: 'task-leads', availableCount: 4 },
  { kind: 'pick_up_respite_shift', id: 'task-respite' },
  { kind: 'instrument_due', id: 'task-joe-svs', personId: 'person-joe', instrument: 'svs' },
  { kind: 'follow_up', id: 'task-sponsee-dana', category: 'sponsees', text: 'check in with dana k.' },
  { kind: 'follow_up', id: 'task-supervision-create', category: 'supervision', text: 'book c.r.e.a.t.e. session with your supervisor' },
  { kind: 'follow_up', id: 'task-lead-marcus', category: 'leads', text: 'call marcus t. back' },
  { kind: 'instrument_due', id: 'task-andre-mh-sca', personId: 'person-andre', instrument: 'mh_sca' },
  { kind: 'follow_up', id: 'task-sponsee-ravi', category: 'sponsees', text: 'review ravi s. referral' },
  { kind: 'instrument_due', id: 'task-sandra-svs', personId: 'person-sandra', instrument: 'svs' },
  { kind: 'follow_up', id: 'task-supervision-notes', category: 'supervision', text: 'read supervisor notes from last session' },
  { kind: 'instrument_due', id: 'task-joe-mh-sca', personId: 'person-joe', instrument: 'mh_sca' },
  { kind: 'follow_up', id: 'task-lead-priya', category: 'leads', text: 'send intake link to priya n.' },
  { kind: 'instrument_due', id: 'task-andre-svs', personId: 'person-andre', instrument: 'svs' },
  { kind: 'follow_up', id: 'task-sponsee-cohort', category: 'sponsees', text: 'confirm cohort seat for dana k.' },
  { kind: 'instrument_due', id: 'task-monica-mh-sca', personId: 'person-monica', instrument: 'mh_sca' }
]

/** Tasks the viewer checked on earlier days. */
export const FIXTURE_EARLIER_TASKS: ReadinessTask[] = [
  { kind: 'follow_up', id: 'task-earlier-lena', category: 'leads', text: 'call lena o. back' },
  { kind: 'follow_up', id: 'task-earlier-welcome', category: 'sponsees', text: 'welcome ravi s. to the cohort' },
  { kind: 'follow_up', id: 'task-earlier-reflection', category: 'supervision', text: 'send reflection to your supervisor' }
]

const DAY_MS = 24 * 60 * 60 * 1000

/** Check times for the earlier tasks: one day, one day and three days before `now`. */
export function fixtureDoneAtByTaskId(now: Date): DoneAtByTaskId {
  const daysBefore = (days: number) => new Date(now.getTime() - days * DAY_MS).toISOString()
  return {
    'task-earlier-lena': daysBefore(1),
    'task-earlier-welcome': daysBefore(1),
    'task-earlier-reflection': daysBefore(3)
  }
}
