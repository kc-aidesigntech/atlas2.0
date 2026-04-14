import React, { useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { RegulationTestStripMarker, RouteCandidateRecord, TimelineConfig } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import MtaRouteBoard from './MtaRouteBoard'
import StripMapControlOverlay from './StripMapControlOverlay'

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
          className="px-3 py-1.5 text-[11px] font-medium"
          style={{
            ['--button-border-color' as const]: SP_COLORS.yellow,
            ['--button-line-color' as const]: SP_COLORS.bg,
            color: SP_COLORS.bg,
            backgroundColor: SP_COLORS.yellow
          } as React.CSSProperties}
        >
          readiness
        </AtlasTextButton>
      )
    }

    phaseButtons.push(
      <AtlasTextButton
        key="renewal-phase"
        disabled
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

    return (
      <div className="flex flex-col items-stretch gap-2">
        {hasTimelineControls ? (
          <AtlasTextButton
            onClick={() => setIsControlOverlayOpen(true)}
            className="inline-flex self-start items-center gap-2 px-3 py-1.5 text-[11px] font-medium"
            style={{ ['--button-border-color' as const]: '#ffffff3d', color: SP_COLORS.white } as React.CSSProperties}
          >
            <CalendarDays size={14} strokeWidth={2} />
            <span>start {formatDateLabel(timelineConfig.planStartIso)}</span>
          </AtlasTextButton>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2">{phaseButtons}</div>
      </div>
    )
  }, [onRegulationTestsClick, onRoutePlanningClick, onStartDateChange, onTimelineConfigChange, showRoutePlanningQuickAction, timelineConfig.planStartIso])

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
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
      <StripMapControlOverlay
        isOpen={isControlOverlayOpen}
        timelineConfig={timelineConfig}
        onClose={() => setIsControlOverlayOpen(false)}
        onSave={(nextConfig) => {
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

function formatDateLabel(timestampIso: string) {
  const date = new Date(timestampIso)
  if (!Number.isFinite(date.getTime())) return 'pending'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}
