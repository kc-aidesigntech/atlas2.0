import React from 'react'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'

interface TimelineLegendProps {
  isOpen: boolean
  onToggle: () => void
}

export function TimelineLegend({ isOpen, onToggle }: TimelineLegendProps) {
  return (
    <div className="absolute right-[14px] top-2 z-20">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border text-[14px] font-semibold"
        style={{ borderColor: '#ffffff50', color: SP_COLORS.white, backgroundColor: '#050505' }}
        aria-label="Partner timeline semantics"
        title="Partner timeline semantics"
      >
        i
      </button>
      {isOpen ? (
        <div
          className="mt-2 w-[320px] rounded-[16px] border px-3 py-3 text-[11px] leading-[1.45]"
          style={{ borderColor: '#ffffff24', backgroundColor: 'rgba(6,6,6,0.96)', color: '#d7e0e9' }}
        >
          <div className="mb-1 text-[10px] uppercase tracking-[0.12em]" style={{ color: SP_COLORS.muted }}>
            partner my station semantics
          </div>
          <div>- Marker color follows canonical Z-code coin mapping by parent Z-code.</div>
          <div>- Marker center text is the enrollee Z-code; callout text is the Z-code definition (short label).</div>
          <div>- Markers stack by phase + parent + Z-code so cluster depth represents per-code count.</div>
          <div>- Click any marker to open its associated aggregate record details and drill into the enrollee record.</div>
        </div>
      ) : null}
    </div>
  )
}
