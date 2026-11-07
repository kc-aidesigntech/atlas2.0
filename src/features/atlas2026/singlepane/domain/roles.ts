import type { AdminPortalPersonRole, AtlasRole, SupervisionParty } from '@/features/atlas2026/shared/contracts'
import { TIER_KEYS, isTierKey, tierAtLeast, tierRank, type TierKey } from '@/features/atlas2026/shared/tiers'

export { TIER_KEYS, isTierKey, tierAtLeast, tierRank }
export type { TierKey }

/**
 * Role keys that JSON Web Token (JWT) claims and older database rows still
 * carry. Each one maps onto the tier that replaced it. This table is the only
 * place the legacy words appear as role values.
 */
const LEGACY_ROLE_ALIASES: Record<string, AtlasRole> = {
  administrator: 't4plus',
  supervisor: 't4',
  navigator: 't3a'
}

export const ATLAS_ROLE_KEYS: readonly AtlasRole[] = [...TIER_KEYS, 'partner']

export const ADMIN_PORTAL_PERSON_ROLE_KEYS: readonly AdminPortalPersonRole[] = [...ATLAS_ROLE_KEYS, 'enrollee']

/**
 * Lower-cases and trims one raw role value, swaps a legacy alias for its tier,
 * and returns the role key or null when the value is not a known role.
 * `enrollee` passes through because the admin portal lists it as a role.
 */
export function normalizeRoleKey(value: unknown): AdminPortalPersonRole | null {
  if (typeof value !== 'string') return null
  const key = value.trim().toLowerCase()
  if (!key) return null
  const aliased = LEGACY_ROLE_ALIASES[key]
  if (aliased) return aliased
  return (ADMIN_PORTAL_PERSON_ROLE_KEYS as readonly string[]).includes(key) ? (key as AdminPortalPersonRole) : null
}

/** Same as `normalizeRoleKey` but drops `enrollee`, so the result is a workspace role. */
export function normalizeAtlasRoleKey(value: unknown): AtlasRole | null {
  const key = normalizeRoleKey(value)
  return key && key !== 'enrollee' ? key : null
}

function dedupe<T>(values: T[]): T[] {
  return values.filter((value, index) => values.indexOf(value) === index)
}

/** Workspace roles from raw strings, aliases mapped, order kept, duplicates dropped. */
export function normalizeAtlasRoleKeys(values: unknown[]): AtlasRole[] {
  return dedupe(values.map(normalizeAtlasRoleKey).filter((value): value is AtlasRole => value !== null))
}

/** Admin-portal roles from raw strings, aliases mapped, `enrollee` kept. */
export function normalizePersonRoleKeys(values: unknown[]): AdminPortalPersonRole[] {
  return dedupe(values.map(normalizeRoleKey).filter((value): value is AdminPortalPersonRole => value !== null))
}

export function isAtlasRole(value: unknown): value is AtlasRole {
  return value === 'partner' || isTierKey(value)
}

/** `t4plus` is the system administrator: the database bypass and the admin shell. */
export function isSystemAdmin(role: unknown): boolean {
  return role === 't4plus'
}

/** Tiers that supervise: `t4` and `t4plus`. */
export function isSupervisorTier(role: unknown): boolean {
  return role === 't4' || role === 't4plus'
}

/** Tiers that carry enrollees: `t3a` and `t2b`. */
export function isNavigatorTier(role: unknown): boolean {
  return role === 't3a' || role === 't2b'
}

/** Roles that can be the subject of a tier action: any tier key. */
export function isStaffTier(role: unknown): role is TierKey {
  return isTierKey(role)
}

/** The one tier key in a person's role list, highest rank wins when rows disagree. */
export function primaryTierOf(roles: readonly string[]): TierKey | null {
  const tiers = roles.filter(isTierKey)
  if (!tiers.length) return null
  return tiers.reduce((best, candidate) => (tierRank(candidate) > tierRank(best) ? candidate : best))
}

/** Highest-ranked workspace role in a list, `partner` only when no tier is present. */
export function primaryAtlasRoleOf(roles: readonly AtlasRole[]): AtlasRole | null {
  return primaryTierOf(roles) || (roles.includes('partner') ? 'partner' : null)
}

/**
 * Which single-pane shell a role renders. Exactly one shell per role so the
 * administrator superset, supervisor wallet, and navigator strip never overlap.
 * `member` covers t1, t2, and t3, which only get the menus their row lists.
 */
export type WorkspaceExperience = 'administrator' | 'supervisor' | 'navigator' | 'partner' | 'member'

export function workspaceExperience(role: AtlasRole): WorkspaceExperience {
  if (role === 'partner') return 'partner'
  if (isSystemAdmin(role)) return 'administrator'
  if (isSupervisorTier(role)) return 'supervisor'
  if (isNavigatorTier(role)) return 'navigator'
  return 'member'
}

export function isAdministratorExperience(role: AtlasRole): boolean {
  return workspaceExperience(role) === 'administrator'
}

export function isSupervisorExperience(role: AtlasRole): boolean {
  return workspaceExperience(role) === 'supervisor'
}

export function isNavigatorExperience(role: AtlasRole): boolean {
  return workspaceExperience(role) === 'navigator'
}

/**
 * Party a role plays in a supervision record: supervisor tiers sit on the
 * supervisor side, navigator tiers on the navigator side, everyone else null.
 */
export function toSupervisionParty(role: AtlasRole): SupervisionParty | null {
  if (isSupervisorTier(role)) return 'supervisor'
  if (isNavigatorTier(role)) return 'navigator'
  return null
}

export function haveSameRoles(left: AtlasRole[], right: AtlasRole[]) {
  if (left.length !== right.length) return false
  const a = [...left].sort()
  const b = [...right].sort()
  return a.every((value, index) => value === b[index])
}

// The authenticated JWT's app_metadata is the database-signed source of truth for identity, so we
// derive the account's real role(s) from it. `atlas_role` is the primary claim; `atlas_roles` is an
// optional array supporting legitimately multi-role accounts. Legacy claim values are mapped to
// tiers here. The result is primary-first and de-duplicated so callers can clamp the
// User Interface (UI) to roles the account was actually granted.
export function extractAuthoritativeRolesFromSession(
  session: { user?: { app_metadata?: Record<string, unknown> | null } | null } | null | undefined
): AtlasRole[] {
  const appMetadata = (session?.user?.app_metadata || {}) as { atlas_role?: unknown; atlas_roles?: unknown }
  const primary = typeof appMetadata.atlas_role === 'string' ? appMetadata.atlas_role : ''
  const additional = Array.isArray(appMetadata.atlas_roles)
    ? appMetadata.atlas_roles.filter((value): value is string => typeof value === 'string')
    : []
  return normalizeAtlasRoleKeys([primary, ...additional])
}

export function dedupeMenus(menus: string[]) {
  return Array.from(new Set(menus.map((menu) => menu.trim()).filter(Boolean)))
}

export function toRemoteSessionErrorMessage(role: AtlasRole) {
  if (role === 'partner') return 'Partner troubleshooting is unavailable until the partner grants access.'
  return 'Unable to start troubleshooting session.'
}
