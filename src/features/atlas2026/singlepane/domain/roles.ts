import type { AtlasRole } from '@/features/atlas2026/shared/contracts'

export function normalizeAtlasRoleKeys(values: string[]): AtlasRole[] {
  return values.filter((value): value is AtlasRole => value === 'administrator' || value === 'supervisor' || value === 'partner' || value === 'navigator')
}

export function haveSameRoles(left: AtlasRole[], right: AtlasRole[]) {
  if (left.length !== right.length) return false
  const a = [...left].sort()
  const b = [...right].sort()
  return a.every((value, index) => value === b[index])
}

// The authenticated JSON Web Token (JWT)'s app_metadata is the database-signed source of truth for identity, so we
// derive the account's real role(s) from it. `atlas_role` is the primary claim; `atlas_roles` is an
// optional array supporting legitimately multi-role accounts. The result is primary-first and
// de-duplicated so callers can clamp the User Interface (UI) to roles the account was actually granted.
export function extractAuthoritativeRolesFromSession(
  session: { user?: { app_metadata?: Record<string, unknown> | null } | null } | null | undefined
): AtlasRole[] {
  const appMetadata = (session?.user?.app_metadata || {}) as { atlas_role?: unknown; atlas_roles?: unknown }
  const primary = typeof appMetadata.atlas_role === 'string' ? appMetadata.atlas_role : ''
  const additional = Array.isArray(appMetadata.atlas_roles)
    ? appMetadata.atlas_roles.filter((value): value is string => typeof value === 'string')
    : []
  const ordered = normalizeAtlasRoleKeys([primary, ...additional])
  return ordered.filter((value, index) => ordered.indexOf(value) === index)
}
export function dedupeMenus(menus: string[]) {
  return Array.from(new Set(menus.map((menu) => menu.trim()).filter(Boolean)))
}

export function toRemoteSessionErrorMessage(role: AtlasRole) {
  if (role === 'partner') return 'Partner troubleshooting is unavailable until the partner grants access.'
  return 'Unable to start troubleshooting session.'
}
