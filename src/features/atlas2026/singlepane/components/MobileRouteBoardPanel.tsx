import React, { useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { RegulationTestStripMarker, RouteCandidateRecord, TimelineConfig } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import MtaRouteBoard from './MtaRouteBoard'
import StripMapControlOverlay from './StripMapControlOverlay'
import { formatDateLabelShort } from './timelineDateUtils'

const arrowIconUrl = new URL(
  '../../../../../assets/up-arrow-icon-symbol-sign-north-point-ahead-above-vector-47696729.png',
  import.meta.url
).href
const PHASE_RAIL_COLUMN_WIDTH_PX = 26
const PHASE_NODE_CENTER_OFFSET_PX = 42

interface MobileRouteBoardPanelProps {
  timelineConfig: TimelineConfig
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
  onSelectZCode?: (selection: { parentCode: string; childCodes: string[] }) => void
  showRoutePlanningQuickAction?: boolean
  isRegulationCleared?: boolean
  regulationTestMarkers?: RegulationTestStripMarker[]
  onRoutePlanningClick?: () => void
  onRegulationTestsClick?: () => void
  onRenewalTestsClick?: () => void
  onStartDateChange?: (nextStartIso: string) => void
  onTimelineConfigChange?: (nextConfig: TimelineConfig) => void
  suggestedPhase?: string
}

export default function MobileRouteBoardPanel({
  timelineConfig,
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
  onSelectZCode,
  showRoutePlanningQuickAction = false,
  isRegulationCleared = false,
  regulationTestMarkers = [],
  onRoutePlanningClick,
  onRegulationTestsClick,
  onRenewalTestsClick,
  onStartDateChange,
  onTimelineConfigChange,
  suggestedPhase = 'readiness'
}: MobileRouteBoardPanelProps) {
  const [isControlOverlayOpen, setIsControlOverlayOpen] = useState(false)
  const headerActions = useMemo(() => {
    const phaseButtons: React.ReactNode[] = []
    const hasTimelineControls = Boolean(onStartDateChange || onTimelineConfigChange)

    if (onRegulationTestsClick) {
      phaseButtons.push(
        <AtlasTextButton
          key="regulation-tests"
          onClick={onRegulationTestsClick}
          className="px-3 py-1.5 text-[11px] font-medium"
          style={{
            ['--button-border-color' as const]: SP_COLORS.red,
            ['--button-line-color' as const]: SP_COLORS.white,
            color: SP_COLORS.white,
            backgroundColor: SP_COLORS.red
          } as React.CSSProperties}
        >
          regulation
        </AtlasTextButton>
      )
    }

    if (showRoutePlanningQuickAction && onRoutePlanningClick) {
      phaseButtons.push(
        <AtlasTextButton
          key="route-planning"
          onClick={onRoutePlanningClick}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium"
          style={{
            ['--button-border-color' as const]: SP_COLORS.yellow,
            ['--button-line-color' as const]: SP_COLORS.bg,
            color: SP_COLORS.bg,
            backgroundColor: SP_COLORS.yellow
          } as React.CSSProperties}
        >
          <span>plan route</span>
          <img
            src={arrowIconUrl}
            alt=""
            aria-hidden="true"
            className="h-[0.9rem] w-[0.9rem] rotate-90"
            style={{ filter: 'brightness(0) saturate(100%)' }}
          />
        </AtlasTextButton>
      )
    }

    if (onRenewalTestsClick) {
      phaseButtons.push(
        <AtlasTextButton
          key="renewal-phase"
          onClick={onRenewalTestsClick}
          className="px-3 py-1.5 text-[11px] font-medium"
          style={{
            ['--button-border-color' as const]: SP_COLORS.deepGreen,
            ['--button-line-color' as const]: SP_COLORS.white,
            backgroundColor: SP_COLORS.deepGreen,
            color: SP_COLORS.white
          }}
        >
          renewal
        </AtlasTextButton>
      )
    }

    return (
      <div className="flex flex-col items-stretch gap-2">
        {hasTimelineControls ? (
          <AtlasTextButton
            onClick={() => setIsControlOverlayOpen(true)}
            className="inline-flex self-start items-center gap-2 px-3 py-1.5 text-[11px] font-medium"
            style={{ ['--button-border-color' as const]: '#ffffff3d', color: SP_COLORS.white } as React.CSSProperties}
          >
            <CalendarDays size={14} strokeWidth={2} />
            <span>start {formatDateLabelShort(timelineConfig.planStartIso)}</span>
          </AtlasTextButton>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2">{phaseButtons}</div>
      </div>
    )
  // Memoize action chrome to avoid re-render jitter in the route board list while timeline data stays stable.
  }, [onRegulationTestsClick, onRenewalTestsClick, onRoutePlanningClick, onStartDateChange, onTimelineConfigChange, showRoutePlanningQuickAction, timelineConfig.planStartIso])

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="relative flex w-full min-w-0 flex-col gap-3">
        <span
          className="pointer-events-none absolute bottom-[42px] top-[42px] w-[2px] bg-white/90"
          style={{ left: `${PHASE_RAIL_COLUMN_WIDTH_PX / 2}px`, transform: 'translateX(-50%)' }}
          aria-hidden="true"
        />
        <PhaseRailRow color={SP_COLORS.red}>
          <section
            className="rounded-[30px] border px-4 py-4 text-white"
            style={{ borderColor: '#ffffff38', backgroundColor: 'var(--surface-panel-soft)' }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <small className="block text-[10px] uppercase tracking-[0.18em]" style={{ color: SP_COLORS.muted }}>
                  first step
                </small>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <div className="text-[24px] font-medium leading-none text-white">regulation</div>
                  <span
                    className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.12em]"
                    style={{ borderColor: isRegulationCleared ? `${SP_COLORS.deepGreen}90` : `${SP_COLORS.red}90`, color: isRegulationCleared ? SP_COLORS.deepGreen : SP_COLORS.red }}
                  >
                    {isRegulationCleared ? 'cleared' : 'pending'}
                  </span>
                </div>
                <small className="mt-2 block text-[11px] leading-[1.35]" style={{ color: '#aab6c3' }}>
                  Complete regulation checks before moving into readiness routing.
                </small>
              </div>
              {onRegulationTestsClick ? (
                <AtlasTextButton
                  onClick={onRegulationTestsClick}
                  className="px-3 py-1.5 text-[11px] font-medium"
                  style={{
                    ['--button-border-color' as const]: SP_COLORS.red,
                    ['--button-line-color' as const]: SP_COLORS.white,
                    color: SP_COLORS.white,
                    backgroundColor: SP_COLORS.red
                  } as React.CSSProperties}
                >
                  regulation
                </AtlasTextButton>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {regulationTestMarkers.length ? (
                regulationTestMarkers.map((marker) => (
                  <span
                    key={marker.id}
                    className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.08em]"
                    style={{
                      borderColor: marker.passed ? `${SP_COLORS.deepGreen}88` : `${SP_COLORS.red}88`,
                      color: marker.passed ? SP_COLORS.deepGreen : SP_COLORS.red,
                      backgroundColor: 'var(--surface-panel-raised)'
                    }}
                  >
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: marker.passed ? SP_COLORS.deepGreen : SP_COLORS.red }} />
                    {marker.label}
                  </span>
                ))
              ) : (
                <div className="rounded-[14px] border px-3 py-2 text-[11px]" style={{ borderColor: '#ffffff18', color: '#9eacb9', backgroundColor: 'var(--surface-panel-raised)' }}>
                  no completed regulation tests yet
                </div>
              )}
            </div>
          </section>
        </PhaseRailRow>

        <PhaseRailRow color={SP_COLORS.yellow}>
          <MtaRouteBoard
            kicker="mobile route board"
            title="readiness"
            subtitle={`${timelineConfig.durationMonths * 30}d · ${suggestedPhase}`}
            routeCandidates={routeCandidates}
            activeZCodeCount={activeZCodeCount}
            headerParentCodes={headerParentCodes}
            completedParentCodes={completedParentCodes}
            selectedCandidateId={selectedCandidateId}
            assignedCandidateId={assignedCandidateId}
            highlightedStationName={highlightedStationName}
            onSelectCandidate={onSelectCandidate}
            onAssignCandidate={onAssignCandidate}
            onDoneCandidate={onDoneCandidate}
            onSelectParentCode={onSelectZCode}
            parentCircleSize="mobile"
            headerActions={headerActions}
            emptyMessage="No ranked partner stations are available for this enrollee yet."
          />
        </PhaseRailRow>

        <PhaseRailRow color={SP_COLORS.deepGreen}>
          <section
            className="rounded-[30px] border px-4 py-4 text-white"
            style={{ borderColor: '#ffffff38', backgroundColor: 'var(--surface-panel-soft)' }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <small className="block text-[10px] uppercase tracking-[0.18em]" style={{ color: SP_COLORS.muted }}>
                  next phase
                </small>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <div className="text-[24px] font-medium leading-none text-white">renewal</div>
                  <span
                    className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.12em]"
                    style={{ borderColor: `${SP_COLORS.deepGreen}90`, color: SP_COLORS.deepGreen }}
                  >
                    after readiness
                  </span>
                </div>
                <small className="mt-2 block text-[11px] leading-[1.35]" style={{ color: '#aab6c3' }}>
                  Maintain the enrollee&apos;s stability plan once regulation clears and readiness routing is complete.
                </small>
              </div>
              {onRenewalTestsClick ? (
                <AtlasTextButton
                  onClick={onRenewalTestsClick}
                  className="px-3 py-1.5 text-[11px] font-medium"
                  style={{
                    ['--button-border-color' as const]: SP_COLORS.deepGreen,
                    ['--button-line-color' as const]: SP_COLORS.white,
                    color: SP_COLORS.white,
                    backgroundColor: SP_COLORS.deepGreen
                  } as React.CSSProperties}
                >
                  renewal
                </AtlasTextButton>
              ) : null}
            </div>
            <div className="mt-3 rounded-[16px] border px-3 py-3 text-[11px]" style={{ borderColor: '#ffffff18', color: '#cfd6de', backgroundColor: 'var(--surface-panel-raised)' }}>
              {timelineConfig.durationMonths * 30}d outlook anchored from {formatDateLabelShort(timelineConfig.planStartIso)}.
            </div>
          </section>
        </PhaseRailRow>
      </div>
      <StripMapControlOverlay
        isOpen={isControlOverlayOpen}
        timelineConfig={timelineConfig}
        onClose={() => setIsControlOverlayOpen(false)}
        onSave={(nextConfig) => {
          // Prefer canonical timeline updates; fall back to start-date-only callback for older call sites.
          onTimelineConfigChange?.(nextConfig)
          if (!onTimelineConfigChange && onStartDateChange && nextConfig.planStartIso !== timelineConfig.planStartIso) {
            onStartDateChange(nextConfig.planStartIso)
          }
          setIsControlOverlayOpen(false)
        }}
      />
    </div>
  )
}

function PhaseRailRow({
  color,
  children
}: {
  color: string
  children: React.ReactNode
}) {
  return (
    <div
      className="grid items-start gap-3"
      style={{ gridTemplateColumns: `${PHASE_RAIL_COLUMN_WIDTH_PX}px minmax(0, 1fr)` }}
    >
      <div className="relative h-full min-h-[96px]">
        <span
          className="absolute left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border"
          style={{ top: `${PHASE_NODE_CENTER_OFFSET_PX}px`, borderColor: SP_COLORS.white, backgroundColor: color }}
          aria-hidden="true"
        />
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
