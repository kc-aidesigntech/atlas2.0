import type { AdminPortalRegistry } from '@/features/atlas2026/shared/contracts'
import {
  loadLatestConfigPayload,
  loadLocalStorageState,
  persistLocalStorageState,
  upsertConfigPayload
} from '@/features/atlas2026/singlepane/data-access/configDocumentPersistence'
import { isOptionalSupabaseDataError } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'

const ADMIN_PORTAL_REGISTRY_CONFIG_KEY = 'admin_portal_registry'
const LOCAL_ADMIN_PORTAL_REGISTRY_KEY = 'atlas2026.singlepane.admin-portal-registry.v1'

function getDefaultAdminPortalRegistry(): AdminPortalRegistry {
  return {
    people: [],
    organizations: [],
    customEnrollees: [],
    archivedPersonIds: [],
    archivedOrganizationIds: [],
    archivedEnrolleeIds: [],
    updatedAtIso: new Date().toISOString()
  }
}

function getDefaultFeaturePolicy() {
  return {
    // Default-open posture lets administrators tighten access by screen, card, or action.
    screenToggles: {},
    cardToggles: {},
    actionToggles: {}
  }
}

function normalizeAdminPortalRegistry(payload: Partial<AdminPortalRegistry> | null | undefined): AdminPortalRegistry {
  return {
    people: Array.isArray(payload?.people)
      ? payload.people.filter(Boolean).map((person) => ({
          ...person,
          canViewNavigatorAssignmentNames: Boolean((person as { canViewNavigatorAssignmentNames?: boolean }).canViewNavigatorAssignmentNames),
          approvalState: (person as { approvalState?: string }).approvalState === 'pending' ? 'pending' : 'approved',
          identityGroupId: String((person as { identityGroupId?: string }).identityGroupId || person.id),
          linkedEmails: Array.from(new Set([
            String((person as { email?: string }).email || ''),
            ...((person as { linkedEmails?: string[] }).linkedEmails || [])
          ].map((value) => value.trim().toLowerCase()).filter(Boolean))),
          featurePolicy:
            (person as { featurePolicy?: unknown }).featurePolicy &&
            typeof (person as { featurePolicy?: unknown }).featurePolicy === 'object'
              ? {
                  screenToggles: { ...getDefaultFeaturePolicy().screenToggles, ...(((person as any).featurePolicy?.screenToggles || {}) as Record<string, boolean>) },
                  cardToggles: { ...getDefaultFeaturePolicy().cardToggles, ...(((person as any).featurePolicy?.cardToggles || {}) as Record<string, boolean>) },
                  actionToggles: { ...getDefaultFeaturePolicy().actionToggles, ...(((person as any).featurePolicy?.actionToggles || {}) as Record<string, boolean>) }
                }
              : getDefaultFeaturePolicy()
        }))
      : [],
    organizations: Array.isArray(payload?.organizations) ? payload.organizations.filter(Boolean) : [],
    customEnrollees: Array.isArray(payload?.customEnrollees) ? payload.customEnrollees.filter(Boolean) : [],
    archivedPersonIds: Array.isArray(payload?.archivedPersonIds) ? payload.archivedPersonIds.map(String).filter(Boolean) : [],
    archivedOrganizationIds: Array.isArray(payload?.archivedOrganizationIds) ? payload.archivedOrganizationIds.map(String).filter(Boolean) : [],
    archivedEnrolleeIds: Array.isArray(payload?.archivedEnrolleeIds) ? payload.archivedEnrolleeIds.map(String).filter(Boolean) : [],
    updatedAtIso: payload?.updatedAtIso || new Date().toISOString()
  }
}

function loadLocalAdminPortalRegistryState(): AdminPortalRegistry {
  return loadLocalStorageState(
    LOCAL_ADMIN_PORTAL_REGISTRY_KEY,
    getDefaultAdminPortalRegistry(),
    (parsed) => normalizeAdminPortalRegistry(parsed as Partial<AdminPortalRegistry>)
  )
}

export async function loadAdminPortalRegistry(): Promise<AdminPortalRegistry> {
  const { payload, error } = await loadLatestConfigPayload<Partial<AdminPortalRegistry>>(ADMIN_PORTAL_REGISTRY_CONFIG_KEY)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return loadLocalAdminPortalRegistryState()
    throw error
  }
  const normalized = normalizeAdminPortalRegistry(payload)
  persistLocalStorageState(LOCAL_ADMIN_PORTAL_REGISTRY_KEY, normalized)
  return normalized
}

export async function saveAdminPortalRegistry(registry: AdminPortalRegistry): Promise<AdminPortalRegistry> {
  const normalized = normalizeAdminPortalRegistry({ ...registry, updatedAtIso: new Date().toISOString() })
  persistLocalStorageState(LOCAL_ADMIN_PORTAL_REGISTRY_KEY, normalized)
  const error = await upsertConfigPayload(ADMIN_PORTAL_REGISTRY_CONFIG_KEY, normalized)
  if (error && !isOptionalSupabaseDataError(error)) throw error
  return normalized
}
