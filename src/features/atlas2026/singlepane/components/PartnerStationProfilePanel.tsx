import React from 'react'
import { getZCodeParentColor, usesLightTextOnZCodeColor } from '@atlas/shared'
import AtlasImageUploadTile from '../../components/AtlasImageUploadTile'
import { createFallbackAvatarDataUrl } from '../../components/avatarFallback'
import type { AccountSettings, PartnerStationProfile, PartnerStationSpecialtyGroup } from '../types'
import { SP_COLORS } from '../theme'

interface PartnerStationProfilePanelProps {
  accountSettings: AccountSettings
  partnerStationProfile: PartnerStationProfile | null
  partnerContactName: string
  partnerUnresolvedCodes: string[]
  specialtyGroups: PartnerStationSpecialtyGroup[]
  onSelectSpecialty?: (group: PartnerStationSpecialtyGroup) => void
  isUploadingAvatar?: boolean
  avatarUploadError?: string | null
  onReplaceAvatar?: (file: File) => Promise<unknown> | unknown
}

export default function PartnerStationProfilePanel({
  accountSettings,
  partnerStationProfile,
  partnerContactName,
  partnerUnresolvedCodes,
  specialtyGroups,
  onSelectSpecialty,
  isUploadingAvatar = false,
  avatarUploadError = null,
  onReplaceAvatar
}: PartnerStationProfilePanelProps) {
  const stationName = partnerStationProfile?.stationName || accountSettings.organization?.trim() || '[My Station]'
  const fallbackAvatarSrc = React.useMemo(() => createFallbackAvatarDataUrl(stationName), [stationName])
  const avatarSrc = accountSettings.avatarUrl || fallbackAvatarSrc

  return (
    <div className="min-w-0 flex-1 basis-[520px]">
      <div className="flex flex-col gap-4 pt-0.5">
        <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
          <div className="shrink-0">
          <AtlasImageUploadTile
            imageSrc={avatarSrc}
            alt={`${stationName} profile`}
            onSelectFile={onReplaceAvatar}
            disabled={!onReplaceAvatar}
            buttonTitle={onReplaceAvatar ? 'Replace station image' : 'Station image upload unavailable'}
            ctaLabel="replace image"
            statusText={isUploadingAvatar ? 'uploading image...' : null}
            errorText={avatarUploadError}
            onImageError={(event) => {
              if (event.currentTarget.src !== fallbackAvatarSrc) {
                event.currentTarget.src = fallbackAvatarSrc
              }
            }}
          />
          </div>
          <div className="min-w-[220px] flex-1 space-y-0.5 pt-[2px] text-white" style={{ textTransform: 'none' }}>
            <h2 className="atlas-h3 text-[34px] font-medium leading-[1.1]" style={{ textTransform: 'none' }}>
              {stationName}
            </h2>
            <small className="atlas-meta block text-white">Org: {partnerStationProfile?.organizationName || accountSettings.organization || 'not configured'}</small>
            <small className="atlas-meta block text-white">County: {partnerStationProfile?.countyName || 'not configured'}</small>
            <small className="atlas-meta block text-white" style={{ textTransform: 'none' }}>
              Contact: {partnerContactName}
            </small>
            <small className="atlas-meta block text-white" style={{ textTransform: 'none' }}>
              E: {partnerStationProfile?.primaryContactEmail || accountSettings.email || 'not configured'}
            </small>
            <small className="atlas-meta block text-white">
              unresolved categories: {partnerUnresolvedCodes.length ? partnerUnresolvedCodes.join(', ') : 'none'}
            </small>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-[10px]">
          {specialtyGroups.map((group) => {
            const accentColor = getZCodeParentColor(group.parentCode) || SP_COLORS.yellow
            const useLightText = usesLightTextOnZCodeColor(accentColor)
            return (
              <button
                key={group.parentCode}
                type="button"
                onClick={() => onSelectSpecialty?.(group)}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[28px] font-bold transition-transform duration-150 hover:scale-[1.04]"
                style={{
                  backgroundColor: accentColor,
                  color: useLightText ? SP_COLORS.white : SP_COLORS.bg
                }}
                title={`View associated ${group.parentCode} specialty Z-codes`}
              >
                {group.parentCode.replace(/^Z/i, '')}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
