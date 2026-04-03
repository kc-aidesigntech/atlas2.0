import React from 'react'
import type { EnrolleeProfile, RouteCandidateRecord } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

interface RoutePlanningOverlayProps {
  isOpen: boolean
  enrollee: EnrolleeProfile | null
  routeCandidates: RouteCandidateRecord[]
  selectedCandidateId: string | null
  assignedCandidateId: string | null
  onSelectCandidate: (candidateId: string) => void
  onCommitCandidate: (candidate: RouteCandidateRecord) => void
  enrollmentStartLabel: string
  hasRecordedIntake: boolean
  suggestedPhase: string
  onClose: () => void
}

export default function RoutePlanningOverlay({
  isOpen,
  enrollee,
  routeCandidates,
  selectedCandidateId,
  assignedCandidateId,
  onSelectCandidate,
  onCommitCandidate,
  enrollmentStartLabel,
  hasRecordedIntake,
  suggestedPhase,
  onClose
}: RoutePlanningOverlayProps) {
  if (!isOpen || !enrollee) return null
  const selectedCandidate = routeCandidates.find((candidate) => candidate.stationId === selectedCandidateId) || routeCandidates[0] || null

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-black/65 px-5 py-6 backdrop-blur-[2px]">
      <div
        className="max-h-[calc(100vh-72px)] w-full max-w-[980px] overflow-y-auto rounded-[34px] border px-6 py-5"
        style={{ borderColor: SP_COLORS.white, backgroundColor: '#020202' }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <small className="block text-[12px] uppercase tracking-[0.18em] text-[#9f9f9f]">route planning overlay</small>
            <h3 className="text-[28px] font-medium text-white">{enrollee.fullName}</h3>
            <small className="text-[13px] text-[#c7c7c7]">
              Matching partners by current Z-code pressure profile: {enrollee.zCodeTags.join(', ') || 'none assigned'}
            </small>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border px-3 py-1 text-[12px] text-white"
            style={{ borderColor: SP_COLORS.white }}
          >
            close
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.58fr_1fr_0.78fr]">
          <section className="rounded-[26px] border p-4" style={{ borderColor: '#ffffff25' }}>
            <small className="mb-3 block text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd]">subject enrollee</small>
            <div className="space-y-2 text-[13px] text-white">
              <div>
                <small className="block text-[#9f9f9f]">case</small>
                <div>{enrollee.caseId}</div>
              </div>
              <div>
                <small className="block text-[#9f9f9f]">navigator</small>
                <div>{enrollee.assignedNavigator || 'unassigned'}</div>
              </div>
              <div>
                <small className="block text-[#9f9f9f]">contact</small>
                <div>{enrollee.email || 'no email on file'}</div>
              </div>
              <div>
                <small className="block text-[#9f9f9f]">timeline anchor</small>
                <div>{enrollmentStartLabel}</div>
                <small className="text-[11px] text-[#8f8f8f]">
                  {hasRecordedIntake ? 'driven by saved admin intake' : 'waiting for admin intake save'}
                </small>
              </div>
              <div>
                <small className="block text-[#9f9f9f]">z-codes driving the match</small>
                <div className="mt-2 flex flex-wrap gap-2">
                  {enrollee.zCodeTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex rounded-full border px-2.5 py-1 text-[12px]"
                      style={{ borderColor: '#ffffff35' }}
                    >
                      {tag.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[26px] border p-4" style={{ borderColor: '#ffffff25' }}>
            <small className="mb-3 block text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd]">correlated partners</small>
            <div className="space-y-3">
              {routeCandidates.length ? (
                routeCandidates.map((candidate, index) => {
                  const isSelected = candidate.stationId === selectedCandidate?.stationId
                  const isAssigned = candidate.stationId === assignedCandidateId
                  return (
                  <div
                    key={candidate.stationId}
                    className="rounded-[22px] border px-4 py-3 transition-colors"
                    style={{
                      borderColor: isSelected ? `${SP_COLORS.yellow}aa` : '#ffffff20',
                      backgroundColor: isSelected ? '#0a0a0a' : '#050505'
                    }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <small className="block text-[11px] uppercase tracking-[0.08em]" style={{ color: isSelected ? SP_COLORS.yellow : '#9f9f9f' }}>
                          rank {index + 1}
                        </small>
                        <div className="text-[15px] font-medium text-white">{candidate.stationName}</div>
                        <small className="text-[12px] text-[#bdbdbd]">
                          matched specialties: {candidate.matchedZCodes.join(', ') || 'none'}
                        </small>
                        {isAssigned ? (
                          <small className="mt-1 block text-[11px]" style={{ color: SP_COLORS.deepGreen }}>
                            saved as current route assignment
                          </small>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <small className="text-[12px] text-white">score {candidate.score.toFixed(1)}</small>
                        <button
                          type="button"
                          onClick={() => onSelectCandidate(candidate.stationId)}
                          className="rounded-full border px-3 py-1 text-[11px] text-white"
                          style={{ borderColor: isSelected ? SP_COLORS.yellow : '#ffffff35', color: isSelected ? SP_COLORS.yellow : SP_COLORS.white }}
                        >
                          {isSelected ? 'focused' : 'focus'}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <MetricChip label="specialize hits" value={candidate.specializeHits} color={SP_COLORS.deepGreen} />
                      <MetricChip label="conflicts" value={candidate.conflictHits} color={SP_COLORS.orange} />
                      <MetricChip label="interference" value={candidate.interfereHits} color={SP_COLORS.red} />
                    </div>
                  </div>
                )})
              ) : (
                <div className="rounded-[22px] border px-4 py-6 text-[13px] text-[#cfcfcf]" style={{ borderColor: '#ffffff20' }}>
                  No partner specialties currently match this enrollee's active Z-codes.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[26px] border p-4" style={{ borderColor: '#ffffff25' }}>
            <small className="mb-3 block text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd]">selection rationale</small>
            {selectedCandidate ? (
              <div className="space-y-4 text-[13px] text-white">
                <div>
                  <div className="text-[18px] font-medium text-white">{selectedCandidate.stationName}</div>
                  <small className="text-[12px] text-[#bdbdbd]">
                    This partner is highlighted in the strip map below as the recommended next station context.
                  </small>
                </div>

                <div className="rounded-[22px] border px-4 py-3" style={{ borderColor: '#ffffff20', backgroundColor: '#050505' }}>
                  <small className="block text-[11px] uppercase tracking-[0.08em] text-[#9f9f9f]">why this ranks here</small>
                  <ul className="mt-2 space-y-2 text-[13px] text-white">
                    <li>{buildReasonLine(selectedCandidate)}</li>
                    <li>
                      Projected strip-map placement: <span style={{ color: SP_COLORS.yellow }}>{suggestedPhase}</span>
                    </li>
                    <li>
                      Timeline anchor remains <span style={{ color: SP_COLORS.yellow }}>{enrollmentStartLabel}</span>.
                    </li>
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onCommitCandidate(selectedCandidate)}
                      className="rounded-full border px-4 py-2 text-[12px] font-medium text-white"
                      style={{ borderColor: SP_COLORS.yellow, color: SP_COLORS.yellow }}
                    >
                      {selectedCandidate.stationId === assignedCandidateId ? 'saved to route context' : 'save to route context'}
                    </button>
                  </div>
                </div>

                <div className="rounded-[22px] border px-4 py-3" style={{ borderColor: '#ffffff20', backgroundColor: '#050505' }}>
                  <small className="block text-[11px] uppercase tracking-[0.08em] text-[#9f9f9f]">matched z-codes</small>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedCandidate.matchedZCodes.length ? (
                      selectedCandidate.matchedZCodes.map((tag) => (
                        <span key={tag} className="inline-flex rounded-full border px-2.5 py-1 text-[11px]" style={{ borderColor: '#ffffff30' }}>
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-[12px] text-[#bdbdbd]">No specialty match captured yet.</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[22px] border px-4 py-6 text-[13px] text-[#cfcfcf]" style={{ borderColor: '#ffffff20' }}>
                Select a correlated partner to inspect why it ranks and where it will project into the timeline.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function MetricChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-[18px] border px-3 py-2" style={{ borderColor: '#ffffff15' }}>
      <small className="block text-[11px] uppercase tracking-[0.08em] text-[#9f9f9f]">{label}</small>
      <div className="text-[18px] font-medium" style={{ color }}>
        {value}
      </div>
    </div>
  )
}

function buildReasonLine(candidate: RouteCandidateRecord) {
  if (candidate.specializeHits > 0 && candidate.conflictHits === 0 && candidate.interfereHits === 0) {
    return `Clear specialty match across ${candidate.specializeHits} active Z-code group${candidate.specializeHits === 1 ? '' : 's'} with no recorded interference.`
  }
  if (candidate.conflictHits > 0) {
    return `Strong specialty coverage is present, but ${candidate.conflictHits} overlap${candidate.conflictHits === 1 ? '' : 's'} include both specialize and interfere signals.`
  }
  if (candidate.interfereHits > 0) {
    return `This option still carries ${candidate.interfereHits} interference signal${candidate.interfereHits === 1 ? '' : 's'}, so it is ranked more cautiously.`
  }
  return 'This partner remains in view, but the current match is weaker than the leading options.'
}
