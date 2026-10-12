/**
 * Path routes for the Atlas workspace. Each menu is a page under /app so the
 * shell can load only that page's data instead of every screen at once.
 */
import { useEffect, useState } from 'react'

export type WorkspaceDataScope =
  | 'wallet'
  | 'enrollee-strip'
  | 'team-burden'
  | 'partner-station'
  | 'service-capacity'
  | 'admin'
  | 'referral'

interface WorkspacePage {
  menu: string
  path: string
  scopes: WorkspaceDataScope[]
}

export const WORKSPACE_PAGES: WorkspacePage[] = [
  { menu: 'my wallet', path: 'my-wallet', scopes: ['wallet'] },
  { menu: 'enrollees', path: 'enrollees', scopes: ['enrollee-strip'] },
  { menu: 'refer', path: 'refer', scopes: ['referral'] },
  { menu: 'referral portal', path: 'referral-portal', scopes: ['referral'] },
  { menu: 'my station', path: 'my-station', scopes: ['partner-station'] },
  { menu: 'service capacity', path: 'service-capacity', scopes: ['service-capacity', 'partner-station'] },
  { menu: 'team burden', path: 'team-burden', scopes: ['team-burden', 'enrollee-strip'] },
  { menu: 'system operations', path: 'system-operations', scopes: ['admin'] },
  { menu: 'governance', path: 'governance', scopes: ['admin'] },
  { menu: 'assigned enrollees', path: 'assigned-enrollees', scopes: ['enrollee-strip', 'admin'] },
  { menu: 'route planning', path: 'route-planning', scopes: ['enrollee-strip'] },
  { menu: 'warm line', path: 'warm-line', scopes: [] },
  { menu: 'scribe', path: 'scribe', scopes: [] },
  { menu: 'fleet', path: 'fleet', scopes: [] },
  { menu: 'county commons', path: 'county-commons', scopes: ['admin'] }
]

const LEGACY_MENU_SLUGS: Record<string, string> = {
  'assigned-navigators': 'my wallet',
  'navigator-assessments': 'my wallet',
  'my-profile': 'my wallet',
  'requests-to-enroll': 'my wallet'
}

export const WORKSPACE_NAVIGATE_EVENT = 'atlas-workspace-navigate'

export function workspaceScopesInclude(scopes: WorkspaceDataScope[], scope: WorkspaceDataScope) {
  return scopes.includes(scope)
}

export function needsEnrolleeStrip(scopes: WorkspaceDataScope[]) {
  return scopes.includes('enrollee-strip') || scopes.includes('team-burden')
}

export function needsPartnerStation(scopes: WorkspaceDataScope[]) {
  return scopes.includes('partner-station') || scopes.includes('service-capacity')
}

function slugifyMenu(menu: string) {
  return menu
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function menuToWorkspacePath(menu: string) {
  const known = WORKSPACE_PAGES.find((page) => page.menu === menu.trim().toLowerCase())
  return `/app/${known?.path || slugifyMenu(menu)}`
}

function menuFromSlug(slug: string, menus: string[]) {
  const normalized = slug.trim().toLowerCase()
  if (!normalized) return null
  const legacy = LEGACY_MENU_SLUGS[normalized]
  if (legacy && menus.includes(legacy)) return legacy
  const known = WORKSPACE_PAGES.find((page) => page.path === normalized)
  if (known && menus.includes(known.menu)) return known.menu
  return menus.find((menu) => slugifyMenu(menu) === normalized) || null
}

export function workspaceMenuFromLocation(pathname: string, hash: string, menus: string[]) {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean)
  const pathSlug = parts[0] === 'app' ? parts[1] || '' : ''
  return menuFromSlug(pathSlug, menus) || menuFromSlug(hash.replace(/^#/, ''), menus)
}

export function scopesFromLocation(pathname: string, hash: string): WorkspaceDataScope[] {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean)
  const slug = (parts[0] === 'app' ? parts[1] : '') || hash.replace(/^#/, '')
  const normalized = slug.trim().toLowerCase()
  const legacyMenu = LEGACY_MENU_SLUGS[normalized]
  const page = WORKSPACE_PAGES.find((item) => item.path === normalized || item.menu === legacyMenu)
  return page?.scopes || []
}

export function navigateWorkspace(menu: string, mode: 'push' | 'replace' = 'push') {
  if (typeof window === 'undefined') return
  const nextUrl = `${menuToWorkspacePath(menu)}${window.location.search}`
  const currentUrl = `${window.location.pathname}${window.location.search}`
  if (currentUrl === nextUrl && !window.location.hash) return
  if (mode === 'replace') window.history.replaceState(null, '', nextUrl)
  else window.history.pushState(null, '', nextUrl)
  window.dispatchEvent(new Event(WORKSPACE_NAVIGATE_EVENT))
}

export function useWorkspaceDataScopes() {
  const [scopes, setScopes] = useState<WorkspaceDataScope[]>(() =>
    typeof window === 'undefined' ? [] : scopesFromLocation(window.location.pathname, window.location.hash)
  )
  useEffect(() => {
    const sync = () => setScopes(scopesFromLocation(window.location.pathname, window.location.hash))
    window.addEventListener('popstate', sync)
    window.addEventListener(WORKSPACE_NAVIGATE_EVENT, sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener(WORKSPACE_NAVIGATE_EVENT, sync)
    }
  }, [])
  return scopes
}
