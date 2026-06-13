import React from 'react'
import { Check } from 'lucide-react'
import { getZCodeParentColor } from '@atlas/shared'
import { AtlasTextButton } from '../../components/AtlasPrimitives'
import ZCodeBadge from '../../components/ZCodeBadge'
import { DEFAULT_SERVICE_CAPACITY_SECTIONS } from '../data/serviceCapacitySurveyCatalog'
import { toSupabaseErrorMessage } from '../data-access/supabaseOptionalData'
import { SP_COLORS } from '../theme'
import type {
  EnrolleeProfile,
  EnrolleeZCodeOverrideInput,
  EnrolleeZCodeOverrideResult,
  EnrolleeZCodeUncheckReason,
  ZCodeUncheckReasonCode
} from '../types'

/**
 * Streamlined enrollee Z-code override panel.
 *
 * Replaces the in-depth enrollee burden survey as the navigator entry point
 * for updating an enrollee's Z-code status. The major Z-code categories render
 * as the standard Z-code coin circles; selecting one opens a card list with
 * checkbox selection of the actual codes in that category. The checked set IS
 * the enrollee's active Z-code set (binary override, not weighted scoring),
 * which keeps partner-capacity matching inputs exact.
 *
 * Unchecking a code that is currently active prompts for a reason that the
 * backend records in the durable "unchecked z-code coin log".
 */

interface EnrolleeZCodeOverridePanelProps {
  enrollee: EnrolleeProfile
  canEdit: boolean
  onSave: (enrollmentId: string, input: EnrolleeZCodeOverrideInput) => Promise<EnrolleeZCodeOverrideResult | null>
}

interface CategoryCatalogEntry {
  parentCode: string
  theme: string
  codes: Array<{ zCode: string; description: string }>
}

const UNCHECK_REASON_OPTIONS: Array<{ value: ZCodeUncheckReasonCode; label: string }> = [
  { value: 'restarting_readiness', label: 'Restarting Readiness' },
  { value: 'entry_error', label: 'Entry error' },
  { value: 'other', label: 'Other:' }
]

function normalizeCode(value: string | null | undefined) {
  return value?.trim().toUpperCase() || ''
}

/**
 * Builds the category -> code catalog from the canonical survey sections,
 * de-duplicated on the normalized code (the catalog carries pseudo-entries
 * like "Z62.810*" that share one persisted code) and merged with any active
 * enrollee codes missing from the static catalog so nothing is ever hidden.
 */
function buildCategoryCatalog(enrollee: EnrolleeProfile): CategoryCatalogEntry[] {
  const categories = new Map<string, CategoryCatalogEntry>()
  for (const section of DEFAULT_SERVICE_CAPACITY_SECTIONS) {
    const parentCode = normalizeCode(section.parentCode)
    const entry = categories.get(parentCode) || { parentCode, theme: section.theme, codes: [] }
    for (const prompt of section.prompts) {
      const zCode = normalizeCode(prompt.normalizedZCode || prompt.zCode)
      if (!zCode || entry.codes.some((code) => code.zCode === zCode)) continue
      entry.codes.push({ zCode, description: prompt.description })
    }
    categories.set(parentCode, entry)
  }
  for (const detail of enrollee.activeZCodeDetails) {
    const parentCode = normalizeCode(detail.parentCode)
    const zCode = normalizeCode(detail.zCode)
    if (!parentCode || !zCode) continue
    const entry = categories.get(parentCode) || { parentCode, theme: detail.title || parentCode, codes: [] }
    if (!entry.codes.some((code) => code.zCode === zCode)) {
      entry.codes.push({ zCode, description: detail.description || detail.title })
      entry.codes.sort((left, right) => left.zCode.localeCompare(right.zCode))
    }
    categories.set(parentCode, entry)
  }
  return Array.from(categories.values()).sort((left, right) => left.parentCode.localeCompare(right.parentCode))
}

interface PendingUncheck {
  zCode: string
  reasonCode: ZCodeUncheckReasonCode
  reasonText: string
}

export default function EnrolleeZCodeOverridePanel({ enrollee, canEdit, onSave }: EnrolleeZCodeOverridePanelProps) {
  const catalog = React.useMemo(() => buildCategoryCatalog(enrollee), [enrollee])
  // The set of codes active in the database right now; only these require an
  // uncheck reason when removed (newly checked-then-unchecked codes do not).
  const originallyActiveCodes = React.useMemo(
    () => new Set(enrollee.activeZCodeDetails.map((detail) => normalizeCode(detail.zCode))),
    [enrollee.activeZCodeDetails]
  )
  const [checkedCodes, setCheckedCodes] = React.useState<Set<string>>(() => new Set(originallyActiveCodes))
  const [uncheckReasonsByCode, setUncheckReasonsByCode] = React.useState<Map<string, EnrolleeZCodeUncheckReason>>(
    () => new Map()
  )
  const [openCategory, setOpenCategory] = React.useState<string | null>(null)
  const [pendingUncheck, setPendingUncheck] = React.useState<PendingUncheck | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [savedAtLabel, setSavedAtLabel] = React.useState<string | null>(null)

  // Re-anchor the draft whenever the persisted active set changes (initial
  // open, save round-trip, or enrollee switch) so checkboxes always reflect
  // the latest database truth.
  React.useEffect(() => {
    setCheckedCodes(new Set(originallyActiveCodes))
    setUncheckReasonsByCode(new Map())
    setPendingUncheck(null)
    setSaveError(null)
  }, [originallyActiveCodes])

  const isDirty = React.useMemo(() => {
    if (checkedCodes.size !== originallyActiveCodes.size) return true
    for (const code of checkedCodes) {
      if (!originallyActiveCodes.has(code)) return true
    }
    return false
  }, [checkedCodes, originallyActiveCodes])

  const activeCategory = openCategory ? catalog.find((entry) => entry.parentCode === openCategory) || null : null

  function toggleCode(zCode: string) {
    if (!canEdit || isSaving) return
    setSavedAtLabel(null)
    if (!checkedCodes.has(zCode)) {
      // (Re-)checking a code restores it to the active set; any reason that
      // was staged while it was unchecked is no longer relevant.
      setCheckedCodes((current) => new Set(current).add(zCode))
      setUncheckReasonsByCode((current) => {
        if (!current.has(zCode)) return current
        const next = new Map(current)
        next.delete(zCode)
        return next
      })
      return
    }
    if (originallyActiveCodes.has(zCode)) {
      // Removing an active code is an audited action: collect the reason in
      // the mini-overlay before the checkbox visually clears.
      setPendingUncheck({ zCode, reasonCode: 'restarting_readiness', reasonText: '' })
      return
    }
    setCheckedCodes((current) => {
      const next = new Set(current)
      next.delete(zCode)
      return next
    })
  }

  function confirmPendingUncheck() {
    if (!pendingUncheck) return
    const trimmedText = pendingUncheck.reasonText.trim()
    if (pendingUncheck.reasonCode === 'other' && !trimmedText) {
      setSaveError('Add a short explanation when choosing "Other:" as the uncheck reason.')
      return
    }
    setSaveError(null)
    setUncheckReasonsByCode((current) => {
      const next = new Map(current)
      next.set(pendingUncheck.zCode, {
        zCode: pendingUncheck.zCode,
        reasonCode: pendingUncheck.reasonCode,
        reasonText: trimmedText || null
      })
      return next
    })
    setCheckedCodes((current) => {
      const next = new Set(current)
      next.delete(pendingUncheck.zCode)
      return next
    })
    setPendingUncheck(null)
  }

  async function handleSave() {
    if (!canEdit || isSaving || !enrollee.enrollmentId) return
    setIsSaving(true)
    setSaveError(null)
    setSavedAtLabel(null)
    try {
      const uncheckReasons = Array.from(uncheckReasonsByCode.values()).filter(
        (reason) => originallyActiveCodes.has(reason.zCode) && !checkedCodes.has(reason.zCode)
      )
      const result = await onSave(enrollee.enrollmentId, {
        checkedZCodes: Array.from(checkedCodes).sort(),
        uncheckReasons
      })
      if (!result) {
        // A null result means no live backend persisted the override; treat it
        // as a hard failure so the navigator never believes a save happened.
        throw new Error('Z-code override was not persisted: no live database connection is available.')
      }
      setSavedAtLabel(
        new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date())
      )
    } catch (error) {
      // Supabase/PostgREST rejections are plain objects, not Error instances;
      // surface their real message instead of a generic fallback.
      setSaveError(toSupabaseErrorMessage(error, 'Unable to save the Z-code override right now.'))
    } finally {
      setIsSaving(false)
    }
  }

  const checkedCountByCategory = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const code of checkedCodes) {
      const parentCode = `Z${code.replace(/^Z/i, '').slice(0, 2)}`
      counts.set(parentCode, (counts.get(parentCode) || 0) + 1)
    }
    return counts
  }, [checkedCodes])

  return (
    <div className="flex flex-col gap-4">
      <section className="atlas-surface-panel px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <small className="atlas-overline block" style={{ color: SP_COLORS.muted }}>
              z-code status override
            </small>
            <div className="mt-1 text-[24px] font-medium text-white">{enrollee.fullName}</div>
            <small className="atlas-caption mt-1 block" style={{ color: '#aab6c3' }}>
              Checked codes are the enrollee's active Z-code set. Unchecking an active code asks for a reason and is
              recorded in the uncheck log.
            </small>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {savedAtLabel ? (
              <small className="text-[12px]" style={{ color: '#9fd0ae' }}>
                saved {savedAtLabel}
              </small>
            ) : null}
            {canEdit ? (
              <AtlasTextButton
                onClick={() => void handleSave()}
                disabled={isSaving || !isDirty}
                className="px-[14px] py-[7px] text-[14px]"
                style={{ backgroundColor: '#ffffff', color: '#111111', borderColor: '#ffffff' } as React.CSSProperties}
              >
                {isSaving ? 'saving...' : 'save z-code status'}
              </AtlasTextButton>
            ) : null}
          </div>
        </div>
        {saveError ? (
          <div className="mt-3 rounded-[18px] border px-4 py-3 text-[12px]" style={{ borderColor: `${SP_COLORS.red}80`, color: SP_COLORS.red }}>
            {saveError}
          </div>
        ) : null}
      </section>

      <section className="atlas-surface-raised px-4 py-4">
        <small className="atlas-overline block" style={{ color: SP_COLORS.muted }}>
          major z-code categories
        </small>
        <div className="mt-3 flex flex-wrap gap-3">
          {catalog.map((entry) => {
            const fill = getZCodeParentColor(entry.parentCode) || SP_COLORS.yellow
            const checkedCount = checkedCountByCategory.get(entry.parentCode) || 0
            const isOpen = openCategory === entry.parentCode
            return (
              <button
                key={entry.parentCode}
                type="button"
                onClick={() => setOpenCategory((current) => (current === entry.parentCode ? null : entry.parentCode))}
                title={entry.theme}
                className="flex flex-col items-center gap-1 rounded-[16px] border px-3 py-2 transition-[border-color,box-shadow] duration-150 hover:border-white/50"
                style={{ borderColor: isOpen ? SP_COLORS.white : '#ffffff22', backgroundColor: 'var(--surface-panel-soft)' }}
              >
                <ZCodeBadge value={entry.parentCode} fill={fill} size="filter" stripLeadingZ checked={checkedCount > 0} />
                <small className="text-[11px]" style={{ color: checkedCount ? SP_COLORS.white : '#9ea8b4' }}>
                  {checkedCount} active
                </small>
              </button>
            )
          })}
        </div>
      </section>

      {activeCategory ? (
        <section className="atlas-surface-panel px-4 py-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <small className="atlas-overline block" style={{ color: SP_COLORS.muted }}>
                {activeCategory.parentCode} category
              </small>
              <div className="mt-1 text-[18px] font-medium text-white">{activeCategory.theme}</div>
            </div>
            <AtlasTextButton onClick={() => setOpenCategory(null)} className="px-[14px] py-[7px] text-[14px]">
              back to categories
            </AtlasTextButton>
          </div>
          <div className="grid gap-3">
            {activeCategory.codes.map((code) => {
              const fill = getZCodeParentColor(activeCategory.parentCode) || SP_COLORS.yellow
              const isChecked = checkedCodes.has(code.zCode)
              return (
                <button
                  key={code.zCode}
                  type="button"
                  onClick={() => toggleCode(code.zCode)}
                  disabled={!canEdit || isSaving}
                  className="flex w-full items-start gap-3 rounded-[20px] border px-3 py-3 text-left transition-[border-color,box-shadow,opacity] duration-150 hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15)] disabled:opacity-60"
                  style={{
                    borderColor: isChecked ? `${SP_COLORS.deepGreen}88` : '#ffffff22',
                    backgroundColor: isChecked ? 'rgba(111,207,151,0.08)' : 'var(--surface-panel-raised)'
                  }}
                >
                  <ZCodeBadge value={code.zCode} fill={fill} size="resolved" stripLeadingZ />
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-medium text-white">{code.zCode}</div>
                    <small className="mt-1 block text-[13px] leading-[1.45]" style={{ color: '#b5c0cb' }}>
                      {code.description || 'No description available for this Z-code.'}
                    </small>
                  </div>
                  <span
                    aria-hidden="true"
                    className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border"
                    style={{
                      borderColor: isChecked ? SP_COLORS.deepGreen : '#ffffff35',
                      color: isChecked ? SP_COLORS.deepGreen : '#ffffff55'
                    }}
                  >
                    <Check size={17} strokeWidth={2.1} />
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      {pendingUncheck ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/72 px-4 py-6 backdrop-blur-[2px]">
          <div className="atlas-surface-shell w-full max-w-[460px] px-4 py-4" style={{ borderColor: SP_COLORS.white, backgroundColor: 'var(--surface-panel-soft)' }}>
            <small className="atlas-overline block" style={{ color: '#9ea8b4' }}>
              reason for unchecking
            </small>
            <div className="mt-1 text-[20px] font-medium text-white">{pendingUncheck.zCode}</div>
            <small className="atlas-caption mt-1 block" style={{ color: '#b1bcc8' }}>
              This removal is recorded in the unchecked z-code coin log.
            </small>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-1">
                <label className="atlas-overline" style={{ color: '#9ea8b4' }} htmlFor="uncheck-reason">
                  reason
                </label>
                <select
                  id="uncheck-reason"
                  value={pendingUncheck.reasonCode}
                  onChange={(event) =>
                    setPendingUncheck((current) =>
                      current ? { ...current, reasonCode: event.target.value as ZCodeUncheckReasonCode } : current
                    )
                  }
                  className="atlas-select h-11 bg-[rgba(255,255,255,0.02)] text-[14px] text-white"
                >
                  {UNCHECK_REASON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} style={{ color: '#111111' }}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {pendingUncheck.reasonCode === 'other' ? (
                <div className="grid gap-1">
                  <label className="atlas-overline" style={{ color: '#9ea8b4' }} htmlFor="uncheck-reason-text">
                    explanation
                  </label>
                  <textarea
                    id="uncheck-reason-text"
                    value={pendingUncheck.reasonText}
                    onChange={(event) =>
                      setPendingUncheck((current) => (current ? { ...current, reasonText: event.target.value } : current))
                    }
                    rows={3}
                    placeholder="Explain why this Z-code is being unchecked."
                    className="atlas-textarea resize-none bg-[rgba(255,255,255,0.02)] text-[14px] text-white outline-none placeholder:text-[#94a0ad]"
                  />
                </div>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2">
                <AtlasTextButton onClick={() => setPendingUncheck(null)} className="px-[14px] py-[7px] text-[14px]">
                  cancel
                </AtlasTextButton>
                <AtlasTextButton
                  onClick={confirmPendingUncheck}
                  className="px-[14px] py-[7px] text-[14px]"
                  style={{ backgroundColor: '#ffffff', color: '#111111', borderColor: '#ffffff' } as React.CSSProperties}
                >
                  uncheck z-code
                </AtlasTextButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
