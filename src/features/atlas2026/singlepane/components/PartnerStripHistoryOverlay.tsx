import React from 'react'
import { AtlasCloseButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { PartnerStripHistoryRecord } from '../types'
import { SP_COLORS } from '../theme'

interface PartnerStripHistoryOverlayProps {
  isOpen: boolean
  records: PartnerStripHistoryRecord[]
  onClose: () => void
}

function formatDateLabel(value: string) {
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(parsed)
}

export default function PartnerStripHistoryOverlay({ isOpen, records, onClose }: PartnerStripHistoryOverlayProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[94] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-[2px]">
      <div className="atlas-surface-panel relative max-h-[88vh] w-full max-w-[760px] overflow-hidden px-5 py-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <small className="atlas-overline block text-[#9fb0c1]">partner strip history</small>
            <div className="mt-1 text-[22px] font-medium text-white">renewal outcomes from referrals</div>
          </div>
          <AtlasCloseButton
            onClick={onClose}
            style={{ ['--button-border-color' as const]: '#ffffff30', color: '#ffffff' } as React.CSSProperties}
          />
        </div>

        <div className="max-h-[66vh] space-y-2 overflow-y-auto pr-1">
          {records.length ? (
            records.map((record) => (
              <div
                key={record.id}
                className="atlas-surface-raised flex items-center justify-between gap-3 px-4 py-3"
                style={{ borderColor: '#ffffff20' }}
              >
                <div>
                  <div className="text-[14px] text-white">{record.anonymousLabel}</div>
                  <small className="text-[12px]" style={{ color: SP_COLORS.muted }}>
                    {record.outcomeLabel}
                  </small>
                </div>
                <small className="text-[12px]" style={{ color: SP_COLORS.deepGreen }}>
                  {formatDateLabel(record.reachedRenewalAtIso)}
                </small>
              </div>
            ))
          ) : (
            <div className="atlas-surface-raised px-4 py-3 text-[13px]" style={{ color: SP_COLORS.muted }}>
              No renewal outcomes are available yet for this partner.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
