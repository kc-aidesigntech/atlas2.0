import React, { useMemo, useState } from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { RegulationTestStripMarker, RouteCandidateRecord, TimelineConfig } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import MtaRouteBoard from './MtaRouteBoard'
import StripMapControlOverlay from './StripMapControlOverlay'

interface MobileRouteBoardPanelProps {
  timelineConfig: TimelineConfig
  routeCandidates: RouteCandidateRecord[]
  selectedCandidateId?: string | null
  assignedCandidateId?: string | null
  highlightedStationName?: string | null
  onSelectCandidate?: (candidateId: string) => void
  onAssignCandidate?: (candidate: RouteCandidateRecord) => void
  onDoneCandidate?: (candidate: RouteCandidateRecord) => void
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
  selectedCandidateId = null,
  assignedCandidateId = null,
  highlightedStationName = null,
  onSelectCandidate,
  onAssignCandidate,
  onDoneCandidate,
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
    const actions: React.ReactNode[] = []

    if (onStartDateChange || onTimelineConfigChange) {
      actions.push(
        <AtlasTextButton
          key="timeline-start"
          onClick={() => setIsControlOverlayOpen(true)}
          className="px-3 py-1.5 text-[11px] font-medium"
          style={{ ['--button-border-color' as const]: `${SP_COLORS.yellow}88`, color: SP_COLORS.yellow } as React.CSSProperties}
        >
          start {formatDateLabel(timelineConfig.planStartIso)}
        </AtlasTextButton>
      )
    }

    if (onRegulationTestsClick) {
      actions.push(
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
      actions.push(
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

    return actions
  }, [onRegulationTestsClick, onRoutePlanningClick, onStartDateChange, onTimelineConfigChange, showRoutePlanningQuickAction, timelineConfig.planStartIso])

  return (
    <>
      <MtaRouteBoard
        kicker="mobile route board"
        title="quickest route"
        subtitle={`${timelineConfig.durationMonths * 30}d · ${suggestedPhase}`}
        routeCandidates={routeCandidates}
        selectedCandidateId={selectedCandidateId}
        assignedCandidateId={assignedCandidateId}
        highlightedStationName={highlightedStationName}
        onSelectCandidate={onSelectCandidate}
        onAssignCandidate={onAssignCandidate}
        onDoneCandidate={onDoneCandidate}
        headerActions={headerActions}
        emptyMessage="No ranked partner stations are available for this enrollee yet."
      />
      <div className="mt-3 rounded-[22px] border px-4 py-3" style={{ borderColor: '#ffffff32', backgroundColor: 'var(--surface-panel-soft)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.08em]" style={{ color: SP_COLORS.muted }}>
            regulation
          </span>
          {isRegulationCleared ? (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-[13px]" style={{ borderColor: SP_COLORS.white, color: SP_COLORS.white }}>
              ✓
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {regulationTestMarkers.length ? (
            regulationTestMarkers.map((marker) => (
              <span
                key={marker.id}
                className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px]"
                style={{ borderColor: marker.passed ? SP_COLORS.deepGreen : SP_COLORS.red, color: marker.passed ? SP_COLORS.deepGreen : SP_COLORS.red }}
              >
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: marker.passed ? SP_COLORS.deepGreen : SP_COLORS.red }} />
                {marker.label}
              </span>
            ))
          ) : (
            <span className="text-[12px]" style={{ color: SP_COLORS.muted }}>
              No completed regulation tests yet.
            </span>
          )}
        </div>
      </div>
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
    </>
  )
}

function formatDateLabel(timestampIso: string) {
  const date = new Date(timestampIso)
  if (!Number.isFinite(date.getTime())) return 'pending'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}
