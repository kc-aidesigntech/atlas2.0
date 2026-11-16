import React from 'react'
import { AtlasPanel } from '@/features/atlas2026/components/AtlasPrimitives'
import ProfileNavigationCard from '../ProfileNavigationCard'
import WalletColumnHeading from './WalletColumnHeading'

/** One card in column 1: the words and artwork `ProfileNavigationCard` prints, and the id its press reports. */
export interface WalletCard {
  id: string
  title: string
  subtitle: string
  actionLabel: string
  variant: 'green' | 'blue'
  illustration: 'feedback' | 'reflection' | 'create'
}

interface WalletCardsColumnProps {
  cards: WalletCard[]
  onOpenCard: (cardId: string) => void
}

/** Column 1 of My Wallet: the cards, top to bottom. A card prints the same at every moment; a press reports its id. */
export default function WalletCardsColumn({ cards, onOpenCard }: WalletCardsColumnProps) {
  return (
    <AtlasPanel className="h-full" contentClassName="flex flex-col gap-5">
      <WalletColumnHeading sequenceNumber={1} title="load your cards" />
      {cards.map((card, index) => (
        <div key={card.id} className="w-full max-w-[400px]" data-wallet-card={card.id}>
          <ProfileNavigationCard
            sequenceNumber={index + 1}
            title={card.title}
            subtitle={card.subtitle}
            actionLabel={card.actionLabel}
            variant={card.variant}
            illustration={card.illustration}
            onClick={() => onOpenCard(card.id)}
          />
        </div>
      ))}
    </AtlasPanel>
  )
}
