import React from 'react'
import { Check } from 'lucide-react'
import { AtlasIconButton } from '../../components/AtlasPrimitives'
import AtlasArrowIcon from '../../components/AtlasArrowIcon'
import ZCodeBadge from '../../components/ZCodeBadge'
import type { RouteCandidateParentSummary, RouteCandidateRecord } from '../types'
import { SP_COLORS } from '../theme'
import { getZCodeParentColor } from '@atlas/shared'

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

interface MtaRouteBoardProps {
  className?: string
  kicker?: string
  title: string
  subtitle?: string
  titleMarkerColor?: string | null
  routeCandidates: RouteCandidateRecord[]
  activeZCodeCount?: number
  headerParentCodes?: string[]
  completedParentCodes?: string[]
  selectedCandidateId?: string | null
  assignedCandidateId?: string | null
  highlightedStationName?: string | null
  onSelectCandidate?: (candidateId: string) => void
  onAssignCandidate?: (candidate: RouteCandidateRecord) => void
  onDoneCandidate?: (candidate: RouteCandidateRecord) => void
  onSelectParentCode?: (selection: { parentCode: string; childCodes: string[] }) => void
  parentCircleSize?: 'board' | 'mobile'
  headerActions?: React.ReactNode
  emptyMessage?: string
}

export default function MtaRouteBoard({
  className,
  kicker = 'route planning',
  title,
  subtitle,
  titleMarkerColor = null,
  routeCandidates,
  activeZCodeCount = 0,
  headerParentCodes = [],
  completedParentCodes = [],
  selectedCandidateId = null,
  assignedCandidateId = null,
  highlightedStationName = null,
  onSelectCandidate,
  onAssignCandidate,
  onDoneCandidate,
  onSelectParentCode,
  parentCircleSize = 'board',
  headerActions,
  emptyMessage = 'No partner specialties currently match this enrollee.'
}: MtaRouteBoardProps) {
  // Keep the board interactive even when no explicit selection exists by defaulting to the top-ranked candidate.
  const selectedCandidate = routeCandidates.find((candidate) => candidate.stationId === selectedCandidateId) ?? routeCandidates[0] ?? null
  const summaryCandidate = selectedCandidate ?? routeCandidates[0] ?? null

  return (
    <section className={cn('atlas-surface-shell w-full px-3 py-3 text-white sm:px-4 sm:py-4', className)} style={{ borderColor: '#ffffff38', backgroundColor: 'var(--surface-panel-soft)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-1 pb-3">
        <div className="min-w-0">
          <small className="atlas-overline block" style={{ color: SP_COLORS.muted }}>
            {kicker}
          </small>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5">
              {titleMarkerColor ? (
                <span
                  className="inline-block h-4 w-4 rounded-full border"
                  style={{ borderColor: SP_COLORS.white, backgroundColor: titleMarkerColor }}
                  aria-hidden="true"
                />
              ) : null}
              <div className="text-[24px] font-medium leading-none text-white sm:text-[28px]">{title}</div>
            </div>
            {headerParentCodes.length ? (
              <div className="flex flex-wrap items-center gap-[10px]">
                {headerParentCodes.map((parentCode) => (
                  <ProfileStyleParentCircle
                    key={`header-${parentCode}`}
                    parentCode={parentCode}
                    childCodes={[]}
                    isCompleted={completedParentCodes.includes(parentCode)}
                    onSelect={onSelectParentCode}
                    size={parentCircleSize}
                  />
                ))}
              </div>
            ) : summaryCandidate ? (
              <RouteCircleGroup
                candidate={summaryCandidate}
                completedParentCodes={completedParentCodes}
                onSelect={onSelectParentCode}
                size={parentCircleSize}
                limit={6}
              />
            ) : null}
          </div>
          {subtitle ? <small className="atlas-caption mt-2 block leading-[1.35]" style={{ color: '#aab6c3' }}>{subtitle}</small> : null}
        </div>
        {headerActions ? <div className="flex flex-wrap items-center justify-end gap-2">{headerActions}</div> : null}
      </div>

      <div className="atlas-surface-panel overflow-hidden bg-[var(--surface-panel-raised)]" style={{ borderColor: '#ffffff24' }}>
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
                          <AtlasArrowIcon decorative direction="right" className="h-[1.15rem] w-[1.15rem] opacity-90" />
                          <span>{index === 0 ? 'quickest route' : `route ${index + 1}`}</span>
                          {isAssigned ? <StateWord color={SP_COLORS.deepGreen}>assigned</StateWord> : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <div className="flex items-center gap-1.5">
                          {onAssignCandidate ? (
                            <AtlasIconButton
                              onClick={(event) => {
                                event.stopPropagation()
                                onAssignCandidate(candidate)
                              }}
                              aria-label={`Assign ${candidate.stationName}`}
                              title="assign"
                              className="h-9 w-9"
                              style={{
                                ['--button-border-color' as const]: isAssigned ? SP_COLORS.deepGreen : SP_COLORS.yellow,
                                ['--button-line-color' as const]: isAssigned ? SP_COLORS.deepGreen : SP_COLORS.yellow,
                                color: isAssigned ? SP_COLORS.deepGreen : SP_COLORS.yellow
                              } as React.CSSProperties}
                            >
                              <AtlasArrowIcon decorative direction="right" className="h-[1.15rem] w-[1.15rem]" />
                            </AtlasIconButton>
                          ) : null}

                          {onDoneCandidate ? (
                            <AtlasIconButton
                              onClick={(event) => {
                                event.stopPropagation()
                                onDoneCandidate(candidate)
                              }}
                              aria-label={`Done with ${candidate.stationName}`}
                              title="done"
                              disabled={!isAssigned}
                              className="h-9 w-9"
                              style={{
                                ['--button-border-color' as const]: isAssigned ? SP_COLORS.deepGreen : '#ffffff30',
                                ['--button-line-color' as const]: isAssigned ? SP_COLORS.deepGreen : '#ffffff75',
                                color: isAssigned ? SP_COLORS.deepGreen : SP_COLORS.white
                              } as React.CSSProperties}
                            >
                              <Check size={17} strokeWidth={2.2} />
                            </AtlasIconButton>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2.5">
                      {summaries.length ? (
                        summaries.map((summary) => (
                          <ParentScoreCard
                            key={`${candidate.stationId}-${summary.parentCode}`}
                            summary={summary}
                            isCompleted={completedParentCodes.includes(summary.parentCode)}
                            onSelect={onSelectParentCode}
                            size={parentCircleSize}
                          />
                        ))
                      ) : (
                        <div className="atlas-empty-state text-[11px]">
                          no aligned parents
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]" style={{ color: '#9fafbd' }}>
                      <StatChip label="score" value={formatMetricValue(candidate.score)} />
                      <StatChip label="match" value={formatMatchPercent(candidate.matchedZCodeCount, activeZCodeCount)} />
                      <StatChip label="station burden" value={formatMetricValue(candidate.partnerBurdenTotal)} />
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="atlas-body px-4 py-6 text-[13px]" style={{ color: '#cfd6de' }}>
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

const STAT_DEFINITIONS: Record<string, { term: string; description: string }> = {
  score: {
    term: 'score',
    description: 'Overall route ranking score for this partner after weighting matched enrollee need against partner burden strength.'
  },
  match: {
    term: 'match',
    description: 'Percent of the enrollee\'s active Z-codes that this station matches.'
  },
  'station burden': {
    term: 'station burden',
    description: 'Summed burden or specialty strength contributed by this station across the matched Z-codes.'
  }
}

function StatChip({ label, value }: { label: string; value: string }) {
  const [isHovered, setIsHovered] = React.useState(false)
  const [isFocused, setIsFocused] = React.useState(false)
  const [isPinned, setIsPinned] = React.useState(false)
  const buttonRef = React.useRef<HTMLButtonElement | null>(null)
  const tooltipId = React.useId()
  const definition = STAT_DEFINITIONS[label] || { term: label, description: value }
  const isOpen = isHovered || isFocused || isPinned
  const [tooltipStyle, setTooltipStyle] = React.useState<React.CSSProperties>({
    left: 8,
    top: 8,
    width: 220,
    transform: 'translateY(-100%)'
  })

  React.useEffect(() => {
    if (!isOpen) return

    // Tooltip is rendered fixed; recompute on scroll/resize so chip explanations stay anchored to the trigger.
    function updateTooltipPosition() {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return
      const viewportWidth = window.innerWidth || 0
      const tooltipWidth = Math.min(220, Math.max(180, viewportWidth - 16))
      const centeredLeft = rect.left + rect.width / 2 - tooltipWidth / 2
      const left = Math.max(8, Math.min(centeredLeft, viewportWidth - tooltipWidth - 8))
      const top = Math.max(12, rect.top - 10)
      setTooltipStyle({
        left,
        top,
        width: tooltipWidth,
        transform: 'translateY(-100%)'
      })
    }

    updateTooltipPosition()
    window.addEventListener('resize', updateTooltipPosition)
    window.addEventListener('scroll', updateTooltipPosition, true)
    return () => {
      window.removeEventListener('resize', updateTooltipPosition)
      window.removeEventListener('scroll', updateTooltipPosition, true)
    }
  }, [isOpen])

  React.useEffect(() => {
    if (!isPinned) return

    // Pinned tooltips close on outside pointer to avoid trapping persistent overlays in dense route rows.
    function handlePointerDown(event: PointerEvent) {
      if (buttonRef.current?.contains(event.target as Node)) return
      setIsPinned(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [isPinned])

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-describedby={tooltipId}
      aria-expanded={isOpen}
      onMouseEnter={(event) => {
        event.stopPropagation()
        setIsHovered(true)
      }}
      onMouseLeave={(event) => {
        event.stopPropagation()
        setIsHovered(false)
      }}
      onFocus={(event) => {
        event.stopPropagation()
        setIsFocused(true)
      }}
      onBlur={(event) => {
        event.stopPropagation()
        setIsFocused(false)
      }}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setIsPinned((current) => !current)
      }}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape') {
          setIsPinned(false)
          buttonRef.current?.blur()
        }
      }}
      className="relative inline-flex items-center gap-1 rounded-full border px-2 py-[3px] text-left transition-[border-color,box-shadow] duration-150 ease-out hover:border-white/35 focus-visible:border-white/45 focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_rgba(255,255,255,0.18)]"
      style={{ borderColor: '#ffffff18', backgroundColor: 'rgba(255,255,255,0.03)' }}
      title={`${definition.term}: ${definition.description}`}
    >
      <span>{label}</span>
      <strong className="font-medium text-white">{value}</strong>
      {isOpen ? (
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none fixed z-30 rounded-[12px] border px-3 py-2 normal-case shadow-[0_12px_28px_rgba(0,0,0,0.45)]"
          style={{ ...tooltipStyle, borderColor: '#ffffff28', backgroundColor: 'rgba(6,6,6,0.96)', color: '#d8e1ea' }}
        >
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: SP_COLORS.white }}>
            {definition.term}
          </span>
          <span className="mt-1 block text-[11px] leading-[1.4]">{definition.description}</span>
        </span>
      ) : null}
    </button>
  )
}

function RouteCircleGroup({
  candidate,
  completedParentCodes = [],
  onSelect,
  size = 'board',
  limit = 5
}: {
  candidate: RouteCandidateRecord
  completedParentCodes?: string[]
  onSelect?: (selection: { parentCode: string; childCodes: string[] }) => void
  size?: 'board' | 'mobile'
  limit?: number
}) {
  const summaries = getRenderableParentSummaries(candidate).slice(0, limit)
  if (!summaries.length) return null

  return (
    <div className="flex shrink-0 flex-wrap justify-end gap-[10px]">
      {summaries.map((summary) => (
        <ProfileStyleParentCircle
          key={`${candidate.stationId}-${summary.parentCode}`}
          parentCode={summary.parentCode}
          childCodes={summary.matchedChildZCodes}
          isCompleted={completedParentCodes.includes(summary.parentCode)}
          onSelect={onSelect}
          size={size}
        />
      ))}
    </div>
  )
}

function ProfileStyleParentCircle({
  parentCode,
  childCodes,
  isCompleted,
  onSelect,
  size = 'board'
}: {
  parentCode: string
  childCodes: string[]
  isCompleted?: boolean
  onSelect?: (selection: { parentCode: string; childCodes: string[] }) => void
  size?: 'board' | 'mobile'
}) {
  const fill = getZCodeParentColor(parentCode) || SP_COLORS.white
  const badgeSize = size === 'mobile' ? 'mobile' : 'board'
  const badge = <ZCodeBadge value={parentCode} fill={fill} size={badgeSize} stripLeadingZ checked={isCompleted} />

  if (onSelect) {
    return (
      <button
        type="button"
        className="cursor-pointer"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onSelect({
            parentCode,
            childCodes
          })
        }}
      >
        {badge}
      </button>
    )
  }

  return badge
}

function ParentScoreCard({
  summary,
  isCompleted = false,
  onSelect,
  size = 'board'
}: {
  summary: RouteCandidateParentSummary
  isCompleted?: boolean
  onSelect?: (selection: { parentCode: string; childCodes: string[] }) => void
  size?: 'board' | 'mobile'
}) {
  const hasAverage = summary.avgBurdenScore > 0
  const scoreColor = hasAverage ? getSurveyScoreColor(summary.avgBurdenScore) : '#aeb8c4'

  return (
    <div
      className={
        size === 'mobile'
          ? 'inline-flex min-w-[96px] items-stretch rounded-[13px] border px-1.5 py-1.5'
          : 'inline-flex min-w-[112px] items-stretch rounded-[13px] border px-1.5 py-1.5'
      }
      style={{ borderColor: '#ffffff20', backgroundColor: 'rgba(255,255,255,0.035)' }}
    >
      <div className="flex min-w-[50%] items-center justify-center">
        <ProfileStyleParentCircle
          parentCode={summary.parentCode}
          childCodes={summary.matchedChildZCodes}
          isCompleted={isCompleted}
          onSelect={onSelect}
          size={size}
        />
      </div>
      <div className="flex min-w-[50%] items-center justify-center self-stretch leading-none">
        <div className={size === 'mobile' ? 'text-[19px] font-semibold' : 'text-[22px] font-semibold'} style={{ color: scoreColor }}>
          {hasAverage ? formatMetricValue(summary.avgBurdenScore) : '--'}
        </div>
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

function formatMatchPercent(matchedZCodeCount: number, activeZCodeCount: number) {
  if (!activeZCodeCount) return '--'
  return `${Math.round((matchedZCodeCount / activeZCodeCount) * 100)}%`
}

function getSurveyScoreColor(value: number) {
  if (value <= 3) return SP_COLORS.red
  if (value <= 6) return SP_COLORS.yellow
  return SP_COLORS.deepGreen
}
