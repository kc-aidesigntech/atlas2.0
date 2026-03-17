import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Group } from '@visx/group'
import { LinePath } from '@visx/shape'
import { scaleTime } from 'd3-scale'
import type { RouteLogEvent } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

interface StripMapTimelineProps {
  events: RouteLogEvent[]
}

const STATUS_COLORS = {
  planned: SP_COLORS.steel,
  active: SP_COLORS.orange,
  completed: SP_COLORS.deepGreen,
  blocked: SP_COLORS.red
}

export default function StripMapTimeline({ events }: StripMapTimelineProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(920)
  const height = 220
  const baselineY = 136
  const marginX = 84

  useEffect(() => {
    const node = wrapperRef.current
    if (!node) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setWidth(Math.max(640, entry.contentRect.width))
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.timestampIso).getTime() - new Date(b.timestampIso).getTime()),
    [events]
  )

  const timeScale = useMemo(() => {
    const min = sortedEvents[0] ? new Date(sortedEvents[0].timestampIso).getTime() : Date.now() - 86400000 * 3
    const max = sortedEvents[sortedEvents.length - 1]
      ? new Date(sortedEvents[sortedEvents.length - 1].timestampIso).getTime()
      : Date.now() + 86400000 * 3
    return scaleTime<number>({
      domain: [new Date(min - 86400000), new Date(max + 86400000)],
      range: [marginX, width - marginX]
    })
  }, [marginX, sortedEvents, width])

  const baselinePoints = useMemo(
    () => [
      { x: marginX, y: baselineY },
      { x: width - marginX, y: baselineY }
    ],
    [baselineY, marginX, width]
  )

  return (
    <div ref={wrapperRef} className="h-[230px] w-full">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Group>
          <LinePath data={baselinePoints} x={(point) => point.x} y={(point) => point.y} stroke={SP_COLORS.white} strokeWidth={3} />

          {/* directional arrows */}
          {[0.3, 0.65].map((ratio) => {
            const arrowX = marginX + (width - marginX * 2) * ratio
            return (
              <g key={ratio} transform={`translate(${arrowX}, ${baselineY})`}>
                <line x1="-30" y1="-28" x2="0" y2="0" stroke={SP_COLORS.white} strokeWidth="3" strokeLinecap="round" />
                <line x1="-30" y1="28" x2="0" y2="0" stroke={SP_COLORS.white} strokeWidth="3" strokeLinecap="round" />
              </g>
            )
          })}

          {sortedEvents.map((event, index) => {
            const x = timeScale(new Date(event.timestampIso))
            const color = STATUS_COLORS[event.status]
            return (
              <g key={event.id} transform={`translate(${x}, ${baselineY})`}>
                <circle r="6" fill={color} stroke={SP_COLORS.white} strokeWidth="1" fillOpacity="0.95" />
                <text y={-16} textAnchor="middle" fill={SP_COLORS.white} fontFamily="Helvetica, Arial, sans-serif" fontSize="9">
                  {index + 1}
                </text>
              </g>
            )
          })}
        </Group>
      </svg>
    </div>
  )
}
