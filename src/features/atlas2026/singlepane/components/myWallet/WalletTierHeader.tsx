import React from 'react'
import { AtlasStatusPill } from '@/features/atlas2026/components/AtlasPrimitives'
import AtlasImageUploadTile from '@/features/atlas2026/components/AtlasImageUploadTile'
import ZCodeBadge from '@/features/atlas2026/components/ZCodeBadge'
import type { AccountSettings } from '@/features/atlas2026/shared/contracts'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import {
  designationLabel,
  earnsBadge,
  earnsRibbon,
  tierDefinition,
  tierDisplayLabel,
  type TierStanding,
  type TierStatus
} from '@/features/atlas2026/shared/tiers'

interface WalletTierHeaderProps {
  accountSettings: AccountSettings
  displayName: string
  fallbackAvatar: string
  /** The viewer's tier row; null while `fn_my_tier` has not answered or the account holds no tier. */
  standing: TierStanding | null
  /** Extra `label: value` lines printed under the identity block. */
  metaLines: Array<{ label: string; value: React.ReactNode }>
  isUploadingAvatar: boolean
  avatarUploadError: string | null
  onReplaceAvatar?: (file: File) => Promise<unknown> | unknown
}

/** Pill color for the standing: green while active, yellow once alum. */
function standingPillColor(status: TierStatus): string {
  switch (status) {
    case 'active':
      return SP_COLORS.deepGreen
    case 'alum':
      return SP_COLORS.yellow
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

/**
 * The identity band at the top of My Wallet: avatar, name, tier identity,
 * badge and ribbon per `earnsBadge` / `earnsRibbon`, alum state, designation
 * chips, and the account lines. The badge reuses `ZCodeBadge`; every pill is
 * `AtlasStatusPill`.
 */
export default function WalletTierHeader({
  accountSettings,
  displayName,
  fallbackAvatar,
  standing,
  metaLines,
  isUploadingAvatar,
  avatarUploadError,
  onReplaceAvatar
}: WalletTierHeaderProps) {
  const definition = standing ? tierDefinition(standing.tierKey) : null
  const tierLine = standing && definition ? tierDisplayLabel(standing.tierKey, standing.tierStatus) : 'no tier on record'
  const showBadge = Boolean(standing && earnsBadge(standing))
  const showRibbon = Boolean(standing && earnsRibbon(standing))

  return (
    <div className="atlas-surface-panel relative flex w-full flex-col px-5 py-4">
      <div className="flex flex-wrap items-start gap-3 pt-0.5 sm:flex-nowrap">
        <AtlasImageUploadTile
          imageSrc={accountSettings.avatarUrl || fallbackAvatar}
          alt={`${displayName} profile`}
          onSelectFile={onReplaceAvatar}
          disabled={!onReplaceAvatar}
          buttonTitle={onReplaceAvatar ? 'Replace profile image' : 'Profile image upload unavailable'}
          statusText={isUploadingAvatar ? 'uploading image...' : null}
          errorText={avatarUploadError}
          onImageError={(event) => {
            if (event.currentTarget.src !== fallbackAvatar) event.currentTarget.src = fallbackAvatar
          }}
        />
        <div className="min-w-[220px] flex-1 space-y-0.5 pt-[2px] text-white" style={{ textTransform: 'none' }}>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="atlas-h3 text-[34px] font-medium leading-[1.1]" style={{ textTransform: 'none' }}>
              {displayName}
            </h2>
            {showBadge && definition ? (
              <ZCodeBadge value={definition.code} fill={SP_COLORS.deepGreen} size="compact" />
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <small className="atlas-meta block text-white">Tier: {tierLine}</small>
            {standing ? (
              <AtlasStatusPill color={standingPillColor(standing.tierStatus)}>{standing.tierStatus}</AtlasStatusPill>
            ) : null}
            {showRibbon ? <AtlasStatusPill color={SP_COLORS.yellow}>ribbon</AtlasStatusPill> : null}
            {standing?.isLucidEmployee ? <AtlasStatusPill color="#ffffff90">Lucid employee</AtlasStatusPill> : null}
          </div>
          {standing?.designations.length ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {standing.designations.map((designation) => (
                <AtlasStatusPill key={designation} color={SP_COLORS.yellow}>
                  {designationLabel(designation)}
                </AtlasStatusPill>
              ))}
            </div>
          ) : null}
          {definition ? <small className="atlas-meta block text-white">{definition.purpose}</small> : null}
          <small className="atlas-meta block text-white">Org: {accountSettings.organization || 'not recorded'}</small>
          <small className="atlas-meta block text-white" style={{ textTransform: 'none' }}>
            E: {accountSettings.email || 'not recorded'}
          </small>
          {metaLines.map((line) => (
            <small key={line.label} className="atlas-meta block text-white">
              {line.label}: {line.value}
            </small>
          ))}
        </div>
      </div>
    </div>
  )
}
