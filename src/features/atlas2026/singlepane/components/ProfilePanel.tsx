/**
 * Enrollee profile header panel with avatar handling and parent Z-code badges
 * that drive drill-in selection for resolution workflows.
 */
import React from 'react'
import AtlasImageUploadTile from '../../components/AtlasImageUploadTile'
import { createFallbackAvatarDataUrl } from '../../components/avatarFallback'
import { getZCodeParentColor, usesLightTextOnZCodeColor } from '@atlas/shared'
import type { EnrolleeProfile } from '../types'
import { SP_COLORS } from '../theme'

const elenaRodriguezPortraitUrl = new URL('../../../../../assets/portraits/elena-rodriguez.jpeg', import.meta.url).href

interface ProfilePanelProps {
  enrollee: EnrolleeProfile
  isUploadingAvatar?: boolean
  avatarUploadError?: string | null
  onReplaceAvatar?: (file: File) => Promise<unknown> | unknown
  onSelectZCode?: (selection: { parentCode: string; childCodes: string[] }) => void
  enrollmentStartLabel?: string
}

interface ParentZCodeGroup {
  parentCode: string
  childCodes: string[]
}

/**
 * Parent-code normalization keeps completion tracking stable even when API and
 * UI surfaces send mixed-case values (`z12` vs `Z12`).
 */
function normalizeParentCode(value: string) {
  const normalized = getParentZCode(value) || value.trim().toLowerCase()
  return normalized.replace(/^z/i, 'Z')
}

function normalizeZCode(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.toLowerCase().startsWith('z') ? trimmed.toLowerCase() : `z${trimmed.toLowerCase()}`
}

function getParentZCode(value: string) {
  const normalized = normalizeZCode(value)
  if (!normalized) return null
  const group = normalized.match(/^z(\d{2})/)
  if (!group) return null
  return `z${group[1]}`
}

/**
 * The profile header shows one badge per parent Z-code while preserving all
 * concrete child codes for drill-in callbacks.
 */
function buildParentZCodeGroups(tags: string[]): ParentZCodeGroup[] {
  const grouped = new Map<string, string[]>()
  for (const tag of tags) {
    const normalized = normalizeZCode(tag)
    const parentCode = getParentZCode(tag)
    if (!normalized || !parentCode) continue
    if (!grouped.has(parentCode)) {
      grouped.set(parentCode, [normalized])
      continue
    }
    const existing = grouped.get(parentCode)!
    if (!existing.includes(normalized)) {
      existing.push(normalized)
    }
  }
  return Array.from(grouped.entries()).map(([parentCode, childCodes]) => ({ parentCode, childCodes }))
}

export default function ProfilePanel({
  enrollee,
  isUploadingAvatar = false,
  avatarUploadError = null,
  onReplaceAvatar,
  onSelectZCode,
  enrollmentStartLabel
}: ProfilePanelProps) {
  const fallbackAvatarSrc = React.useMemo(() => createFallbackAvatarDataUrl(enrollee.fullName), [enrollee.fullName])
  // Preserve legacy demo portrait behavior while still supporting
  // the standard uploader + fallback path for all other enrollees.
  const isElenaRodriguez = enrollee.fullName.trim().toLowerCase() === 'elena rodriguez'
  const avatarSrc = enrollee.avatarUrl || (isElenaRodriguez ? elenaRodriguezPortraitUrl : fallbackAvatarSrc)
  // Prefer structured active details when present; fallback tags keep older
  // profile payloads usable without changing rendering behavior.
  const activeZCodeTags = React.useMemo(
    () => (enrollee.activeZCodeDetails.length ? enrollee.activeZCodeDetails.map((detail) => detail.zCode) : enrollee.zCodeTags),
    [enrollee.activeZCodeDetails, enrollee.zCodeTags]
  )
  const parentGroups = React.useMemo(() => buildParentZCodeGroups(activeZCodeTags), [activeZCodeTags])
  const completedParentCodes = React.useMemo(
    () => new Set(enrollee.completedParentCodes.map((code) => normalizeParentCode(code))),
    [enrollee.completedParentCodes]
  )

  return (
    <div className="flex flex-wrap items-start gap-3 pt-0.5 sm:flex-nowrap">
      <div>
        <AtlasImageUploadTile
          imageSrc={avatarSrc}
          alt={`${enrollee.fullName} profile`}
          onSelectFile={onReplaceAvatar}
          disabled={!onReplaceAvatar}
          buttonTitle={onReplaceAvatar ? 'Replace profile image' : 'Profile image upload unavailable'}
          statusText={isUploadingAvatar ? 'uploading image...' : null}
          errorText={avatarUploadError}
          onImageError={(event) => {
            // This handler guarantees we always land on a resolvable source so
            // broken avatar URLs never leave an empty image frame in the panel.
            if (isElenaRodriguez && event.currentTarget.src !== elenaRodriguezPortraitUrl) {
              event.currentTarget.src = elenaRodriguezPortraitUrl
              return
            }
            if (event.currentTarget.src !== fallbackAvatarSrc) {
              event.currentTarget.src = fallbackAvatarSrc
            }
          }}
        />
        <div className="mt-4 flex flex-wrap items-center gap-[10px]">
          {parentGroups.map((group, index) => {
            const bgColor = getZCodeParentColor(group.parentCode) || [SP_COLORS.yellow, SP_COLORS.red, SP_COLORS.blue][index % 3]
            const useLightText = usesLightTextOnZCodeColor(bgColor)
            const isCompleted = completedParentCodes.has(normalizeParentCode(group.parentCode))
            return (
              <button
                key={group.parentCode}
                type="button"
                className={`relative inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[30px] font-bold ${
                  useLightText ? 'text-white' : 'text-black'
                }`}
                style={{ backgroundColor: bgColor }}
                onClick={() =>
                  onSelectZCode?.({
                    parentCode: group.parentCode,
                    childCodes: group.childCodes
                  })
                }
              >
                {isCompleted ? (
                  <span
                    className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold"
                    style={{ borderColor: SP_COLORS.white, backgroundColor: SP_COLORS.deepGreen, color: SP_COLORS.white }}
                  >
                    ✓
                  </span>
                ) : null}
                {group.parentCode.replace(/^z/i, '')}
              </button>
            )
          })}
        </div>
      </div>
      <div className="min-w-[220px] flex-1 space-y-0.5 pt-[2px] text-white" style={{ textTransform: 'none' }}>
        <h2 className="text-[34px] font-medium leading-[1.1]" style={{ textTransform: 'none' }}>
          {enrollee.fullName}
        </h2>
        <small className="block text-[13px] text-white">DOB: {enrollee.dob || 'not recorded'}</small>
        <small className="block text-[13px] text-white">C: {enrollee.caseId}</small>
        <small className="block text-[13px] text-white" style={{ textTransform: 'none' }}>
          E: {enrollee.email}
        </small>
        <small className="block text-[13px] text-white" style={{ textTransform: 'none' }}>
          N: {enrollee.assignedNavigator || 'unassigned'}
        </small>
        <small className="block text-[13px] text-white">Enrollment start: {enrollmentStartLabel || 'not recorded'}</small>
      </div>
    </div>
  )
}
