/**
 * Dual radar for navigator My Profile: blue = weekly IPSCC self-assessment,
 * red = enrollee IPSCC encounter averages. Strain (absolute perception gap)
 * extends outward as a third series so competencies most likely to tip care
 * disruption read as higher load — same radial language as enrollee load charts.
 */
import React from 'react'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts'
import type {
  IpsccEnrolleeFeedbackPrivacy,
  IpsccSelfAwarenessCorrelationRow
} from '@/features/atlas2026/shared/contracts'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'

interface IpsccStrainRadarChartProps {
  correlationRows: IpsccSelfAwarenessCorrelationRow[]
  enrolleeFeedbackPrivacy: IpsccEnrolleeFeedbackPrivacy
  onOpenAwareness?: () => void
}

/** Wrap multi-word Intentional Peer Support Core Competencies (IPSCC) labels for radial ticks. */
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
  // Nudge labels slightly outward from the plot center so full IPSCC names clear the polygon.
  const dx = x - cx
  const dy = y - cy
  const distance = Math.hypot(dx, dy) || 1
  const nudge = 10
  const labelX = x + (dx / distance) * nudge
  const labelY = y + (dy / distance) * nudge
  const lineHeight = 11
  const startDy = -((lines.length - 1) * lineHeight) / 2

  return (
    <text x={labelX} y={labelY} textAnchor="middle" fill={SP_COLORS.muted} fontSize="9">
      {lines.map((line, index) => (
        <tspan key={`${axisKey}-${line}-${index}`} x={labelX} dy={index === 0 ? startDy : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

export default function IpsccStrainRadarChart({
  correlationRows,
  enrolleeFeedbackPrivacy,
  onOpenAwareness
}: IpsccStrainRadarChartProps) {
  const averagesRevealed = enrolleeFeedbackPrivacy.averagesRevealed
  const chartData = correlationRows.map((row) => ({
    axis: row.key,
    // Full IPSCC catalog short labels (e.g. "Learning together"), not chart abbreviations.
    label: row.label,
    // Blue series: navigator weekly self-assessment (1–5).
    self: typeof row.selfAverage === 'number' ? row.selfAverage : 0,
    // Red series: enrollee IPSCC averages — zeroed when privacy-gated.
    enrollee: averagesRevealed && typeof row.ipsccAverage === 'number' ? row.ipsccAverage : 0,
    // Strain extends outward: absolute gap maps onto the same 0–5 domain so
    // high perception mismatch reads as higher radial load / tip risk.
    strain: averagesRevealed && typeof row.strain === 'number' ? row.strain : 0,
    hasSelf: typeof row.selfAverage === 'number',
    hasEnrollee: averagesRevealed && typeof row.ipsccAverage === 'number'
  }))
  const labelMap = React.useMemo(
    () => new Map(chartData.map((point) => [point.axis, point.label])),
    [chartData]
  )
  const hasAnySelf = chartData.some((point) => point.hasSelf)
  const topStrain = averagesRevealed
    ? correlationRows
        .filter((row) => typeof row.strain === 'number' && (row.strain || 0) > 0)
        .slice()
        .sort((left, right) => (right.strain || 0) - (left.strain || 0))[0]
    : null
  const Wrapper = onOpenAwareness ? 'button' : 'div'
  const remaining =
    enrolleeFeedbackPrivacy.minEntriesToRevealAverages - enrolleeFeedbackPrivacy.totalEncounterSubmissions

  return (
    <Wrapper
      type={onOpenAwareness ? 'button' : undefined}
      onClick={onOpenAwareness}
      className={`atlas-surface-panel w-full px-3 py-3 text-left ${
        onOpenAwareness ? 'cursor-pointer transition-opacity hover:opacity-90' : ''
      }`}
      aria-label="Intentional Peer Support Core Competencies self-awareness strain radar"
    >
      <small className="atlas-overline block text-[#9eacb9]">self-awareness load</small>
      <div className="text-[15px] font-medium text-white">IPSCC perception strain</div>
      <small className="atlas-meta mt-0.5 block text-[#9eacb9]">
        Blue = your weekly self-assessment · Red = enrollee feedback averages
      </small>

      <div className="mt-2 h-[280px] w-full overflow-visible">
        {hasAnySelf ? (
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius="58%"
              startAngle={90}
              endAngle={-270}
              margin={{ top: 28, right: 36, bottom: 28, left: 36 }}
            >
              <PolarGrid
                gridType="polygon"
                radialLines
                stroke={SP_COLORS.text}
                strokeOpacity={0.32}
                strokeWidth={0.55}
              />
              <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={false} axisLine={false} />
              <PolarAngleAxis
                dataKey="axis"
                tick={(tickProps) => <AxisTick {...tickProps} labelMap={labelMap} />}
                axisLine={false}
                tickLine={false}
              />
              {/* Strain fill first so score polygons sit on top; outward extent = tip risk. */}
              {averagesRevealed ? (
                <Radar
                  name="Strain"
                  dataKey="strain"
                  stroke={SP_COLORS.yellow}
                  fill={SP_COLORS.red}
                  fillOpacity={0.18}
                  strokeWidth={1.25}
                  isAnimationActive={false}
                  dot={false}
                />
              ) : null}
              <Radar
                name="Self"
                dataKey="self"
                stroke={SP_COLORS.blue}
                fill={SP_COLORS.blue}
                fillOpacity={0.28}
                strokeWidth={2}
                isAnimationActive={false}
                dot={{ r: 2.5, fill: SP_COLORS.blue, stroke: SP_COLORS.white, strokeWidth: 1 }}
              />
              {averagesRevealed ? (
                <Radar
                  name="Enrollee"
                  dataKey="enrollee"
                  stroke={SP_COLORS.red}
                  fill={SP_COLORS.red}
                  fillOpacity={0.16}
                  strokeWidth={2}
                  isAnimationActive={false}
                  dot={{ r: 2.5, fill: SP_COLORS.red, stroke: SP_COLORS.white, strokeWidth: 1 }}
                />
              ) : null}
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center text-[12px] text-[#9eacb9]">
            Complete a weekly Intentional Peer Support Core Competencies (IPSCC) self-assessment before
            supervision to seed the blue series.
          </div>
        )}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-[#9eacb9]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SP_COLORS.blue }} />
          Self
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SP_COLORS.red }} />
          Enrollee averages
        </span>
        {averagesRevealed ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: `${SP_COLORS.yellow}99` }} />
            Strain (tip risk)
          </span>
        ) : null}
      </div>

      {!averagesRevealed ? (
        <div className="mt-2 rounded-[12px] border border-white/10 bg-white/5 px-2.5 py-2 text-[11px] leading-snug text-[#d7e0e9]">
          Enrollee IPSCC averages stay hidden until {enrolleeFeedbackPrivacy.minEntriesToRevealAverages}{' '}
          encounter submissions protect anonymity
          {remaining > 0
            ? ` (${enrolleeFeedbackPrivacy.totalEncounterSubmissions} of ${enrolleeFeedbackPrivacy.minEntriesToRevealAverages} so far).`
            : '.'}{' '}
          Individual enrollee responses are never shown.
        </div>
      ) : topStrain ? (
        <div className="mt-2 text-[11px] leading-snug text-[#d7e0e9]">
          Highest strain: <span className="font-medium text-white">{topStrain.label}</span>
          {typeof topStrain.strain === 'number' ? ` · gap ${topStrain.strain.toFixed(2)}` : ''} — most likely to tip
          into care disruption if unaddressed in supervision.
        </div>
      ) : null}

      {onOpenAwareness ? (
        <small className="mt-2 block text-center text-[10px] uppercase tracking-[0.08em] text-[#9f9f9f]">
          tap to open self-awareness
        </small>
      ) : null}
    </Wrapper>
  )
}
