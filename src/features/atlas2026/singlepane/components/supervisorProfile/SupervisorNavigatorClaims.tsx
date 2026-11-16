import React from 'react'
import {
  claimSupervisorNavigator,
  loadSupervisorNavigatorClaimCards,
  releaseSupervisorNavigator
} from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'
import WalletClaimCircles, { type WalletClaimCard } from '../WalletClaimCircles'

/**
 * The navigator claim circles (`supervision.give`). Mounting reads
 * `fn_wallet_navigator_claim_cards`; a circle's button calls
 * `fn_supervisor_claim_navigator` or `fn_supervisor_release_navigator`.
 */
export default function SupervisorNavigatorClaims() {
  const [claimCards, setClaimCards] = React.useState<WalletClaimCard[]>([])
  const [claimError, setClaimError] = React.useState<string | null>(null)
  const [busyNavigatorId, setBusyNavigatorId] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void loadSupervisorNavigatorClaimCards()
      .then((rows) => {
        if (cancelled) return
        setClaimCards(rows.map((row) => ({ id: row.personId, label: row.displayName, selected: row.isMine })))
        setClaimError(null)
      })
      .catch((error) => {
        if (cancelled) return
        setClaimError(error instanceof Error ? error.message : 'Unable to load navigators.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function toggleNavigator(personId: string, nextSelected: boolean) {
    const previous = claimCards
    // The circle changes first; a rejected call puts the earlier circles back.
    setClaimCards(claimCards.map((card) => (card.id === personId ? { ...card, selected: nextSelected } : card)))
    setBusyNavigatorId(personId)
    setClaimError(null)
    try {
      if (nextSelected) await claimSupervisorNavigator(personId)
      else await releaseSupervisorNavigator(personId)
    } catch (error) {
      setClaimCards(previous)
      setClaimError(error instanceof Error ? error.message : 'Unable to update this navigator.')
    } finally {
      setBusyNavigatorId(null)
    }
  }

  return (
    <WalletClaimCircles
      title="navigators"
      description="Tap a circle, then assign them to you or remove them."
      cards={claimCards}
      emptyLabel="No navigators are available to claim yet."
      error={claimError}
      busyId={busyNavigatorId}
      onToggle={(personId, nextSelected) => void toggleNavigator(personId, nextSelected)}
    />
  )
}
