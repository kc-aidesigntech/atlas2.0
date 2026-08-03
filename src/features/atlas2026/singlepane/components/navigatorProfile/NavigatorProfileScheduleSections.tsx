import React from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type { IntervalAssessmentDueItem, RegulationReviewDueItem } from '@/features/atlas2026/shared/contracts'
import { formatDateLabel } from './model'

export function NavigatorScheduleSection({
  dueItems,
  regulationItems,
  onStart
}: {
  dueItems: IntervalAssessmentDueItem[]
  regulationItems: RegulationReviewDueItem[]
  onStart: (item: RegulationReviewDueItem) => void
}) {
  return (
    <div className="space-y-2">
      {dueItems.map((item) => (
        <div key={item.id} className="atlas-surface-raised flex items-center justify-between px-3 py-2 text-[12px]">
          <span className="text-white">{item.title}</span>
          <span className="text-[#9eacb9]">{formatDateLabel(item.dueAtIso)} · {item.status}</span>
        </div>
      ))}
      {regulationItems.map((item) => <RegulationReviewRow key={item.id} item={item} onStart={() => onStart(item)} />)}
    </div>
  )
}

export function RegulationReviewRow({ item, onStart }: { item: RegulationReviewDueItem; onStart: () => void }) {
  const missing = (item.missingInstruments || ['mh_sca', 'svs'])
    .map((instrument) => (instrument === 'mh_sca' ? 'MH-SCA' : 'SVS'))
    .join(' + ')
  return (
    <div className="atlas-surface-raised flex flex-wrap items-center justify-between gap-2 px-3 py-2">
      <div className="text-[13px] text-white">
        {item.enrolleeName}
        <span className="ml-2 text-[#9eacb9]">
          due {formatDateLabel(item.dueAtIso)}
          {item.status === 'open' ? ` · missing ${missing}` : ` · ${item.status}`}
        </span>
      </div>
      {item.status === 'open' ? (
        <AtlasTextButton
          onClick={onStart}
          className="px-3 py-1 text-[12px]"
          style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
        >
          start review
        </AtlasTextButton>
      ) : null}
    </div>
  )
}
