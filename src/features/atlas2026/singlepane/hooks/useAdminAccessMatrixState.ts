import { useEffect, useState } from 'react'
import type {
  AccessMatrixDataset,
  AccountSettings,
  AdminPortalPersonRecord,
  AdminPortalPersonRole,
  AdminPortalRegistry,
  AtlasRole
} from '@/features/atlas2026/shared/contracts'
import {
  loadAccessMatrixDataset,
  loadAdminPortalRegistry,
  saveAccessMatrixEnrollmentNavigators as persistAccessMatrixEnrollmentNavigators,
  saveAccessMatrixPartnerPrimaryContacts as persistAccessMatrixPartnerPrimaryContacts,
  saveAccessMatrixPersonRoles as persistAccessMatrixPersonRoles,
  saveAccessMatrixSupervisorAssignments as persistAccessMatrixSupervisorAssignments,
  saveAdminPortalRegistry as persistAdminPortalRegistry
} from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'

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
    const normalizedRole = (role === 'administrator' || role === 'supervisor' || role === 'navigator' || role === 'partner'
      ? role
      : 'navigator') as AdminPortalPersonRole
    const createdPerson: AdminPortalPersonRecord = {
      id: `person-${Date.now().toString(36)}`,
      fullName: accountSettings.fullName.trim() || normalizedEmail,
      email: normalizedEmail,
      title: '',
      roles: [normalizedRole],
      canViewNavigatorAssignmentNames: normalizedRole === 'administrator',
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
    if (viewerRole !== 'administrator') {
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
    saveAccessMatrixEnrollmentNavigators,
    saveAccessMatrixSupervisorAssignments,
    toggleSupervisorManagedNavigator,
    saveAccessMatrixPartnerPrimaryContacts
  }
}
