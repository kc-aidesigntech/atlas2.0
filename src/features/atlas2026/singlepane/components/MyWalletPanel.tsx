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
import { buildNavigatorRoute, type NavigatorRouteStop, type NavigatorRouteTarget } from '@/features/atlas2026/singlepane/domain/navigatorRoute'
import NavigatorMyProfilePanel, { type NavigatorMyProfilePanelProps } from './NavigatorMyProfilePanel'
import NavigatorRouteBoard from './NavigatorRouteBoard'
import SupervisorMyProfilePanel, { type SupervisorMyProfilePanelProps } from './SupervisorMyProfilePanel'
import WalletLeadSection from './myWallet/WalletLeadSection'
import WalletTierHeader from './myWallet/WalletTierHeader'
import RadialLoadChart from './RadialLoadChart'
import {
  CompetencyCardsSection,
  LeadsSection,
  MySupervisorSection,
  RespiteShiftsSection,
  SecondmentScheduleSection,
  SponsorshipSection
} from './myWallet/WalletOverviewSections'
import type { NavigatorProfileOverlayKey } from './navigatorProfile/model'
import type { SupervisorProfileOverlayKey } from './supervisorProfile/SupervisorProfileOverlay'

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
 * One My Wallet for every tier. The opening band is the identity beside the
 * strain chart, then Section 1, then the three supervision cards. Each section
 * under that band appears by permission key. A section whose key the viewer
 * holds only through the administrator bypass stays hidden while it has no
 * rows, so a Coordinator's wallet does not print empty candidate sections.
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
  const [navigatorSection, setNavigatorSection] = React.useState<NavigatorProfileOverlayKey | null>(null)
  const [supervisorSection, setSupervisorSection] = React.useState<SupervisorProfileOverlayKey | null>(null)
  const [requestNonce, setRequestNonce] = React.useState(0)
  const [navigatorClaims, setNavigatorClaims] = React.useState({ total: 0, mine: 0 })

  // The same fn_my_tier row the role view uses. The pane role fills in until that call answers.
  const standing: TierStanding | null = React.useMemo(() => {
    if (viewerTier) return viewerTier
    if (isTierKey(viewerRole)) return { tierKey: viewerRole, tierStatus: 'active', isLucidEmployee: false, designations: [] }
    return null
  }, [viewerRole, viewerTier])
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

  const routeStops = React.useMemo(
    () =>
      buildNavigatorRoute({
        canWorkEnrollees: showEnrollees,
        canReceiveSupervision,
        canSupervise: showSupervisees,
        assignedEnrolleeCount: navigator.assignedEnrollees.length,
        ipsccEncounterSubmittedAtIsos: navigator.ipsccEncounterSubmittedAtIsos ?? [],
        regulationReviews: navigator.regulationReviewDueItems ?? [],
        ipsSelfAssessments: navigator.ipsSelfAssessments,
        createSessions: navigator.createSessions,
        claimedNavigatorCount: navigatorClaims.mine,
        availableNavigatorCount: navigatorClaims.total,
        supervisorAssessments: supervisor.allSupervisorIpsAssessments,
        supervisorName: supervisor.currentSupervisorName
      }),
    [canReceiveSupervision, navigator, navigatorClaims.mine, navigatorClaims.total, showEnrollees, showSupervisees, supervisor]
  )

  function openRouteStop(stop: NavigatorRouteStop) {
    const target: NavigatorRouteTarget = stop.target
    switch (target.kind) {
      case 'enrollee-claims':
        document.getElementById('wallet-enrollee-claims')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      case 'navigator-claims':
        document.getElementById('wallet-navigator-claims')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      case 'point-of-care':
        setNavigatorSection('section_1_ipscc')
        setRequestNonce((current) => current + 1)
        return
      case 'self-assessment':
        setNavigatorSection('section_2_awareness')
        setRequestNonce((current) => current + 1)
        return
      case 'create-session':
        setNavigatorSection('section_3_create')
        setRequestNonce((current) => current + 1)
        return
      case 'regulation-review':
        if (target.enrolleeId) navigator.onOpenRegulationReview?.(target.enrolleeId, target.missingInstruments)
        return
      case 'supervisor-weekly':
        setSupervisorSection('section_1_weekly_ips')
        setRequestNonce((current) => current + 1)
        return
      case 'supervisor-create':
        setSupervisorSection('section_4_create_reflections')
        setRequestNonce((current) => current + 1)
        return
      default: {
        const exhaustive: never = target
        return exhaustive
      }
    }
  }

  return (
    <div className="relative flex flex-col gap-4">
      <div className="border-b pb-4" style={{ borderColor: '#ffffff55', borderBottomWidth: '2px' }}>
        <div className="atlas-navigator-profile-layout">
          <div className="atlas-navigator-profile-main">
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
          </div>
          <div className="atlas-navigator-profile-rail items-center justify-center">
            <RadialLoadChart load={navigator.aggregateLoad} onClick={navigator.onOpenLoadTable} />
          </div>
        </div>
      </div>
      {showEnrollees ? <NavigatorMyProfilePanel {...navigator} /> : null}
      {showSupervisees ? (
        <SupervisorMyProfilePanel
          {...supervisor}
          placement="claims"
          onClaimSummary={setNavigatorClaims}
        />
      ) : null}
      <NavigatorRouteBoard stops={routeStops} onOpenStop={openRouteStop} />
      <WalletLeadSection
        identity={null}
        navigator={navigator}
        requestedSection={navigatorSection}
        requestNonce={requestNonce}
      />
      {showCompetencyCards ? <CompetencyCardsSection cards={competencyCards} isLoading={isLoading} /> : null}
      {showMySponsor ? <SponsorshipSection direction="received" rows={sponsorshipsReceived} isLoading={isLoading} /> : null}
      {showPeopleISponsor ? <SponsorshipSection direction="given" rows={sponsorshipsGiven} isLoading={isLoading} /> : null}
      {showMySupervisor ? <MySupervisorSection supervisor={mySupervisor} isLoading={isLoading} /> : null}
      {showSecondments ? <SecondmentScheduleSection secondments={secondments} isLoading={isLoading} /> : null}
      {showRespiteShifts ? <RespiteShiftsSection shifts={respiteShifts} isLoading={isLoading} /> : null}
      {showLeads ? <LeadsSection count={leadsOwnedCount} isLoading={isLoading} onOpenLeads={onOpenLeads} /> : null}
      {showSupervisees ? (
        <SupervisorMyProfilePanel
          {...supervisor}
          placement="tools"
          requestedOverlay={supervisorSection}
          requestNonce={requestNonce}
        />
      ) : null}
    </div>
  )
}
