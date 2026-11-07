import React from 'react'
import { AtlasStatusPill, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { PersonTierRecord, TierDesignation, TierKey } from '@/features/atlas2026/shared/contracts'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import {
  TIER_DESIGNATIONS,
  canHoldDesignation,
  designationLabel,
  listTierDefinitions,
  tierDisplayLabel
} from '@/features/atlas2026/shared/tiers'
import { isUuidPersonId } from '@/features/atlas2026/singlepane/data-access/warmlineAccess'

export interface TierStandingEditorProps {
  personId: string
  /** The person's `atlas.people_tiers` row joined with designations; null when none exists. */
  record: PersonTierRecord | null
  disabled?: boolean
  /** `fn_set_person_tier`. */
  onSetTier: (personId: string, tierKey: TierKey) => Promise<unknown> | unknown
  /** `fn_mark_tier_alum`. */
  onMarkAlum: (personId: string) => Promise<unknown> | unknown
  /** `people_tiers.is_lucid_employee`. */
  onSetLucidEmployee: (personId: string, isLucidEmployee: boolean) => Promise<unknown> | unknown
  /** `fn_grant_designation` when granted is true, `fn_revoke_designation` otherwise. */
  onSetDesignation: (personId: string, designation: TierDesignation, granted: boolean) => Promise<unknown> | unknown
}

/**
 * One person's tier standing: the tier picker, the active or alum status, the
 * Lucid employee flag, and the designation chips (t2b and higher). Rendered on
 * the Admin Directory editor and on the person-to-tier matrix. Every change
 * calls the handler at once; the parent reloads the dataset after the write.
 * Seed-only directory rows (no database person id) render as read-only.
 */
export default function TierStandingEditor({
  personId,
  record,
  disabled = false,
  onSetTier,
  onMarkAlum,
  onSetLucidEmployee,
  onSetDesignation
}: TierStandingEditorProps) {
  const [busyKey, setBusyKey] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const isPersistedPerson = isUuidPersonId(personId)
  const tierKey = record?.tierKey || null
  const tierStatus = record?.tierStatus || 'active'
  const isAlum = Boolean(record) && tierStatus === 'alum'
  const isLocked = disabled || !isPersistedPerson || Boolean(busyKey)
  // Designations need an active tier of t2b or higher, the same rule `fn_grant_designation` enforces.
  const designationsAvailable = Boolean(record) && !isAlum && canHoldDesignation(tierKey)

  async function run(key: string, write: () => Promise<unknown> | unknown) {
    setBusyKey(key)
    setError(null)
    try {
      await write()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update tier standing.')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={tierKey || ''}
          onChange={(event) => {
            const next = event.target.value as TierKey | ''
            if (!next) return
            void run('tier', () => onSetTier(personId, next))
          }}
          disabled={isLocked}
          className="atlas-admin-input min-w-[220px]"
          aria-label="Tier"
        >
          <option value="">no tier</option>
          {listTierDefinitions().map((definition) => (
            <option key={definition.key} value={definition.key}>
              {definition.identity}
            </option>
          ))}
        </select>
        {record ? (
          <AtlasStatusPill color={isAlum ? SP_COLORS.yellow : SP_COLORS.deepGreen}>
            {isAlum ? tierDisplayLabel(tierKey, 'alum') : 'active'}
          </AtlasStatusPill>
        ) : (
          <AtlasStatusPill color="#ffffff70">no tier row</AtlasStatusPill>
        )}
        {record && !isAlum ? (
          <AtlasTextButton
            onClick={() => void run('alum', () => onMarkAlum(personId))}
            disabled={isLocked}
            className="px-3 py-[6px] text-[13px] font-medium"
            style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
          >
            {busyKey === 'alum' ? 'saving…' : 'mark alum'}
          </AtlasTextButton>
        ) : null}
      </div>
      {record ? (
        <label className="flex items-center gap-3 text-[13px] text-white">
          <input
            type="checkbox"
            checked={record.isLucidEmployee}
            onChange={(event) => void run('employee', () => onSetLucidEmployee(personId, event.target.checked))}
            disabled={isLocked}
            className="h-5 w-5 accent-white"
          />
          <span>Lucid employee</span>
          <small className="text-[12px] text-[var(--foreground-secondary)]">A T1 employee earns the ribbon.</small>
        </label>
      ) : null}
      <div>
        <small className="mb-2 block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">designations</small>
        <div className="flex flex-wrap gap-2">
          {TIER_DESIGNATIONS.map((designation) => {
            const granted = Boolean(record?.designations.includes(designation))
            const chipDisabled = isLocked || (!granted && !designationsAvailable)
            return (
              <AtlasTextButton
                key={designation}
                onClick={() => void run(`designation:${designation}`, () => onSetDesignation(personId, designation, !granted))}
                disabled={chipDisabled}
                aria-pressed={granted}
                className="px-[14px] py-[7px] text-[13px] font-medium"
                style={
                  {
                    ['--button-border-color' as const]: granted ? SP_COLORS.yellow : '#ffffff25',
                    color: granted ? SP_COLORS.yellow : SP_COLORS.white,
                    backgroundColor: granted ? 'rgba(252,192,26,0.08)' : 'transparent'
                  } as React.CSSProperties
                }
              >
                {busyKey === `designation:${designation}` ? 'saving…' : designationLabel(designation)}
              </AtlasTextButton>
            )
          })}
        </div>
        <small className="mt-2 block text-[12px] text-[var(--foreground-secondary)]">
          {!isPersistedPerson
            ? 'Tier standing is stored once this person exists in the database directory.'
            : designationsAvailable
              ? 'Designations are held alongside the tier.'
              : 'Designations require an active tier of T2B or higher.'}
        </small>
      </div>
      {error ? <small className="block text-[12px] text-[#ffb4b4]">{error}</small> : null}
    </div>
  )
}
