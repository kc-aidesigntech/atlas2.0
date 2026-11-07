import { useCallback, useEffect, useState } from 'react'
import {
  loadMySupervisor,
  loadWalletOverview,
  type WalletOverview,
  type WalletSupervisor
} from '@/features/atlas2026/singlepane/data-access/walletRepository'

interface UseWalletOverviewInput {
  /** The load runs only while true; the My Wallet panel passes true, so nothing loads until it mounts. */
  enabled: boolean
  /** `supervision.receive`; the supervisor read is skipped without it. */
  loadSupervisor: boolean
}

/**
 * Loads `fn_wallet_overview` and the caller's open supervisor row when the
 * wallet panel mounts. The shell's `isReady` does not wait on this hook; the
 * panel renders its header from the viewer tier and fills sections as the
 * Remote Procedure Call (RPC) answers.
 */
export function useWalletOverview(input: UseWalletOverviewInput) {
  const [overview, setOverview] = useState<WalletOverview | null>(null)
  const [supervisor, setSupervisor] = useState<WalletSupervisor | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!input.enabled) return
    let isMounted = true
    setIsLoading(true)
    void Promise.all([loadWalletOverview(), input.loadSupervisor ? loadMySupervisor() : Promise.resolve(null)]).then(
      ([nextOverview, nextSupervisor]) => {
        if (!isMounted) return
        setOverview(nextOverview)
        setSupervisor(nextSupervisor)
        setIsLoading(false)
      }
    )
    return () => {
      isMounted = false
    }
  }, [input.enabled, input.loadSupervisor, reloadToken])

  const reload = useCallback(() => setReloadToken((value) => value + 1), [])

  return { overview, supervisor, isLoading, reload }
}
