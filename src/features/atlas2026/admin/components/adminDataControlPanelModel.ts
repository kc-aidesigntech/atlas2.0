import { DEFAULT_SERVICE_CAPACITY_SECTIONS } from '@/features/atlas2026/singlepane/data/serviceCapacitySurveyCatalog'
import type {
  AccessMatrixDataset,
  AdminDataQualityMetric,
  AdminDeletableServiceCapacitySubmissionRecord,
  AdminPortalCustomEnrolleeRecord,
  AdminPortalOrganizationRecord,
  AdminPortalOrganizationType,
  AdminPortalPersonRecord,
  AdminPortalPersonRole,
  AdminPortalRegistry,
  AtlasRole,
  EnrolleeIntakeRecord,
  EnrolleeProfile,
  EnrolleeZCodeOverrideResult,
  EnrollmentRequestRecord,
  IntervalAssessmentDueItem,
  IntervalAssessmentRule,
  NavigatorProgramState,
  RegulationReviewDueItem,
  RegulationReviewSettings,
  SupervisorNavigatorCompetencySummary,
  ZCodeDomainSurveyHistorySummary,
  ZCodeSurveyPrompt
} from '@/features/atlas2026/shared/contracts'

export type AdminPortalSection =
  | 'overview'
  | 'enrollees'
  | 'directory'
  | 'organizations'
  | 'relationships'
  | 'assessments'
  | 'permissions'

export interface AdminDataControlPanelProps {
  metrics: AdminDataQualityMetric[]
  zCodeDomainSurveyHistorySummary: ZCodeDomainSurveyHistorySummary[]
  deletableServiceCapacitySubmissions: AdminDeletableServiceCapacitySubmissionRecord[]
  isLoadingDeletableServiceCapacitySubmissions: boolean
  deletingServiceCapacitySubmissionId: string | null
  serviceCapacityDeletionError: string | null
  isLoadingZCodeDomainSurveyHistorySummary: boolean
  isSavingZCodeDomainSurveyNullification: boolean
  zCodeDomainSurveyHistoryError: string | null
  enrollees: EnrolleeProfile[]
  intakeFormsByEnrolleeId: Record<string, EnrolleeIntakeRecord>
  selectedEnrollee: EnrolleeProfile | null
  accountSettings: { fullName: string; email: string; organization: string }
  enrollmentRequests: EnrollmentRequestRecord[]
  supervisorNavigatorCompetency: SupervisorNavigatorCompetencySummary[]
  navigatorProgramState: NavigatorProgramState
  navigatorIntervalDueItems: IntervalAssessmentDueItem[]
  regulationReviewSettings: RegulationReviewSettings
  regulationReviewDueItems: RegulationReviewDueItem[]
  regulationReviewError: string | null
  onSaveRegulationReviewSettings: (settings: RegulationReviewSettings) => Promise<unknown> | unknown
  accessMatrixDataset: AccessMatrixDataset | null
  registry: AdminPortalRegistry | null
  isSavingRegistry: boolean
  registryError: string | null
  onSaveRegistry: (registry: AdminPortalRegistry) => Promise<AdminPortalRegistry>
  onSetZCodeDomainSurveyAnswerNullification: (input: {
    answerId: string
    isNullified: boolean
    nullifiedReason?: string | null
  }) => Promise<unknown> | unknown
  onDeleteServiceCapacitySubmission: (input: {
    submissionId: string
    reasonCode: 'obsolete' | 'not_relevant' | 'mistakenly_entered' | 'contained_errors' | 'other'
    reasonOtherText?: string | null
  }) => Promise<unknown> | unknown
  requestedDomainSurveyZCode?: string | null
  onAcknowledgeRequestedDomainSurveyZCode?: () => void
  onSaveEnrollmentNavigators: (enrollmentId: string, navigatorPersonIds: string[]) => Promise<unknown> | unknown
  onSaveIntervalAssessmentRule: (rule: IntervalAssessmentRule) => Promise<unknown> | unknown
  onSaveIntake: (intake: EnrolleeIntakeRecord) => Promise<unknown> | unknown
  onOverrideEnrolleeZCodes: (
    enrollmentId: string,
    input: { checkedZCodes: string[]; uncheckReasons: Array<{ zCode: string; reasonCode: string; reasonText?: string | null }> }
  ) => Promise<EnrolleeZCodeOverrideResult | null>
}

export const ADMIN_SECTIONS: Array<{ id: AdminPortalSection; label: string; description: string }> = [
  { id: 'overview', label: 'Overview', description: 'Portal health, requests, and system posture.' },
  { id: 'enrollees', label: 'Enrollees', description: 'Edit records, create drafts, archive, and reassign.' },
  { id: 'directory', label: 'People & roles', description: 'Manage administrators, supervisors, navigators, and partner users.' },
  { id: 'organizations', label: 'Organizations', description: 'Partner and internal organization registry with contact ownership.' },
  { id: 'relationships', label: 'Assignments', description: 'Quickly manage one-to-many reporting and coverage relationships.' },
  { id: 'assessments', label: 'Assessments', description: 'Control interval rules, due generation, and navigator program monitoring.' },
  { id: 'permissions', label: 'Permission exceptions', description: 'Audit and clear person-level overrides against role defaults.' }
]

export const ROLE_OPTIONS: AdminPortalPersonRole[] = ['administrator', 'supervisor', 'navigator', 'partner', 'enrollee']
export const ORG_TYPE_OPTIONS: AdminPortalOrganizationType[] = ['partner', 'internal', 'public_agency', 'community']
export const CUSTOM_ENROLLEE_STATUS_OPTIONS: AdminPortalCustomEnrolleeRecord['status'][] = ['draft', 'active']
export const ADMIN_ACTIVE_SECTION_KEY = 'atlas2026.admin.session.active-section'
export const ADMIN_SELECTED_ENROLLEE_KEY = 'atlas2026.admin.session.selected-enrollee'
export const ADMIN_SELECTED_PERSON_KEY = 'atlas2026.admin.session.selected-person'
export const ADMIN_SELECTED_ORGANIZATION_KEY = 'atlas2026.admin.session.selected-organization'

export function createDefaultFeaturePolicy(): AdminPortalPersonRecord['featurePolicy'] {
  return { screenToggles: {}, cardToggles: {}, actionToggles: {} }
}

export function toAtlasRoles(roles: AdminPortalPersonRole[]): AtlasRole[] {
  return roles.filter(
    (role): role is AtlasRole =>
      role === 'administrator' || role === 'supervisor' || role === 'navigator' || role === 'partner'
  )
}

export function hasCapabilityOverride(overrides: Record<string, boolean>, key: string) {
  return Object.prototype.hasOwnProperty.call(overrides, key)
}

// Normalize the survey catalog once so every admin editor uses the same canonical
// Z-code labels and merged descriptions.
export const ADMIN_Z_CODE_OPTIONS = Array.from(
  DEFAULT_SERVICE_CAPACITY_SECTIONS.flatMap((section) => section.prompts).reduce(
    (map, prompt) => {
      const normalizedCode = prompt.normalizedZCode.trim().toUpperCase()
      const existing = map.get(normalizedCode)
      if (!existing) {
        map.set(normalizedCode, {
          ...prompt,
          normalizedZCode: normalizedCode,
          zCode: prompt.zCode.trim().toUpperCase(),
          title: prompt.title.trim().toUpperCase(),
          description: prompt.description.trim()
        })
        return map
      }
      const mergedDescription = Array.from(
        new Set([existing.description, prompt.description].map((value) => value.trim()).filter(Boolean))
      ).join(' | ')
      map.set(normalizedCode, { ...existing, description: mergedDescription })
      return map
    },
    new Map<string, ZCodeSurveyPrompt>()
  ).values()
).sort((left, right) => left.normalizedZCode.localeCompare(right.normalizedZCode, undefined, { numeric: true }))

export const ADMIN_Z_CODE_PARENT_CODES = DEFAULT_SERVICE_CAPACITY_SECTIONS.map((section) =>
  section.parentCode.trim().toUpperCase()
)

export function readAdminSessionValue(key: string) {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return null
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeAdminSessionValue(key: string, value: string | null) {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return
  try {
    if (!value) {
      window.sessionStorage.removeItem(key)
      return
    }
    window.sessionStorage.setItem(key, value)
  } catch {
    // Session restoration is best-effort because privacy settings may disable storage.
  }
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function createSeedPersonId(name: string) {
  return `seed-person:${slugify(name) || 'unknown'}`
}

export function createSeedOrganizationId(name: string) {
  return `seed-org:${slugify(name) || 'organization'}`
}

export function createPortalId(prefix: string) {
  // User Interface (UI)-created records need stable, human-inspectable identifiers
  // before persistence exists; prefixes keep mixed collections debuggable.
  return `${prefix}:${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`
}

export function getEmptyRegistry(): AdminPortalRegistry {
  return {
    people: [],
    organizations: [],
    customEnrollees: [],
    archivedPersonIds: [],
    archivedOrganizationIds: [],
    archivedEnrolleeIds: [],
    updatedAtIso: new Date().toISOString()
  }
}

export function buildExistingEnrolleeIntake(
  profile: EnrolleeProfile,
  intake: EnrolleeIntakeRecord | undefined
): EnrolleeIntakeRecord {
  const activeCodes = profile.activeZCodeDetails.map((detail) => detail.zCode.trim().toUpperCase()).filter(Boolean)
  const canonicalCodes = activeCodes.length
    ? Array.from(new Set(activeCodes))
    : profile.zCodeTags.map((value) => value.trim().toUpperCase()).filter(Boolean)
  // Sparse intake records inherit profile fields so editors always receive a complete contract.
  return intake
    ? { ...intake, zCodeTags: canonicalCodes.length ? canonicalCodes : intake.zCodeTags }
    : {
        enrolleeId: profile.id,
        fullName: profile.fullName,
        dob: profile.dob,
        caseId: profile.caseId,
        email: profile.email,
        assignedNavigator: profile.assignedNavigator,
        enrollmentStartIso: new Date().toISOString(),
        zCodeTags: canonicalCodes
      }
}

export function buildBlankCustomEnrollee(
  enrolleeId = createPortalId('custom-enrollee')
): AdminPortalCustomEnrolleeRecord {
  return {
    enrolleeId,
    fullName: '',
    dob: '',
    caseId: '',
    email: '',
    assignedNavigator: '',
    enrollmentStartIso: new Date().toISOString(),
    zCodeTags: [],
    status: 'draft',
    notes: ''
  }
}

export function buildBlankPerson(): AdminPortalPersonRecord {
  const id = createPortalId('person')
  return {
    id,
    fullName: '',
    email: '',
    title: '',
    roles: ['navigator'],
    canViewNavigatorAssignmentNames: false,
    approvalState: 'pending',
    identityGroupId: id,
    linkedEmails: [],
    featurePolicy: createDefaultFeaturePolicy(),
    organizationId: null,
    reportsToPersonId: null,
    linkedEnrolleeId: null,
    status: 'invited',
    notes: ''
  }
}

export function buildBlankOrganization(): AdminPortalOrganizationRecord {
  return {
    id: createPortalId('organization'),
    name: '',
    type: 'partner',
    countyName: '',
    primaryContactPersonId: null,
    status: 'draft',
    notes: ''
  }
}

export function buildBlankIntervalAssessmentRule(): IntervalAssessmentRule {
  return {
    id: createPortalId('assessment-rule'),
    title: '',
    assessmentType: 'navigator_self_assessment',
    assigneeRole: 'navigator',
    navigatorName: null,
    cadence: 'weekly',
    startsAtIso: new Date().toISOString(),
    weekday: 1,
    isActive: true,
    instructions: '',
    lastGeneratedAtIso: null
  }
}

export function mergeById<T extends { id: string }>(seedRows: T[], persistedRows: T[], archivedIds: string[]) {
  // Persisted rows win over seeds while archived identifiers remain hidden.
  const map = new Map(seedRows.map((row) => [row.id, row]))
  persistedRows.forEach((row) => map.set(row.id, row))
  return Array.from(map.values()).filter((row) => !archivedIds.includes(row.id))
}

export function formatDateLabel(value: string | null | undefined) {
  if (!value) return 'not recorded'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatMetricLabel(metric: string) {
  return metric.replace(/_/g, ' ')
}
