import React from 'react'
import { Check } from 'lucide-react'
import { AtlasCloseButton } from '@/features/atlas2026/components/AtlasPrimitives'
import ZCodeBadge from '@/features/atlas2026/components/ZCodeBadge'
import type {
  EnrolleeProfile,
  EnrolleeZCodeResolutionInput,
  RouteCandidateRecord
} from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import { getZCodeParentColor } from '@atlas/shared'

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

  async function handleToggle(enrolleeZCodeId: string, isResolved: boolean) {
    // Manual resolutions require attribution context to keep downstream audit/history screens actionable.
    if (isResolved && !isRouteBoardLaunch && !selectedPartnerId && !trimmedNote) {
      setValidationMessage('Select a partner station or add a note before marking a Z-code resolved.')
      return
    }
    setValidationMessage(null)
    const input: EnrolleeZCodeResolutionInput = isResolved
      ? {
          partnerId: isRouteBoardLaunch ? candidate?.partnerId || null : selectedPartnerId || null,
          partnerName: isRouteBoardLaunch ? candidate?.stationName || null : selectedPartnerLabel || null,
          resolutionNote: trimmedNote || null
        }
      : {
          partnerId: null,
          partnerName: null,
          resolutionNote: null
        }
    setSavingIds((current) => [...current, enrolleeZCodeId])
    try {
      await onToggleResolution(enrolleeZCodeId, isResolved, input)
    } catch (error) {
      setValidationMessage(error instanceof Error ? error.message : 'Unable to save this Z-code resolution right now.')
    } finally {
      setSavingIds((current) => current.filter((id) => id !== enrolleeZCodeId))
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center bg-black/72 px-5 py-6 backdrop-blur-[2px]">
      <div
        className="max-h-[calc(100vh-72px)] w-full max-w-[920px] overflow-y-auto rounded-[34px] border px-4 py-4 sm:px-5 sm:py-5"
        style={{ borderColor: SP_COLORS.white, backgroundColor: 'var(--surface-panel-soft)' }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <small className="block text-[11px] uppercase tracking-[0.18em]" style={{ color: '#9ea8b4' }}>
              {isRouteBoardLaunch ? 'route resolution' : 'zcode resolution'}
            </small>
            <h3 className="text-[30px] font-medium text-white">which zcodes were resolved?</h3>
            <small className="mt-2 block text-[12px] leading-[1.45]" style={{ color: '#b1bcc8' }}>
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
          <div
            className="mb-4 rounded-[20px] border px-4 py-3 text-[12px]"
            style={{ borderColor: '#ffffff24', backgroundColor: 'var(--surface-panel-raised)', color: '#d3dbe4' }}
          >
            Partner attribution will be saved to <span className="font-medium text-white">{candidate?.stationName}</span>.
          </div>
        ) : (
          <div
            className="mb-4 grid gap-3 rounded-[24px] border px-4 py-4"
            style={{ borderColor: '#ffffff24', backgroundColor: 'var(--surface-panel-raised)' }}
          >
            <div className="grid gap-1">
              <label className="text-[11px] uppercase tracking-[0.18em]" style={{ color: '#9ea8b4' }} htmlFor="resolution-partner">
                partner station
              </label>
              <select
                id="resolution-partner"
                value={selectedPartnerId}
                onChange={(event) => setSelectedPartnerId(event.target.value)}
                className="h-11 rounded-[14px] border px-3 text-[14px] text-white outline-none"
                style={{ borderColor: '#ffffff24', backgroundColor: 'rgba(255,255,255,0.02)' }}
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
              <label className="text-[11px] uppercase tracking-[0.18em]" style={{ color: '#9ea8b4' }} htmlFor="resolution-note">
                note
              </label>
              <textarea
                id="resolution-note"
                value={resolutionNote}
                onChange={(event) => setResolutionNote(event.target.value)}
                rows={3}
                placeholder="Add context if the partner is not in the list, or to explain how the resolution happened."
                className="resize-none rounded-[14px] border px-3 py-2 text-[14px] text-white outline-none placeholder:text-[#94a0ad]"
                style={{ borderColor: '#ffffff24', backgroundColor: 'rgba(255,255,255,0.02)' }}
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
              return (
                <button
                  key={detail.enrolleeZCodeId}
                  type="button"
                  onClick={() => handleToggle(detail.enrolleeZCodeId, !detail.isResolved)}
                  disabled={isSaving}
                  className="flex w-full items-start gap-3 rounded-[20px] border px-3 py-3 text-left transition-[border-color,box-shadow,opacity] duration-150 hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15)] disabled:opacity-60"
                  style={{
                    borderColor: detail.isResolved ? `${SP_COLORS.deepGreen}88` : '#ffffff22',
                    backgroundColor: detail.isResolved ? 'rgba(111,207,151,0.08)' : 'var(--surface-panel-raised)'
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
                  </div>
                  <span
                    aria-hidden="true"
                    className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border"
                    style={{
                      borderColor: detail.isResolved ? SP_COLORS.deepGreen : '#ffffff35',
                      color: detail.isResolved ? SP_COLORS.deepGreen : SP_COLORS.white
                    } as React.CSSProperties}
                  >
                    <Check size={17} strokeWidth={2.1} />
                  </span>
                </button>
              )
            })
          ) : (
            <div className="rounded-[20px] border px-4 py-5 text-[13px]" style={{ borderColor: '#ffffff24', color: '#c7d0d9' }}>
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
