import React from 'react'
import type { EnrolleeProfile, RouteCandidateRecord } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

interface RoutePlanningOverlayProps {
  isOpen: boolean
  enrollee: EnrolleeProfile | null
  routeCandidates: RouteCandidateRecord[]
  enrollmentStartLabel: string
  hasRecordedIntake: boolean
  onClose: () => void
}

export default function RoutePlanningOverlay({
  isOpen,
  enrollee,
  routeCandidates,
  enrollmentStartLabel,
  hasRecordedIntake,
  onClose
}: RoutePlanningOverlayProps) {
  if (!isOpen || !enrollee) return null

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-black/65 px-5 py-6 backdrop-blur-[2px]">
      <div
        className="w-full max-w-[980px] rounded-[34px] border px-6 py-5"
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

        <div className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
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
                routeCandidates.map((candidate) => (
                  <div
                    key={candidate.stationId}
                    className="rounded-[22px] border px-4 py-3"
                    style={{ borderColor: '#ffffff20', backgroundColor: '#050505' }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-[15px] font-medium text-white">{candidate.stationName}</div>
                        <small className="text-[12px] text-[#bdbdbd]">
                          matched specialties: {candidate.matchedZCodes.join(', ') || 'none'}
                        </small>
                      </div>
                      <small className="text-[12px] text-white">score {candidate.score.toFixed(1)}</small>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <MetricChip label="specialize hits" value={candidate.specializeHits} color={SP_COLORS.deepGreen} />
                      <MetricChip label="conflicts" value={candidate.conflictHits} color={SP_COLORS.orange} />
                      <MetricChip label="interference" value={candidate.interfereHits} color={SP_COLORS.red} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border px-4 py-6 text-[13px] text-[#cfcfcf]" style={{ borderColor: '#ffffff20' }}>
                  No partner specialties currently match this enrollee's active Z-codes.
                </div>
              )}
            </div>
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
