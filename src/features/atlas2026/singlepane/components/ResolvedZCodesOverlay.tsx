import React from 'react'
import { Check } from 'lucide-react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { EnrolleeProfile, RouteCandidateRecord } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import { getZCodeParentColor, usesLightTextOnZCodeColor } from '@atlas/shared'

interface ResolvedZCodesOverlayProps {
  isOpen: boolean
  enrollee: EnrolleeProfile | null
  candidate?: RouteCandidateRecord | null
  onClose: () => void
  onToggleResolution: (enrolleeZCodeId: string, isResolved: boolean) => Promise<unknown>
}

export default function ResolvedZCodesOverlay({
  isOpen,
  enrollee,
  candidate = null,
  onClose,
  onToggleResolution
}: ResolvedZCodesOverlayProps) {
  const [savingIds, setSavingIds] = React.useState<string[]>([])

  const details = enrollee?.activeZCodeDetails || []

  if (!isOpen || !enrollee) return null

  async function handleToggle(enrolleeZCodeId: string, isResolved: boolean) {
    setSavingIds((current) => [...current, enrolleeZCodeId])
    try {
      await onToggleResolution(enrolleeZCodeId, isResolved)
    } finally {
      setSavingIds((current) => current.filter((id) => id !== enrolleeZCodeId))
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center bg-black/72 px-5 py-6 backdrop-blur-[2px]">
      <div
        className="max-h-[calc(100vh-72px)] w-full max-w-[920px] overflow-y-auto rounded-[34px] border px-4 py-4 sm:px-5 sm:py-5"
        style={{ borderColor: SP_COLORS.white, backgroundColor: 'var(--surface-panel-soft)' }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <small className="block text-[11px] uppercase tracking-[0.18em]" style={{ color: '#9ea8b4' }}>
              route resolution
            </small>
            <h3 className="text-[30px] font-medium text-white">which zcodes were resolved?</h3>
            <small className="mt-2 block text-[12px] leading-[1.45]" style={{ color: '#b1bcc8' }}>
              {candidate ? `${candidate.stationName} assigned` : enrollee.fullName}
            </small>
          </div>
          <AtlasTextButton
            onClick={onClose}
            className="px-3 py-1.5 text-[11px] font-medium"
            style={{ ['--button-border-color' as const]: '#ffffff45', color: SP_COLORS.white } as React.CSSProperties}
          >
            close
          </AtlasTextButton>
        </div>

        <div className="grid gap-3">
          {details.length ? (
            details.map((detail) => {
              const parentFill = getZCodeParentColor(detail.parentCode) || SP_COLORS.yellow
              const parentTextColor = usesLightTextOnZCodeColor(parentFill) ? SP_COLORS.white : SP_COLORS.bg
              const isSaving = savingIds.includes(detail.enrolleeZCodeId)
              return (
                <button
                  key={detail.enrolleeZCodeId}
                  type="button"
                  onClick={() => handleToggle(detail.enrolleeZCodeId, !detail.isResolved)}
                  disabled={isSaving}
                  className="flex w-full items-start gap-3 rounded-[20px] border px-3 py-3 text-left transition-[border-color,box-shadow,opacity] duration-150 hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15)] disabled:opacity-60"
                  style={{
                    borderColor: detail.isResolved ? `${SP_COLORS.deepGreen}88` : '#ffffff22',
                    backgroundColor: detail.isResolved ? 'rgba(111,207,151,0.08)' : 'var(--surface-panel-raised)'
                  }}
                >
                  <span
                    className="inline-flex h-12 min-w-[3rem] items-center justify-center rounded-full border px-2 text-[18px] font-semibold"
                    style={{ backgroundColor: parentFill, borderColor: parentFill, color: parentTextColor }}
                  >
                    {detail.zCode.replace(/^Z/i, '')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[18px] font-medium text-white">{detail.title || detail.zCode}</span>
                      <span className="rounded-full border px-2 py-[2px] text-[10px] uppercase tracking-[0.12em]" style={{ borderColor: '#ffffff22', color: '#b0bcc9' }}>
                        {detail.parentCode}
                      </span>
                    </div>
                    <small className="mt-1 block text-[13px] leading-[1.45]" style={{ color: '#b5c0cb' }}>
                      {detail.description || 'No context available yet for this Z-code.'}
                    </small>
                  </div>
                  <span
                    aria-hidden="true"
                    className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border"
                    style={{
                      borderColor: detail.isResolved ? SP_COLORS.deepGreen : '#ffffff35',
                      color: detail.isResolved ? SP_COLORS.deepGreen : SP_COLORS.white
                    } as React.CSSProperties}
                  >
                    <Check size={17} strokeWidth={2.1} />
                  </span>
                </button>
              )
            })
          ) : (
            <div className="rounded-[20px] border px-4 py-5 text-[13px]" style={{ borderColor: '#ffffff24', color: '#c7d0d9' }}>
              No active Z-codes are available for this enrollee.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
