import React from 'react'
import { Check } from 'lucide-react'
import { AtlasCloseButton, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import ZCodeBadge from '@/features/atlas2026/components/ZCodeBadge'
import type {
  EnrolleeActiveZCode,
  EnrolleeProfile,
  EnrolleeZCodeResolutionInput,
  RouteCandidateRecord,
  ZCodeConfidenceLevel,
  ZCodeReviewStatus
} from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import { toSupabaseErrorMessage } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'
import { getZCodeParentColor } from '@atlas/shared'

// Readiness criteria selectors rendered per Z-code: the code review tri-state
// drives the existing resolved semantics ('resolved' <=> isResolved), and the
// confidence level is an independent quality signal.
const CODE_REVIEW_OPTIONS: Array<{ value: ZCodeReviewStatus; label: string }> = [
  { value: 'not_resolved', label: 'not resolved' },
  { value: 'partially_resolved', label: 'partially resolved' },
  { value: 'resolved', label: 'resolved' }
]

const CONFIDENCE_OPTIONS: Array<{ value: ZCodeConfidenceLevel; label: string }> = [
  { value: 'low', label: 'low' },
  { value: 'medium', label: 'medium' },
  { value: 'high', label: 'high' }
]

// Rows persisted before the readiness-criteria columns fall back to the
// legacy boolean so the selectors always render a coherent selection.
function getCodeReviewStatus(detail: EnrolleeActiveZCode): ZCodeReviewStatus {
  return detail.codeReviewStatus ?? (detail.isResolved ? 'resolved' : 'not_resolved')
}

interface ResolvedZCodesOverlayProps {
  isOpen: boolean
  enrollee: EnrolleeProfile | null
  candidate?: RouteCandidateRecord | null
  partnerOptions?: Array<{ partnerId: string; label: string }>
  launchSource?: 'route-board' | 'page-zcode'
  filterParentCode?: string | null
  filterChildCodes?: string[]
  onClose: () => void
  onToggleResolution: (
    enrolleeZCodeId: string,
    isResolved: boolean,
    input?: EnrolleeZCodeResolutionInput
  ) => Promise<unknown>
}

function normalizeCode(value: string | null | undefined) {
  return value?.trim().toUpperCase() || ''
}

export default function ResolvedZCodesOverlay({
  isOpen,
  enrollee,
  candidate = null,
  partnerOptions = [],
  launchSource = 'page-zcode',
  filterParentCode = null,
  filterChildCodes = [],
  onClose,
  onToggleResolution
}: ResolvedZCodesOverlayProps) {
  const [savingIds, setSavingIds] = React.useState<string[]>([])
  const [selectedPartnerId, setSelectedPartnerId] = React.useState('')
  const [resolutionNote, setResolutionNote] = React.useState('')
  const [validationMessage, setValidationMessage] = React.useState<string | null>(null)

  const details = enrollee?.activeZCodeDetails || []
  const selectedChildCodes = React.useMemo(
    () => new Set(filterChildCodes.map((code) => normalizeCode(code))),
    [filterChildCodes]
  )
  const normalizedFilterParentCode = React.useMemo(() => normalizeCode(filterParentCode), [filterParentCode])
  const isRouteBoardLaunch = launchSource === 'route-board' && Boolean(candidate)
  const trimmedNote = resolutionNote.trim()
  const detailsToRender = React.useMemo(() => {
    if (!normalizedFilterParentCode && !selectedChildCodes.size) return details
    return details.filter((detail) => {
      const matchesParent = normalizedFilterParentCode ? normalizeCode(detail.parentCode) === normalizedFilterParentCode : true
      const matchesChild = selectedChildCodes.size ? selectedChildCodes.has(normalizeCode(detail.zCode)) : true
      return matchesParent && matchesChild
    })
  }, [details, normalizedFilterParentCode, selectedChildCodes])
  const selectedPartnerLabel = React.useMemo(
    () => partnerOptions.find((option) => option.partnerId === selectedPartnerId)?.label || '',
    [partnerOptions, selectedPartnerId]
  )

  React.useEffect(() => {
    if (!isOpen) return
    setSavingIds([])
    setValidationMessage(null)
    // Route-board launches carry implicit partner attribution; manual launches must collect partner/note per run.
    if (isRouteBoardLaunch && candidate?.partnerId) {
      setSelectedPartnerId(candidate.partnerId)
      setResolutionNote('')
      return
    }
    setSelectedPartnerId('')
    setResolutionNote('')
  }, [candidate?.partnerId, isOpen, isRouteBoardLaunch])

  if (!isOpen || !enrollee) return null

  /**
   * Persists the readiness criteria for one Z-code. Both selectors funnel
   * through here so every save carries the full (status, confidence) pair:
   * the resolution Remote Procedure Call (RPC) overwrites both columns, so
   * omitting the untouched one would silently clear it.
   */
  async function handleCriteriaSave(
    detail: EnrolleeActiveZCode,
    nextStatus: ZCodeReviewStatus,
    nextConfidence: ZCodeConfidenceLevel | null
  ) {
    const isResolved = nextStatus === 'resolved'
    const wasResolved = detail.isResolved
    // Manual resolutions require attribution context to keep downstream audit/history screens actionable.
    // Already-resolved rows keep their stored attribution when only confidence changes.
    if (isResolved && !wasResolved && !isRouteBoardLaunch && !selectedPartnerId && !trimmedNote) {
      setValidationMessage('Select a partner station or add a note before marking a Z-code resolved.')
      return
    }
    setValidationMessage(null)
    const input: EnrolleeZCodeResolutionInput = isResolved
      ? {
          // Re-saving an already-resolved code (e.g. a confidence tweak) must
          // not wipe its stored partner attribution, so reuse the detail's
          // persisted values before falling back to the form selections.
          partnerId: wasResolved
            ? detail.resolutionPartnerId ?? (isRouteBoardLaunch ? candidate?.partnerId || null : selectedPartnerId || null)
            : isRouteBoardLaunch
              ? candidate?.partnerId || null
              : selectedPartnerId || null,
          partnerName: wasResolved
            ? detail.resolutionPartnerName ?? (isRouteBoardLaunch ? candidate?.stationName || null : selectedPartnerLabel || null)
            : isRouteBoardLaunch
              ? candidate?.stationName || null
              : selectedPartnerLabel || null,
          resolutionNote: (wasResolved ? detail.resolutionNote || trimmedNote : trimmedNote) || null,
          codeReviewStatus: nextStatus,
          confidenceLevel: nextConfidence
        }
      : {
          partnerId: null,
          partnerName: null,
          resolutionNote: null,
          codeReviewStatus: nextStatus,
          confidenceLevel: nextConfidence
        }
    setSavingIds((current) => [...current, detail.enrolleeZCodeId])
    try {
      await onToggleResolution(detail.enrolleeZCodeId, isResolved, input)
    } catch (error) {
      // Supabase/PostgREST rejections are plain objects, not Error instances;
      // surface their real message instead of a generic fallback.
      setValidationMessage(toSupabaseErrorMessage(error, 'Unable to save this Z-code resolution right now.'))
    } finally {
      setSavingIds((current) => current.filter((id) => id !== detail.enrolleeZCodeId))
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center bg-black/72 px-5 py-6 backdrop-blur-[2px]">
      <div className="atlas-surface-shell max-h-[calc(100vh-72px)] w-full max-w-[920px] overflow-y-auto px-4 py-4 sm:px-5 sm:py-5" style={{ borderColor: SP_COLORS.white, backgroundColor: 'var(--surface-panel-soft)' }}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <small className="atlas-overline block" style={{ color: '#9ea8b4' }}>
              {isRouteBoardLaunch ? 'route resolution' : 'zcode resolution'}
            </small>
            <h3 className="atlas-h3 text-[30px] font-medium text-white">which zcodes were resolved?</h3>
            <small className="atlas-caption mt-2 block leading-[1.45]" style={{ color: '#b1bcc8' }}>
              {isRouteBoardLaunch
                ? `${candidate?.stationName || 'selected station'} assigned`
                : normalizedFilterParentCode
                  ? `${normalizedFilterParentCode} selected for ${enrollee.fullName}`
                  : enrollee.fullName}
            </small>
          </div>
          <AtlasCloseButton
            onClick={onClose}
            style={{ ['--button-border-color' as const]: '#ffffff45', color: SP_COLORS.white } as React.CSSProperties}
          />
        </div>

        {isRouteBoardLaunch ? (
          <div className="atlas-surface-raised mb-4 px-4 py-3 text-[12px]" style={{ color: '#d3dbe4' }}>
            Partner attribution will be saved to <span className="font-medium text-white">{candidate?.stationName}</span>.
          </div>
        ) : (
          <div className="atlas-surface-panel mb-4 grid gap-3 px-4 py-4">
            <div className="grid gap-1">
              <label className="atlas-overline" style={{ color: '#9ea8b4' }} htmlFor="resolution-partner">
                partner station
              </label>
              <select
                id="resolution-partner"
                value={selectedPartnerId}
                onChange={(event) => setSelectedPartnerId(event.target.value)}
                className="atlas-select h-11 bg-[rgba(255,255,255,0.02)] text-[14px] text-white"
              >
                <option value="" style={{ color: '#111111' }}>
                  select a partner station
                </option>
                {partnerOptions.map((option) => (
                  <option key={option.partnerId} value={option.partnerId} style={{ color: '#111111' }}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label className="atlas-overline" style={{ color: '#9ea8b4' }} htmlFor="resolution-note">
                note
              </label>
              <textarea
                id="resolution-note"
                value={resolutionNote}
                onChange={(event) => setResolutionNote(event.target.value)}
                rows={3}
                placeholder="Add context if the partner is not in the list, or to explain how the resolution happened."
                className="atlas-textarea resize-none bg-[rgba(255,255,255,0.02)] text-[14px] text-white outline-none placeholder:text-[#94a0ad]"
              />
            </div>
            <small className="text-[12px] leading-[1.45]" style={{ color: validationMessage ? '#ff9a9a' : '#b5c0cb' }}>
              {validationMessage || 'Select a partner station or add a note before marking a Z-code resolved.'}
            </small>
          </div>
        )}

        <div className="grid gap-3">
          {detailsToRender.length ? (
            detailsToRender.map((detail) => {
              const parentFill = getZCodeParentColor(detail.parentCode) || SP_COLORS.yellow
              const isSaving = savingIds.includes(detail.enrolleeZCodeId)
              const reviewStatus = getCodeReviewStatus(detail)
              const confidenceLevel = detail.confidenceLevel ?? null
              return (
                <div
                  key={detail.enrolleeZCodeId}
                  className="flex w-full items-start gap-3 rounded-[20px] border px-3 py-3 text-left transition-[border-color,box-shadow,opacity] duration-150"
                  style={{
                    borderColor: detail.isResolved ? `${SP_COLORS.deepGreen}88` : '#ffffff22',
                    backgroundColor: detail.isResolved ? 'rgba(111,207,151,0.08)' : 'var(--surface-panel-raised)',
                    opacity: isSaving ? 0.6 : 1
                  }}
                >
                  <ZCodeBadge value={detail.zCode} fill={parentFill} size="resolved" stripLeadingZ />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[18px] font-medium text-white">{detail.title || detail.zCode}</span>
                      <span className="rounded-full border px-2 py-[2px] text-[10px] uppercase tracking-[0.12em]" style={{ borderColor: '#ffffff22', color: '#b0bcc9' }}>
                        {detail.parentCode}
                      </span>
                    </div>
                    <small className="mt-1 block text-[13px] leading-[1.45]" style={{ color: '#b5c0cb' }}>
                      {detail.description || 'No context available yet for this Z-code.'}
                    </small>
                    {detail.isResolved && (detail.resolutionPartnerName || detail.resolutionNote) ? (
                      <small className="mt-2 block text-[12px] leading-[1.45]" style={{ color: '#9fd0ae' }}>
                        {detail.resolutionPartnerName ? `partner: ${detail.resolutionPartnerName}` : 'partner: not recorded'}
                        {detail.resolutionNote ? ` | note: ${detail.resolutionNote}` : ''}
                      </small>
                    ) : null}
                    {/* Readiness criteria: code review drives resolved semantics; confidence is independent. */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <small className="atlas-overline w-[112px] shrink-0" style={{ color: '#9ea8b4' }}>
                        code review
                      </small>
                      {CODE_REVIEW_OPTIONS.map((option) => {
                        const isSelected = reviewStatus === option.value
                        const accent = option.value === 'resolved' ? SP_COLORS.deepGreen : option.value === 'partially_resolved' ? SP_COLORS.yellow : '#ffffff'
                        return (
                          <AtlasTextButton
                            key={option.value}
                            disabled={isSaving}
                            onClick={() => void handleCriteriaSave(detail, option.value, confidenceLevel)}
                            className="px-[10px] py-[4px] text-[12px] md:text-[13px]"
                            style={{
                              ['--button-border-color' as const]: isSelected ? accent : '#ffffff22',
                              backgroundColor: 'var(--surface-button-strong)',
                              color: SP_COLORS.white,
                              boxShadow: isSelected ? `0 0 0 1px ${accent}66` : 'none'
                            } as React.CSSProperties}
                          >
                            {option.label}
                          </AtlasTextButton>
                        )
                      })}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <small className="atlas-overline w-[112px] shrink-0" style={{ color: '#9ea8b4' }}>
                        confidence in status
                      </small>
                      {CONFIDENCE_OPTIONS.map((option) => {
                        const isSelected = confidenceLevel === option.value
                        return (
                          <AtlasTextButton
                            key={option.value}
                            disabled={isSaving}
                            onClick={() => void handleCriteriaSave(detail, reviewStatus, isSelected ? null : option.value)}
                            className="px-[10px] py-[4px] text-[12px] md:text-[13px]"
                            style={{
                              ['--button-border-color' as const]: isSelected ? SP_COLORS.white : '#ffffff22',
                              backgroundColor: 'var(--surface-button-strong)',
                              color: SP_COLORS.white,
                              boxShadow: isSelected ? '0 0 0 1px #ffffff66' : 'none'
                            } as React.CSSProperties}
                          >
                            {option.label}
                          </AtlasTextButton>
                        )
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCriteriaSave(detail, detail.isResolved ? 'not_resolved' : 'resolved', confidenceLevel)}
                    disabled={isSaving}
                    aria-label={detail.isResolved ? `mark ${detail.zCode} unresolved` : `mark ${detail.zCode} resolved`}
                    className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border transition-[border-color,box-shadow] duration-150 hover:border-white/60 disabled:opacity-60"
                    style={{
                      borderColor: detail.isResolved ? SP_COLORS.deepGreen : '#ffffff35',
                      color: detail.isResolved ? SP_COLORS.deepGreen : SP_COLORS.white
                    } as React.CSSProperties}
                  >
                    <Check size={17} strokeWidth={2.1} />
                  </button>
                </div>
              )
            })
          ) : (
            <div className="atlas-empty-state px-4 py-5 text-[13px]" style={{ color: '#c7d0d9' }}>
              {normalizedFilterParentCode
                ? `No active ${normalizedFilterParentCode} Z-codes are available for this enrollee.`
                : 'No active Z-codes are available for this enrollee.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
