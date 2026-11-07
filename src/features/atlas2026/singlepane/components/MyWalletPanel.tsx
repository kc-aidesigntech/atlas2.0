import React from 'react'
import { createFallbackAvatarDataUrl } from '@/features/atlas2026/components/avatarFallback'
import type { AccountSettings, AtlasRole } from '@/features/atlas2026/shared/contracts'
import {
  isTierKey,
  tierHasDefaultPermission,
  type AtlasPermissionKey,
  type TierStanding
} from '@/features/atlas2026/shared/tiers'
import { useWalletOverview } from '@/features/atlas2026/singlepane/hooks/useWalletOverview'
import NavigatorMyProfilePanel, { type NavigatorMyProfilePanelProps } from './NavigatorMyProfilePanel'
import SupervisorMyProfilePanel, { type SupervisorMyProfilePanelProps } from './SupervisorMyProfilePanel'
import WalletTierHeader from './myWallet/WalletTierHeader'
import {
  CompetencyCardsSection,
  LeadsSection,
  MySupervisorSection,
  RespiteShiftsSection,
  SecondmentScheduleSection,
  SponsorshipSection
} from './myWallet/WalletOverviewSections'

export interface MyWalletPanelProps {
  viewerRole: AtlasRole
  /** `fn_my_tier` for the signed-in account; null until it answers or when no tier row exists. */
  viewerTier: TierStanding | null
  hasPermission: (key: AtlasPermissionKey) => boolean
  accountSettings: AccountSettings
  displayName: string
  isUploadingAvatar: boolean
  avatarUploadError: string | null
  onReplaceAvatar?: (file: File) => Promise<unknown> | unknown
  /** Set when the `leads` menu is on this role's row; opens that menu. */
  onOpenLeads: (() => void) | null
  /** Enrollee claim circles and the navigator supervision sections (`enrollee_profile.write`). */
  navigator: NavigatorMyProfilePanelProps
  /** Navigator claim circles and the assessment rollup (`supervision.give`). */
  supervisor: SupervisorMyProfilePanelProps
}

/**
 * One My Wallet for every tier. The header prints the tier identity, badge,
 * ribbon, and designations from `fn_my_tier`; each section below appears by
 * permission key. A section whose key the viewer holds only through the
 * administrator bypass stays hidden while it has no rows, so a Coordinator's
 * wallet does not print empty candidate sections.
 */
export default function MyWalletPanel({
  viewerRole,
  viewerTier,
  hasPermission,
  accountSettings,
  displayName,
  isUploadingAvatar,
  avatarUploadError,
  onReplaceAvatar,
  onOpenLeads,
  navigator,
  supervisor
}: MyWalletPanelProps) {
  const canReceiveSupervision = hasPermission('supervision.receive')
  const { overview, supervisor: mySupervisor, isLoading } = useWalletOverview({
    enabled: true,
    loadSupervisor: canReceiveSupervision
  })
  const fallbackAvatar = React.useMemo(() => createFallbackAvatarDataUrl(displayName), [displayName])

  // The tier row embedded in the Remote Procedure Call (RPC) answer wins; the viewer-state
  // tier fills in until it answers; the pane role stands in when the account has no tier row.
  const standing: TierStanding | null = React.useMemo(() => {
    if (overview?.tier) return overview.tier
    if (viewerTier) return viewerTier
    if (isTierKey(viewerRole)) return { tierKey: viewerRole, tierStatus: 'active', isLucidEmployee: false, designations: [] }
    return null
  }, [overview?.tier, viewerRole, viewerTier])
  const tierKey = standing?.tierKey ?? null

  // Visible when the viewer holds the key and either the tier seeds it or rows exist.
  const showsSection = React.useCallback(
    (key: AtlasPermissionKey, hasRows: boolean) =>
      hasPermission(key) && (tierHasDefaultPermission(tierKey, key) || hasRows),
    [hasPermission, tierKey]
  )

  const competencyCards = overview?.competencyCards ?? []
  const sponsorshipsReceived = overview?.sponsorshipsReceived ?? []
  const sponsorshipsGiven = overview?.sponsorshipsGiven ?? []
  const secondments = overview?.secondments ?? []
  const respiteShifts = overview?.respiteShifts ?? []
  const leadsOwnedCount = overview?.leadsOwnedCount ?? 0

  const showCompetencyCards = showsSection('competency_cards.view', competencyCards.length > 0)
  const showMySponsor = showsSection('sponsorship.receive', sponsorshipsReceived.length > 0)
  const showPeopleISponsor = showsSection('sponsorship.give', sponsorshipsGiven.length > 0)
  const showMySupervisor = showsSection('supervision.receive', mySupervisor !== null)
  const showSupervisees = hasPermission('supervision.give')
  const showEnrollees = hasPermission('enrollee_profile.write')
  const showSecondments = showsSection('secondment_schedule.view', secondments.length > 0)
  const showRespiteShifts = showsSection('respite_shifts.take', respiteShifts.length > 0)
  const showLeads = showsSection('leads.engage', leadsOwnedCount > 0)

  const metaLines: Array<{ label: string; value: React.ReactNode }> = []
  if (showEnrollees) metaLines.push({ label: 'Assigned enrollees', value: navigator.assignedEnrollees.length })
  if (showCompetencyCards) metaLines.push({ label: 'Competency cards', value: isLoading && !overview ? '…' : competencyCards.length })

  return (
    <div className="relative flex flex-col gap-4">
      <WalletTierHeader
        accountSettings={accountSettings}
        displayName={displayName}
        fallbackAvatar={fallbackAvatar}
        standing={standing}
        metaLines={metaLines}
        isUploadingAvatar={isUploadingAvatar}
        avatarUploadError={avatarUploadError}
        onReplaceAvatar={onReplaceAvatar}
      />
      {showCompetencyCards ? <CompetencyCardsSection cards={competencyCards} isLoading={isLoading} /> : null}
      {showMySponsor ? <SponsorshipSection direction="received" rows={sponsorshipsReceived} isLoading={isLoading} /> : null}
      {showPeopleISponsor ? <SponsorshipSection direction="given" rows={sponsorshipsGiven} isLoading={isLoading} /> : null}
      {showMySupervisor ? <MySupervisorSection supervisor={mySupervisor} isLoading={isLoading} /> : null}
      {showSecondments ? <SecondmentScheduleSection secondments={secondments} isLoading={isLoading} /> : null}
      {showRespiteShifts ? <RespiteShiftsSection shifts={respiteShifts} isLoading={isLoading} /> : null}
      {showLeads ? <LeadsSection count={leadsOwnedCount} isLoading={isLoading} onOpenLeads={onOpenLeads} /> : null}
      {showEnrollees ? <NavigatorMyProfilePanel {...navigator} /> : null}
      {showSupervisees ? <SupervisorMyProfilePanel {...supervisor} /> : null}
    </div>
  )
}
