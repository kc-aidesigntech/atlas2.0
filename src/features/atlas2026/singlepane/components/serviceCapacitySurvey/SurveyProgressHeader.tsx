import React from 'react'
import { usesLightTextOnZCodeColor } from '@atlas/shared'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'

export interface SurveySectionProgressItem {
  parentCode: string
  total: number
  completed: number
  accentColor: string
  isCurrent: boolean
}

/**
 * Shows total and per-parent survey progress while keeping Z-code color contrast accessible.
 */
export default function SurveyProgressHeader({
  currentIndex,
  totalCount,
  completedCount,
  parentCode,
  parentTheme,
  accentColor,
  sectionProgress,
  pinToViewport = true,
  className = ''
}: {
  currentIndex: number
  totalCount: number
  completedCount: number
  parentCode: string
  parentTheme: string
  accentColor: string
  sectionProgress: SurveySectionProgressItem[]
  pinToViewport?: boolean
  className?: string
}) {
  const ratio = totalCount ? completedCount / totalCount : 0
  const useLightText = usesLightTextOnZCodeColor(accentColor)

  return (
    <div className={`atlas-surface-panel ${pinToViewport ? 'sticky top-0 z-30' : 'relative'} mt-5 bg-[color:var(--surface-panel-soft)] px-4 py-3 backdrop-blur-sm transition-[padding,border-radius,background-color] duration-500 ease-out md:px-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <small className="atlas-overline block md:text-[13px]" style={{ color: SP_COLORS.muted }}>
            survey progress
          </small>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className="rounded-[10px] px-2.5 py-1 text-[12px] font-semibold md:text-[13px]"
              style={{
                backgroundColor: accentColor,
                color: useLightText ? SP_COLORS.white : SP_COLORS.bg
              }}
            >
              {parentCode}
            </span>
            <small className="text-[12px] text-[#d5d5d5] md:text-[13px]">{parentTheme}</small>
          </div>
        </div>
        <small className="text-[12px] md:text-[13px]" style={{ color: SP_COLORS.muted }}>
          {Math.min(currentIndex + 1, totalCount)} of {totalCount} viewed | {completedCount} completed
        </small>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-200 ease-out"
          style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%`, backgroundColor: accentColor }}
        />
      </div>
      <div
        className="mt-4 grid items-start justify-items-center gap-1.5 sm:gap-2"
        style={{ gridTemplateColumns: `repeat(${sectionProgress.length}, minmax(0, 1fr))` }}
      >
        {sectionProgress.map((item) => {
          const sectionRatio = item.total ? item.completed / item.total : 0
          const circleSize = 40
          const radius = 17
          const circumference = 2 * Math.PI * radius
          const dashOffset = circumference * (1 - Math.max(0, Math.min(1, sectionRatio)))
          const itemUsesLightText = usesLightTextOnZCodeColor(item.accentColor)
          const isComplete = item.total > 0 && item.completed === item.total

          return (
            <div
              key={item.parentCode}
              className={`flex w-full min-w-0 flex-col items-center gap-1 rounded-[11px] px-1 py-1.5 transition-[background-color,border-color] duration-200 ease-out ${
                item.isCurrent ? 'border bg-white/6' : 'border border-transparent bg-transparent'
              }`}
              style={item.isCurrent ? { borderColor: '#ffffff14' } : undefined}
            >
              <div className="relative h-[clamp(26px,7vw,40px)] w-[clamp(26px,7vw,40px)]">
                <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox={`0 0 ${circleSize} ${circleSize}`} aria-hidden="true">
                  <circle cx={circleSize / 2} cy={circleSize / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
                  <circle
                    cx={circleSize / 2}
                    cy={circleSize / 2}
                    r={radius}
                    fill="none"
                    stroke={item.accentColor}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                  />
                </svg>
                <div
                  className="absolute left-1/2 top-1/2 flex h-[calc(100%-8px)] w-[calc(100%-8px)] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[clamp(10px,2.5vw,14px)] font-bold leading-none"
                  style={{
                    backgroundColor: isComplete ? item.accentColor : 'var(--surface-panel-raised)',
                    color: isComplete ? (itemUsesLightText ? SP_COLORS.white : SP_COLORS.bg) : item.accentColor,
                    border: `1px solid ${isComplete ? item.accentColor : '#ffffff1f'}`
                  }}
                >
                  {item.parentCode.replace(/^Z/i, '')}
                </div>
              </div>
              <small className="text-[clamp(8px,1.8vw,12px)] font-medium leading-none" style={{ color: SP_COLORS.muted }}>
                {item.completed}/{item.total}
              </small>
            </div>
          )
        })}
      </div>
    </div>
  )
}
