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

function AxisTick(props: {
  x?: number
  y?: number
  cx?: number
  cy?: number
  payload?: { value?: string }
  labelMap?: ReadonlyMap<string, string>
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
  const dx = anchor === 'middle' ? 0 : anchor === 'start' ? 12 : -12
  const baseDy = y < cy ? -8 : y > cy ? 10 : 4

  return (
    <text
      x={x + dx}
      y={y + baseDy}
      textAnchor={anchor}
      fill={SP_COLORS.text}
      fontFamily="Helvetica, Arial, sans-serif"
      fontSize="13"
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

export default function RadialLoadChart({ load, onClick }: RadialLoadChartProps) {
  const habitat = load?.habitat || 0
  const work = load?.work || 0
  const social = load?.socialNetworks || 0
  const habitatWorkBlend = (habitat + work) / 2
  const workSocialBlend = (work + social) / 2
  const socialHabitatBlend = (social + habitat) / 2
  const maxDomainValue = Math.max(
    habitat,
    habitatWorkBlend,
    work,
    workSocialBlend,
    social,
    socialHabitatBlend,
    1
  )
  const chartDomainMax = Math.max(6, Math.min(9, Math.ceil(maxDomainValue + 2)))

  const data: ChartAxisPoint[] = [
    { axis: 'habitat', label: 'habitat', value: habitat },
    { axis: 'habitat-work-blend', label: '', value: habitatWorkBlend },
    { axis: 'work', label: 'work', value: work },
    { axis: 'work-social-blend', label: '', value: workSocialBlend },
    { axis: 'social-networks', label: 'social networks', value: social },
    { axis: 'social-habitat-blend', label: '', value: socialHabitatBlend }
  ]
  const axisLabelMap = React.useMemo(() => new Map(data.map((point) => [point.axis, point.label])), [data])
  const tickCount = Math.min(Math.max(Math.ceil(chartDomainMax), 3), 6)
  const Wrapper = onClick ? 'button' : 'div'

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex h-[320px] w-full max-w-[520px] flex-col items-center justify-center overflow-visible px-4 sm:h-[350px] sm:max-w-[560px] sm:px-5 ${
        onClick ? 'cursor-pointer rounded-[28px] transition-opacity hover:opacity-90' : ''
      }`}
      aria-label={onClick ? 'Open radial load source table' : undefined}
    >
      <div className="flex h-[80%] w-full items-center justify-center overflow-visible">
        <div className="h-full w-full max-w-[470px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} cx="50%" cy="51%" outerRadius="76%" startAngle={90} endAngle={-270} margin={{ top: 22, right: 84, bottom: 32, left: 84 }}>
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
                tick={(tickProps) => <AxisTick {...tickProps} labelMap={axisLabelMap} />}
                axisLine={false}
                tickLine={false}
              />
              <Radar
                dataKey="value"
                stroke={SP_COLORS.white}
                fill="var(--atlas-signal-lucid-teal)"
                fillOpacity={0.5}
                strokeOpacity={1}
                strokeWidth={2}
                isAnimationActive={false}
                dot={{ r: 3.5, fill: SP_COLORS.white, stroke: 'var(--atlas-signal-lucid-teal)', strokeWidth: 1.5 }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-1 flex w-full items-center justify-between px-3">
        <small className="text-[14px]" style={{ color: SP_COLORS.text }}>
          manageable strain
        </small>
        <small className="text-[14px]" style={{ color: SP_COLORS.text }}>
          destabilizing load
        </small>
      </div>
      {onClick ? (
        <small className="mt-1 text-[11px] uppercase tracking-[0.08em] text-[#9f9f9f]">click chart to inspect source rows</small>
      ) : null}
    </Wrapper>
  )
}
