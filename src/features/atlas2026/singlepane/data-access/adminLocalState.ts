import type { AdminPortalFeaturePolicy, AdminPortalRegistry, AdminRoleCapabilityPolicies, AtlasRole } from '@/features/atlas2026/shared/contracts'
import {
  loadLatestConfigPayload,
  loadLocalStorageState,
  persistLocalStorageState,
  upsertConfigPayload
} from '@/features/atlas2026/singlepane/data-access/configDocumentPersistence'
import { isOptionalSupabaseDataError } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'
import { ATLAS_ROLE_KEYS, normalizeAtlasRoleKey, normalizePersonRoleKeys } from '@/features/atlas2026/singlepane/domain/roles'

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
    rolePolicies: {},
    updatedAtIso: new Date().toISOString()
  }
}

function booleanCapabilityMap(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')
  )
}

function normalizeFeaturePolicy(value: unknown): AdminPortalFeaturePolicy {
  const policy = value && typeof value === 'object' ? (value as Partial<AdminPortalFeaturePolicy>) : {}
  return {
    screenToggles: booleanCapabilityMap(policy.screenToggles),
    cardToggles: booleanCapabilityMap(policy.cardToggles),
    actionToggles: booleanCapabilityMap(policy.actionToggles)
  }
}

const ROLE_POLICY_KEYS: readonly AtlasRole[] = ATLAS_ROLE_KEYS

// Older registries have no rolePolicies field. Empty maps mean every role still
// uses the shipped baseline until an administrator changes that role. A policy
// stored under a legacy key lands on its tier unless that tier already has one.
function normalizeRolePolicies(value: unknown): AdminRoleCapabilityPolicies {
  if (!value || typeof value !== 'object') return {}
  const source = value as Record<string, unknown>
  const policies: AdminRoleCapabilityPolicies = {}
  for (const [storedKey, storedPolicy] of Object.entries(source)) {
    const role = normalizeAtlasRoleKey(storedKey)
    if (!role || !ROLE_POLICY_KEYS.includes(role) || !storedPolicy || typeof storedPolicy !== 'object') continue
    if (policies[role] && storedKey !== role) continue
    policies[role] = normalizeFeaturePolicy(storedPolicy)
  }
  return policies
}

function normalizeAdminPortalRegistry(payload: Partial<AdminPortalRegistry> | null | undefined): AdminPortalRegistry {
  return {
    people: Array.isArray(payload?.people)
      ? payload.people.filter(Boolean).map((person) => ({
          ...person,
          // Stored legacy role keys map onto their tier.
          roles: normalizePersonRoleKeys(Array.isArray(person.roles) ? person.roles : []),
          canViewNavigatorAssignmentNames: Boolean((person as { canViewNavigatorAssignmentNames?: boolean }).canViewNavigatorAssignmentNames),
          approvalState: (person as { approvalState?: string }).approvalState === 'pending' ? 'pending' : 'approved',
          identityGroupId: String((person as { identityGroupId?: string }).identityGroupId || person.id),
          linkedEmails: Array.from(new Set([
            String((person as { email?: string }).email || ''),
            ...((person as { linkedEmails?: string[] }).linkedEmails || [])
          ].map((value) => value.trim().toLowerCase()).filter(Boolean))),
          featurePolicy: normalizeFeaturePolicy((person as { featurePolicy?: unknown }).featurePolicy)
        }))
      : [],
    organizations: Array.isArray(payload?.organizations) ? payload.organizations.filter(Boolean) : [],
    customEnrollees: Array.isArray(payload?.customEnrollees) ? payload.customEnrollees.filter(Boolean) : [],
    archivedPersonIds: Array.isArray(payload?.archivedPersonIds) ? payload.archivedPersonIds.map(String).filter(Boolean) : [],
    archivedOrganizationIds: Array.isArray(payload?.archivedOrganizationIds) ? payload.archivedOrganizationIds.map(String).filter(Boolean) : [],
    archivedEnrolleeIds: Array.isArray(payload?.archivedEnrolleeIds) ? payload.archivedEnrolleeIds.map(String).filter(Boolean) : [],
    rolePolicies: normalizeRolePolicies(payload?.rolePolicies),
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
