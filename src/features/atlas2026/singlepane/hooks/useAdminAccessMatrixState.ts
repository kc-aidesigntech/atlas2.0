import { useEffect, useState } from 'react'
import type {
  AccessMatrixDataset,
  AccountSettings,
  AdminPortalPersonRecord,
  AdminPortalPersonRole,
  AdminPortalRegistry,
  AtlasRole,
  TierDesignation,
  TierKey
} from '@/features/atlas2026/shared/contracts'
import {
  grantPersonDesignation as persistGrantPersonDesignation,
  loadAccessMatrixDataset,
  loadAdminPortalRegistry,
  markPersonTierAlum as persistMarkPersonTierAlum,
  revokePersonDesignation as persistRevokePersonDesignation,
  saveAccessMatrixEnrollmentNavigators as persistAccessMatrixEnrollmentNavigators,
  saveAccessMatrixPartnerPrimaryContacts as persistAccessMatrixPartnerPrimaryContacts,
  saveAccessMatrixPersonRoles as persistAccessMatrixPersonRoles,
  saveAccessMatrixSupervisorAssignments as persistAccessMatrixSupervisorAssignments,
  saveAdminPortalRegistry as persistAdminPortalRegistry,
  setPersonLucidEmployee as persistPersonLucidEmployee,
  setPersonTier as persistPersonTier
} from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'
import { isAtlasRole, isSystemAdmin } from '@/features/atlas2026/singlepane/domain/roles'

interface AdminAccessMatrixStateInput {
  viewerRole: AtlasRole
  role: AtlasRole
  sessionEmail: string
  accountSettings: AccountSettings
  remoteSessionActive: boolean
  getViewerPersonId: () => string | null
  canAccessAdminRegistryCards: () => boolean
  ensureAdminPermissionWrite: (actionLabel: string) => void
  refreshAssignmentParityViews: () => Promise<void>
}

/**
 * Owns administrator registry and access-matrix persistence. Identity continuity is
 * reconciled here so authenticated email linkage and assignment data share one state owner.
 */
export function useAdminAccessMatrixState({
  viewerRole,
  role,
  sessionEmail,
  accountSettings,
  remoteSessionActive,
  getViewerPersonId,
  canAccessAdminRegistryCards,
  ensureAdminPermissionWrite,
  refreshAssignmentParityViews
}: AdminAccessMatrixStateInput) {
  const [adminPortalRegistry, setAdminPortalRegistry] = useState<AdminPortalRegistry | null>(null)
  const [accessMatrixDataset, setAccessMatrixDataset] = useState<AccessMatrixDataset | null>(null)
  const [isSavingAdminPortalRegistry, setIsSavingAdminPortalRegistry] = useState(false)
  const [isSavingAccessMatrix, setIsSavingAccessMatrix] = useState(false)
  const [adminPortalRegistryError, setAdminPortalRegistryError] = useState<string | null>(null)
  const [accessMatrixError, setAccessMatrixError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    loadAdminPortalRegistry()
      .then((registry) => {
        if (!isMounted) return
        setAdminPortalRegistry(registry)
        setAdminPortalRegistryError(null)
      })
      .catch((error) => {
        if (!isMounted) return
        setAdminPortalRegistryError(error instanceof Error ? error.message : 'Unable to load admin portal registry.')
      })
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!adminPortalRegistry || remoteSessionActive) return
    const normalizedEmail = (sessionEmail || accountSettings.email || '').trim().toLowerCase()
    if (!normalizedEmail) return
    const existingPerson =
      adminPortalRegistry.people.find(
        (person) =>
          person.email.trim().toLowerCase() === normalizedEmail ||
          person.linkedEmails.map((value) => value.trim().toLowerCase()).includes(normalizedEmail)
      ) || null
    const normalizedRole: AdminPortalPersonRole = isAtlasRole(role) ? role : 't3a'
    const createdPerson: AdminPortalPersonRecord = {
      id: `person-${Date.now().toString(36)}`,
      fullName: accountSettings.fullName.trim() || normalizedEmail,
      email: normalizedEmail,
      title: '',
      roles: [normalizedRole],
      canViewNavigatorAssignmentNames: isSystemAdmin(normalizedRole),
      approvalState: 'pending',
      identityGroupId: `identity-${normalizedEmail}`,
      linkedEmails: [normalizedEmail],
      featurePolicy: { screenToggles: {}, cardToggles: {}, actionToggles: {} },
      organizationId: null,
      reportsToPersonId: null,
      linkedEnrolleeId: null,
      status: 'active',
      notes: 'Auto-created from auth signup continuity.'
    }
    const registryToSave = existingPerson
      ? {
          ...adminPortalRegistry,
          people: adminPortalRegistry.people.map((person) =>
            person.id === existingPerson.id
              ? {
                  ...person,
                  linkedEmails: Array.from(
                    new Set([normalizedEmail, ...person.linkedEmails.map((value) => value.trim().toLowerCase())])
                  ),
                  identityGroupId: person.identityGroupId.trim() || person.id,
                  featurePolicy: person.featurePolicy || { screenToggles: {}, cardToggles: {}, actionToggles: {} }
                }
              : person
          ),
          updatedAtIso: new Date().toISOString()
        }
      : {
          ...adminPortalRegistry,
          people: [...adminPortalRegistry.people, createdPerson],
          updatedAtIso: new Date().toISOString()
        }
    if (JSON.stringify(registryToSave.people) === JSON.stringify(adminPortalRegistry.people)) return
    // Persist deterministic auth-email linkage so signup identity survives future sessions.
    void persistAdminPortalRegistry(registryToSave)
      .then((saved) => setAdminPortalRegistry(saved))
      .catch((error) => console.warn('Unable to persist signup/person continuity update.', error))
  }, [accountSettings.email, accountSettings.fullName, adminPortalRegistry, remoteSessionActive, role, sessionEmail])

  useEffect(() => {
    if (!isSystemAdmin(viewerRole)) {
      setAccessMatrixDataset(null)
      setAccessMatrixError(null)
      return
    }
    let isMounted = true
    loadAccessMatrixDataset()
      .then((dataset) => {
        if (!isMounted) return
        setAccessMatrixDataset(dataset)
        setAccessMatrixError(null)
      })
      .catch((error) => {
        if (!isMounted) return
        setAccessMatrixError(error instanceof Error ? error.message : 'Unable to load access matrix dataset.')
      })
    return () => {
      isMounted = false
    }
  }, [viewerRole])

  async function saveAdminPortalRegistry(registry: AdminPortalRegistry) {
    ensureAdminPermissionWrite('update registry permissions')
    if (!canAccessAdminRegistryCards()) {
      throw new Error('Admin registry updates are disabled by policy for this account.')
    }
    setIsSavingAdminPortalRegistry(true)
    setAdminPortalRegistryError(null)
    try {
      const saved = await persistAdminPortalRegistry(registry)
      setAdminPortalRegistry(saved)
      return saved
    } catch (error) {
      setAdminPortalRegistryError(error instanceof Error ? error.message : 'Unable to save admin portal registry.')
      throw error
    } finally {
      setIsSavingAdminPortalRegistry(false)
    }
  }

  async function refreshAccessMatrixDataset() {
    const dataset = await loadAccessMatrixDataset()
    setAccessMatrixDataset(dataset)
    return dataset
  }

  async function saveAccessMatrixPersonRoles(personId: string, roleKeys: AdminPortalPersonRole[]) {
    ensureAdminPermissionWrite('change role assignments')
    setIsSavingAccessMatrix(true)
    setAccessMatrixError(null)
    try {
      await persistAccessMatrixPersonRoles(personId, roleKeys)
      await refreshAccessMatrixDataset()
    } catch (error) {
      setAccessMatrixError(error instanceof Error ? error.message : 'Unable to save person role assignments.')
      throw error
    } finally {
      setIsSavingAccessMatrix(false)
    }
  }

  async function saveAccessMatrixEnrollmentNavigators(enrollmentId: string, navigatorPersonIds: string[]) {
    ensureAdminPermissionWrite('update enrollment coverage assignments')
    if (!canAccessAdminRegistryCards()) {
      throw new Error('Coverage updates are disabled by policy for this account.')
    }
    setIsSavingAccessMatrix(true)
    setAccessMatrixError(null)
    try {
      await persistAccessMatrixEnrollmentNavigators(enrollmentId, navigatorPersonIds)
      await refreshAccessMatrixDataset()
      await refreshAssignmentParityViews()
    } catch (error) {
      setAccessMatrixError(error instanceof Error ? error.message : 'Unable to save navigator enrollment assignments.')
      throw error
    } finally {
      setIsSavingAccessMatrix(false)
    }
  }

  async function saveAccessMatrixSupervisorAssignments(navigatorPersonId: string, supervisorPersonIds: string[]) {
    ensureAdminPermissionWrite('update supervisor assignments')
    setIsSavingAccessMatrix(true)
    setAccessMatrixError(null)
    try {
      await persistAccessMatrixSupervisorAssignments(navigatorPersonId, supervisorPersonIds)
      await refreshAccessMatrixDataset()
    } catch (error) {
      setAccessMatrixError(error instanceof Error ? error.message : 'Unable to save supervisor assignments.')
      throw error
    } finally {
      setIsSavingAccessMatrix(false)
    }
  }

  /** Runs one tier Remote Procedure Call (RPC) and reloads the dataset so the tier column reflects the row the database wrote. */
  async function runTierWrite(actionLabel: string, failureMessage: string, write: () => Promise<void>) {
    ensureAdminPermissionWrite(actionLabel)
    setIsSavingAccessMatrix(true)
    setAccessMatrixError(null)
    try {
      await write()
      await refreshAccessMatrixDataset()
    } catch (error) {
      setAccessMatrixError(error instanceof Error ? error.message : failureMessage)
      throw error
    } finally {
      setIsSavingAccessMatrix(false)
    }
  }

  /** `fn_set_person_tier`: the role assignment and the active tier row change together. */
  async function saveAccessMatrixPersonTier(personId: string, tierKey: TierKey) {
    await runTierWrite('change tier assignments', 'Unable to set the person tier.', () => persistPersonTier(personId, tierKey))
  }

  /** `fn_mark_tier_alum`: the tier row keeps its key with `tier_status` alum. */
  async function markAccessMatrixPersonTierAlum(personId: string) {
    await runTierWrite('mark a tier alum', 'Unable to mark the tier alum.', () => persistMarkPersonTierAlum(personId))
  }

  /** Writes `people_tiers.is_lucid_employee`. */
  async function saveAccessMatrixPersonLucidEmployee(personId: string, isLucidEmployee: boolean) {
    await runTierWrite('change the employee flag', 'Unable to update the employee flag.', () =>
      persistPersonLucidEmployee(personId, isLucidEmployee)
    )
  }

  /** `fn_grant_designation` or `fn_revoke_designation`, chosen by `granted`. */
  async function saveAccessMatrixPersonDesignation(personId: string, designation: TierDesignation, granted: boolean) {
    await runTierWrite('change designations', 'Unable to update the designation.', () =>
      granted ? persistGrantPersonDesignation(personId, designation) : persistRevokePersonDesignation(personId, designation)
    )
  }

  async function toggleSupervisorManagedNavigator(navigatorPersonId: string, isManaged: boolean) {
    const viewerPersonId = getViewerPersonId()
    if (!viewerPersonId || !accessMatrixDataset) return
    const currentAssignment = accessMatrixDataset.supervisorAssignments.find(
      (assignment) => assignment.navigatorPersonId === navigatorPersonId
    )
    const currentSupervisorIds = currentAssignment?.supervisorPersonIds || []
    const nextSupervisorIds = isManaged
      ? Array.from(new Set([...currentSupervisorIds, viewerPersonId]))
      : currentSupervisorIds.filter((supervisorPersonId) => supervisorPersonId !== viewerPersonId)
    await saveAccessMatrixSupervisorAssignments(navigatorPersonId, nextSupervisorIds)
  }

  async function saveAccessMatrixPartnerPrimaryContacts(partnerId: string, primaryContactPersonIds: string[]) {
    ensureAdminPermissionWrite('update partner ownership assignments')
    setIsSavingAccessMatrix(true)
    setAccessMatrixError(null)
    try {
      await persistAccessMatrixPartnerPrimaryContacts(partnerId, primaryContactPersonIds)
      await refreshAccessMatrixDataset()
    } catch (error) {
      setAccessMatrixError(error instanceof Error ? error.message : 'Unable to save partner ownership assignments.')
      throw error
    } finally {
      setIsSavingAccessMatrix(false)
    }
  }

  return {
    adminPortalRegistry,
    accessMatrixDataset,
    isSavingAdminPortalRegistry,
    isSavingAccessMatrix,
    adminPortalRegistryError,
    accessMatrixError,
    saveAdminPortalRegistry,
    saveAccessMatrixPersonRoles,
    saveAccessMatrixPersonTier,
    markAccessMatrixPersonTierAlum,
    saveAccessMatrixPersonLucidEmployee,
    saveAccessMatrixPersonDesignation,
    saveAccessMatrixEnrollmentNavigators,
    saveAccessMatrixSupervisorAssignments,
    toggleSupervisorManagedNavigator,
    saveAccessMatrixPartnerPrimaryContacts
  }
}
