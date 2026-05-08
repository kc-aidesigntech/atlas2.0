import React from 'react'
import AtlasImageUploadTile from '../../components/AtlasImageUploadTile'
import { createFallbackAvatarDataUrl } from '../../components/avatarFallback'
import type { AccountSettings, PartnerStationProfile } from '../types'
import { SP_COLORS } from '../theme'

interface PartnerStationProfilePanelProps {
  accountSettings: AccountSettings
  partnerStationProfile: PartnerStationProfile | null
  partnerContactName: string
  partnerUnresolvedCodes: string[]
  partnerStationBadgeCodes: string[]
  isUploadingAvatar?: boolean
  avatarUploadError?: string | null
  onReplaceAvatar?: (file: File) => Promise<unknown> | unknown
}

export default function PartnerStationProfilePanel({
  accountSettings,
  partnerStationProfile,
  partnerContactName,
  partnerUnresolvedCodes,
  partnerStationBadgeCodes,
  isUploadingAvatar = false,
  avatarUploadError = null,
  onReplaceAvatar
}: PartnerStationProfilePanelProps) {
  const stationName = partnerStationProfile?.stationName || accountSettings.organization?.trim() || '[My Station]'
  const fallbackAvatarSrc = React.useMemo(() => createFallbackAvatarDataUrl(stationName), [stationName])
  const avatarSrc = accountSettings.avatarUrl || fallbackAvatarSrc

  return (
    <div className="min-w-0 flex-1 basis-[520px]">
      <div className="flex flex-wrap items-start gap-3 pt-0.5 sm:flex-nowrap">
        <div>
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
          <div className="mt-4 flex flex-wrap items-center gap-[10px]">
            {partnerStationBadgeCodes.map((code, index) => (
              <span
                key={`${code}-${index}`}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[28px] font-bold"
                style={{
                  backgroundColor: index % 3 === 1 ? SP_COLORS.red : index % 3 === 2 ? SP_COLORS.blue : SP_COLORS.yellow,
                  color: '#000000'
                }}
              >
                {code}
              </span>
            ))}
          </div>
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
    </div>
  )
}
