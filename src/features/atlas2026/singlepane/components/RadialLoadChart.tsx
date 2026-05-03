/**
 * Compact radial load visualization for habitat/work/social domains used by
 * profile and station panels, with optional click-through behavior.
 */
import React from 'react'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from 'recharts'
import type { DomainLoad } from '../types'
import { SP_COLORS } from '../theme'

interface RadialLoadChartProps {
  load: DomainLoad | null
  onClick?: () => void
}

function wrapAxisLabel(label: string) {
  if (!label.includes(' ')) return [label]
  return label.split(/\s+/).filter(Boolean)
}

function AxisTick(props: { x?: number; y?: number; cx?: number; cy?: number; payload?: { value?: string } }) {
  const label = props.payload?.value || ''
  if (!label || label.includes('-')) return null

  const x = props.x ?? 0
  const y = props.y ?? 0
  const cx = props.cx ?? 0
  const cy = props.cy ?? 0
  const lines = wrapAxisLabel(label)
  const anchor = Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end'
  const dx = anchor === 'middle' ? 0 : anchor === 'start' ? 8 : -8
  const baseDy = y < cy ? -4 : y > cy ? 6 : 4

  return (
    <text
      x={x + dx}
      y={y + baseDy}
      textAnchor={anchor}
      fill={SP_COLORS.text}
      fontFamily="Helvetica, Arial, sans-serif"
      fontSize="14"
      fontWeight={500}
    >
      {lines.map((line, index) => (
        <tspan key={`${label}-${line}-${index}`} x={x + dx} dy={index === 0 ? 0 : 14}>
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
  const chartWidth = 340
  const chartHeight = 220

  // Six-point polygon mixes anchor domains with adjacency averages so chart
  // area communicates both direct burden and cross-domain interaction.
  const data = [
    { axis: 'habitat', value: habitat },
    { axis: 'habitat-social', value: Math.round((habitat + social) / 2) },
    { axis: 'social networks', value: social },
    { axis: 'social-work', value: Math.round((social + work) / 2) },
    { axis: 'work', value: work },
    { axis: 'work-habitat', value: Math.round((work + habitat) / 2) }
  ]
  const polarRadius = [12, 24, 36, 48, 60, 72]
  const polarAngles = [90, 30, -30, -90, -150, -210]
  const Wrapper = onClick ? 'button' : 'div'

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex h-[250px] w-full max-w-[400px] flex-col items-center justify-center overflow-visible pr-3 sm:h-[280px] sm:max-w-[420px] sm:pr-4 ${
        onClick ? 'cursor-pointer rounded-[28px] transition-opacity hover:opacity-90' : ''
      }`}
      aria-label={onClick ? 'Open radial load source table' : undefined}
    >
      <div className="flex h-[84%] w-full items-center justify-center overflow-visible">
        <RadarChart
          width={chartWidth}
          height={chartHeight}
          cx={chartWidth * 0.47}
          cy={chartHeight * 0.53}
          outerRadius={chartHeight * 0.34}
          data={data}
          startAngle={90}
          endAngle={-270}
          margin={{ top: 14, right: 44, bottom: 14, left: 28 }}
        >
          <PolarGrid
            gridType="polygon"
            radialLines
            polarRadius={polarRadius}
            polarAngles={polarAngles}
            stroke={SP_COLORS.text}
            strokeOpacity={0.5}
            strokeWidth={0.4}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tickCount={6}
            tick={{ fill: 'transparent', fontSize: 1 }}
            axisLine={false}
            tickLine={false}
          />
          <PolarAngleAxis
            dataKey="axis"
            tick={<AxisTick />}
            axisLine={false}
            tickLine={false}
          />
          <Radar dataKey="value" stroke={SP_COLORS.text} fill={SP_COLORS.blue} fillOpacity={0.28} strokeOpacity={1} strokeWidth={1.8} isAnimationActive={false} />
        </RadarChart>
      </div>
      <div className="mt-[2px] flex w-[92%] items-center justify-between">
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
