import { ACTIVE_NAVIGATOR_PROFILE_CARDS, type NavigatorProfileOverlayKey } from '../navigatorProfile/model'
import { SUPERVISOR_WALLET_CARDS } from '../supervisorProfile/model'
import type { SupervisorProfileOverlayKey } from '../supervisorProfile/SupervisorProfileOverlay'
import type { WalletCard } from './WalletCardsColumn'

/** The overlay one My Wallet card opens: a navigator section or a supervisor section. */
export type WalletCardTarget =
  | { kind: 'navigator'; overlayId: NavigatorProfileOverlayKey }
  | { kind: 'supervisor'; overlayId: SupervisorProfileOverlayKey }

export interface WalletCardEntry {
  card: WalletCard
  target: WalletCardTarget
}

/** The three cards every wallet prints: the enrollee survey, the self-reflection, and the supervisor session. */
export const NAVIGATOR_WALLET_CARD_ENTRIES: WalletCardEntry[] = ACTIVE_NAVIGATOR_PROFILE_CARDS.map((row) => ({
  card: {
    id: row.overlayId,
    title: row.cardTitle,
    subtitle: row.cardSubtitle,
    actionLabel: row.actionLabel,
    variant: row.variant,
    illustration: row.illustration
  },
  target: { kind: 'navigator', overlayId: row.overlayId }
}))

/** The cards a `supervision.give` holder's wallet prints after the three above. */
export const SUPERVISOR_WALLET_CARD_ENTRIES: WalletCardEntry[] = SUPERVISOR_WALLET_CARDS.map((row) => ({
  card: {
    id: row.overlayId,
    title: row.cardTitle,
    subtitle: row.cardSubtitle,
    actionLabel: row.actionLabel,
    variant: row.variant,
    illustration: row.illustration
  },
  target: { kind: 'supervisor', overlayId: row.overlayId }
}))
