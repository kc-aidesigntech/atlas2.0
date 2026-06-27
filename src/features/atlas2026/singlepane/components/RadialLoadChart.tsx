/**
 * Compact radial load visualization for habitat/work/social domains used by
 * profile and station panels, with optional click-through behavior.
 */
import React from 'react'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts'
import type { DomainLoad } from '../types'
import { SP_COLORS } from '../theme'

interface RadialLoadChartProps {
  load: DomainLoad | null
  onClick?: () => void
  size?: 'default' | 'large'
}

interface ChartAxisPoint {
  axis: string
  label: string
  value: number
}

function wrapAxisLabel(label: string) {
  if (!label.includes(' ')) return [label]
  return label.split(/\s+/).filter(Boolean)
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return null
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16)
  ] as const
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0')).join('')}`
}

/** Spectrum segment colors from low (manageable strain) to high (destabilizing load). */
function loadScaleSegmentColor(lowHex: string, highHex: string, segmentIndex: number, segmentCount: number) {
  if (segmentCount <= 1) return lowHex
  const a = hexToRgb(lowHex)
  const b = hexToRgb(highHex)
  if (!a || !b) return lowHex
  const t = segmentIndex / (segmentCount - 1)
  const r = Math.round(a[0] + (b[0] - a[0]) * t)
  const g = Math.round(a[1] + (b[1] - a[1]) * t)
  const bl = Math.round(a[2] + (b[2] - a[2]) * t)
  return rgbToHex(r, g, bl)
}

function AxisTick(props: {
  x?: number
  y?: number
  cx?: number
  cy?: number
  payload?: { value?: string }
  labelMap?: ReadonlyMap<string, string>
  fontSize?: string
  dxOffset?: number
  upperDy?: number
  lowerDy?: number
}) {
  const axisKey = props.payload?.value || ''
  const label = props.labelMap?.get(axisKey) || ''
  if (!label.trim()) return null

  const x = props.x ?? 0
  const y = props.y ?? 0
  const cx = props.cx ?? 0
  const cy = props.cy ?? 0
  const lines = wrapAxisLabel(label)
  const anchor = Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end'
  const dxOffset = props.dxOffset ?? 12
  const dx = anchor === 'middle' ? 0 : anchor === 'start' ? dxOffset : -dxOffset
  const baseDy = y < cy ? (props.upperDy ?? -8) : y > cy ? (props.lowerDy ?? 10) : 4

  return (
    <text
      x={x + dx}
      y={y + baseDy}
      textAnchor={anchor}
      fill={SP_COLORS.text}
      fontFamily="Helvetica, Arial, sans-serif"
      fontSize={props.fontSize ?? '13'}
      fontWeight={500}
    >
      {lines.map((line, index) => (
        <tspan key={`${label}-${line}-${index}`} x={x + dx} dy={index === 0 ? 0 : 13}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

export default function RadialLoadChart({ load, onClick, size = 'default' }: RadialLoadChartProps) {
  const habitat = load?.habitat || 0
  const work = load?.work || 0
  const social = load?.socialNetworks || 0
  const habitatSocialBlend = (habitat + social) / 2
  const socialWorkBlend = (social + work) / 2
  const workHabitatBlend = (work + habitat) / 2
  const maxDomainValue = Math.max(
    habitat,
    habitatSocialBlend,
    social,
    socialWorkBlend,
    work,
    workHabitatBlend,
    1
  )
  const chartDomainMax = Math.max(6, Math.min(9, Math.ceil(maxDomainValue + 2)))

  // Keep vertex order aligned with domain-spectrum controls so clockwise
  // orientation is consistent anywhere we render habitat/social/work.
  const data: ChartAxisPoint[] = [
    { axis: 'habitat', label: 'habitat', value: habitat },
    { axis: 'habitat-social-blend', label: '', value: habitatSocialBlend },
    { axis: 'social-networks', label: 'social networks', value: social },
    { axis: 'social-work-blend', label: '', value: socialWorkBlend },
    { axis: 'work', label: 'work', value: work },
    { axis: 'work-habitat-blend', label: '', value: workHabitatBlend }
  ]
  const axisLabelMap = React.useMemo(() => new Map(data.map((point) => [point.axis, point.label])), [data])
  const tickCount = Math.min(Math.max(Math.ceil(chartDomainMax), 3), 6)
  const Wrapper = onClick ? 'button' : 'div'
  const isLarge = size === 'large'
  /** Tight wrapper: chart block is fixed height; no percentage split (avoids empty band above helper). */
  const wrapperClassName = isLarge
    ? 'w-fit max-w-[min(100vw-2rem,780px)] pl-2 pr-1 sm:pl-3 sm:pr-2'
    : 'w-fit max-w-[min(100vw-2rem,460px)] pl-1.5 pr-2 sm:pl-2 sm:pr-3'
  const chartShellClassName = 'h-full min-h-0 w-full max-w-full overflow-visible'
  const chartBlockHeightClass = isLarge ? 'h-[320px] sm:h-[346px] lg:h-[366px]' : 'h-[242px] sm:h-[265px]'
  const chartBlockWidthClass = isLarge
    ? 'w-[min(100%,728px)] min-w-[364px] sm:w-[min(100%,780px)]'
    : 'w-[min(100%,368px)] min-w-[272px] sm:w-[min(100%,392px)]'
  /** Extra left margin so angle labels (e.g. «social networks») are not clipped by the SVG box. */
  const chartMargin = isLarge
    ? { top: 0, right: 64, bottom: 6, left: 108 }
    : { top: 8, right: 28, bottom: 20, left: 88 }
  const outerRadius = isLarge ? '92%' : '86%'
  const chartCx = isLarge ? '50%' : '51%'
  const chartCy = isLarge ? '46%' : '50%'
  const axisFontSize = isLarge ? '17' : '14'
  const axisDx = isLarge ? 18 : 14
  const axisUpperDy = isLarge ? -10 : -8
  const axisLowerDy = isLarge ? 12 : 10
  const helperClassName = isLarge
    ? 'mt-0 block w-full max-w-[min(100%,420px)] text-center text-[12px] uppercase leading-tight tracking-[0.08em] text-[#9f9f9f]'
    : 'mt-0.5 block w-full max-w-[min(100%,392px)] text-center text-[10px] uppercase leading-tight tracking-[0.08em] text-[#9f9f9f]'
  const radarStrokeWidth = isLarge ? 1.5 : 2
  const radarDot = isLarge
    ? { r: 5.5, fill: SP_COLORS.white, stroke: 'var(--atlas-signal-lucid-teal)', strokeWidth: 2 }
    : { r: 3.5, fill: SP_COLORS.white, stroke: 'var(--atlas-signal-lucid-teal)', strokeWidth: 1.5 }

  const loadScaleLowHex = SP_COLORS.deepGreen
  const loadScaleHighHex = SP_COLORS.red
  const [loadScaleTooltip, setLoadScaleTooltip] = React.useState<{ x: number; y: number } | null>(null)

  const layoutClasses = 'flex flex-col items-center gap-0'

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`${layoutClasses} relative overflow-visible ${wrapperClassName} ${
        onClick ? 'cursor-pointer rounded-[28px] transition-opacity hover:opacity-90' : ''
      }`}
      aria-label={onClick ? 'Open radial load source table' : undefined}
      onMouseEnter={(e) => setLoadScaleTooltip({ x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => setLoadScaleTooltip({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setLoadScaleTooltip(null)}
    >
      <div className={`flex shrink-0 justify-center overflow-visible ${chartBlockHeightClass} ${chartBlockWidthClass}`}>
        <div className={chartShellClassName}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} cx={chartCx} cy={chartCy} outerRadius={outerRadius} startAngle={90} endAngle={-270} margin={chartMargin}>
              <PolarGrid
                gridType="polygon"
                radialLines
                stroke={SP_COLORS.text}
                strokeOpacity={0.38}
                strokeWidth={0.55}
              />
              <PolarRadiusAxis
                domain={[0, chartDomainMax]}
                tickCount={tickCount}
                tick={{ fill: 'transparent', fontSize: 1 }}
                axisLine={false}
                tickLine={false}
              />
              <PolarAngleAxis
                dataKey="axis"
                tick={(tickProps) => (
                  <AxisTick
                    {...tickProps}
                    labelMap={axisLabelMap}
                    fontSize={axisFontSize}
                    dxOffset={axisDx}
                    upperDy={axisUpperDy}
                    lowerDy={axisLowerDy}
                  />
                )}
                axisLine={false}
                tickLine={false}
              />
              <Radar
                dataKey="value"
                stroke={SP_COLORS.white}
                fill="var(--atlas-signal-lucid-teal)"
                fillOpacity={0.5}
                strokeOpacity={1}
                strokeWidth={radarStrokeWidth}
                isAnimationActive={false}
                dot={radarDot}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {loadScaleTooltip ? (
        <div
          className="pointer-events-none fixed z-[80] w-[min(92vw,240px)] rounded-[14px] border px-3 py-2.5 shadow-lg"
          style={{
            left: (() => {
              const pad = 12
              const tipW = 248
              const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
              return Math.max(pad, Math.min(loadScaleTooltip.x + 14, vw - tipW - pad))
            })(),
            top: (() => {
              const pad = 12
              const tipH = 140
              const vh = typeof window !== 'undefined' ? window.innerHeight : 800
              return Math.max(pad, Math.min(loadScaleTooltip.y + 14, vh - tipH - pad))
            })(),
            borderColor: '#ffffff38',
            backgroundColor: 'rgba(8, 8, 8, 0.96)',
            color: SP_COLORS.text
          }}
          role="tooltip"
        >
          <div className="text-[11px] font-medium uppercase tracking-[0.1em]" style={{ color: SP_COLORS.muted }}>
            radial scale
          </div>
          <p className="mt-1 text-[12px] leading-snug" style={{ color: '#e4e8eb' }}>
            Distance from center matches ring steps on the chart ({tickCount} levels). Lower values are closer to the center.
          </p>
          <div className="mt-2 flex h-2.5 w-full gap-px overflow-hidden rounded-sm" aria-hidden="true">
            {Array.from({ length: tickCount }).map((_, index) => (
              <div
                key={index}
                className="min-w-0 flex-1"
                style={{
                  backgroundColor: loadScaleSegmentColor(loadScaleLowHex, loadScaleHighHex, index, tickCount)
                }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between gap-2 text-[11px] leading-snug" style={{ color: SP_COLORS.muted }}>
            <span className="text-left">manageable strain (low)</span>
            <span className="text-right">destabilizing load (high)</span>
          </div>
        </div>
      ) : null}
      {onClick ? (
        <small className={helperClassName}>click chart to inspect source rows</small>
      ) : null}
    </Wrapper>
  )
}
