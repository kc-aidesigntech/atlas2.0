import type { AtlasRole, TroubleshootingSessionState } from '@/features/atlas2026/shared/contracts'

export const SESSION_ROLE_KEY = 'atlas2026.singlepane.session.role'
export const SESSION_ACTIVE_MENU_KEY = 'atlas2026.singlepane.session.active-menu'
export const SESSION_SELECTED_ENROLLEE_KEY = 'atlas2026.singlepane.session.selected-enrollee'
export const SESSION_REMOTE_SESSION_KEY = 'atlas2026.singlepane.session.remote-session'

// sessionStorage access can throw (e.g. Safari private mode, storage disabled by policy).
// These helpers swallow those failures so session persistence degrades to in-memory-only
// rather than crashing the workspace; a lost role/menu hint is acceptable, a crash is not.
export function readSessionStorageValue(key: string) {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return null
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeSessionStorageValue(key: string, value: string | null) {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return
  try {
    if (!value) {
      window.sessionStorage.removeItem(key)
      return
    }
    window.sessionStorage.setItem(key, value)
  } catch {}
}

export function readSessionRole(initialRole: AtlasRole) {
  const stored = readSessionStorageValue(SESSION_ROLE_KEY)
  return stored === 'administrator' || stored === 'supervisor' || stored === 'partner' || stored === 'navigator'
    ? stored
    : initialRole
}

export function readSessionRemoteSession(): TroubleshootingSessionState | null {
  const raw = readSessionStorageValue(SESSION_REMOTE_SESSION_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<TroubleshootingSessionState>
    if (!parsed || !parsed.isActive || !parsed.targetPersonId || !parsed.targetRole) return null
    return {
      isActive: true,
      targetPersonId: String(parsed.targetPersonId),
      targetRole: parsed.targetRole,
      targetDisplayName: String(parsed.targetDisplayName || ''),
      targetEmail: String(parsed.targetEmail || ''),
      targetOrganizationName: parsed.targetOrganizationName ? String(parsed.targetOrganizationName) : null,
      startedAtIso: String(parsed.startedAtIso || new Date().toISOString()),
      partnerGrant: parsed.partnerGrant || null
    }
  } catch {
    return null
  }
}
