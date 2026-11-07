import React from 'react'
import type { AtlasPermissionKey } from '@/features/atlas2026/shared/tiers'
import CohortsPanel from '@/features/atlas2026/singlepane/components/tierFeaturePanels/CohortsPanel'
import CompetencyCardsPanel from '@/features/atlas2026/singlepane/components/tierFeaturePanels/CompetencyCardsPanel'
import LeadsPanel from '@/features/atlas2026/singlepane/components/tierFeaturePanels/LeadsPanel'
import PartnersPanel from '@/features/atlas2026/singlepane/components/tierFeaturePanels/PartnersPanel'
import RespiteShiftsPanel from '@/features/atlas2026/singlepane/components/tierFeaturePanels/RespiteShiftsPanel'
import SecondmentSchedulePanel from '@/features/atlas2026/singlepane/components/tierFeaturePanels/SecondmentSchedulePanel'
import SponsorshipsPanel from '@/features/atlas2026/singlepane/components/tierFeaturePanels/SponsorshipsPanel'
import {
  TIER_FEATURE_SCREEN_IDS,
  isTierFeatureScreenId,
  type TierFeatureScreenId
} from '@/features/atlas2026/singlepane/components/tierFeaturePanels/tierFeatureScreenIds'

export { TIER_FEATURE_SCREEN_IDS, isTierFeatureScreenId }
export type { TierFeatureScreenId }

interface TierFeatureScreenProps {
  screenId: TierFeatureScreenId
  hasPermission: (key: AtlasPermissionKey) => boolean
  /** Opens the admin screen; the partners panel uses it to reach the Organizations section. */
  onOpenAdminScreen?: () => void
}

/**
 * Picks the panel for a tier feature screen. Each panel receives the
 * permission booleans it gates on; `hasPermission` already passes every key
 * for a system administrator.
 */
export default function TierFeatureScreen({ screenId, hasPermission, onOpenAdminScreen }: TierFeatureScreenProps) {
  switch (screenId) {
    case 'leads':
      return <LeadsPanel canEngageLeads={hasPermission('leads.engage')} />
    case 'respite shifts':
      return <RespiteShiftsPanel canTakeShifts={hasPermission('respite_shifts.take')} />
    case 'secondment schedule':
      return <SecondmentSchedulePanel canViewSchedule={hasPermission('secondment_schedule.view')} />
    case 'partners':
      return (
        <PartnersPanel
          canWritePartnerProfile={hasPermission('partner_profile.write')}
          canWritePartnerMilestones={hasPermission('partner_milestones.write')}
          onOpenAdminOrganizations={onOpenAdminScreen}
        />
      )
    case 'cohorts':
      return <CohortsPanel canManageCohorts={hasPermission('supervision.give')} />
    case 'sponsorships':
      return (
        <SponsorshipsPanel
          canGiveSponsorship={hasPermission('sponsorship.give')}
          canReceiveSponsorship={hasPermission('sponsorship.receive')}
        />
      )
    case 'competency cards':
      return <CompetencyCardsPanel canIssueCards={hasPermission('supervision.give')} />
    default: {
      const exhaustive: never = screenId
      return exhaustive
    }
  }
}
