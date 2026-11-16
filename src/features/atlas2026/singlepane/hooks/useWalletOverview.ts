import { useCallback, useEffect, useState } from 'react'
import {
  loadWalletOverview,
  loadWalletPickupCounts,
  type WalletOverview,
  type WalletPickupCounts
} from '@/features/atlas2026/singlepane/data-access/walletRepository'

interface UseWalletOverviewInput {
  /** The load runs only while true; the My Wallet panel passes true, so nothing loads until it mounts. */
  enabled: boolean
  /** `leads.engage`; the available-lead count is skipped without it. */
  countLeads: boolean
  /** `respite_shifts.take`; the open-shift count is skipped without it. */
  countRespiteShifts: boolean
}

const NO_PICKUP_COUNTS: WalletPickupCounts = { availableLeadCount: null, openRespiteShiftCount: null }

/**
 * Loads `fn_wallet_overview` and the pickup counts when the wallet panel
 * mounts. The shell's `isReady` does not wait on this hook; the panel renders
 * its header from the viewer tier and fills in as the Remote Procedure Call
 * (RPC) answers.
 */
export function useWalletOverview(input: UseWalletOverviewInput) {
  const [overview, setOverview] = useState<WalletOverview | null>(null)
  const [pickupCounts, setPickupCounts] = useState<WalletPickupCounts>(NO_PICKUP_COUNTS)
  const [isLoading, setIsLoading] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!input.enabled) return
    let isMounted = true
    setIsLoading(true)
    void Promise.all([
      loadWalletOverview(),
      loadWalletPickupCounts({ leads: input.countLeads, respiteShifts: input.countRespiteShifts })
    ]).then(([nextOverview, nextPickupCounts]) => {
      if (!isMounted) return
      setOverview(nextOverview)
      setPickupCounts(nextPickupCounts)
      setIsLoading(false)
    })
    return () => {
      isMounted = false
    }
  }, [input.enabled, input.countLeads, input.countRespiteShifts, reloadToken])

  const reload = useCallback(() => setReloadToken((value) => value + 1), [])

  return { overview, pickupCounts, isLoading, reload }
}
