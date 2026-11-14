/**
 * Ordered navigator route. Each stop is one task, and the first open stop is
 * what's next. Choosing a stop opens that task in the wallet.
 */
import React from 'react'
import AtlasArrowIcon from '@/features/atlas2026/components/AtlasArrowIcon'
import { AtlasPanel } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type { NavigatorRouteStop } from '@/features/atlas2026/singlepane/domain/navigatorRoute'

interface NavigatorRouteBoardProps {
  stops: NavigatorRouteStop[]
  onOpenStop: (stop: NavigatorRouteStop) => void
}

function stopColor(status: NavigatorRouteStop['status']) {
  switch (status) {
    case 'done':
      return SP_COLORS.deepGreen
    case 'now':
      return SP_COLORS.yellow
    case 'later':
      return '#ffffff55'
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

export default function NavigatorRouteBoard({ stops, onOpenStop }: NavigatorRouteBoardProps) {
  const now = stops.find((stop) => stop.status === 'now')
  if (!stops.length) return null

  return (
    <AtlasPanel
      kicker="navigator route"
      title={now ? now.title : 'route clear'}
      description={now ? now.detail : 'Every stop on this route is done.'}
    >
      <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
        {stops.map((stop, index) => {
          const color = stopColor(stop.status)
          return (
            <React.Fragment key={stop.id}>
              {index > 0 ? (
                <div className="flex shrink-0 items-center">
                  <AtlasArrowIcon direction="right" className="h-4 w-4 opacity-70" />
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => onOpenStop(stop)}
                className="flex w-[148px] shrink-0 flex-col items-start rounded-[18px] border px-3 py-3 text-left"
                style={{
                  borderColor: color,
                  backgroundColor: stop.status === 'now' ? '#ffffff10' : 'transparent'
                }}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full border text-[12px] font-semibold" style={{ borderColor: color, color }}>
                  {stop.status === 'done' ? '✓' : stop.order}
                </span>
                <span className="mt-2 text-[13px] font-medium text-white">{stop.title}</span>
                <span className="mt-1 line-clamp-3 text-[11px] leading-snug text-[#cfcfcf]">{stop.detail}</span>
              </button>
            </React.Fragment>
          )
        })}
      </div>
    </AtlasPanel>
  )
}
