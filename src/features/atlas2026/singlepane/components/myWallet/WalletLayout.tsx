import React from 'react'
import type { AccountSettings, DomainLoad } from '@/features/atlas2026/shared/contracts'
import type { TierStanding } from '@/features/atlas2026/shared/tiers'
import RadialLoadChart from '../RadialLoadChart'
import WalletCardsColumn, { type WalletCard } from './WalletCardsColumn'
import WalletRoutesColumn, { type WalletRoutesColumnProps } from './WalletRoutesColumn'
import WalletTierHeader from './WalletTierHeader'

export interface WalletBandProps {
  accountSettings: AccountSettings
  displayName: string
  fallbackAvatar: string
  standing: TierStanding | null
  metaLines: Array<{ label: string; value: React.ReactNode }>
  isUploadingAvatar: boolean
  avatarUploadError: string | null
  onReplaceAvatar?: (file: File) => Promise<unknown> | unknown
  load: DomainLoad | null
  onOpenLoadTable?: () => void
}

interface WalletLayoutProps {
  band: WalletBandProps
  cards: WalletCard[]
  onOpenCard: (cardId: string) => void
  routes: WalletRoutesColumnProps
}

/**
 * The whole My Wallet screen, from props alone: the identity band beside the
 * load chart, then the cards column and the task pad column side by side.
 * `MyWalletPanel` renders it from the signed-in account's records and the
 * prototype page renders it from fixtures.
 */
export default function WalletLayout({ band, cards, onOpenCard, routes }: WalletLayoutProps) {
  return (
    <div className="relative flex flex-col gap-4">
      <div className="border-b pb-4" style={{ borderColor: '#ffffff55', borderBottomWidth: '2px' }}>
        <div className="atlas-navigator-profile-layout">
          <div className="atlas-navigator-profile-main">
            <WalletTierHeader
              accountSettings={band.accountSettings}
              displayName={band.displayName}
              fallbackAvatar={band.fallbackAvatar}
              standing={band.standing}
              metaLines={band.metaLines}
              isUploadingAvatar={band.isUploadingAvatar}
              avatarUploadError={band.avatarUploadError}
              onReplaceAvatar={band.onReplaceAvatar}
            />
          </div>
          <div className="atlas-navigator-profile-rail items-center justify-center">
            <RadialLoadChart load={band.load} onClick={band.onOpenLoadTable} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <WalletCardsColumn cards={cards} onOpenCard={onOpenCard} />
        <WalletRoutesColumn {...routes} />
      </div>
    </div>
  )
}
