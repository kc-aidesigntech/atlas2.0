import React, { useEffect, useMemo, useState } from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { StabilizationPhase, TimelineConfig } from '../types'
import {
  adjustTimelineDuration,
  adjustTimelinePhaseLength,
  buildTimelinePhaseSegments,
  normalizeTimelineConfig
} from '../timelineConfigUtils'
import { SP_COLORS } from '../theme'

interface StripMapControlOverlayProps {
  isOpen: boolean
  timelineConfig: TimelineConfig
  onClose: () => void
  onSave: (nextConfig: TimelineConfig) => void
}

const PHASE_COLORS: Record<StabilizationPhase, string> = {
  regulation: SP_COLORS.red,
  readiness: SP_COLORS.yellow,
  renewal: SP_COLORS.deepGreen
}

function formatDateInputValue(timestampIso: string) {
  const date = new Date(timestampIso)
  if (!Number.isFinite(date.getTime())) return ''
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${date.getUTCDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function StripMapControlOverlay({
  isOpen,
  timelineConfig,
  onClose,
  onSave
}: StripMapControlOverlayProps) {
  const [draftConfig, setDraftConfig] = useState(() => normalizeTimelineConfig(timelineConfig))

  useEffect(() => {
    if (!isOpen) return
    setDraftConfig(normalizeTimelineConfig(timelineConfig))
  }, [isOpen, timelineConfig])

  const normalizedDraftConfig = useMemo(() => normalizeTimelineConfig(draftConfig), [draftConfig])
  const phaseSegments = useMemo(() => buildTimelinePhaseSegments(normalizedDraftConfig), [normalizedDraftConfig])

  if (!isOpen) return null

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-black/70 px-4 py-5 backdrop-blur-[2px]">
      <div
        className="w-full max-w-[560px] rounded-[24px] border px-5 py-5 md:px-6 md:py-6"
        style={{ borderColor: '#ffffff30', backgroundColor: 'var(--surface-panel-soft)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <small className="block text-[12px] uppercase tracking-[0.14em]" style={{ color: SP_COLORS.muted }}>
              strip map controls
            </small>
            <div className="mt-1 text-[22px] font-medium text-white md:text-[26px]">timeline setup</div>
            <small className="mt-1 block text-[13px] text-[#bdbdbd] md:text-[14px]">
              Set the start date, overall duration, and the 30-day geometry of regulation, readiness, and renewal.
            </small>
          </div>
          <AtlasTextButton
            onClick={onClose}
            className="px-4 py-2 text-[12px] font-medium"
            style={{ ['--button-border-color' as const]: '#ffffff30', color: SP_COLORS.white } as React.CSSProperties}
          >
            close
          </AtlasTextButton>
        </div>

        <div className="mt-5 space-y-4">
          <section className="rounded-[18px] border px-4 py-4" style={{ borderColor: '#ffffff18', backgroundColor: 'var(--surface-panel-raised)' }}>
            <small className="block text-[11px] uppercase tracking-[0.12em]" style={{ color: SP_COLORS.muted }}>
              start date
            </small>
            <input
              type="date"
              value={formatDateInputValue(normalizedDraftConfig.planStartIso)}
              onChange={(event) => {
                const nextValue = event.target.value
                if (!nextValue) return
                setDraftConfig((current) =>
                  normalizeTimelineConfig({
                    ...current,
                    planStartIso: new Date(`${nextValue}T00:00:00.000Z`).toISOString()
                  })
                )
              }}
              className="mt-3 w-full rounded-[11px] border bg-[var(--surface-panel-raised)] px-3 py-2 text-[14px] text-white md:text-[16px]"
              style={{ borderColor: '#ffffff30' }}
            />
          </section>

          <section className="rounded-[18px] border px-4 py-4" style={{ borderColor: '#ffffff18', backgroundColor: 'var(--surface-panel-raised)' }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <small className="block text-[11px] uppercase tracking-[0.12em]" style={{ color: SP_COLORS.muted }}>
                  total duration
                </small>
                <div className="mt-1 text-[18px] text-white md:text-[20px]">{normalizedDraftConfig.durationMonths * 30} days</div>
              </div>
              <div className="flex items-center gap-2">
                <AtlasTextButton
                  onClick={() => setDraftConfig((current) => adjustTimelineDuration(current, -1))}
                  className="px-3 py-1.5 text-[12px] font-medium"
                  style={{ ['--button-border-color' as const]: '#ffffff2c', color: SP_COLORS.white } as React.CSSProperties}
                >
                  -30d
                </AtlasTextButton>
                <AtlasTextButton
                  onClick={() => setDraftConfig((current) => adjustTimelineDuration(current, 1))}
                  className="px-3 py-1.5 text-[12px] font-medium"
                  style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
                >
                  +30d
                </AtlasTextButton>
              </div>
            </div>
          </section>

          <section className="rounded-[18px] border px-4 py-4" style={{ borderColor: '#ffffff18', backgroundColor: 'var(--surface-panel-raised)' }}>
            <small className="block text-[11px] uppercase tracking-[0.12em]" style={{ color: SP_COLORS.muted }}>
              phase lengths
            </small>
            <div className="mt-3 space-y-3">
              {phaseSegments.map((segment) => {
                const phaseLengthDays = (segment.endOffset - segment.startOffset) * 30
                return (
                  <div
                    key={segment.phase}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border px-3 py-3"
                    style={{ borderColor: '#ffffff14', backgroundColor: 'var(--surface-panel-soft)' }}
                  >
                    <div className="min-w-0">
                      <small className="block text-[11px] uppercase tracking-[0.12em]" style={{ color: PHASE_COLORS[segment.phase] }}>
                        {segment.label}
                      </small>
                      <div className="mt-1 text-[16px] text-white">{phaseLengthDays} days</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <AtlasTextButton
                        onClick={() => setDraftConfig((current) => adjustTimelinePhaseLength(current, segment.phase, -1))}
                        className="px-3 py-1.5 text-[12px] font-medium"
                        style={{ ['--button-border-color' as const]: '#ffffff2c', color: SP_COLORS.white } as React.CSSProperties}
                      >
                        -30d
                      </AtlasTextButton>
                      <AtlasTextButton
                        onClick={() => setDraftConfig((current) => adjustTimelinePhaseLength(current, segment.phase, 1))}
                        className="px-3 py-1.5 text-[12px] font-medium"
                        style={{ ['--button-border-color' as const]: PHASE_COLORS[segment.phase], color: PHASE_COLORS[segment.phase] } as React.CSSProperties}
                      >
                        +30d
                      </AtlasTextButton>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <AtlasTextButton
            onClick={onClose}
            className="px-4 py-2 text-[12px] font-medium"
            style={{ ['--button-border-color' as const]: '#ffffff2c', color: SP_COLORS.white } as React.CSSProperties}
          >
            cancel
          </AtlasTextButton>
          <AtlasTextButton
            onClick={() => onSave(normalizedDraftConfig)}
            className="px-4 py-2 text-[12px] font-medium"
            style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
          >
            save timeline
          </AtlasTextButton>
        </div>
      </div>
    </div>
  )
}
