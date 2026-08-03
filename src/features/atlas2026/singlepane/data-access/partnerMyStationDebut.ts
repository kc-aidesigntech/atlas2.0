/**
 * Partner My Station debut commissioning rules.
 *
 * My Station stays hidden until the partner completes service-capacity commissioning
 * with enough capacity entries and clear specialization signal. This keeps first-launch
 * partners on referral portal + service capacity until the station return signal is real.
 */
import type {
  PartnerServiceCapacitySubmissionRecord,
  PartnerStationProfile,
  PartnerStationSpecialtyGroup,
  RoleMenuConfig
} from '@/features/atlas2026/shared/contracts'
import { SERVICE_CAPACITY_FORM_VERSION } from '@/features/atlas2026/singlepane/data/serviceCapacitySurveyCatalog'
import {
  derivePartnerStationSpecialtyGroups,
  selectCompletedPartnerSurveysNewestFirst
} from '@/features/atlas2026/singlepane/data-access/domainLoadMapping'

export type PartnerMyStationDebutRequirementKey =
  | 'stationProfileInitiated'
  | 'capacityEntriesComplete'
  | 'specializationClarity'

export interface PartnerMyStationDebutRequirement {
  key: PartnerMyStationDebutRequirementKey
  label: string
  detail: string
  met: boolean
}

export interface PartnerMyStationDebutEvaluation {
  canDebut: boolean
  requirements: PartnerMyStationDebutRequirement[]
  latestCompletedBurdenSurvey: PartnerServiceCapacitySubmissionRecord | null
  specialtyGroups: PartnerStationSpecialtyGroup[]
  capacityEntryCount: number
}

const LOCAL_FALLBACK_PARTNER_ID = 'local-partner-profile'

function countScoredCapacityEntries(submission: PartnerServiceCapacitySubmissionRecord | null) {
  if (!submission) return 0
  return submission.answers.filter(
    (answer) => !answer.notEncountered && typeof answer.score === 'number' && Number.isFinite(answer.score)
  ).length
}

/**
 * Station profile is "initiated" when organization identity is present.
 * Local fallback partner ids remain valid for offline/demo shells so commissioning
 * can still unlock after a completed capacity survey.
 */
export function isPartnerStationProfileInitiated(profile: PartnerStationProfile | null | undefined) {
  const organizationName = profile?.organizationName?.trim() || ''
  if (!organizationName) return false
  const partnerId = profile?.partnerId?.trim() || ''
  if (!partnerId) return false
  // A local fallback profile counts as initiated once organization is set; directory-backed
  // profiles are preferred in commissioned environments but are not required for the gate.
  return partnerId === LOCAL_FALLBACK_PARTNER_ID || Boolean(organizationName)
}

export function evaluatePartnerMyStationDebut(input: {
  stationProfile: PartnerStationProfile | null | undefined
  surveyHistory: PartnerServiceCapacitySubmissionRecord[]
}): PartnerMyStationDebutEvaluation {
  const completedNewestFirst = selectCompletedPartnerSurveysNewestFirst(input.surveyHistory)
  // Debut commissioning is driven by the classic burden/service-capacity form. Domain-spectrum
  // submissions shape radial placement but do not mint specialty coins for My Station.
  const latestCompletedBurdenSurvey =
    completedNewestFirst.find((record) => record.formVersion.trim() === SERVICE_CAPACITY_FORM_VERSION) || null
  const specialtyGroups = derivePartnerStationSpecialtyGroups(latestCompletedBurdenSurvey)
  const capacityEntryCount = countScoredCapacityEntries(latestCompletedBurdenSurvey)
  const stationProfileInitiated = isPartnerStationProfileInitiated(input.stationProfile)
  const capacityEntriesComplete = capacityEntryCount > 0
  const specializationClarity = specialtyGroups.length > 0

  const requirements: PartnerMyStationDebutRequirement[] = [
    {
      key: 'stationProfileInitiated',
      label: 'Station profile initiated',
      detail: 'Organization identity is present so My Station can bind to a real partner site.',
      met: stationProfileInitiated
    },
    {
      key: 'capacityEntriesComplete',
      label: 'Service-capacity entries complete',
      detail: 'At least one completed service-capacity survey includes scored Z-code capacity answers.',
      met: capacityEntriesComplete
    },
    {
      key: 'specializationClarity',
      label: 'Specialization clarity',
      detail: 'At least one parent-code specialty (burden score above 6) is present for station coins.',
      met: specializationClarity
    }
  ]

  return {
    canDebut: requirements.every((requirement) => requirement.met),
    requirements,
    latestCompletedBurdenSurvey,
    specialtyGroups,
    capacityEntryCount
  }
}

/** Remove My Station from partner top menus until commissioning requirements are met. */
export function applyPartnerMyStationDebutMenuGate(
  roleConfig: RoleMenuConfig,
  canDebut: boolean
): RoleMenuConfig {
  if (canDebut) return roleConfig
  return {
    ...roleConfig,
    topMenus: roleConfig.topMenus.filter((menu) => menu.trim().toLowerCase() !== 'my station')
  }
}
