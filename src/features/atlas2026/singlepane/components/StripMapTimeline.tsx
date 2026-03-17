import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Group } from '@visx/group'
import { LinePath } from '@visx/shape'
import { scaleTime } from 'd3-scale'
import type { RouteLogEvent, StabilizationPhase, StationIcon, TimelineConfig, ZDomain } from '../types'
import { SP_COLORS } from '../theme'

interface StripMapTimelineProps {
  events: RouteLogEvent[]
  timelineConfig: TimelineConfig
}

const STATUS_COLORS = {
  planned: SP_COLORS.steel,
  active: SP_COLORS.orange,
  completed: SP_COLORS.deepGreen,
  blocked: SP_COLORS.red
}

const PHASE_COLORS: Record<StabilizationPhase, string> = {
  regulation: SP_COLORS.yellow,
  readiness: SP_COLORS.blue,
  renewal: SP_COLORS.deepGreen
}

const DOMAIN_GLYPHS: Record<ZDomain, string> = {
  housing: 'h',
  health: '+',
  work: 'w',
  social: 's',
  legal: 'l',
  education: 'e'
}

const STATION_GLYPHS: Record<StationIcon, string> = {
  housing: 'h',
  health: '+',
  work: 'w',
  social: 's',
  legal: 'l',
  education: 'e',
  check: 'v',
  flag: 'f'
}

function addMonths(date: Date, months: number) {
  const clone = new Date(date)
  clone.setMonth(clone.getMonth() + months)
  return clone
}

export default function StripMapTimeline({ events, timelineConfig }: StripMapTimelineProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(920)
  const height = 280
  const baselineY = 124
  const marginX = 90

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
    const planStart = new Date(timelineConfig.planStartIso)
    const safePlanStart = Number.isFinite(planStart.getTime()) ? planStart : new Date()
    const safeDuration = Math.min(timelineConfig.maxDurationMonths || 12, Math.max(1, timelineConfig.durationMonths || 6))
    const planEnd = addMonths(safePlanStart, safeDuration)
    return scaleTime().domain([safePlanStart, planEnd]).range([marginX, width - marginX])
  }, [marginX, timelineConfig.durationMonths, timelineConfig.maxDurationMonths, timelineConfig.planStartIso, width])

  const baselinePoints = useMemo(
    () => [
      { x: marginX, y: baselineY },
      { x: width - marginX, y: baselineY }
    ],
    [baselineY, marginX, width]
  )

  function getEventX(event: RouteLogEvent, index: number) {
    const timestamp = new Date(event.timestampIso).getTime()
    const denominator = Math.max(sortedEvents.length - 1, 1)
    const fallbackX = marginX + ((width - marginX * 2) * index) / denominator
    if (Number.isFinite(timestamp)) {
      const scaledX = Number(timeScale(new Date(timestamp)))
      return Number.isFinite(scaledX) ? scaledX : fallbackX
    }
    return fallbackX
  }

  return (
    <div ref={wrapperRef} className="relative h-[260px] w-full overflow-visible">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Group>
          <LinePath data={baselinePoints} x={(point) => point.x} y={(point) => point.y} stroke={SP_COLORS.white} strokeWidth={5} />

          {/* phase corridor segments driven by dynamic gates */}
          {timelineConfig.gates.slice(0, -1).map((gate, index) => {
            const next = timelineConfig.gates[index + 1]
            if (!next) return null
            const startDate = addMonths(new Date(timelineConfig.planStartIso), gate.monthOffset || 0)
            const endDate = addMonths(new Date(timelineConfig.planStartIso), next.monthOffset || 0)
            const xStart = Number(timeScale(startDate))
            const xEnd = Number(timeScale(endDate))
            return (
              <g key={gate.id}>
                <line
                  x1={xStart}
                  y1={baselineY}
                  x2={xEnd}
                  y2={baselineY}
                  stroke={PHASE_COLORS[gate.phase as StabilizationPhase]}
                  strokeWidth={6}
                  strokeOpacity={0.8}
                />
                <text
                  x={(xStart + xEnd) / 2}
                  y={baselineY - 22}
                  textAnchor="middle"
                  fill={SP_COLORS.white}
                  fontFamily="Helvetica, Arial, sans-serif"
                  fontSize="12"
                >
                  {gate.label}
                </text>
              </g>
            )
          })}

          {/* directional arrows */}
          {[0.3, 0.65].map((ratio) => {
            const arrowX = marginX + (width - marginX * 2) * ratio
            return (
              <g key={ratio} transform={`translate(${arrowX}, ${baselineY})`}>
                <line x1="-30" y1="-26" x2="0" y2="0" stroke={SP_COLORS.white} strokeWidth="5" strokeLinecap="round" />
                <line x1="-30" y1="26" x2="0" y2="0" stroke={SP_COLORS.white} strokeWidth="5" strokeLinecap="round" />
              </g>
            )
          })}

          {sortedEvents.map((event, index) => {
            const x = getEventX(event, index)
            const color = STATUS_COLORS[event.status]
            const domains = Array.isArray(event.domainsRelieved) ? event.domainsRelieved : []
            return (
              <g key={event.id} transform={`translate(${x}, ${baselineY})`}>
                <circle r="11" fill={color} stroke={SP_COLORS.white} strokeWidth="2.2" fillOpacity="0.95" />
                <text y={-18} textAnchor="middle" fill={SP_COLORS.white} fontFamily="Helvetica, Arial, sans-serif" fontSize="9">
                  {index + 1}
                </text>
                <text y={24} textAnchor="middle" fill={SP_COLORS.white} fontFamily="Helvetica, Arial, sans-serif" fontSize="11">
                  {event.label}
                </text>
                {domains.slice(0, 3).map((domain, domainIndex) => (
                  <g key={`${event.id}-${domain}`} transform={`translate(${(domainIndex - 1) * 20}, 48)`}>
                    <circle r="8" fill="#000000" stroke={SP_COLORS.white} strokeWidth="1.4" />
                    <text
                      y="3"
                      textAnchor="middle"
                      fill={SP_COLORS.white}
                      fontFamily="Helvetica, Arial, sans-serif"
                      fontSize="8"
                      fontWeight={700}
                    >
                      {DOMAIN_GLYPHS[domain] || STATION_GLYPHS[event.stationIcon || 'check'] || '?'}
                    </text>
                  </g>
                ))}
              </g>
            )
          })}
        </Group>
      </svg>
    </div>
  )
}
