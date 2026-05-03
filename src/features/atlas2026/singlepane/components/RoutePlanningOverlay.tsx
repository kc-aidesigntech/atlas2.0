import React from 'react'
import { AtlasCloseButton, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { EnrolleeProfile, RouteCandidateRecord } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import MtaRouteBoard from './MtaRouteBoard'

interface RoutePlanningOverlayProps {
  isOpen: boolean
  enrollee: EnrolleeProfile | null
  routeCandidates: RouteCandidateRecord[]
  headerParentCodes?: string[]
  completedParentCodes?: string[]
  selectedCandidateId: string | null
  assignedCandidateId: string | null
  onSelectCandidate: (candidateId: string) => void
  onAssignCandidate: (candidate: RouteCandidateRecord) => void
  onDoneCandidate: (candidate: RouteCandidateRecord) => void
  onSelectZCode?: (selection: { parentCode: string; childCodes: string[] }) => void
  enrollmentStartLabel: string
  hasRecordedIntake: boolean
  suggestedPhase: string
  onClose: () => void
}

export default function RoutePlanningOverlay({
  isOpen,
  enrollee,
  routeCandidates,
  headerParentCodes = [],
  completedParentCodes = [],
  selectedCandidateId,
  assignedCandidateId,
  onSelectCandidate,
  onAssignCandidate,
  onDoneCandidate,
  onSelectZCode,
  enrollmentStartLabel,
  hasRecordedIntake,
  suggestedPhase,
  onClose
}: RoutePlanningOverlayProps) {
  if (!isOpen || !enrollee) return null
  // Default selection mirrors board ranking so assign/done actions are always available on first open.
  const selectedCandidate = routeCandidates.find((candidate) => candidate.stationId === selectedCandidateId) ?? routeCandidates[0] ?? null

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-black/65 px-5 py-6 backdrop-blur-[2px]">
      <div
        className="max-h-[calc(100vh-72px)] w-full max-w-[1120px] overflow-y-auto rounded-[34px] border px-4 py-4 sm:px-5 sm:py-5"
        style={{ borderColor: SP_COLORS.white, backgroundColor: 'var(--surface-panel-soft)' }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <small className="block text-[12px] uppercase tracking-[0.18em] text-[#9f9f9f]">route board</small>
            <h3 className="text-[28px] font-medium text-white">{enrollee.fullName}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {enrollee.zCodeTags.length ? (
                enrollee.zCodeTags.map((tag) => (
                  <span key={tag} className="inline-flex rounded-full border px-2.5 py-1 text-[11px]" style={{ borderColor: '#ffffff24', color: '#d8e1ea' }}>
                    {tag}
                  </span>
                ))
              ) : (
                <small className="text-[12px] text-[#9ea8b4]">no z-codes assigned</small>
              )}
            </div>
          </div>
          <AtlasCloseButton
            onClick={onClose}
            className="h-9 w-9"
            style={{ ['--button-border-color' as const]: SP_COLORS.white } as React.CSSProperties}
          />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <MetaPill label="case" value={enrollee.caseId} />
          <MetaPill label="navigator" value={enrollee.assignedNavigator || 'unassigned'} />
          <MetaPill label="timeline anchor" value={enrollmentStartLabel} />
          <MetaPill label="phase" value={suggestedPhase} accentColor={SP_COLORS.yellow} />
          <MetaPill label="intake" value={hasRecordedIntake ? 'saved' : 'pending'} accentColor={hasRecordedIntake ? SP_COLORS.deepGreen : SP_COLORS.orange} />
        </div>

        <MtaRouteBoard
          kicker="route board"
          title="route board"
          subtitle={`${enrollee.activeZCodeDetails.length || enrollee.zCodeTags.length || 0} active Z-codes`}
          routeCandidates={routeCandidates}
          activeZCodeCount={enrollee.activeZCodeDetails.length || enrollee.zCodeTags.length || 0}
          headerParentCodes={headerParentCodes}
          completedParentCodes={completedParentCodes}
          selectedCandidateId={selectedCandidate?.stationId || null}
          assignedCandidateId={assignedCandidateId}
          onSelectCandidate={onSelectCandidate}
          onAssignCandidate={onAssignCandidate}
          onDoneCandidate={onDoneCandidate}
          onSelectParentCode={onSelectZCode}
          parentCircleSize="board"
          headerActions={
            <AtlasCloseButton
              onClick={onClose}
              className="h-8 w-8"
              style={{ ['--button-border-color' as const]: '#ffffff45', color: SP_COLORS.white } as React.CSSProperties}
            />
          }
          emptyMessage="No partner specialties currently match this enrollee's active Z-codes."
        />
      </div>
    </div>
  )
}

function MetaPill({ label, value, accentColor }: { label: string; value: string; accentColor?: string }) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px]"
      style={{ borderColor: '#ffffff20', backgroundColor: 'var(--surface-panel-raised)', color: accentColor || '#d2d9e2' }}
    >
      <span style={{ color: '#9fa8b4' }}>{label}</span>
      <span className="font-medium text-white" style={accentColor ? { color: accentColor } : undefined}>
        {value}
      </span>
    </div>
  )
}
