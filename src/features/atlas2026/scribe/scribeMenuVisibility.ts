import type { AtlasRole } from '@/features/atlas2026/shared/contracts'

/** Workspace menu label stored on atlas.app_role_navigation.top_menus. */
export const SCRIBE_MENU_LABEL = 'scribe'

/** Permission levels that have a single-pane menu list an administrator can edit. */
export const SCRIBE_MENU_ROLES: readonly AtlasRole[] = ['administrator', 'supervisor', 'navigator', 'partner']

export function isScribeMenuRole(value: string): value is AtlasRole {
  return (SCRIBE_MENU_ROLES as readonly string[]).includes(value)
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
