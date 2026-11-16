/**
 * Tier, capability, and screen matrix. This is the client copy of
 * `atlas.tiers`, `atlas.capabilities`, `atlas.tier_capabilities`, and
 * `atlas.screen_capabilities`. Algorithms anchor to capability keys. Screens
 * open when the viewer holds any capability linked to that screen.
 */
import type { AtlasPermissionKey, TierKey } from '@/features/atlas2026/shared/tiers'

export const CAPABILITY_KEYS = [
  'refer',
  'be_sponsored',
  'wallet_and_competency_cards',
  'receive_supervision',
  'sponsor',
  'engage_leads',
  'warmline_and_respite',
  'enrollee_profiles_and_regulation',
  'travel_peer_schedule',
  'pickup_routes_z_burden',
  'supervise_users',
  'partner_station_operations'
] as const

export type CapabilityKey = (typeof CAPABILITY_KEYS)[number]

export interface CapabilityDefinition {
  key: CapabilityKey
  label: string
  permissionKeys: AtlasPermissionKey[]
}

export const CAPABILITY_DEFINITIONS: CapabilityDefinition[] = [
  { key: 'refer', label: 'Can refer', permissionKeys: ['referral.submit'] },
  { key: 'be_sponsored', label: 'Can be sponsored', permissionKeys: ['sponsorship.receive'] },
  { key: 'wallet_and_competency_cards', label: 'Wallet and competency cards', permissionKeys: ['wallet.access', 'competency_cards.view'] },
  { key: 'receive_supervision', label: 'Receive supervision', permissionKeys: ['supervision.receive'] },
  { key: 'sponsor', label: 'Can sponsor', permissionKeys: ['sponsorship.give'] },
  { key: 'engage_leads', label: 'Engage leads', permissionKeys: ['leads.engage'] },
  { key: 'warmline_and_respite', label: 'Warmline and respite shifts', permissionKeys: ['warmline_agent.access', 'respite_shifts.take'] },
  { key: 'enrollee_profiles_and_regulation', label: 'Enrollee profiles and regulation variables', permissionKeys: ['enrollee_profile.write', 'regulation_variables.write'] },
  { key: 'travel_peer_schedule', label: 'Travel peer schedule (secondment)', permissionKeys: ['secondment_schedule.view'] },
  { key: 'pickup_routes_z_burden', label: 'Pick up enrollees, plan routes, resolve z-burden', permissionKeys: ['pickup.claim', 'route_plan.write', 'z_burden.resolve'] },
  { key: 'supervise_users', label: 'Supervise users', permissionKeys: ['supervision.give'] },
  { key: 'partner_station_operations', label: 'Partner (station) profiles, milestones, heat map', permissionKeys: ['partner_profile.write', 'partner_milestones.write', 'heatmap.view', 'heatmap.toggle'] }
]

/**
 * Tier-to-capability bridge. t4plus does not include supervise_users. t2b does
 * not include enrollee_profiles_and_regulation, which starts at t3a.
 */
export const TIER_CAPABILITY_MATRIX: Record<TierKey, CapabilityKey[]> = {
  t1: ['refer', 'be_sponsored'],
  t2: ['refer', 'be_sponsored', 'wallet_and_competency_cards', 'receive_supervision'],
  t2b: ['refer', 'sponsor', 'wallet_and_competency_cards', 'receive_supervision', 'engage_leads', 'warmline_and_respite'],
  t3: ['refer', 'sponsor', 'wallet_and_competency_cards', 'receive_supervision', 'travel_peer_schedule'],
  t3a: ['refer', 'sponsor', 'wallet_and_competency_cards', 'receive_supervision', 'engage_leads', 'warmline_and_respite', 'enrollee_profiles_and_regulation', 'pickup_routes_z_burden'],
  t4: ['refer', 'sponsor', 'wallet_and_competency_cards', 'receive_supervision', 'engage_leads', 'warmline_and_respite', 'enrollee_profiles_and_regulation', 'supervise_users'],
  t4plus: ['refer', 'sponsor', 'wallet_and_competency_cards', 'receive_supervision', 'engage_leads', 'warmline_and_respite', 'enrollee_profiles_and_regulation', 'partner_station_operations']
}

/**
 * Screen-to-capability bridge. A screen opens when the viewer holds any
 * listed capability.
 */
export const SCREEN_CAPABILITY_MATRIX: Record<string, CapabilityKey[]> = {
  refer: ['refer'],
  'my wallet': ['wallet_and_competency_cards'],
  'competency cards': ['wallet_and_competency_cards'],
  sponsorships: ['sponsor', 'be_sponsored'],
  leads: ['engage_leads'],
  'warm line': ['warmline_and_respite'],
  'respite shifts': ['warmline_and_respite'],
  enrollees: ['enrollee_profiles_and_regulation'],
  'route planning': ['pickup_routes_z_burden'],
  'secondment schedule': ['travel_peer_schedule'],
  'team burden': ['supervise_users'],
  cohorts: ['supervise_users'],
  partners: ['partner_station_operations'],
  'county commons': ['partner_station_operations']
}

export function isCapabilityKey(value: unknown): value is CapabilityKey {
  return typeof value === 'string' && (CAPABILITY_KEYS as readonly string[]).includes(value)
}

export function capabilitiesForTier(tierKey: TierKey): CapabilityKey[] {
  return TIER_CAPABILITY_MATRIX[tierKey]
}

export function tierHasCapability(tierKey: TierKey, capabilityKey: CapabilityKey): boolean {
  return TIER_CAPABILITY_MATRIX[tierKey].includes(capabilityKey)
}

/** True when the tier holds any capability that opens the screen. */
export function tierCanOpenScreen(tierKey: TierKey, screenKey: string): boolean {
  const required = SCREEN_CAPABILITY_MATRIX[screenKey]
  if (!required?.length) return false
  const held = new Set(TIER_CAPABILITY_MATRIX[tierKey])
  return required.some((capabilityKey) => held.has(capabilityKey))
}
