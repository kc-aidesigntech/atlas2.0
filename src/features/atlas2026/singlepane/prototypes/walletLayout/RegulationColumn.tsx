import React from 'react'
import { AtlasPanel } from '@/features/atlas2026/components/AtlasPrimitives'
import { ACTIVE_NAVIGATOR_PROFILE_CARDS } from '../../components/navigatorProfile/model'
import ProfileNavigationCard from '../../components/ProfileNavigationCard'
import ColumnHeading from './ColumnHeading'
import type { PrototypeWalletCard } from './walletLayoutFixtures'

interface RegulationColumnProps {
  cards: PrototypeWalletCard[]
}

/** Column 1: the three wallet cards, top to bottom. A card prints the same at every moment and takes a press. */
export default function RegulationColumn({ cards }: RegulationColumnProps) {
  return (
    <AtlasPanel className="h-full" contentClassName="flex flex-col gap-5">
      <ColumnHeading sequenceNumber={1} title="load your cards" />
      {cards.map((card, index) => {
        // Each card prints the variant, illustration and action label of its row in the wallet's card list.
        const face = ACTIVE_NAVIGATOR_PROFILE_CARDS.find((row) => row.overlayId === card.overlayId)
        if (!face) return null
        return (
          <div key={card.id} className="w-full max-w-[400px]" data-wallet-card={card.id}>
            <ProfileNavigationCard
              sequenceNumber={index + 1}
              title={card.title}
              subtitle={card.subtitle}
              actionLabel={face.actionLabel}
              variant={face.variant}
              illustration={face.illustration}
              // The live wallet opens the card's form on this press; this page opens none.
              onClick={() => undefined}
            />
          </div>
        )
      })}
    </AtlasPanel>
  )
}
