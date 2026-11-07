import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AtlasRole } from '@/features/atlas2026/shared/contracts'
import { defaultPermissionKeysForRole } from '@/features/atlas2026/shared/roleCapabilityPolicy'
import type { AtlasPermissionKey, TierStanding } from '@/features/atlas2026/shared/tiers'
import { loadMyPermissions, loadMyTier } from '@/features/atlas2026/singlepane/data-access/tierRepository'
import { isSystemAdmin } from '@/features/atlas2026/singlepane/domain/roles'

interface UseViewerPermissionsInput {
  /** Role whose screens are on the pane. */
  viewerRole: AtlasRole
  /** Roles the signed-in account holds, primary first. */
  authoritativeAccountRoles: AtlasRole[]
  sessionEmail: string
  remoteSessionActive: boolean
}

export type ViewerPermissionSource = 'rpc' | 'tier-defaults'

/**
 * Loads the signed-in account's permission keys (`fn_my_permissions`) and tier
 * standing (`fn_my_tier`) once per session email. `hasPermission` answers from
 * the Remote Procedure Call (RPC) list when the pane shows the account's own
 * primary role; a troubleshooting session, an administrator viewing another
 * experience, or an RPC failure answers from the seeded tier defaults instead.
 */
export function useViewerPermissions(input: UseViewerPermissionsInput) {
  const [rpcPermissionKeys, setRpcPermissionKeys] = useState<AtlasPermissionKey[] | null>(null)
  const [viewerTier, setViewerTier] = useState<TierStanding | null>(null)

  useEffect(() => {
    let isMounted = true
    if (!input.sessionEmail) {
      setRpcPermissionKeys(null)
      setViewerTier(null)
      return
    }
    void Promise.all([loadMyPermissions(), loadMyTier()]).then(([permissions, tier]) => {
      if (!isMounted) return
      setRpcPermissionKeys(permissions.source === 'rpc' ? permissions.keys : null)
      setViewerTier(tier)
    })
    return () => {
      isMounted = false
    }
  }, [input.sessionEmail])

  const primaryAccountRole = input.authoritativeAccountRoles[0] || null
  const usesRpcKeys = Boolean(rpcPermissionKeys) && !input.remoteSessionActive && primaryAccountRole === input.viewerRole
  const permissionSource: ViewerPermissionSource = usesRpcKeys ? 'rpc' : 'tier-defaults'

  const viewerPermissionKeys = useMemo<AtlasPermissionKey[]>(
    () => (usesRpcKeys && rpcPermissionKeys ? rpcPermissionKeys : defaultPermissionKeysForRole(input.viewerRole)),
    [input.viewerRole, rpcPermissionKeys, usesRpcKeys]
  )

  const hasPermission = useCallback(
    (key: AtlasPermissionKey) => isSystemAdmin(input.viewerRole) || viewerPermissionKeys.includes(key),
    [input.viewerRole, viewerPermissionKeys]
  )

  return { hasPermission, viewerPermissionKeys, viewerTier, permissionSource }
}
