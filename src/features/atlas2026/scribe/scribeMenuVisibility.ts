import type { AtlasRole } from '@/features/atlas2026/shared/contracts'
import { ATLAS_ROLE_KEYS, normalizeAtlasRoleKey } from '@/features/atlas2026/singlepane/domain/roles'

/** Workspace menu label stored on atlas.app_role_navigation.top_menus. */
export const SCRIBE_MENU_LABEL = 'scribe'

/** Roles with a single-pane menu list an administrator can edit: the seven tiers and partner. */
export const SCRIBE_MENU_ROLES: readonly AtlasRole[] = ATLAS_ROLE_KEYS

/** Maps a stored `role_key` (tier, partner, or a legacy navigator/supervisor/administrator row) onto its role; null for anything else. */
export function toScribeMenuRole(value: string): AtlasRole | null {
  const role = normalizeAtlasRoleKey(value)
  return role && SCRIBE_MENU_ROLES.includes(role) ? role : null
}

export function isScribeMenuRole(value: string): value is AtlasRole {
  return toScribeMenuRole(value) !== null
}

export function menuListIncludesScribe(menus: readonly string[]) {
  return menus.some((menu) => menu.trim().toLowerCase() === SCRIBE_MENU_LABEL)
}

/**
 * Add or remove the scribe entry without disturbing the rest of a role's menu.
 * Hidden means the label is absent, so later enables append it at the end.
 */
export function setScribeOnMenuList(menus: readonly string[], visible: boolean) {
  const withoutScribe = menus.filter((menu) => menu.trim().toLowerCase() !== SCRIBE_MENU_LABEL)
  return visible ? [...withoutScribe, SCRIBE_MENU_LABEL] : withoutScribe
}
