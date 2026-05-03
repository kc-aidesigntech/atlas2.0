import React, { useMemo } from 'react'
import type { CountyHeatPoint } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

interface CountyCommonsHeatmapProps {
  points: CountyHeatPoint[]
}

const GROUP_COLORS: Record<number, string> = {
  55: SP_COLORS.yellow,
  56: SP_COLORS.orange,
  57: SP_COLORS.red,
  59: SP_COLORS.deepGreen,
  60: SP_COLORS.blue,
  62: SP_COLORS.purple,
  63: SP_COLORS.brown,
  64: SP_COLORS.green,
  65: SP_COLORS.steel,
  75: SP_COLORS.white
}

export default function CountyCommonsHeatmap({ points }: CountyCommonsHeatmapProps) {
  const byCounty = useMemo(() => {
    const grouped = new Map<string, CountyHeatPoint[]>()
    for (const point of points) {
      const key = point.countyName.toLowerCase()
      const next = grouped.get(key) || []
      next.push(point)
      grouped.set(key, next)
    }
    // Sort once when deriving view data so render stays pure and doesn't mutate grouped arrays in place.
    return Array.from(grouped.entries()).map(([countyName, countyPoints]) => [
      countyName,
      countyPoints.slice().sort((a, b) => b.activeCaseCount - a.activeCaseCount)
    ] as const)
  }, [points])

  return (
    <div className="w-full rounded-2xl border px-4 py-3" style={{ borderColor: '#ffffff50' }}>
      <small className="mb-2 block text-[13px] text-white">county commons heat map</small>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {byCounty.map(([countyName, countyPoints]) => (
          <div key={countyName} className="rounded-xl border px-3 py-2" style={{ borderColor: '#ffffff33' }}>
            <small className="mb-2 block text-[12px] uppercase tracking-wide text-white">{countyName}</small>
            <div className="flex flex-wrap gap-2">
              {countyPoints
                .map((point) => (
                  <div
                    key={`${point.countyId}-${point.zGroup}`}
                    className="inline-flex min-w-[72px] items-center justify-between rounded-md px-2 py-1"
                    style={{
                      backgroundColor: `${GROUP_COLORS[point.zGroup] || SP_COLORS.steel}33`,
                      border: `1px solid ${GROUP_COLORS[point.zGroup] || SP_COLORS.steel}`
                    }}
                  >
                    <small className="text-[11px] font-semibold text-white">z{point.zGroup}</small>
                    <small className="text-[11px] text-white">{point.activeCaseCount}</small>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
