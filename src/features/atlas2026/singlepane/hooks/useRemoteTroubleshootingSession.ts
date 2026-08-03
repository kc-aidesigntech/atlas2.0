import type { Dispatch, SetStateAction } from 'react'
import type {
  AccessMatrixDataset,
  AtlasRole,
  PartnerTroubleshootingGrant,
  TroubleshootingSessionState
} from '@/features/atlas2026/shared/contracts'
import { savePartnerTroubleshootingGrant as persistPartnerTroubleshootingGrant } from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'
import { toRemoteSessionErrorMessage } from '@/features/atlas2026/singlepane/domain/roles'

interface UseRemoteTroubleshootingSessionInput {
  accessMatrixDataset: AccessMatrixDataset | null
  partnerTroubleshootingGrants: Record<string, PartnerTroubleshootingGrant>
  setPartnerTroubleshootingGrants: Dispatch<SetStateAction<Record<string, PartnerTroubleshootingGrant>>>
  setRemoteSession: Dispatch<SetStateAction<TroubleshootingSessionState | null>>
  ensureAdminPermissionWrite: (actionLabel: string) => void
}

/** Centralizes administrator impersonation and partner-grant state transitions. */
export function useRemoteTroubleshootingSession({
  accessMatrixDataset,
  partnerTroubleshootingGrants,
  setPartnerTroubleshootingGrants,
  setRemoteSession,
  ensureAdminPermissionWrite
}: UseRemoteTroubleshootingSessionInput) {
  async function savePartnerGrant(grant: PartnerTroubleshootingGrant) {
    ensureAdminPermissionWrite('update troubleshooting grant exceptions')
    const saved = await persistPartnerTroubleshootingGrant(grant)
    setPartnerTroubleshootingGrants((current) => ({ ...current, [saved.partnerId]: saved }))
    setRemoteSession((current) =>
      current?.targetRole === 'partner' && current.partnerGrant?.partnerId === saved.partnerId
        ? { ...current, partnerGrant: saved }
        : current
    )
    return saved
  }

  async function startTroubleshootingSession(targetPersonId: string, targetRole: AtlasRole) {
    ensureAdminPermissionWrite('start troubleshooting sessions')
    const targetPerson = accessMatrixDataset?.people.find((person) => person.id === targetPersonId) || null
    if (!targetPerson) throw new Error(toRemoteSessionErrorMessage(targetRole))

    const partnerAssignment =
      targetRole === 'partner'
        ? accessMatrixDataset?.partnerAssignments.find((partner) =>
            partner.primaryContactPersonIds.includes(targetPersonId)
          ) || null
        : null
    const partnerGrant = partnerAssignment ? partnerTroubleshootingGrants[partnerAssignment.partnerId] || null : null
    if (targetRole === 'partner' && (!partnerAssignment || !partnerGrant?.allowedMenus.length)) {
      throw new Error(toRemoteSessionErrorMessage(targetRole))
    }
    setRemoteSession({
      isActive: true,
      targetPersonId,
      targetRole,
      targetDisplayName: targetPerson.fullName,
      targetEmail: targetPerson.email,
      targetOrganizationName: partnerAssignment?.organizationName || null,
      startedAtIso: new Date().toISOString(),
      partnerGrant
    })
  }

  return {
    savePartnerTroubleshootingGrant: savePartnerGrant,
    startTroubleshootingSession,
    stopTroubleshootingSession: () => setRemoteSession(null)
  }
}
