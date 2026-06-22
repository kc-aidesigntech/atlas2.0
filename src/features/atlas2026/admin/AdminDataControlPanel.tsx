import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Building2, GitBranch, ShieldCheck, Users } from 'lucide-react'
import { getZCodeParentColor } from '@atlas/shared'
import {
  AtlasInsetCard,
  AtlasMetricPill,
  AtlasPanel,
  AtlasStatusPill,
  AtlasTextButton
} from '@/features/atlas2026/components/AtlasPrimitives'
import ZCodeBadge from '@/features/atlas2026/components/ZCodeBadge'
import { DEFAULT_SERVICE_CAPACITY_SECTIONS } from '@/features/atlas2026/singlepane/data/serviceCapacitySurveyCatalog'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import AdminEnrolleesSection from '@/features/atlas2026/admin/components/AdminEnrolleesSection'
import AdminOverviewSection from '@/features/atlas2026/admin/components/AdminOverviewSection'
import AdminDirectorySection from '@/features/atlas2026/admin/components/AdminDirectorySection'
import AdminOrganizationsSection from '@/features/atlas2026/admin/components/AdminOrganizationsSection'
import AdminRelationshipsSection from '@/features/atlas2026/admin/components/AdminRelationshipsSection'
import AdminAssessmentsSection from '@/features/atlas2026/admin/components/AdminAssessmentsSection'
import AdminPermissionsSection from '@/features/atlas2026/admin/components/AdminPermissionsSection'
import type {
  CombinedEnrolleeRow,
  NavigatorCoverageOption,
  PermissionExceptionRow,
  RegulationReviewRosterRow
} from '@/features/atlas2026/admin/components/types'
import type {
  AccessMatrixDataset,
  AdminPortalCustomEnrolleeRecord,
  AdminPortalOrganizationRecord,
  AdminPortalOrganizationType,
  AdminPortalPersonRecord,
  AdminPortalPersonRole,
  AdminPortalRegistry,
  AdminDataQualityMetric,
  AtlasRole,
  EnrolleeIntakeRecord,
  EnrolleeProfile,
  EnrolleeZCodeOverrideResult,
  EnrollmentRequestRecord,
  IntervalAssessmentDueItem,
  IntervalAssessmentRule,
  IntervalCadence,
  NavigatorProgramState,
  RegulationReviewDueItem,
  RegulationReviewSettings,
  SupervisorNavigatorCompetencySummary,
  ZCodeDomainSurveyHistorySummary,
  ZCodeSurveyPrompt
} from '@/features/atlas2026/singlepane/types'
import {
  ADMIN_POLICY_ACTION_KEYS,
  ADMIN_POLICY_CARD_KEYS,
  ADMIN_POLICY_SCREEN_KEYS,
  isCapabilityAllowedForAnyRole,
  toggleCapabilityOverride
} from '@/features/atlas2026/singlepane/roleCapabilityPolicy'

// Admin control panel composes multiple registry contracts (people, organizations,
// enrollee drafts, interval rules) into one operator console with explicit save paths.
type AdminPortalSection = 'overview' | 'enrollees' | 'directory' | 'organizations' | 'relationships' | 'assessments' | 'permissions'

interface AdminDataControlPanelProps {
  metrics: AdminDataQualityMetric[]
  zCodeDomainSurveyHistorySummary: ZCodeDomainSurveyHistorySummary[]
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
  // Forced regulation review: admin-editable cadence policy, computed due items, and the
  // persistence error surface for the underlying config document.
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
  onSaveEnrollmentNavigators: (enrollmentId: string, navigatorPersonIds: string[]) => Promise<unknown> | unknown
  onSaveIntervalAssessmentRule: (rule: IntervalAssessmentRule) => Promise<unknown> | unknown
  onSaveIntake: (intake: EnrolleeIntakeRecord) => Promise<unknown> | unknown
  onOverrideEnrolleeZCodes: (
    enrollmentId: string,
    input: { checkedZCodes: string[]; uncheckReasons: Array<{ zCode: string; reasonCode: string; reasonText?: string | null }> }
  ) => Promise<EnrolleeZCodeOverrideResult | null>
}

const ADMIN_SECTIONS: Array<{ id: AdminPortalSection; label: string; description: string }> = [
  { id: 'overview', label: 'Overview', description: 'Portal health, requests, and system posture.' },
  { id: 'enrollees', label: 'Enrollees', description: 'Edit records, create drafts, archive, and reassign.' },
  { id: 'directory', label: 'People & roles', description: 'Manage administrators, supervisors, navigators, and partner users.' },
  { id: 'organizations', label: 'Organizations', description: 'Partner and internal organization registry with contact ownership.' },
  { id: 'relationships', label: 'Assignments', description: 'Quickly manage one-to-many reporting and coverage relationships.' },
  { id: 'assessments', label: 'Assessments', description: 'Control interval rules, due generation, and navigator program monitoring.' },
  { id: 'permissions', label: 'Permission exceptions', description: 'Audit and clear person-level overrides against role defaults.' }
]

const ROLE_OPTIONS: AdminPortalPersonRole[] = ['administrator', 'supervisor', 'navigator', 'partner', 'enrollee']
const ORG_TYPE_OPTIONS: AdminPortalOrganizationType[] = ['partner', 'internal', 'public_agency', 'community']
const CUSTOM_ENROLLEE_STATUS_OPTIONS: AdminPortalCustomEnrolleeRecord['status'][] = ['draft', 'active']
const ADMIN_ACTIVE_SECTION_KEY = 'atlas2026.admin.session.active-section'
const ADMIN_SELECTED_ENROLLEE_KEY = 'atlas2026.admin.session.selected-enrollee'
const ADMIN_SELECTED_PERSON_KEY = 'atlas2026.admin.session.selected-person'
const ADMIN_SELECTED_ORGANIZATION_KEY = 'atlas2026.admin.session.selected-organization'
function createDefaultFeaturePolicy(): AdminPortalPersonRecord['featurePolicy'] {
  return {
    // Empty maps inherit role-level defaults; admins only store explicit exceptions.
    screenToggles: {},
    cardToggles: {},
    actionToggles: {}
  }
}

function toAtlasRoles(roles: AdminPortalPersonRole[]): AtlasRole[] {
  return roles.filter(
    (role): role is AtlasRole =>
      role === 'administrator' || role === 'supervisor' || role === 'navigator' || role === 'partner'
  )
}

function hasCapabilityOverride(overrides: Record<string, boolean>, key: string) {
  return Object.prototype.hasOwnProperty.call(overrides, key)
}

const ADMIN_Z_CODE_OPTIONS = Array.from(
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
      const mergedDescription = Array.from(new Set([existing.description, prompt.description].map((value) => value.trim()).filter(Boolean))).join(' | ')
      map.set(normalizedCode, {
        ...existing,
        description: mergedDescription
      })
      return map
    },
    new Map<string, ZCodeSurveyPrompt>()
  ).values()
).sort((left, right) => left.normalizedZCode.localeCompare(right.normalizedZCode, undefined, { numeric: true }))

const ADMIN_Z_CODE_PARENT_CODES = DEFAULT_SERVICE_CAPACITY_SECTIONS.map((section) => section.parentCode.trim().toUpperCase())

function readAdminSessionValue(key: string) {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return null
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeAdminSessionValue(key: string, value: string | null) {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return
  try {
    if (!value) {
      window.sessionStorage.removeItem(key)
      return
    }
    window.sessionStorage.setItem(key, value)
  } catch {
    // Session restore is best-effort only.
  }
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function createSeedPersonId(name: string) {
  return `seed-person:${slugify(name) || 'unknown'}`
}

function createSeedOrganizationId(name: string) {
  return `seed-org:${slugify(name) || 'organization'}`
}

function createPortalId(prefix: string) {
  // User Interface (UI)-created records need stable, human-inspectable ids before persistence exists.
  // Prefixes keep mixed record collections debuggable in admin snapshots.
  return `${prefix}:${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`
}

function getEmptyRegistry(): AdminPortalRegistry {
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

function buildExistingEnrolleeIntake(profile: EnrolleeProfile, intake: EnrolleeIntakeRecord | undefined): EnrolleeIntakeRecord {
  const canonicalActiveZCodes = profile.activeZCodeDetails
    .map((detail) => detail.zCode.trim().toUpperCase())
    .filter(Boolean)
  const canonicalZCodeTags = canonicalActiveZCodes.length
    ? Array.from(new Set(canonicalActiveZCodes))
    : profile.zCodeTags.map((value) => value.trim().toUpperCase()).filter(Boolean)
  // Intake overrides are sparse. Fall back to profile fields so edits always start
  // from a complete object and save handlers can rely on required keys.
  return (
    intake
      ? {
          ...intake,
          // Seed the record editor from canonical active rows so adding one code
          // does not implicitly stage removals from stale intake mirrors.
          zCodeTags: canonicalZCodeTags.length ? canonicalZCodeTags : intake.zCodeTags
        }
      : {
          enrolleeId: profile.id,
          fullName: profile.fullName,
          dob: profile.dob,
          caseId: profile.caseId,
          email: profile.email,
          assignedNavigator: profile.assignedNavigator,
          enrollmentStartIso: new Date().toISOString(),
          zCodeTags: canonicalZCodeTags
        }
  )
}

function buildBlankCustomEnrollee(enrolleeId = createPortalId('custom-enrollee')): AdminPortalCustomEnrolleeRecord {
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

function buildBlankPerson(): AdminPortalPersonRecord {
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

function buildBlankOrganization(): AdminPortalOrganizationRecord {
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

function buildBlankIntervalAssessmentRule(): IntervalAssessmentRule {
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

function mergeById<T extends { id: string }>(seedRows: T[], persistedRows: T[], archivedIds: string[]) {
  // Persisted rows win over seeded rows with the same id so operator edits survive
  // each render, while archived ids remain hidden even if they are still present in seed data.
  const map = new Map(seedRows.map((row) => [row.id, row]))
  for (const row of persistedRows) {
    map.set(row.id, row)
  }
  return Array.from(map.values()).filter((row) => !archivedIds.includes(row.id))
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return 'not recorded'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatMetricLabel(metric: string) {
  return metric.replace(/_/g, ' ')
}

function RecordTable({
  columns,
  rows,
  renderRow
}: {
  columns: string[]
  rows: Array<{ id: string }>
  renderRow: (row: { id: string }, index: number) => React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-white/10">
      <div className="grid grid-cols-[1.3fr_repeat(3,minmax(0,1fr))] gap-3 border-b border-white/10 bg-white/5 px-4 py-3 text-[11px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
        {columns.map((column) => (
          <div key={column}>{column}</div>
        ))}
      </div>
      <div className="divide-y divide-white/10">
        {rows.length ? rows.map((row, index) => <div key={row.id}>{renderRow(row, index)}</div>) : null}
      </div>
    </div>
  )
}

export default function AdminDataControlPanel({
  metrics,
  zCodeDomainSurveyHistorySummary,
  isLoadingZCodeDomainSurveyHistorySummary,
  isSavingZCodeDomainSurveyNullification,
  zCodeDomainSurveyHistoryError,
  enrollees,
  intakeFormsByEnrolleeId,
  selectedEnrollee,
  accountSettings,
  enrollmentRequests,
  supervisorNavigatorCompetency,
  navigatorProgramState,
  navigatorIntervalDueItems,
  regulationReviewSettings,
  regulationReviewDueItems,
  regulationReviewError,
  onSaveRegulationReviewSettings,
  accessMatrixDataset,
  registry,
  isSavingRegistry,
  registryError,
  onSaveRegistry,
  onSetZCodeDomainSurveyAnswerNullification,
  onSaveEnrollmentNavigators,
  onSaveIntervalAssessmentRule,
  onSaveIntake,
  onOverrideEnrolleeZCodes
}: AdminDataControlPanelProps) {
  // The UI can render before registry hydration completes; use an empty shape so
  // all mutation helpers stay null-safe and write against one consistent structure.
  const effectiveRegistry = registry || getEmptyRegistry()
  const [activeSection, setActiveSection] = useState<AdminPortalSection>(() => {
    const stored = readAdminSessionValue(ADMIN_ACTIVE_SECTION_KEY)
    return stored === 'overview' || stored === 'enrollees' || stored === 'directory' || stored === 'organizations' || stored === 'relationships' || stored === 'assessments'
      ? stored
      : 'overview'
  })
  const [selectedEnrolleeId, setSelectedEnrolleeId] = useState<string | null>(() => readAdminSessionValue(ADMIN_SELECTED_ENROLLEE_KEY) || selectedEnrollee?.id || null)
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(() => readAdminSessionValue(ADMIN_SELECTED_PERSON_KEY))
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(() => readAdminSessionValue(ADMIN_SELECTED_ORGANIZATION_KEY))
  const [enrolleeDraft, setEnrolleeDraft] = useState<CombinedEnrolleeRow | null>(null)
  const [personDraft, setPersonDraft] = useState<AdminPortalPersonRecord | null>(null)
  const [organizationDraft, setOrganizationDraft] = useState<AdminPortalOrganizationRecord | null>(null)
  const [intervalRuleDraft, setIntervalRuleDraft] = useState<IntervalAssessmentRule | null>(null)
  // Forced regulation review draft: null means "no unsaved edits, mirror persisted settings".
  const [regulationReviewDraft, setRegulationReviewDraft] = useState<RegulationReviewSettings | null>(null)
  const [isSavingRegulationReview, setIsSavingRegulationReview] = useState(false)
  const [portalMessage, setPortalMessage] = useState<string | null>(null)
  const [isSubmittingEnrollee, setIsSubmittingEnrollee] = useState(false)
  const [isZCodePickerOpen, setIsZCodePickerOpen] = useState(false)
  const [activeZCodeParentFilters, setActiveZCodeParentFilters] = useState<string[]>([])
  const [selectedDomainSurveyZCode, setSelectedDomainSurveyZCode] = useState<string>('')
  const [nullificationReasonByAnswerId, setNullificationReasonByAnswerId] = useState<Record<string, string>>({})
  const zCodeOverlayPanelRef = useRef<HTMLDivElement | null>(null)
  const zCodeOverlayListRef = useRef<HTMLDivElement | null>(null)
  const previousZCodeOverlayHeightRef = useRef<number | null>(null)

  const seedOrganizations = useMemo<AdminPortalOrganizationRecord[]>(() => {
    if (!accountSettings.organization.trim()) return []
    return [
      {
        id: createSeedOrganizationId(accountSettings.organization),
        name: accountSettings.organization,
        type: 'internal',
        countyName: '',
        primaryContactPersonId: createSeedPersonId(accountSettings.fullName || 'atlas operator'),
        status: 'active',
        notes: 'Seeded from the current administrator account context.'
      }
    ]
  }, [accountSettings.fullName, accountSettings.organization])

  const seedPeople = useMemo<AdminPortalPersonRecord[]>(() => {
    const rows: AdminPortalPersonRecord[] = []
    const seenIds = new Set<string>()
    const seenEmails = new Set<string>()
    const registerSeedPerson = (person: AdminPortalPersonRecord) => {
      const normalizedEmail = person.email.trim().toLowerCase()
      if (seenIds.has(person.id)) return
      if (normalizedEmail && seenEmails.has(normalizedEmail)) return
      rows.push(person)
      seenIds.add(person.id)
      if (normalizedEmail) seenEmails.add(normalizedEmail)
    }
    if (accountSettings.fullName.trim() || accountSettings.email.trim()) {
      registerSeedPerson({
        id: createSeedPersonId(accountSettings.fullName || accountSettings.email || 'atlas operator'),
        fullName: accountSettings.fullName || 'atlas operator',
        email: accountSettings.email,
        title: 'System administrator',
        roles: ['administrator'],
        canViewNavigatorAssignmentNames: true,
        approvalState: 'approved',
        identityGroupId: createSeedPersonId(accountSettings.fullName || accountSettings.email || 'atlas operator'),
        linkedEmails: accountSettings.email ? [accountSettings.email.trim().toLowerCase()] : [],
        featurePolicy: createDefaultFeaturePolicy(),
        organizationId: accountSettings.organization.trim() ? createSeedOrganizationId(accountSettings.organization) : null,
        reportsToPersonId: null,
        linkedEnrolleeId: null,
        status: 'active',
        notes: 'Seeded from account settings.'
      })
    }
    if (accessMatrixDataset?.people.length) {
      for (const person of accessMatrixDataset.people) {
        registerSeedPerson({
          id: person.id,
          fullName: person.fullName,
          email: person.email,
          title: '',
          roles: person.roleKeys,
          canViewNavigatorAssignmentNames: person.roleKeys.includes('administrator'),
          approvalState: 'approved',
          identityGroupId: person.id,
          linkedEmails: person.email ? [person.email.trim().toLowerCase()] : [],
          featurePolicy: createDefaultFeaturePolicy(),
          organizationId: null,
          reportsToPersonId: null,
          linkedEnrolleeId: null,
          status: 'active',
          notes: 'Seeded from access matrix dataset.'
        })
      }
    }
    const navigatorNames = Array.from(
      new Set([
        ...enrollees.map((enrollee) => enrollee.assignedNavigator),
        ...supervisorNavigatorCompetency.map((summary) => summary.navigatorName)
      ].map((value) => value.trim()).filter(Boolean))
    )
    for (const name of navigatorNames) {
      registerSeedPerson({
        id: createSeedPersonId(name),
        fullName: name,
        email: '',
        title: 'Navigator',
        roles: ['navigator'],
        canViewNavigatorAssignmentNames: false,
        approvalState: 'approved',
        identityGroupId: createSeedPersonId(name),
        linkedEmails: [],
        featurePolicy: createDefaultFeaturePolicy(),
        organizationId: null,
        reportsToPersonId: null,
        linkedEnrolleeId: null,
        status: 'active',
        notes: 'Seeded from existing enrollee assignment data.'
      })
    }
    return rows
  }, [accessMatrixDataset, accountSettings.email, accountSettings.fullName, accountSettings.organization, enrollees, supervisorNavigatorCompetency])

  const combinedOrganizations = useMemo(
    () => mergeById(seedOrganizations, effectiveRegistry.organizations, effectiveRegistry.archivedOrganizationIds),
    [effectiveRegistry.archivedOrganizationIds, effectiveRegistry.organizations, seedOrganizations]
  )

  const combinedPeople = useMemo(
    () => mergeById(seedPeople, effectiveRegistry.people, effectiveRegistry.archivedPersonIds),
    [effectiveRegistry.archivedPersonIds, effectiveRegistry.people, seedPeople]
  )

  const visibleEnrollees = useMemo<CombinedEnrolleeRow[]>(() => {
    // This panel intentionally blends immutable "live" enrollees with admin-authored drafts
    // to support one table User Experience (UX) while preserving the source distinction in each row.
    const existingRows = enrollees
      .filter((profile) => !effectiveRegistry.archivedEnrolleeIds.includes(profile.id))
      .map((profile) => ({
        kind: 'existing' as const,
        id: profile.id,
        profile,
        intake: buildExistingEnrolleeIntake(profile, intakeFormsByEnrolleeId[profile.id])
      }))
    const customRows = effectiveRegistry.customEnrollees
      .filter((record) => !effectiveRegistry.archivedEnrolleeIds.includes(record.enrolleeId))
      .map((record) => ({
        kind: 'custom' as const,
        id: record.enrolleeId,
        record
      }))
    return [...existingRows, ...customRows]
  }, [effectiveRegistry.archivedEnrolleeIds, effectiveRegistry.customEnrollees, enrollees, intakeFormsByEnrolleeId])

  const navigators = useMemo(
    () => combinedPeople.filter((person) => person.roles.includes('navigator')),
    [combinedPeople]
  )
  const supervisors = useMemo(
    () => combinedPeople.filter((person) => person.roles.includes('supervisor') || person.roles.includes('administrator')),
    [combinedPeople]
  )
  const navigatorCoverageOptions = useMemo<NavigatorCoverageOption[]>(() => {
    const options = (accessMatrixDataset?.people || [])
      .filter((person) => person.roleKeys.includes('navigator'))
      .map((person) => ({
        id: person.id,
        label: person.fullName.trim() || person.email.trim() || person.id,
        email: person.email.trim()
      }))
      .sort((left, right) => left.label.localeCompare(right.label))
    return options
  }, [accessMatrixDataset?.people])

  useEffect(() => {
    // Keep first-row selection sticky for UX continuity when data loads/reset occurs.
    if ((!selectedEnrolleeId || !visibleEnrollees.some((row) => row.id === selectedEnrolleeId)) && visibleEnrollees[0]?.id) {
      setSelectedEnrolleeId(visibleEnrollees[0].id)
    }
  }, [selectedEnrolleeId, visibleEnrollees])

  useEffect(() => {
    if ((!selectedPersonId || !combinedPeople.some((person) => person.id === selectedPersonId)) && combinedPeople[0]?.id) {
      setSelectedPersonId(combinedPeople[0].id)
    }
  }, [combinedPeople, selectedPersonId])

  useEffect(() => {
    if ((!selectedOrganizationId || !combinedOrganizations.some((organization) => organization.id === selectedOrganizationId)) && combinedOrganizations[0]?.id) {
      setSelectedOrganizationId(combinedOrganizations[0].id)
    }
  }, [combinedOrganizations, selectedOrganizationId])

  useEffect(() => {
    writeAdminSessionValue(ADMIN_ACTIVE_SECTION_KEY, activeSection)
  }, [activeSection])

  useEffect(() => {
    writeAdminSessionValue(ADMIN_SELECTED_ENROLLEE_KEY, selectedEnrolleeId)
  }, [selectedEnrolleeId])

  useEffect(() => {
    writeAdminSessionValue(ADMIN_SELECTED_PERSON_KEY, selectedPersonId)
  }, [selectedPersonId])

  useEffect(() => {
    writeAdminSessionValue(ADMIN_SELECTED_ORGANIZATION_KEY, selectedOrganizationId)
  }, [selectedOrganizationId])

  const selectedEnrolleeRow = useMemo(
    () => visibleEnrollees.find((row) => row.id === selectedEnrolleeId) || null,
    [selectedEnrolleeId, visibleEnrollees]
  )
  const selectedDraftZCodes = useMemo(
    () =>
      Array.from(
        new Set(
          (enrolleeDraft ? (enrolleeDraft.kind === 'existing' ? enrolleeDraft.intake.zCodeTags : enrolleeDraft.record.zCodeTags) : [])
            .map((value) => value.trim().toUpperCase())
            .filter(Boolean)
        )
      ),
    [enrolleeDraft]
  )
  const selectedDraftParentCodes = useMemo(
    () =>
      Array.from(
        new Set(
          selectedDraftZCodes
            .map((code) => code.split('.')[0]?.trim().toUpperCase() || '')
            .filter(Boolean)
        )
      ),
    [selectedDraftZCodes]
  )
  const visibleZCodeOptions = useMemo(
    () =>
      ADMIN_Z_CODE_OPTIONS.filter((option) =>
        !activeZCodeParentFilters.length || activeZCodeParentFilters.includes(option.parentCode.trim().toUpperCase())
      ),
    [activeZCodeParentFilters]
  )
  const selectedPerson = useMemo(
    () => combinedPeople.find((person) => person.id === selectedPersonId) || null,
    [combinedPeople, selectedPersonId]
  )
  const selectedOrganization = useMemo(
    () => combinedOrganizations.find((org) => org.id === selectedOrganizationId) || null,
    [combinedOrganizations, selectedOrganizationId]
  )
  const permissionExceptionRows = useMemo<PermissionExceptionRow[]>(() => {
    return combinedPeople
      .map((person) => {
        const roles = toAtlasRoles(person.roles)
        const baselineNavigatorNameVisibility = isCapabilityAllowedForAnyRole(
          roles,
          'actionToggles',
          'assignmentBoard.viewNavigatorNames',
          undefined
        )
        const entries: Array<{ id: string; label: string; kind: 'allow' | 'block' }> = []

        for (const key of ADMIN_POLICY_SCREEN_KEYS) {
          if (!hasCapabilityOverride(person.featurePolicy.screenToggles, key)) continue
          const nextValue = Boolean(person.featurePolicy.screenToggles[key])
          entries.push({
            id: `screen:${key}`,
            label: `screen ${key} -> ${nextValue ? 'allow' : 'block'}`,
            kind: nextValue ? 'allow' : 'block'
          })
        }
        for (const key of ADMIN_POLICY_CARD_KEYS) {
          if (!hasCapabilityOverride(person.featurePolicy.cardToggles, key)) continue
          const nextValue = Boolean(person.featurePolicy.cardToggles[key])
          entries.push({
            id: `card:${key}`,
            label: `card ${key} -> ${nextValue ? 'allow' : 'block'}`,
            kind: nextValue ? 'allow' : 'block'
          })
        }
        for (const key of ADMIN_POLICY_ACTION_KEYS) {
          if (!hasCapabilityOverride(person.featurePolicy.actionToggles, key)) continue
          const nextValue = Boolean(person.featurePolicy.actionToggles[key])
          entries.push({
            id: `action:${key}`,
            label: `action ${key} -> ${nextValue ? 'allow' : 'block'}`,
            kind: nextValue ? 'allow' : 'block'
          })
        }
        if (person.canViewNavigatorAssignmentNames !== baselineNavigatorNameVisibility) {
          entries.push({
            id: 'legacy:assignmentBoard.viewNavigatorNames',
            label: `legacy navigator-name visibility -> ${person.canViewNavigatorAssignmentNames ? 'allow' : 'block'}`,
            kind: person.canViewNavigatorAssignmentNames ? 'allow' : 'block'
          })
        }

        if (!entries.length) return null
        return {
          person,
          roles,
          entries
        }
      })
      .filter((row): row is { person: AdminPortalPersonRecord; roles: AtlasRole[]; entries: Array<{ id: string; label: string; kind: 'allow' | 'block' }> } => Boolean(row))
      .sort((left, right) => right.entries.length - left.entries.length)
  }, [combinedPeople])
  const totalPermissionExceptionCount = useMemo(
    () => permissionExceptionRows.reduce((sum, row) => sum + row.entries.length, 0),
    [permissionExceptionRows]
  )

  useEffect(() => {
    if (!enrolleeDraft && selectedEnrolleeRow) {
      setEnrolleeDraft(selectedEnrolleeRow)
    }
  }, [enrolleeDraft, selectedEnrolleeRow])

  useEffect(() => {
    setIsZCodePickerOpen(false)
    setActiveZCodeParentFilters([])
  }, [selectedEnrolleeId])

  useLayoutEffect(() => {
    if (!isZCodePickerOpen || !zCodeOverlayPanelRef.current) return
    const panel = zCodeOverlayPanelRef.current
    const nextHeight = panel.getBoundingClientRect().height
    const previousHeight = previousZCodeOverlayHeightRef.current
    previousZCodeOverlayHeightRef.current = nextHeight
    if (!previousHeight || Math.abs(previousHeight - nextHeight) < 2) return

    const offsetY = (previousHeight - nextHeight) / 2
    panel.animate(
      [
        { transform: `translateY(${offsetY}px) scale(0.992)`, opacity: 0.92 },
        { transform: 'translateY(0px) scale(1)', opacity: 1 }
      ],
      {
        duration: 240,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
      }
    )
    zCodeOverlayListRef.current?.animate(
      [
        { transform: 'translateY(8px)', opacity: 0.72 },
        { transform: 'translateY(0px)', opacity: 1 }
      ],
      {
        duration: 220,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
      }
    )
  }, [activeZCodeParentFilters, isZCodePickerOpen, visibleZCodeOptions.length])

  useEffect(() => {
    if (!personDraft && selectedPerson) {
      setPersonDraft(selectedPerson)
    }
  }, [personDraft, selectedPerson])

  useEffect(() => {
    if (!organizationDraft && selectedOrganization) {
      setOrganizationDraft(selectedOrganization)
    }
  }, [organizationDraft, selectedOrganization])

  async function commitRegistry(nextRegistry: AdminPortalRegistry, successMessage: string) {
    // Centralize registry writes so every path updates updatedAt and portal feedback
    // with the same semantics.
    const saved = await onSaveRegistry({
      ...nextRegistry,
      updatedAtIso: new Date().toISOString()
    })
    setPortalMessage(successMessage)
    return saved
  }

  function withRegistryPerson(person: AdminPortalPersonRecord) {
    const nextPeople = effectiveRegistry.people.filter((entry) => entry.id !== person.id)
    nextPeople.push(person)
    return { ...effectiveRegistry, people: nextPeople }
  }

  function withRegistryOrganization(organization: AdminPortalOrganizationRecord) {
    const nextOrganizations = effectiveRegistry.organizations.filter((entry) => entry.id !== organization.id)
    nextOrganizations.push(organization)
    return { ...effectiveRegistry, organizations: nextOrganizations }
  }

  function updateEnrolleeDraftZCodes(nextTags: string[]) {
    const normalizedTags = Array.from(new Set(nextTags.map((value) => value.trim().toUpperCase()).filter(Boolean)))
    setEnrolleeDraft((current) => {
      if (!current) return current
      if (current.kind === 'existing') return { ...current, intake: { ...current.intake, zCodeTags: normalizedTags } }
      return { ...current, record: { ...current.record, zCodeTags: normalizedTags } }
    })
  }

  function toggleEnrolleeDraftZCode(code: string) {
    const normalizedCode = code.trim().toUpperCase()
    if (!normalizedCode) return
    const nextTags = selectedDraftZCodes.includes(normalizedCode)
      ? selectedDraftZCodes.filter((tag) => tag !== normalizedCode)
      : [...selectedDraftZCodes, normalizedCode]
    updateEnrolleeDraftZCodes(nextTags)
  }

  function openZCodePicker() {
    setActiveZCodeParentFilters(selectedDraftParentCodes.length ? selectedDraftParentCodes : ADMIN_Z_CODE_PARENT_CODES.slice(0, 1))
    previousZCodeOverlayHeightRef.current = null
    setIsZCodePickerOpen(true)
  }

  function toggleZCodeParentFilter(parentCode: string) {
    const normalizedParentCode = parentCode.trim().toUpperCase()
    setActiveZCodeParentFilters((current) =>
      current.includes(normalizedParentCode)
        ? current.filter((value) => value !== normalizedParentCode)
        : [...current, normalizedParentCode]
    )
  }

  async function handleSaveEnrolleeDraft() {
    if (!enrolleeDraft) return
    setIsSubmittingEnrollee(true)
    try {
      if (enrolleeDraft.kind === 'existing') {
        const normalizedDraftZCodes = selectedDraftZCodes
        const activeProfileZCodes = Array.from(
          new Set(enrolleeDraft.profile.activeZCodeDetails.map((detail) => detail.zCode.trim().toUpperCase()).filter(Boolean))
        )
        const removedWithoutReason = activeProfileZCodes.filter((zCode) => !normalizedDraftZCodes.includes(zCode))
        if (removedWithoutReason.length) {
          // The canonical override command requires an audited reason for every uncheck.
          // Fail loudly in admin until this editor collects those reasons explicitly.
          setPortalMessage(
            `Unable to remove ${removedWithoutReason.join(', ')} here because each uncheck requires a reason. Use "update z-codes" on the enrollee page to record removals.`
          )
          return
        }
        if (!enrolleeDraft.profile.enrollmentId) {
          setPortalMessage(`Unable to save ${enrolleeDraft.intake.fullName || enrolleeDraft.profile.fullName}: enrollment id is missing.`)
          return
        }
        const overrideResult = await onOverrideEnrolleeZCodes(enrolleeDraft.profile.enrollmentId, {
          checkedZCodes: normalizedDraftZCodes,
          uncheckReasons: []
        })
        if (!overrideResult) {
          throw new Error('Z-code override was not persisted by the database.')
        }
        await Promise.resolve(onSaveIntake({ ...enrolleeDraft.intake, zCodeTags: overrideResult.zCodeTags }))
        setEnrolleeDraft((current) =>
          current && current.kind === 'existing'
            ? { ...current, intake: { ...current.intake, zCodeTags: overrideResult.zCodeTags } }
            : current
        )
        setPortalMessage(
          `Saved enrollee intake for ${enrolleeDraft.intake.fullName || enrolleeDraft.profile.fullName} with canonical z-code sync.`
        )
      } else {
        await commitRegistry(
          {
            ...effectiveRegistry,
            customEnrollees: [
              ...effectiveRegistry.customEnrollees.filter((record) => record.enrolleeId !== enrolleeDraft.record.enrolleeId),
              enrolleeDraft.record
            ]
          },
          `Saved custom enrollee draft for ${enrolleeDraft.record.fullName || enrolleeDraft.record.caseId || 'new enrollee'}.`
        )
      }
    } catch (error) {
      setPortalMessage(error instanceof Error ? error.message : 'Unable to save enrollee updates right now.')
    } finally {
      setIsSubmittingEnrollee(false)
    }
  }

  async function handleArchiveEnrollee(row: CombinedEnrolleeRow) {
    // Archiving is soft-delete: ids are tracked separately so source records can stay in
    // historical data while disappearing from active admin workflows.
    await commitRegistry(
      {
        ...effectiveRegistry,
        archivedEnrolleeIds: Array.from(new Set([...effectiveRegistry.archivedEnrolleeIds, row.id])),
        customEnrollees:
          row.kind === 'custom'
            ? effectiveRegistry.customEnrollees.filter((record) => record.enrolleeId !== row.id)
            : effectiveRegistry.customEnrollees
      },
      'Enrollee record archived from the admin portal.'
    )
    setEnrolleeDraft(null)
  }

  async function handleSavePersonDraft() {
    if (!personDraft) return
    const normalizedPrimaryEmail = personDraft.email.trim().toLowerCase()
    const normalizedLinkedEmails = Array.from(
      new Set([normalizedPrimaryEmail, ...personDraft.linkedEmails.map((value) => value.trim().toLowerCase())].filter(Boolean))
    )
    // Keep email linkage deterministic so multiple auth emails can map to one person identity.
    const normalizedDraft: AdminPortalPersonRecord = {
      ...personDraft,
      linkedEmails: normalizedLinkedEmails,
      identityGroupId: personDraft.identityGroupId.trim() || personDraft.id
    }
    await commitRegistry(withRegistryPerson(normalizedDraft), `Saved ${personDraft.fullName || 'person'} in the directory.`)
  }

  async function handleDeletePerson(person: AdminPortalPersonRecord) {
    await commitRegistry(
      {
        ...effectiveRegistry,
        people: effectiveRegistry.people.filter((entry) => entry.id !== person.id),
        archivedPersonIds: Array.from(new Set([...effectiveRegistry.archivedPersonIds, person.id]))
      },
      'Directory record removed from the active portal view.'
    )
    setPersonDraft(null)
  }

  async function handleClearPersonPermissionExceptions(person: AdminPortalPersonRecord) {
    const roleDefaultsForNavigatorNameVisibility = isCapabilityAllowedForAnyRole(
      toAtlasRoles(person.roles),
      'actionToggles',
      'assignmentBoard.viewNavigatorNames',
      undefined
    )
    const resetPerson: AdminPortalPersonRecord = {
      ...person,
      canViewNavigatorAssignmentNames: roleDefaultsForNavigatorNameVisibility,
      featurePolicy: createDefaultFeaturePolicy()
    }
    await commitRegistry(
      withRegistryPerson(resetPerson),
      `Cleared permission exceptions for ${person.fullName || person.email || 'person'}.`
    )
    if (selectedPersonId === resetPerson.id) {
      setPersonDraft(resetPerson)
    }
  }

  async function handleSaveOrganizationDraft() {
    if (!organizationDraft) return
    await commitRegistry(
      withRegistryOrganization(organizationDraft),
      `Saved ${organizationDraft.name || 'organization'} in the organization registry.`
    )
  }

  async function handleDeleteOrganization(organization: AdminPortalOrganizationRecord) {
    // Clearing organization references avoids dangling foreign keys in people records
    // after an org is removed from the active registry.
    await commitRegistry(
      {
        ...effectiveRegistry,
        organizations: effectiveRegistry.organizations.filter((entry) => entry.id !== organization.id),
        archivedOrganizationIds: Array.from(new Set([...effectiveRegistry.archivedOrganizationIds, organization.id])),
        people: effectiveRegistry.people.map((person) =>
          person.organizationId === organization.id ? { ...person, organizationId: null } : person
        )
      },
      'Organization removed from the active portal view.'
    )
    setOrganizationDraft(null)
  }

  async function handleNavigatorAssignment(row: CombinedEnrolleeRow, navigatorName: string) {
    if (row.kind === 'existing') {
      await Promise.resolve(onSaveIntake({ ...row.intake, assignedNavigator: navigatorName }))
      setPortalMessage(`Reassigned ${row.intake.fullName || row.profile.fullName} to ${navigatorName || 'no navigator'}.`)
      return
    }
    const nextRecord = { ...row.record, assignedNavigator: navigatorName }
    await commitRegistry(
      {
        ...effectiveRegistry,
        customEnrollees: effectiveRegistry.customEnrollees.map((record) =>
          record.enrolleeId === nextRecord.enrolleeId ? nextRecord : record
        )
      },
      `Updated coverage assignment for ${row.record.fullName || row.record.caseId || 'custom enrollee'}.`
    )
  }

  async function handleNavigatorCoverageSelection(row: CombinedEnrolleeRow, navigatorPersonIds: string[]) {
    if (row.kind !== 'existing') {
      const firstLabel = navigatorCoverageOptions.find((option) => option.id === navigatorPersonIds[0])?.label || ''
      await handleNavigatorAssignment(row, firstLabel)
      return
    }
    if (!row.profile.enrollmentId) {
      setPortalMessage(`Unable to update ${row.intake.fullName || row.profile.fullName}: enrollment id is missing.`)
      return
    }
    await Promise.resolve(onSaveEnrollmentNavigators(row.profile.enrollmentId, navigatorPersonIds))
    setPortalMessage(
      `Updated coverage for ${row.intake.fullName || row.profile.fullName} to ${navigatorPersonIds.length} navigator${navigatorPersonIds.length === 1 ? '' : 's'}.`
    )
  }

  async function handlePersonSupervisorAssignment(personId: string, supervisorId: string | null) {
    const person = combinedPeople.find((entry) => entry.id === personId)
    if (!person) return
    await commitRegistry(
      withRegistryPerson({ ...person, reportsToPersonId: supervisorId }),
      `Updated reporting line for ${person.fullName || 'selected person'}.`
    )
  }

  async function handlePersonOrganizationAssignment(personId: string, organizationId: string | null) {
    const person = combinedPeople.find((entry) => entry.id === personId)
    if (!person) return
    await commitRegistry(
      withRegistryPerson({ ...person, organizationId }),
      `Updated organization ownership for ${person.fullName || 'selected person'}.`
    )
  }

  async function handleSaveIntervalRule() {
    if (!intervalRuleDraft) return
    await Promise.resolve(onSaveIntervalAssessmentRule(intervalRuleDraft))
    setPortalMessage(`Saved interval rule for ${intervalRuleDraft.title || 'assessment rule'}.`)
  }

  // Unsaved edits take precedence over the persisted policy; null draft mirrors persistence.
  const effectiveRegulationReview = regulationReviewDraft ?? regulationReviewSettings

  // Admin roster for per-enrollee review toggles: every visible enrollee plus any persisted
  // entry whose enrollee is no longer visible (archived/renamed) so it stays manageable.
  const regulationReviewRoster = useMemo<RegulationReviewRosterRow[]>(() => {
    const rows = visibleEnrollees.map((row) => ({
      enrolleeId: row.kind === 'existing' ? row.profile.id : row.record.enrolleeId,
      enrolleeName: row.kind === 'existing' ? row.profile.fullName : row.record.fullName
    }))
    const knownIds = new Set(rows.map((row) => row.enrolleeId))
    Object.values(effectiveRegulationReview.enrolleeSettings).forEach((entry) => {
      if (knownIds.has(entry.enrolleeId)) return
      rows.push({ enrolleeId: entry.enrolleeId, enrolleeName: entry.enrolleeName || entry.enrolleeId })
    })
    return rows.sort((left, right) => left.enrolleeName.localeCompare(right.enrolleeName))
  }, [effectiveRegulationReview.enrolleeSettings, visibleEnrollees])

  function updateRegulationReviewEnrolleeSetting(
    enrolleeId: string,
    enrolleeName: string,
    patch: Partial<Pick<RegulationReviewSettings['enrolleeSettings'][string], 'isActive' | 'cadence'>>
  ) {
    const base = effectiveRegulationReview
    const existing = base.enrolleeSettings[enrolleeId]
    setRegulationReviewDraft({
      ...base,
      enrolleeSettings: {
        ...base.enrolleeSettings,
        [enrolleeId]: {
          enrolleeId,
          enrolleeName,
          // Enrollees without an explicit entry inherit the default-active policy, so a
          // first toggle starts from that inherited state.
          isActive: existing ? existing.isActive : base.isActiveForNewEnrollees,
          cadence: existing ? existing.cadence : null,
          ...patch,
          updatedAtIso: new Date().toISOString()
        }
      }
    })
  }

  async function handleSaveRegulationReviewSettings() {
    if (!regulationReviewDraft) return
    setIsSavingRegulationReview(true)
    try {
      await Promise.resolve(onSaveRegulationReviewSettings(regulationReviewDraft))
      setRegulationReviewDraft(null)
      setPortalMessage('Saved forced regulation review settings.')
    } finally {
      setIsSavingRegulationReview(false)
    }
  }

  const overviewCards = useMemo(
    () => [
      { label: 'Active enrollees', value: visibleEnrollees.length, accentColor: SP_COLORS.blue },
      { label: 'People directory', value: combinedPeople.length, accentColor: SP_COLORS.yellow },
      { label: 'Organizations', value: combinedOrganizations.length, accentColor: SP_COLORS.deepGreen },
      { label: 'Pending requests', value: enrollmentRequests.filter((item) => item.status === 'pending').length, accentColor: SP_COLORS.red },
      { label: 'Pickup queue', value: navigatorProgramState.pickupQueue.filter((item) => item.status === 'available').length, accentColor: SP_COLORS.yellow },
      { label: 'Assessment rules', value: navigatorProgramState.intervalAssessmentRules.length, accentColor: SP_COLORS.blue }
    ],
    [combinedOrganizations.length, combinedPeople.length, enrollmentRequests, navigatorProgramState.intervalAssessmentRules.length, navigatorProgramState.pickupQueue, visibleEnrollees.length]
  )

  useEffect(() => {
    if (!zCodeDomainSurveyHistorySummary.length) {
      setSelectedDomainSurveyZCode('')
      return
    }
    if (selectedDomainSurveyZCode && zCodeDomainSurveyHistorySummary.some((entry) => entry.normalizedZCode === selectedDomainSurveyZCode)) {
      return
    }
    setSelectedDomainSurveyZCode(zCodeDomainSurveyHistorySummary[0].normalizedZCode)
  }, [selectedDomainSurveyZCode, zCodeDomainSurveyHistorySummary])

  const selectedDomainSurveySummary = useMemo(
    () => zCodeDomainSurveyHistorySummary.find((entry) => entry.normalizedZCode === selectedDomainSurveyZCode) || null,
    [selectedDomainSurveyZCode, zCodeDomainSurveyHistorySummary]
  )

  async function handleSetDomainSurveyNullification(answerId: string, isNullified: boolean) {
    const reason = nullificationReasonByAnswerId[answerId]?.trim() || null
    await Promise.resolve(
      onSetZCodeDomainSurveyAnswerNullification({
        answerId,
        isNullified,
        nullifiedReason: reason
      })
    )
    setPortalMessage(isNullified ? 'Answer has been nullified from the aggregate average.' : 'Answer has been restored to the aggregate average.')
  }

  return (
    <AtlasPanel
      kicker="administrator portal"
      title="System record control center"
      description="Manage directory records, organization ownership, enrollee intake details, and one-to-many assignment relationships from a single operational console."
      className="h-full w-full rounded-[28px] bg-[var(--surface-panel-soft)]"
      contentClassName="space-y-5"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <AtlasStatusPill color={isSavingRegistry ? SP_COLORS.yellow : SP_COLORS.deepGreen}>
            {isSavingRegistry ? 'saving portal state' : 'portal synced'}
          </AtlasStatusPill>
          <AtlasTextButton
            onClick={() => setActiveSection('relationships')}
            className="px-4 py-2 text-[13px] font-medium"
            style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
          >
            jump to assignments
          </AtlasTextButton>
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
        <div className="space-y-4">
          <AtlasInsetCard className="rounded-[22px] border-white/15 bg-[#090909] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5">
                <ShieldCheck className="h-5 w-5 text-[var(--atlas-signal-yellow)]" />
              </div>
              <div>
                <div className="text-[16px] font-medium text-white">{accountSettings.fullName || 'atlas operator'}</div>
                <small className="block text-[12px] text-[var(--foreground-secondary)]">
                  {accountSettings.organization || 'atlas operations'}
                </small>
              </div>
            </div>
            <small className="mt-3 block text-[12px] leading-relaxed text-[var(--foreground-secondary)]">
              This portal is designed to be the operational source of truth for front-end administrative control.
            </small>
          </AtlasInsetCard>

          <div className="space-y-2">
            {ADMIN_SECTIONS.map((section) => {
              const isActive = section.id === activeSection
              // Keep section pills on the canonical dark surface and reserve lucid teal for the
              // currently selected route so state changes stay obvious without yellow/white drift.
              return (
                <AtlasTextButton
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className="w-full px-4 py-3 text-left"
                  style={
                    {
                      ['--button-border-color' as const]: isActive ? 'var(--atlas-signal-lucid-teal)' : '#ffffff25',
                      color: SP_COLORS.white,
                      backgroundColor: isActive ? 'var(--atlas-signal-lucid-teal)' : 'var(--surface-button)'
                    } as React.CSSProperties
                  }
                >
                  <div className="text-[14px] font-semibold">{section.label}</div>
                  <small className="mt-1 block text-[12px] text-[var(--foreground-secondary)]">{section.description}</small>
                </AtlasTextButton>
              )
            })}
          </div>

          {portalMessage ? (
            <AtlasInsetCard className="rounded-[18px] border-[rgba(69,191,85,0.45)] bg-[rgba(69,191,85,0.08)] px-4 py-3">
              <small className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: SP_COLORS.deepGreen }}>
                last action
              </small>
              <div className="mt-1 text-[13px] text-white">{portalMessage}</div>
            </AtlasInsetCard>
          ) : null}

          {registryError ? (
            <AtlasInsetCard className="rounded-[18px] border-[rgba(255,92,92,0.4)] bg-[rgba(255,92,92,0.08)] px-4 py-3">
              <small className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: SP_COLORS.red }}>
                persistence warning
              </small>
              <div className="mt-1 text-[13px] text-white">{registryError}</div>
            </AtlasInsetCard>
          ) : null}
        </div>

        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {overviewCards.map((card) => (
              <AtlasMetricPill key={card.label} label={card.label} value={card.value} accentColor={card.accentColor} className="rounded-[18px]" />
            ))}
          </div>

          {activeSection === 'overview' ? (
            <AdminOverviewSection
              metrics={metrics}
              enrollmentRequests={enrollmentRequests}
              selectedEnrollee={selectedEnrollee}
              supervisorNavigatorCompetency={supervisorNavigatorCompetency}
              isSavingZCodeDomainSurveyNullification={isSavingZCodeDomainSurveyNullification}
              isLoadingZCodeDomainSurveyHistorySummary={isLoadingZCodeDomainSurveyHistorySummary}
              zCodeDomainSurveyHistoryError={zCodeDomainSurveyHistoryError}
              zCodeDomainSurveyHistorySummary={zCodeDomainSurveyHistorySummary}
              selectedDomainSurveySummary={selectedDomainSurveySummary}
              setSelectedDomainSurveyZCode={setSelectedDomainSurveyZCode}
              nullificationReasonByAnswerId={nullificationReasonByAnswerId}
              setNullificationReasonByAnswerId={setNullificationReasonByAnswerId}
              handleSetDomainSurveyNullification={handleSetDomainSurveyNullification}
              formatMetricLabel={formatMetricLabel}
              formatDateLabel={formatDateLabel}
              StatusPillComponent={StatusPill}
            />
          ) : null}

          {activeSection === 'enrollees' ? (
            <AdminEnrolleesSection
              visibleEnrollees={visibleEnrollees}
              selectedEnrolleeId={selectedEnrolleeId}
              setSelectedEnrolleeId={setSelectedEnrolleeId}
              setEnrolleeDraft={setEnrolleeDraft}
              createPortalId={createPortalId}
              buildBlankCustomEnrollee={buildBlankCustomEnrollee}
              navigators={navigators}
              enrolleeDraft={enrolleeDraft}
              selectedDraftParentCodes={selectedDraftParentCodes}
              openZCodePicker={openZCodePicker}
              selectedDraftZCodes={selectedDraftZCodes}
              handleSaveEnrolleeDraft={handleSaveEnrolleeDraft}
              handleArchiveEnrollee={handleArchiveEnrollee}
              isSubmittingEnrollee={isSubmittingEnrollee}
              CUSTOM_ENROLLEE_STATUS_OPTIONS={CUSTOM_ENROLLEE_STATUS_OPTIONS}
              setDraftFromUpdater={setEnrolleeDraft}
              RecordTableComponent={RecordTable}
              StatusPillComponent={StatusPill}
              FieldComponent={Field}
              ZCodeParentFilterCircleComponent={ZCodeParentFilterCircle}
            />
          ) : null}

          {activeSection === 'directory' ? (
            <AdminDirectorySection
              setPersonDraft={setPersonDraft}
              buildBlankPerson={buildBlankPerson}
              combinedPeople={combinedPeople}
              selectedPersonId={selectedPersonId}
              setSelectedPersonId={setSelectedPersonId}
              combinedOrganizations={combinedOrganizations}
              personDraft={personDraft}
              ROLE_OPTIONS={ROLE_OPTIONS}
              supervisors={supervisors}
              isCapabilityAllowedForAnyRole={isCapabilityAllowedForAnyRole}
              toAtlasRoles={toAtlasRoles}
              toggleCapabilityOverride={toggleCapabilityOverride}
              ADMIN_POLICY_SCREEN_KEYS={[...ADMIN_POLICY_SCREEN_KEYS]}
              ADMIN_POLICY_CARD_KEYS={[...ADMIN_POLICY_CARD_KEYS]}
              ADMIN_POLICY_ACTION_KEYS={[...ADMIN_POLICY_ACTION_KEYS]}
              handleSavePersonDraft={handleSavePersonDraft}
              handleDeletePerson={handleDeletePerson}
              RecordTableComponent={RecordTable}
              StatusPillComponent={StatusPill}
              FieldComponent={Field}
            />
          ) : null}

          {activeSection === 'organizations' ? (
            <AdminOrganizationsSection
              setOrganizationDraft={setOrganizationDraft}
              buildBlankOrganization={buildBlankOrganization}
              combinedOrganizations={combinedOrganizations}
              selectedOrganizationId={selectedOrganizationId}
              setSelectedOrganizationId={setSelectedOrganizationId}
              combinedPeople={combinedPeople}
              organizationDraft={organizationDraft}
              ORG_TYPE_OPTIONS={ORG_TYPE_OPTIONS}
              handleSaveOrganizationDraft={handleSaveOrganizationDraft}
              handleDeleteOrganization={handleDeleteOrganization}
              RecordTableComponent={RecordTable}
              StatusPillComponent={StatusPill}
              FieldComponent={Field}
            />
          ) : null}

          {activeSection === 'relationships' ? (
            <AdminRelationshipsSection
              navigators={navigators}
              supervisors={supervisors}
              handlePersonSupervisorAssignment={handlePersonSupervisorAssignment}
              visibleEnrollees={visibleEnrollees}
              accessMatrixDataset={accessMatrixDataset}
              navigatorCoverageOptions={navigatorCoverageOptions}
              handleNavigatorCoverageSelection={handleNavigatorCoverageSelection}
              handleNavigatorAssignment={handleNavigatorAssignment}
              combinedPeople={combinedPeople}
              combinedOrganizations={combinedOrganizations}
              handlePersonOrganizationAssignment={handlePersonOrganizationAssignment}
            />
          ) : null}

          {activeSection === 'assessments' ? (
            <AdminAssessmentsSection
              setIntervalRuleDraft={setIntervalRuleDraft}
              buildBlankIntervalAssessmentRule={buildBlankIntervalAssessmentRule}
              navigatorProgramState={navigatorProgramState}
              intervalRuleDraft={intervalRuleDraft}
              handleSaveIntervalRule={handleSaveIntervalRule}
              handleSaveRegulationReviewSettings={handleSaveRegulationReviewSettings}
              regulationReviewDraft={regulationReviewDraft}
              isSavingRegulationReview={isSavingRegulationReview}
              regulationReviewError={regulationReviewError}
              effectiveRegulationReview={effectiveRegulationReview}
              setRegulationReviewDraft={setRegulationReviewDraft}
              regulationReviewDueItems={regulationReviewDueItems}
              regulationReviewRoster={regulationReviewRoster}
              updateRegulationReviewEnrolleeSetting={updateRegulationReviewEnrolleeSetting}
              navigatorIntervalDueItems={navigatorIntervalDueItems}
              supervisorNavigatorCompetency={supervisorNavigatorCompetency}
              formatDateLabel={formatDateLabel}
              StatusPillComponent={StatusPill}
              FieldComponent={Field}
            />
          ) : null}
          {activeSection === 'permissions' ? (
            <AdminPermissionsSection
              permissionExceptionRows={permissionExceptionRows}
              totalPermissionExceptionCount={totalPermissionExceptionCount}
              onClearPersonPermissionExceptions={handleClearPersonPermissionExceptions}
            />
          ) : null}
        </div>
        {isZCodePickerOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 py-6 backdrop-blur-[2px]">
            <div
              ref={zCodeOverlayPanelRef}
              className="max-h-[85vh] w-full max-w-[980px] overflow-hidden rounded-[28px] border border-white/15 bg-[#080808] px-5 py-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">z-code selector</small>
                  <div className="mt-1 text-[24px] font-medium text-white">Select active z-codes</div>
                  <small className="block text-[12px] text-[var(--foreground-secondary)]">
                    Parent filters default to the currently selected families. Click the circles to add or remove parent groups.
                  </small>
                </div>
                <AtlasTextButton
                  type="button"
                  onClick={() => setIsZCodePickerOpen(false)}
                  className="px-[19px] py-[10px] text-[14px]"
                  style={{ ['--button-border-color' as const]: '#ffffff30', color: '#f1f1f1' } as React.CSSProperties}
                >
                  close
                </AtlasTextButton>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {ADMIN_Z_CODE_PARENT_CODES.map((parentCode) => (
                  <button
                    key={parentCode}
                    type="button"
                    onClick={() => toggleZCodeParentFilter(parentCode)}
                    className="rounded-full"
                  >
                    <ZCodeParentFilterCircle
                      parentCode={parentCode}
                      selected={activeZCodeParentFilters.includes(parentCode)}
                    />
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] text-[var(--foreground-secondary)]">
                <span>{selectedDraftZCodes.length} z-code{selectedDraftZCodes.length === 1 ? '' : 's'} selected</span>
                <span>
                  {activeZCodeParentFilters.length
                    ? `showing ${activeZCodeParentFilters.join(', ')}`
                    : 'no parent filters active'}
                </span>
              </div>
              <div ref={zCodeOverlayListRef} className="mt-5 max-h-[56vh] overflow-y-auto">
                {activeZCodeParentFilters.length ? (
                  <div className="grid gap-2">
                    {visibleZCodeOptions.map((option) => (
                      <ZCodeOptionCard
                        key={option.id}
                        option={option}
                        selected={selectedDraftZCodes.includes(option.normalizedZCode)}
                        onToggle={() => toggleEnrolleeDraftZCode(option.normalizedZCode)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[18px] border border-white/10 px-4 py-4 text-[13px] text-[var(--foreground-secondary)]">
                    Turn on at least one parent circle to show its child z-codes.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AtlasPanel>
  )
}

function ZCodeParentFilterCircle({
  parentCode,
  selected
}: {
  parentCode: string
  selected: boolean
}) {
  const normalized = parentCode.trim().toUpperCase()
  const fill = getZCodeParentColor(normalized) || SP_COLORS.white
  return (
    <span
      className="inline-flex rounded-full transition-all duration-200 ease-out"
      style={{ boxShadow: selected ? `0 0 0 2px ${SP_COLORS.yellow}` : 'none' }}
    >
      <ZCodeBadge
        value={normalized}
        fill={fill}
        size="filter"
        stripLeadingZ
        checked={selected}
        borderColor={selected ? SP_COLORS.white : fill}
      />
    </span>
  )
}

function ZCodeCircleChip({ code }: { code: string }) {
  const normalized = code.trim().toUpperCase()
  const parentCode = normalized.split('.')[0] || normalized
  const fill = getZCodeParentColor(parentCode) || SP_COLORS.white
  return <ZCodeBadge value={normalized} fill={fill} size="chip" className="transition-all duration-200 ease-out" />
}

function ZCodeOptionCard({
  option,
  selected,
  onToggle
}: {
  option: ZCodeSurveyPrompt
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-start gap-3 rounded-[16px] border px-3 py-3 text-left transition-all duration-200 ease-out"
      style={{
        borderColor: selected ? SP_COLORS.yellow : '#ffffff18',
        backgroundColor: selected ? '#1a1606' : '#101010'
      }}
    >
      <ZCodeCircleChip code={option.normalizedZCode} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-white">{option.title}</span>
        <span className="mt-1 block text-[12px] text-[var(--foreground-secondary)]">{option.description}</span>
        <span className="mt-1 block text-[10px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
          {option.parentTheme}
        </span>
      </span>
      <span
        className="mt-0.5 inline-flex min-w-[64px] justify-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
        style={{
          borderColor: selected ? SP_COLORS.yellow : '#ffffff20',
          color: selected ? SP_COLORS.yellow : '#d8d8d8'
        }}
      >
        {selected ? 'selected' : 'select'}
      </span>
    </button>
  )
}

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block text-[12px] text-[var(--foreground-secondary)]">
      <span className="mb-1.5 block uppercase tracking-[0.12em]">{label}</span>
      {children}
    </label>
  )
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  const color =
    normalized.includes('inactive') || normalized.includes('archived')
      ? SP_COLORS.red
      : normalized.includes('draft') || normalized.includes('pending') || normalized.includes('invited')
        ? SP_COLORS.yellow
        : SP_COLORS.deepGreen
  return <AtlasStatusPill color={color}>{status}</AtlasStatusPill>
}
