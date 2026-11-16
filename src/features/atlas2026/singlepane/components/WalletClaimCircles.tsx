/**
 * Small claim circles for My Wallet.
 * One circle per person. Opening a circle is the only place assign and remove live.
 */
import React from 'react'
import { AtlasPanel, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import PersonCircleButton from './PersonCircleButton'

export interface WalletClaimCard {
  id: string
  label: string
  selected: boolean
}

interface WalletClaimCirclesProps {
  title: string
  description: string
  cards: WalletClaimCard[]
  emptyLabel: string
  busyId?: string | null
  error?: string | null
  onToggle: (id: string, nextSelected: boolean) => void
}

export default function WalletClaimCircles({
  title,
  description,
  cards,
  emptyLabel,
  busyId = null,
  error = null,
  onToggle
}: WalletClaimCirclesProps) {
  const [openId, setOpenId] = React.useState<string | null>(null)
  const mineCount = cards.filter((card) => card.selected).length

  return (
    <AtlasPanel
      kicker="my wallet"
      title={title}
      description={`${mineCount} of ${cards.length} assigned to you. ${description}`}
    >
      {error ? (
        <small className="mb-3 block text-[12px]" style={{ color: SP_COLORS.red }}>
          {error}
        </small>
      ) : null}
      {cards.length ? (
        <div className="flex flex-wrap items-center gap-3">
          {cards.map((card) => {
            const open = openId === card.id
            if (!open) {
              return (
                <PersonCircleButton
                  key={card.id}
                  name={card.label}
                  selected={card.selected}
                  size="large"
                  aria-expanded={false}
                  title={card.label}
                  onClick={() => setOpenId(card.id)}
                />
              )
            }
            return (
              <div
                key={card.id}
                className="flex min-w-[240px] items-center gap-3 rounded-full border py-1.5 pl-1.5 pr-3"
                style={{ borderColor: card.selected ? SP_COLORS.deepGreen : '#ffffff40' }}
              >
                <PersonCircleButton name={card.label} selected={card.selected} aria-expanded title="close" onClick={() => setOpenId(null)} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-white">{card.label}</div>
                  <small className="block text-[11px] text-[#cfcfcf]">{card.selected ? 'assigned to you' : 'not assigned to you'}</small>
                </div>
                <AtlasTextButton
                  disabled={busyId === card.id}
                  onClick={() => onToggle(card.id, !card.selected)}
                  className="px-3 py-1 text-[12px]"
                >
                  {busyId === card.id ? 'saving...' : card.selected ? 'remove' : 'assign me'}
                </AtlasTextButton>
              </div>
            )
          })}
        </div>
      ) : (
        <small className="block text-[13px] text-[#cfcfcf]">{emptyLabel}</small>
      )}
    </AtlasPanel>
  )
}
