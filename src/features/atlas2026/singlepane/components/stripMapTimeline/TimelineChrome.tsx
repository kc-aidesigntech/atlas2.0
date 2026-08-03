import React from 'react'
import AtlasArrowIcon from '@/features/atlas2026/components/AtlasArrowIcon'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type { RouteLogEvent, TimelineConfig } from '../../types'
import LocalDateInputBox from '../LocalDateInputBox'
import StripMapControlOverlay from '../StripMapControlOverlay'
import type {
  DateEditorState,
  PhaseActionButton,
  ResolvedTooltipState,
  TimelineMarkerInspectorState
} from './types'
import { TimelineLegend } from './TimelineLegend'

interface TimelineChromeProps {
  dateEditor: DateEditorState | null
  dateEditorError: string | null
  editorPosition: { left: number; top: number }
  focusedStationTop: number
  highlightedStationName: string | null
  isControlOverlayOpen: boolean
  isPartnerAggregateMode: boolean
  isPartnerPolicyOpen: boolean
  isRegulationCleared: boolean
  markerInspector: TimelineMarkerInspectorState | null
  normalizedTimelineConfig: TimelineConfig
  onCloseControlOverlay: () => void
  onCommitDateEditor: () => void
  onDeleteEvent?: (logId: string) => void
  onEditEventDate: (event: RouteLogEvent, x: number, y: number) => void
  onEventDateChange?: (logId: string, nextTimestampIso: string) => void
  onSaveTimelineConfig: (nextConfig: TimelineConfig) => void
  onSetDateEditor: React.Dispatch<React.SetStateAction<DateEditorState | null>>
  onSetDateEditorError: React.Dispatch<React.SetStateAction<string | null>>
  onSetMarkerInspector: React.Dispatch<React.SetStateAction<TimelineMarkerInspectorState | null>>
  onTogglePartnerPolicy: () => void
  phaseActionButtons: PhaseActionButton[]
  phaseButtonsTop: number
  readinessCenterX: number
  resolvedTooltip: ResolvedTooltipState | null
  showReadinessProgress: boolean
  width: number
}

export function TimelineChrome({
  dateEditor,
  dateEditorError,
  editorPosition,
  focusedStationTop,
  highlightedStationName,
  isControlOverlayOpen,
  isPartnerAggregateMode,
  isPartnerPolicyOpen,
  isRegulationCleared,
  markerInspector,
  normalizedTimelineConfig,
  onCloseControlOverlay,
  onCommitDateEditor,
  onDeleteEvent,
  onEditEventDate,
  onEventDateChange,
  onSaveTimelineConfig,
  onSetDateEditor,
  onSetDateEditorError,
  onSetMarkerInspector,
  onTogglePartnerPolicy,
  phaseActionButtons,
  phaseButtonsTop,
  readinessCenterX,
  resolvedTooltip,
  showReadinessProgress,
  width
}: TimelineChromeProps) {
  const closeDateEditor = () => {
    onSetDateEditor(null)
    onSetDateEditorError(null)
  }
  return (
    <>
      {dateEditor ? (
        <div className="absolute z-20" style={editorPosition}>
          <LocalDateInputBox
            label={dateEditor.label}
            value={dateEditor.value}
            error={dateEditorError}
            onChange={(nextValue) => {
              onSetDateEditor((current) => (current ? { ...current, value: nextValue } : current))
              onSetDateEditorError(null)
            }}
            onSave={onCommitDateEditor}
            onCancel={closeDateEditor}
            onDelete={
              dateEditor.kind === 'event' && typeof dateEditor.logId === 'string' && onDeleteEvent
                ? () => {
                    onDeleteEvent(dateEditor.logId as string)
                    closeDateEditor()
                  }
                : null
            }
            deleteLabel="delete entry"
          />
        </div>
      ) : null}
      <StripMapControlOverlay
        isOpen={isControlOverlayOpen}
        timelineConfig={normalizedTimelineConfig}
        onClose={onCloseControlOverlay}
        onSave={onSaveTimelineConfig}
      />
      {phaseActionButtons.map((button) => (
        <div key={button.key} className="absolute z-20" style={{ left: button.centerX, top: phaseButtonsTop, transform: 'translateX(-50%)' }}>
          <AtlasTextButton
            type="button"
            onClick={button.onClick}
            disabled={button.disabled}
            className="inline-flex items-center gap-2 px-5 py-1.5 text-[22px] font-medium"
            style={{
              ['--button-border-color' as const]: button.color,
              ['--button-line-color' as const]: button.textColor,
              color: button.textColor,
              backgroundColor: button.color
            } as React.CSSProperties}
          >
            {button.label}
            {button.showArrowIcon ? (
              <AtlasArrowIcon
                decorative
                direction="right"
                className="h-[1.1rem] w-[1.1rem]"
                style={button.textColor === SP_COLORS.bg ? { filter: 'brightness(0) saturate(100%)' } : undefined}
              />
            ) : null}
          </AtlasTextButton>
        </div>
      ))}
      {isRegulationCleared
        ? phaseActionButtons
            .filter((button) => button.key === 'regulation')
            .map((button) => (
              <div key={`${button.key}-gate`} className="absolute top-16 z-20" style={{ left: button.centerX, transform: 'translateX(-50%)' }}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full border text-[18px]" style={{ borderColor: SP_COLORS.white, color: SP_COLORS.white, backgroundColor: '#000000' }}>✓</div>
              </div>
            ))
        : null}
      {!showReadinessProgress ? (
        <div className="absolute bottom-16 right-5 rounded-[18px] border px-4 py-2 text-[12px]" style={{ borderColor: `${SP_COLORS.red}90`, color: SP_COLORS.red, backgroundColor: 'rgba(0,0,0,0.78)' }}>
          readiness hidden pending regulation clearance
        </div>
      ) : null}
      {resolvedTooltip ? (
        <div
          className="absolute z-30 w-[260px] rounded-[18px] border px-4 py-3"
          style={{ left: Math.max(12, Math.min(width - 272, resolvedTooltip.x + 18)), top: Math.max(90, resolvedTooltip.y - 6), borderColor: '#ffffff24', backgroundColor: 'rgba(6,6,6,0.96)' }}
        >
          <small className="block text-[10px] uppercase tracking-[0.12em]" style={{ color: SP_COLORS.muted }}>resolved z-code</small>
          <div className="mt-1 text-[16px] font-medium text-white">{resolvedTooltip.title}</div>
          <small className="mt-1 block text-[12px] leading-[1.45]" style={{ color: '#d7e0e9' }}>{resolvedTooltip.description}</small>
          {resolvedTooltip.partnerName ? <small className="mt-2 block text-[11px] leading-[1.45]" style={{ color: '#a6d5b2' }}>partner: {resolvedTooltip.partnerName}</small> : null}
          <small className="mt-1 block text-[11px] leading-[1.45]" style={{ color: '#c5ced8' }}>resolved: {resolvedTooltip.resolvedAtLabel}</small>
        </div>
      ) : null}
      {markerInspector ? (
        <div
          className="absolute z-30 w-[300px] rounded-[18px] border px-4 py-3"
          style={{ left: Math.max(12, Math.min(width - 312, markerInspector.x + 18)), top: Math.max(90, markerInspector.y + 18), borderColor: '#ffffff24', backgroundColor: 'rgba(6,6,6,0.96)' }}
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <small className="block text-[10px] uppercase tracking-[0.12em]" style={{ color: SP_COLORS.muted }}>timeline record</small>
              <div className="mt-1 text-[15px] font-medium text-white">{markerInspector.title}</div>
              <small className="mt-0.5 block text-[11px]" style={{ color: '#c9d3dc' }}>{markerInspector.subtitle}</small>
            </div>
            <button type="button" onClick={() => onSetMarkerInspector(null)} className="rounded-full border px-2 py-0.5 text-[11px]" style={{ borderColor: '#ffffff2d', color: SP_COLORS.white }}>close</button>
          </div>
          <div className="space-y-1.5">
            {markerInspector.details.map((detail, index) => <small key={`${markerInspector.id}:detail:${index}`} className="block text-[11px] leading-[1.45]" style={{ color: '#d7e0e9' }}>{detail}</small>)}
          </div>
          {markerInspector.onOpenRecord ? (
            <AtlasTextButton onClick={() => markerInspector.onOpenRecord?.()} className="mt-3 px-3 py-1 text-[11px]" style={{ ['--button-border-color' as const]: `${SP_COLORS.white}55`, color: SP_COLORS.white } as React.CSSProperties}>
              {markerInspector.openRecordLabel || 'open record'}
            </AtlasTextButton>
          ) : null}
          {markerInspector.eventRecord && onEventDateChange ? (
            <AtlasTextButton
              onClick={() => onEditEventDate(markerInspector.eventRecord as RouteLogEvent, markerInspector.x, markerInspector.y)}
              className="mt-3 px-3 py-1 text-[11px]"
              style={{ ['--button-border-color' as const]: `${SP_COLORS.yellow}80`, color: SP_COLORS.yellow } as React.CSSProperties}
            >
              edit milestone date
            </AtlasTextButton>
          ) : null}
        </div>
      ) : null}
      {isPartnerAggregateMode ? <TimelineLegend isOpen={isPartnerPolicyOpen} onToggle={onTogglePartnerPolicy} /> : null}
      {highlightedStationName ? (
        <div
          className="absolute z-20 max-w-[320px] rounded-[20px] border px-4 py-2 text-center"
          style={{ left: readinessCenterX, top: focusedStationTop, transform: 'translateX(-50%)', borderColor: `${SP_COLORS.yellow}88`, backgroundColor: 'var(--surface-panel-raised)' }}
        >
          <small className="block text-[10px] uppercase tracking-[0.08em]" style={{ color: SP_COLORS.yellow }}>next station</small>
          <div className="mt-1 text-[16px] leading-tight text-white">{highlightedStationName}</div>
        </div>
      ) : null}
    </>
  )
}
