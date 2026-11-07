/**
 * Residency tier catalog. The seven tier keys are the staff `role_key`s in
 * `atlas.roles`; `partner` and `enrollee` stay as non-tier roles. This module
 * holds the ordered key list, the per-tier metadata the User Interface (UI)
 * prints, the permission keys the database seeds per tier, and the badge and
 * ribbon rules. It imports nothing from the rest of the feature so that
 * `contracts.ts` can build `AtlasRole` from it.
 */

export const TIER_KEYS = ['t1', 't2', 't2b', 't3', 't3a', 't4', 't4plus'] as const

export type TierKey = (typeof TIER_KEYS)[number]

export type TierStatus = 'active' | 'alum'

export const TIER_DESIGNATIONS = ['warmline_operator', 'mentor', 'group_facilitator'] as const

export type TierDesignation = (typeof TIER_DESIGNATIONS)[number]

/** Lowest tier that may hold a designation. */
export const DESIGNATION_MIN_TIER: TierKey = 't2b'

/** Lowest tier that earns the badge. */
export const BADGE_MIN_TIER: TierKey = 't2'

/** Lowest tier that earns the ribbon without the employee flag. */
export const RIBBON_MIN_TIER: TierKey = 't2'

export interface TierDefinition {
  key: TierKey
  /** Short code printed on badges and alum labels: T1, T2, T2B, T3, T3A, T4, T4+. */
  code: string
  /** Role name stored on `atlas.roles.role_name`. */
  label: string
  /** Code plus label, the line shown in wallet headers and pickers. */
  identity: string
  purpose: string
  advancementQuestion: string
  /** Label kept when `tier_status` is `alum`. */
  alumLabel: string
}

const TIER_DEFINITION_LIST: TierDefinition[] = [
  {
    key: 't1',
    code: 'T1',
    label: 'Candidate',
    identity: 'T1 Candidate',
    purpose: 'Refers people in and can be sponsored into an Intentional Peer Support (IPS) Core cohort.',
    advancementQuestion: 'Am I curious?',
    alumLabel: 'T1 Alum'
  },
  {
    key: 't2',
    code: 'T2',
    label: 'Apprentice',
    identity: 'T2 Apprentice',
    purpose: 'Learns the practice inside a cohort, holds a wallet, and receives supervision.',
    advancementQuestion: 'Am I learning the practice?',
    alumLabel: 'T2 Alum'
  },
  {
    key: 't2b',
    code: 'T2B',
    label: 'Peer Resident',
    identity: 'T2B Peer Resident',
    purpose: 'Sits the warm line, takes respite shifts, engages leads, and writes enrollee profiles.',
    advancementQuestion: 'Can I hold space for others?',
    alumLabel: 'T2B Alum'
  },
  {
    key: 't3',
    code: 'T3',
    label: 'Travel Peer',
    identity: 'T3 Travel Peer',
    purpose: 'Carries the practice to a host organization on a secondment schedule.',
    advancementQuestion: 'Can I carry the practice to another site?',
    alumLabel: 'T3 Alum'
  },
  {
    key: 't3a',
    code: 'T3A',
    label: 'Peer Navigator',
    identity: 'T3A Peer Navigator',
    purpose: 'Claims pickups, plans routes, and resolves Z-code burden with enrollees.',
    advancementQuestion: 'Can I walk a route with an enrollee?',
    alumLabel: 'T3A Alum'
  },
  {
    key: 't4',
    code: 'T4',
    label: 'Supervisor',
    identity: 'T4 Supervisor',
    purpose: 'Supervises navigators and records competency assessments.',
    advancementQuestion: 'Can I grow other peers?',
    alumLabel: 'T4 Alum'
  },
  {
    key: 't4plus',
    code: 'T4+',
    label: 'Coordinator',
    identity: 'T4+ Coordinator',
    purpose: 'Stewards partners, the heat map, governance, and the fleet.',
    advancementQuestion: 'Can I steward the Residency itself?',
    alumLabel: 'T4+ Alum'
  }
]

export const TIER_DEFINITIONS: Record<TierKey, TierDefinition> = Object.fromEntries(
  TIER_DEFINITION_LIST.map((definition) => [definition.key, definition])
) as Record<TierKey, TierDefinition>

export function listTierDefinitions(): TierDefinition[] {
  return TIER_DEFINITION_LIST
}

export function isTierKey(value: unknown): value is TierKey {
  return typeof value === 'string' && (TIER_KEYS as readonly string[]).includes(value)
}

/** Position in the ladder, t1 = 0 through t4plus = 6. Non-tier roles return -1. */
export function tierRank(value: unknown): number {
  return isTierKey(value) ? TIER_KEYS.indexOf(value) : -1
}

export function tierAtLeast(value: unknown, minimum: TierKey): boolean {
  const rank = tierRank(value)
  return rank >= 0 && rank >= tierRank(minimum)
}

export function tierDefinition(value: unknown): TierDefinition | null {
  return isTierKey(value) ? TIER_DEFINITIONS[value] : null
}

/** Picker and badge label: the identity while active, the alum label after leaving. */
export function tierDisplayLabel(value: unknown, status: TierStatus = 'active'): string {
  const definition = tierDefinition(value)
  if (!definition) return typeof value === 'string' ? value : ''
  return status === 'alum' ? definition.alumLabel : definition.identity
}

export function isTierDesignation(value: unknown): value is TierDesignation {
  return typeof value === 'string' && (TIER_DESIGNATIONS as readonly string[]).includes(value)
}

export function canHoldDesignation(value: unknown): boolean {
  return tierAtLeast(value, DESIGNATION_MIN_TIER)
}

export function designationLabel(designation: TierDesignation): string {
  return designation.replace(/_/g, ' ')
}

export interface TierStanding {
  tierKey: TierKey | null
  tierStatus: TierStatus
  isLucidEmployee: boolean
  designations: TierDesignation[]
}

/** Badge rule: an active tier at or above t2. */
export function earnsBadge(standing: Pick<TierStanding, 'tierKey' | 'tierStatus'>): boolean {
  return standing.tierStatus === 'active' && tierAtLeast(standing.tierKey, BADGE_MIN_TIER)
}

/** Ribbon rule: an active tier at or above t2, or an active t1 who is a Lucid employee. */
export function earnsRibbon(standing: Pick<TierStanding, 'tierKey' | 'tierStatus' | 'isLucidEmployee'>): boolean {
  if (standing.tierStatus !== 'active') return false
  if (tierAtLeast(standing.tierKey, RIBBON_MIN_TIER)) return true
  return standing.tierKey === 't1' && standing.isLucidEmployee
}

export const ATLAS_PERMISSION_KEYS = [
  'referral.submit',
  'sponsorship.receive',
  'sponsorship.give',
  'wallet.access',
  'competency_cards.view',
  'supervision.receive',
  'supervision.give',
  'leads.engage',
  'warmline_agent.access',
  'respite_shifts.take',
  'enrollee_profile.write',
  'regulation_variables.write',
  'pickup.claim',
  'route_plan.write',
  'z_burden.resolve',
  'secondment_schedule.view',
  'partner_profile.write',
  'partner_milestones.write',
  'heatmap.view',
  'heatmap.toggle'
] as const

export type AtlasPermissionKey = (typeof ATLAS_PERMISSION_KEYS)[number]

export function isAtlasPermissionKey(value: unknown): value is AtlasPermissionKey {
  return typeof value === 'string' && (ATLAS_PERMISSION_KEYS as readonly string[]).includes(value)
}

const T2_PLUS: TierKey[] = ['t2', 't2b', 't3', 't3a', 't4', 't4plus']
const RESIDENT_SET: TierKey[] = ['t2b', 't3a', 't4', 't4plus']

/**
 * Permission keys `atlas.role_permissions` seeds per tier. The client reads
 * this table when `fn_my_permissions` is unavailable, and for the experience an
 * administrator switches into. `t4plus` also passes every key through the
 * system-administrator bypass in `fn_has_permission`.
 */
export const TIER_PERMISSION_SEED: Record<AtlasPermissionKey, TierKey[]> = {
  'referral.submit': [...TIER_KEYS],
  'sponsorship.receive': ['t1', 't2'],
  'sponsorship.give': ['t2b', 't3', 't3a', 't4', 't4plus'],
  'wallet.access': T2_PLUS,
  'competency_cards.view': T2_PLUS,
  'supervision.receive': T2_PLUS,
  'supervision.give': ['t4', 't4plus'],
  'leads.engage': RESIDENT_SET,
  'warmline_agent.access': RESIDENT_SET,
  'respite_shifts.take': RESIDENT_SET,
  'enrollee_profile.write': RESIDENT_SET,
  'regulation_variables.write': RESIDENT_SET,
  'pickup.claim': ['t3a'],
  'route_plan.write': ['t3a'],
  'z_burden.resolve': ['t3a'],
  'secondment_schedule.view': ['t3'],
  'partner_profile.write': ['t4plus'],
  'partner_milestones.write': ['t4plus'],
  'heatmap.view': ['t4plus'],
  'heatmap.toggle': ['t4plus']
}

/** Seeded keys for one tier. Non-tier roles get an empty list. */
export function tierDefaultPermissions(value: unknown): AtlasPermissionKey[] {
  if (!isTierKey(value)) return []
  return ATLAS_PERMISSION_KEYS.filter((key) => TIER_PERMISSION_SEED[key].includes(value))
}

export function tierHasDefaultPermission(value: unknown, key: AtlasPermissionKey): boolean {
  return isTierKey(value) && TIER_PERMISSION_SEED[key].includes(value)
}
