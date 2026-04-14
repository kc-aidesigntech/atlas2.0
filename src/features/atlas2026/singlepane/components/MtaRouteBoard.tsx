import React from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { RouteCandidateParentSummary, RouteCandidateRecord } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import { getZCodeParentColor, usesLightTextOnZCodeColor } from '@atlas/shared'

const arrowIconUrl = new URL('../../../../../assets/up-arrow-icon-symbol-sign-north-point-ahead-above-vector-47696729.png', import.meta.url).href

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

interface MtaRouteBoardProps {
  className?: string
  kicker?: string
  title: string
  subtitle?: string
  routeCandidates: RouteCandidateRecord[]
  selectedCandidateId?: string | null
  assignedCandidateId?: string | null
  highlightedStationName?: string | null
  onSelectCandidate?: (candidateId: string) => void
  onCommitCandidate?: (candidate: RouteCandidateRecord) => void
  headerActions?: React.ReactNode
  emptyMessage?: string
}

export default function MtaRouteBoard({
  className,
  kicker = 'route planning',
  title,
  subtitle,
  routeCandidates,
  selectedCandidateId = null,
  assignedCandidateId = null,
  highlightedStationName = null,
  onSelectCandidate,
  onCommitCandidate,
  headerActions,
  emptyMessage = 'No partner specialties currently match this enrollee.'
}: MtaRouteBoardProps) {
  const selectedCandidate = routeCandidates.find((candidate) => candidate.stationId === selectedCandidateId) ?? routeCandidates[0] ?? null
  const summaryCandidate = selectedCandidate ?? routeCandidates[0] ?? null

  return (
    <section
      className={cn('w-full rounded-[30px] border px-3 py-3 text-white sm:px-4 sm:py-4', className)}
      style={{ borderColor: '#ffffff38', backgroundColor: 'var(--surface-panel-soft)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-1 pb-3">
        <div className="min-w-0">
          <small className="block text-[10px] uppercase tracking-[0.18em]" style={{ color: SP_COLORS.muted }}>
            {kicker}
          </small>
          <div className="mt-1 flex items-center gap-3">
            <div className="text-[24px] font-medium leading-none text-white sm:text-[28px]">{title}</div>
            {summaryCandidate ? <RouteCircleGroup candidate={summaryCandidate} limit={6} /> : null}
          </div>
          {subtitle ? (
            <small className="mt-2 block text-[11px] leading-[1.35]" style={{ color: '#aab6c3' }}>
              {subtitle}
            </small>
          ) : null}
        </div>
        {headerActions ? <div className="flex flex-wrap items-center justify-end gap-2">{headerActions}</div> : null}
      </div>

      <div className="overflow-hidden rounded-[26px] border" style={{ borderColor: '#ffffff24', backgroundColor: 'var(--surface-panel-raised)' }}>
        {routeCandidates.length ? (
          routeCandidates.map((candidate, index) => {
            const isSelected = candidate.stationId === selectedCandidate?.stationId
            const isAssigned = candidate.stationId === assignedCandidateId
            const isHighlighted = candidate.stationName === highlightedStationName
            const rowGlow = isAssigned ? SP_COLORS.deepGreen : isSelected || isHighlighted ? SP_COLORS.yellow : null
            const summaries = getRenderableParentSummaries(candidate)

            return (
              <div
                key={candidate.stationId}
                role={onSelectCandidate ? 'button' : undefined}
                tabIndex={onSelectCandidate ? 0 : undefined}
                onClick={() => onSelectCandidate?.(candidate.stationId)}
                onKeyDown={(event) => {
                  if (!onSelectCandidate) return
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  onSelectCandidate(candidate.stationId)
                }}
                className={cn(
                  'px-3 py-4 transition-[background-color,box-shadow,filter] duration-150 ease-out sm:px-4',
                  index > 0 && 'border-t',
                  onSelectCandidate && 'cursor-pointer hover:brightness-110 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_24px_rgba(255,255,255,0.08)]'
                )}
                style={{
                  borderTopColor: '#ffffff18',
                  backgroundColor: rowGlow ? 'rgba(255,255,255,0.025)' : 'transparent',
                  boxShadow: rowGlow ? `inset 2px 0 0 ${rowGlow}` : undefined
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-[2px] flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold"
                    style={{ borderColor: rowGlow ? `${rowGlow}88` : '#ffffff2c', color: rowGlow || '#d8e1ea', backgroundColor: rowGlow ? `${rowGlow}16` : 'transparent' }}
                  >
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[22px] font-medium leading-tight text-white sm:text-[24px]">{candidate.stationName}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: rowGlow || '#b0bcc9' }}>
                          <img src={arrowIconUrl} alt="" aria-hidden="true" className="h-[1.15rem] w-[1.15rem] shrink-0 rotate-90 opacity-90" />
                          <span>{index === 0 ? 'quickest route' : `route ${index + 1}`}</span>
                          {isAssigned ? <StateWord color={SP_COLORS.deepGreen}>saved</StateWord> : null}
                          {isSelected && !isAssigned ? <StateWord color={SP_COLORS.yellow}>focused</StateWord> : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <RouteCircleGroup candidate={candidate} limit={5} />
                        <div className="flex items-center gap-1.5">
                          {onSelectCandidate ? (
                            <AtlasTextButton
                              onClick={(event) => {
                                event.stopPropagation()
                                onSelectCandidate(candidate.stationId)
                              }}
                              className="px-2.5 py-1 text-[10px] font-medium"
                              style={{
                                ['--button-border-color' as const]: isSelected ? SP_COLORS.yellow : '#ffffff30',
                                ['--button-line-color' as const]: isSelected ? SP_COLORS.yellow : '#ffffff75',
                                color: isSelected ? SP_COLORS.yellow : SP_COLORS.white
                              } as React.CSSProperties}
                            >
                              focus
                            </AtlasTextButton>
                          ) : null}

                          {onCommitCandidate ? (
                            <AtlasTextButton
                              onClick={(event) => {
                                event.stopPropagation()
                                onCommitCandidate(candidate)
                              }}
                              className="px-2.5 py-1 text-[10px] font-medium"
                              style={{
                                ['--button-border-color' as const]: isAssigned ? SP_COLORS.deepGreen : SP_COLORS.yellow,
                                ['--button-line-color' as const]: isAssigned ? SP_COLORS.deepGreen : SP_COLORS.yellow,
                                color: isAssigned ? SP_COLORS.deepGreen : SP_COLORS.yellow
                              } as React.CSSProperties}
                            >
                              save
                            </AtlasTextButton>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2.5">
                      {summaries.length ? (
                        summaries.map((summary) => <ParentScoreCard key={`${candidate.stationId}-${summary.parentCode}`} summary={summary} />)
                      ) : (
                        <div className="rounded-[14px] border px-3 py-2 text-[11px]" style={{ borderColor: '#ffffff18', color: '#9eacb9' }}>
                          no aligned parents
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]" style={{ color: '#9fafbd' }}>
                      <StatChip label="s" value={formatMetricValue(candidate.score)} />
                      <StatChip label="m" value={String(candidate.matchedZCodeCount)} />
                      <StatChip label="n" value={String(candidate.needUnitsMatched)} />
                      <StatChip label="b" value={formatMetricValue(candidate.partnerBurdenTotal)} />
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="px-4 py-6 text-[13px]" style={{ color: '#cfd6de' }}>
            {emptyMessage}
          </div>
        )}
      </div>
    </section>
  )
}

function StateWord({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-[3px] uppercase tracking-[0.12em]" style={{ borderColor: `${color}55`, color }}>
      {children}
    </span>
  )
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-[3px]" style={{ borderColor: '#ffffff18', backgroundColor: 'rgba(255,255,255,0.03)' }}>
      <span>{label}</span>
      <strong className="font-medium text-white">{value}</strong>
    </span>
  )
}

function RouteCircleGroup({ candidate, limit = 5 }: { candidate: RouteCandidateRecord; limit?: number }) {
  const summaries = getRenderableParentSummaries(candidate).slice(0, limit)
  if (!summaries.length) return null

  return (
    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
      {summaries.map((summary) => (
        <ParentCircle key={`${candidate.stationId}-${summary.parentCode}`} parentCode={summary.parentCode} />
      ))}
    </div>
  )
}

function ParentCircle({ parentCode }: { parentCode: string }) {
  const fill = getZCodeParentColor(parentCode) || SP_COLORS.white
  const textColor = usesLightTextOnZCodeColor(fill) ? SP_COLORS.white : SP_COLORS.bg
  return (
    <span
      className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full border px-2 text-[10px] font-semibold tracking-[0.08em]"
      style={{ backgroundColor: fill, borderColor: fill, color: textColor }}
    >
      {parentCode}
    </span>
  )
}

function ParentScoreCard({ summary }: { summary: RouteCandidateParentSummary }) {
  const fill = getZCodeParentColor(summary.parentCode) || SP_COLORS.white
  const textColor = usesLightTextOnZCodeColor(fill) ? SP_COLORS.white : SP_COLORS.bg
  const hasAverage = summary.avgBurdenScore > 0

  return (
    <div
      className="inline-flex min-w-[90px] items-center gap-2 rounded-[13px] border px-2 py-1.5"
      style={{ borderColor: '#ffffff20', backgroundColor: 'rgba(255,255,255,0.035)' }}
    >
      <span
        className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full border px-2 text-[11px] font-semibold"
        style={{ backgroundColor: fill, borderColor: fill, color: textColor }}
      >
        {summary.parentCode.replace(/^Z/, '')}
      </span>
      <div className="min-w-0 leading-none">
        <div className="text-[16px] font-medium text-white">{hasAverage ? formatMetricValue(summary.avgBurdenScore) : '--'}</div>
        <small className="mt-1 block text-[9px] uppercase tracking-[0.12em]" style={{ color: '#aeb8c4' }}>
          {summary.matchedChildCount}x
        </small>
      </div>
    </div>
  )
}

function getRenderableParentSummaries(candidate: RouteCandidateRecord) {
  if (candidate.matchedParentSummaries.length) return candidate.matchedParentSummaries
  return candidate.matchedZCodes.map((parentCode) => ({
    parentCode,
    matchedChildCount: 1,
    avgBurdenScore: 0,
    matchedChildZCodes: []
  }))
}

function buildReasonLine(candidate: RouteCandidateRecord) {
  const parents = getRenderableParentSummaries(candidate)
  const parentList = parents.map((summary) => summary.parentCode).join(', ')
  if (!parents.length) return 'No matched Z-code parents are currently available for this route.'
  return `aligned parents: ${parentList} · ${candidate.needUnitsMatched} need units matched · burden ${formatMetricValue(candidate.partnerBurdenTotal)}`
}

function formatMetricValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
