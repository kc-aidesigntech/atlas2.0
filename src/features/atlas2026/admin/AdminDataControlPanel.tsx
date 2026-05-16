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
  EnrollmentRequestRecord,
  IntervalAssessmentDueItem,
  IntervalAssessmentRule,
  NavigatorProgramState,
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
type CombinedEnrolleeRow =
  | { kind: 'existing'; id: string; profile: EnrolleeProfile; intake: EnrolleeIntakeRecord }
  | { kind: 'custom'; id: string; record: AdminPortalCustomEnrolleeRecord }

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
  // Intake overrides are sparse. Fall back to profile fields so edits always start
  // from a complete object and save handlers can rely on required keys.
  return (
    intake || {
      enrolleeId: profile.id,
      fullName: profile.fullName,
      dob: profile.dob,
      caseId: profile.caseId,
      email: profile.email,
      assignedNavigator: profile.assignedNavigator,
      enrollmentStartIso: new Date().toISOString(),
      zCodeTags: profile.zCodeTags
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
  accessMatrixDataset,
  registry,
  isSavingRegistry,
  registryError,
  onSaveRegistry,
  onSetZCodeDomainSurveyAnswerNullification,
  onSaveEnrollmentNavigators,
  onSaveIntervalAssessmentRule,
  onSaveIntake
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
  const navigatorCoverageOptions = useMemo(() => {
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
  const permissionExceptionRows = useMemo(() => {
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
        await Promise.resolve(onSaveIntake(enrolleeDraft.intake))
        setPortalMessage(`Saved enrollee intake for ${enrolleeDraft.intake.fullName || enrolleeDraft.profile.fullName}.`)
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
            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <AtlasInsetCard className="rounded-[22px] px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
                      system posture
                    </small>
                    <div className="mt-1 text-[22px] font-medium text-white">Operational summary</div>
                  </div>
                  <Users className="h-5 w-5 text-[var(--atlas-signal-yellow)]" />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {metrics.map((metric) => (
                    <AtlasInsetCard key={metric.metric} className="rounded-[16px] px-4 py-3">
                      <small className="block text-[11px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
                        {formatMetricLabel(metric.metric)}
                      </small>
                      <div className="mt-1 text-[20px] font-semibold text-white">{metric.countValue}</div>
                    </AtlasInsetCard>
                  ))}
                </div>
              </AtlasInsetCard>

              <AtlasInsetCard className="rounded-[22px] px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
                      pending requests
                    </small>
                    <div className="mt-1 text-[22px] font-medium text-white">Queue watch</div>
                  </div>
                  <GitBranch className="h-5 w-5 text-[var(--atlas-signal-yellow)]" />
                </div>
                <div className="mt-4 space-y-3">
                  {enrollmentRequests.slice(0, 5).map((request) => (
                    <div key={request.id} className="rounded-[16px] border border-white/10 bg-white/5 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[15px] font-medium text-white">{request.prospectiveEnrollee}</div>
                          <small className="block text-[12px] text-[var(--foreground-secondary)]">
                            {request.email || 'email not supplied'} · {formatDateLabel(request.submittedAt)}
                          </small>
                        </div>
                        <StatusPill status={request.status} />
                      </div>
                    </div>
                  ))}
                  {!enrollmentRequests.length ? (
                    <small className="text-[13px] text-[var(--foreground-secondary)]">No pending enrollment traffic is waiting right now.</small>
                  ) : null}
                </div>
              </AtlasInsetCard>

              <AtlasInsetCard className="rounded-[22px] px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
                      active selection
                    </small>
                    <div className="mt-1 text-[22px] font-medium text-white">Current enrollee focus</div>
                  </div>
                  <Building2 className="h-5 w-5 text-[var(--atlas-signal-yellow)]" />
                </div>
                <div className="mt-4 rounded-[18px] border border-white/10 bg-white/5 px-4 py-4">
                  <div className="text-[18px] font-medium text-white">
                    {selectedEnrollee ? selectedEnrollee.fullName : 'No enrollee selected'}
                  </div>
                  <small className="mt-2 block text-[13px] text-[var(--foreground-secondary)]">
                    {selectedEnrollee ? `${selectedEnrollee.caseId} · ${selectedEnrollee.assignedNavigator}` : 'Select an enrollee from the portal tables to inspect assignments.'}
                  </small>
                </div>
              </AtlasInsetCard>

              <AtlasInsetCard className="rounded-[22px] px-5 py-5">
                <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
                  relationship health
                </small>
                <div className="mt-1 text-[22px] font-medium text-white">Supervisor coverage</div>
                <div className="mt-4 space-y-3">
                  {supervisorNavigatorCompetency.map((summary) => (
                    <div key={summary.navigatorName} className="rounded-[16px] border border-white/10 bg-white/5 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[15px] font-medium text-white">{summary.navigatorName}</div>
                          <small className="block text-[12px] text-[var(--foreground-secondary)]">
                            {summary.assessmentCount} assessments · last recorded {formatDateLabel(summary.lastAssessmentAtIso)}
                          </small>
                        </div>
                        <div className="text-right">
                          <small className="block text-[11px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">rolling avg</small>
                          <div className="text-[18px] font-semibold text-white">{summary.weightedRollingAverage}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!supervisorNavigatorCompetency.length ? (
                    <small className="text-[13px] text-[var(--foreground-secondary)]">Supervisor assessment records will appear here once the team starts logging them.</small>
                  ) : null}
                </div>
              </AtlasInsetCard>

              <AtlasInsetCard className="rounded-[22px] px-5 py-5 lg:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
                      z code domain survey
                    </small>
                    <div className="mt-1 text-[22px] font-medium text-white">Response history and anomaly controls</div>
                    <small className="mt-1 block text-[13px] text-[var(--foreground-secondary)]">
                      Review every response per Z-code, inspect the rolling average, and nullify anomalous entries without deleting source logs.
                    </small>
                  </div>
                  <AtlasStatusPill color={isSavingZCodeDomainSurveyNullification ? SP_COLORS.yellow : SP_COLORS.deepGreen}>
                    {isSavingZCodeDomainSurveyNullification ? 'updating nullification' : 'ready'}
                  </AtlasStatusPill>
                </div>
                {isLoadingZCodeDomainSurveyHistorySummary ? (
                  <small className="mt-4 block text-[13px] text-[var(--foreground-secondary)]">Loading z-code domain survey history...</small>
                ) : null}
                {zCodeDomainSurveyHistoryError ? (
                  <small className="mt-4 block text-[13px]" style={{ color: SP_COLORS.red }}>
                    {zCodeDomainSurveyHistoryError}
                  </small>
                ) : null}
                {!isLoadingZCodeDomainSurveyHistorySummary && !zCodeDomainSurveyHistorySummary.length ? (
                  <small className="mt-4 block text-[13px] text-[var(--foreground-secondary)]">
                    No completed public domain survey responses are available yet.
                  </small>
                ) : null}
                {zCodeDomainSurveyHistorySummary.length ? (
                  <div className="mt-4 grid gap-4 xl:grid-cols-[0.35fr_0.65fr]">
                    <div className="space-y-2">
                      {zCodeDomainSurveyHistorySummary.map((summary) => {
                        const isSelected = selectedDomainSurveySummary?.normalizedZCode === summary.normalizedZCode
                        return (
                          <button
                            key={summary.normalizedZCode}
                            type="button"
                            className="w-full rounded-[14px] border px-3 py-2 text-left transition hover:bg-white/10"
                            style={{
                              borderColor: isSelected ? SP_COLORS.yellow : '#ffffff18',
                              backgroundColor: isSelected ? 'rgba(252,192,26,0.08)' : 'rgba(255,255,255,0.02)'
                            }}
                            onClick={() => setSelectedDomainSurveyZCode(summary.normalizedZCode)}
                          >
                            <div className="text-[13px] font-medium text-white">{summary.zCode}</div>
                            <small className="block truncate text-[11px] text-[var(--foreground-secondary)]">{summary.title}</small>
                            <small className="mt-1 block text-[11px] text-[var(--foreground-secondary)]">
                              avg {summary.averageScore ? summary.averageScore.toFixed(2) : 'n/a'} · active {summary.activeResponses} / total {summary.totalResponses}
                            </small>
                          </button>
                        )
                      })}
                    </div>
                    <div>
                      {selectedDomainSurveySummary ? (
                        <div className="space-y-3">
                          <div className="rounded-[14px] border border-white/10 bg-white/5 px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="text-[16px] font-medium text-white">
                                  {selectedDomainSurveySummary.zCode} - {selectedDomainSurveySummary.title}
                                </div>
                                <small className="block text-[12px] text-[var(--foreground-secondary)]">
                                  Average score {selectedDomainSurveySummary.averageScore ? selectedDomainSurveySummary.averageScore.toFixed(2) : 'n/a'} from {selectedDomainSurveySummary.activeResponses} active responses.
                                </small>
                              </div>
                              <small className="text-[12px] text-[var(--foreground-secondary)]">
                                nullified {selectedDomainSurveySummary.nullifiedResponses}
                              </small>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {selectedDomainSurveySummary.scoreHistory.map((entry) => (
                              <div key={entry.answerId} className="rounded-[14px] border border-white/10 bg-white/5 px-4 py-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="text-[13px] font-medium text-white">
                                      {entry.respondentFirstName || 'Unknown'} {entry.respondentLastName || ''} · {entry.respondentEmail || 'email not provided'}
                                    </div>
                                    <small className="block text-[12px] text-[var(--foreground-secondary)]">
                                      score {entry.score} · submitted {formatDateLabel(entry.completedAtIso || entry.submittedAtIso)}
                                    </small>
                                    {entry.isNullified && entry.nullifiedReason ? (
                                      <small className="mt-1 block text-[12px] text-[var(--foreground-secondary)]">
                                        nullified reason: {entry.nullifiedReason}
                                      </small>
                                    ) : null}
                                  </div>
                                  <AtlasStatusPill color={entry.isNullified ? SP_COLORS.red : SP_COLORS.deepGreen}>
                                    {entry.isNullified ? 'nullified' : 'active'}
                                  </AtlasStatusPill>
                                </div>
                                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                                  <input
                                    value={nullificationReasonByAnswerId[entry.answerId] || ''}
                                    onChange={(event) =>
                                      setNullificationReasonByAnswerId((current) => ({
                                        ...current,
                                        [entry.answerId]: event.target.value
                                      }))
                                    }
                                    placeholder="reason for nullification (optional)"
                                    className="atlas-admin-input"
                                  />
                                  <AtlasTextButton
                                    onClick={() => void handleSetDomainSurveyNullification(entry.answerId, !entry.isNullified)}
                                    disabled={isSavingZCodeDomainSurveyNullification}
                                    className="px-3 py-2 text-[12px] font-medium"
                                    style={{
                                      ['--button-border-color' as const]: entry.isNullified ? SP_COLORS.deepGreen : SP_COLORS.red,
                                      color: entry.isNullified ? SP_COLORS.deepGreen : SP_COLORS.red,
                                      opacity: isSavingZCodeDomainSurveyNullification ? 0.65 : 1
                                    } as React.CSSProperties}
                                  >
                                    {entry.isNullified ? 'restore answer' : 'nullify answer'}
                                  </AtlasTextButton>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </AtlasInsetCard>
            </div>
          ) : null}

          {activeSection === 'enrollees' ? (
            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <AtlasInsetCard className="rounded-[22px] px-5 py-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[22px] font-medium text-white">Enrollee registry</div>
                    <small className="block text-[13px] text-[var(--foreground-secondary)]">
                      Edit intake-facing fields, assign navigators quickly, and create draft enrollee records before they are formally onboarded.
                    </small>
                  </div>
                  <AtlasTextButton
                    onClick={() => {
                      const id = createPortalId('custom-enrollee')
                      const next = { kind: 'custom' as const, id, record: buildBlankCustomEnrollee(id) }
                      setEnrolleeDraft(next)
                      setSelectedEnrolleeId(next.id)
                    }}
                    className="px-4 py-2 text-[13px] font-medium"
                    style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
                  >
                    new enrollee
                  </AtlasTextButton>
                </div>
                <RecordTable
                  columns={['enrollee', 'navigator', 'source', 'status']}
                  rows={visibleEnrollees.map((row) => ({ id: row.id }))}
                  renderRow={({ id }) => {
                    const row = visibleEnrollees.find((entry) => entry.id === id)
                    if (!row) return null
                    const isSelected = selectedEnrolleeId === row.id
                    const label = row.kind === 'existing' ? row.intake.fullName || row.profile.fullName : row.record.fullName || row.record.caseId || 'untitled draft'
                    const navigatorName = row.kind === 'existing' ? row.intake.assignedNavigator || 'unassigned' : row.record.assignedNavigator || 'unassigned'
                    const source = row.kind === 'existing' ? 'live + intake override' : 'admin draft'
                    const status = row.kind === 'existing' ? 'active' : row.record.status
                    return (
                      <button
                        type="button"
                        className="grid w-full grid-cols-[1.3fr_repeat(3,minmax(0,1fr))] gap-3 px-4 py-3 text-left transition hover:bg-white/5"
                        style={isSelected ? { backgroundColor: 'rgba(252,192,26,0.08)' } : undefined}
                        onClick={() => {
                          setSelectedEnrolleeId(row.id)
                          setEnrolleeDraft(row)
                        }}
                      >
                        <div>
                          <div className="text-[14px] font-medium text-white">{label}</div>
                          <small className="block text-[12px] text-[var(--foreground-secondary)]">
                            {row.kind === 'existing' ? row.intake.caseId || row.profile.caseId : row.record.caseId || 'case id pending'}
                          </small>
                        </div>
                        <div className="text-[13px] text-white">{navigatorName}</div>
                        <div className="text-[13px] text-[var(--foreground-secondary)]">{source}</div>
                        <div>
                          <StatusPill status={status} />
                        </div>
                      </button>
                    )
                  }}
                />
              </AtlasInsetCard>

              <AtlasInsetCard className="rounded-[22px] px-5 py-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[22px] font-medium text-white">Record editor</div>
                    <small className="block text-[13px] text-[var(--foreground-secondary)]">
                      Existing records save through intake overrides. Custom drafts stay inside the admin registry until you operationalize them.
                    </small>
                  </div>
                  {enrolleeDraft ? <StatusPill status={enrolleeDraft.kind === 'existing' ? 'live record' : enrolleeDraft.record.status} /> : null}
                </div>
                {enrolleeDraft ? (
                  <div className="space-y-3">
                    <Field label="full name">
                      <input
                        value={enrolleeDraft.kind === 'existing' ? enrolleeDraft.intake.fullName : enrolleeDraft.record.fullName}
                        onChange={(event) =>
                          setEnrolleeDraft((current) => {
                            if (!current) return current
                            if (current.kind === 'existing') return { ...current, intake: { ...current.intake, fullName: event.target.value } }
                            return { ...current, record: { ...current.record, fullName: event.target.value } }
                          })
                        }
                        className="atlas-admin-input"
                      />
                    </Field>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="date of birth">
                        <input
                          value={enrolleeDraft.kind === 'existing' ? enrolleeDraft.intake.dob : enrolleeDraft.record.dob}
                          onChange={(event) =>
                            setEnrolleeDraft((current) => {
                              if (!current) return current
                              if (current.kind === 'existing') return { ...current, intake: { ...current.intake, dob: event.target.value } }
                              return { ...current, record: { ...current.record, dob: event.target.value } }
                            })
                          }
                          className="atlas-admin-input"
                        />
                      </Field>
                      <Field label="case id">
                        <input
                          value={enrolleeDraft.kind === 'existing' ? enrolleeDraft.intake.caseId : enrolleeDraft.record.caseId}
                          onChange={(event) =>
                            setEnrolleeDraft((current) => {
                              if (!current) return current
                              if (current.kind === 'existing') return { ...current, intake: { ...current.intake, caseId: event.target.value } }
                              return { ...current, record: { ...current.record, caseId: event.target.value } }
                            })
                          }
                          className="atlas-admin-input"
                        />
                      </Field>
                      <Field label="email">
                        <input
                          value={enrolleeDraft.kind === 'existing' ? enrolleeDraft.intake.email : enrolleeDraft.record.email}
                          onChange={(event) =>
                            setEnrolleeDraft((current) => {
                              if (!current) return current
                              if (current.kind === 'existing') return { ...current, intake: { ...current.intake, email: event.target.value } }
                              return { ...current, record: { ...current.record, email: event.target.value } }
                            })
                          }
                          className="atlas-admin-input"
                        />
                      </Field>
                      <Field label="assigned navigator">
                        <select
                          value={enrolleeDraft.kind === 'existing' ? enrolleeDraft.intake.assignedNavigator : enrolleeDraft.record.assignedNavigator}
                          onChange={(event) =>
                            setEnrolleeDraft((current) => {
                              if (!current) return current
                              if (current.kind === 'existing') return { ...current, intake: { ...current.intake, assignedNavigator: event.target.value } }
                              return { ...current, record: { ...current.record, assignedNavigator: event.target.value } }
                            })
                          }
                          className="atlas-admin-input"
                        >
                          <option value="">Unassigned</option>
                          {navigators.map((navigator) => (
                            <option key={navigator.id} value={navigator.fullName}>
                              {navigator.fullName}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <Field label="enrollment start">
                      <input
                        type="date"
                        value={(enrolleeDraft.kind === 'existing' ? enrolleeDraft.intake.enrollmentStartIso : enrolleeDraft.record.enrollmentStartIso).slice(0, 10)}
                        onChange={(event) =>
                          setEnrolleeDraft((current) => {
                            if (!current) return current
                            const nextIso = `${event.target.value || '2026-01-01'}T00:00:00.000Z`
                            if (current.kind === 'existing') return { ...current, intake: { ...current.intake, enrollmentStartIso: nextIso } }
                            return { ...current, record: { ...current.record, enrollmentStartIso: nextIso } }
                          })
                        }
                        className="atlas-admin-input"
                      />
                    </Field>
                    <Field label="z-codes">
                      <div className="space-y-3">
                        <div className="rounded-[18px] border border-white/10 bg-[#111111] px-3 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              {selectedDraftParentCodes.length ? (
                                selectedDraftParentCodes.map((code) => (
                                  <button
                                    key={code}
                                    type="button"
                                    onClick={openZCodePicker}
                                    className="rounded-full"
                                  >
                                    <ZCodeParentFilterCircle parentCode={code} selected />
                                  </button>
                                ))
                              ) : (
                                <button type="button" onClick={openZCodePicker} className="text-[13px] text-[var(--foreground-secondary)]">
                                  click to choose z-codes
                                </button>
                              )}
                            </div>
                            <AtlasTextButton
                              type="button"
                              onClick={openZCodePicker}
                              className="px-[14px] py-[7px] text-[14px]"
                              style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
                            >
                              edit z-codes
                            </AtlasTextButton>
                          </div>
                          <div className="mt-3 text-[12px] text-[var(--foreground-secondary)]">
                            {selectedDraftZCodes.length ? selectedDraftZCodes.join(', ') : 'no z-codes selected'}
                          </div>
                        </div>
                      </div>
                    </Field>
                    {enrolleeDraft.kind === 'custom' ? (
                      <Field label="notes">
                        <textarea
                          value={enrolleeDraft.record.notes}
                          onChange={(event) =>
                            setEnrolleeDraft((current) => (current && current.kind === 'custom' ? { ...current, record: { ...current.record, notes: event.target.value } } : current))
                          }
                          className="atlas-admin-input min-h-[96px] resize-y"
                        />
                      </Field>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <AtlasTextButton
                        onClick={handleSaveEnrolleeDraft}
                        disabled={isSubmittingEnrollee}
                        className="px-4 py-2 text-[13px] font-medium"
                        style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
                      >
                        {isSubmittingEnrollee ? 'saving...' : 'save enrollee'}
                      </AtlasTextButton>
                      <AtlasTextButton
                        onClick={() => void handleArchiveEnrollee(enrolleeDraft)}
                        className="px-4 py-2 text-[13px] font-medium"
                        style={{ ['--button-border-color' as const]: SP_COLORS.red, color: SP_COLORS.red } as React.CSSProperties}
                      >
                        archive record
                      </AtlasTextButton>
                    </div>
                  </div>
                ) : (
                  <small className="text-[13px] text-[var(--foreground-secondary)]">Select an enrollee row or create a new draft to start editing.</small>
                )}
              </AtlasInsetCard>
            </div>
          ) : null}

          {activeSection === 'directory' ? (
            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <AtlasInsetCard className="rounded-[22px] px-5 py-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[22px] font-medium text-white">People and role directory</div>
                    <small className="block text-[13px] text-[var(--foreground-secondary)]">
                      Seeded from live runtime data and extended by the admin registry for invitations, ownership, and reporting structure.
                    </small>
                  </div>
                  <AtlasTextButton
                    onClick={() => setPersonDraft(buildBlankPerson())}
                    className="px-4 py-2 text-[13px] font-medium"
                    style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
                  >
                    new person
                  </AtlasTextButton>
                </div>
                <RecordTable
                  columns={['person', 'roles', 'organization', 'status']}
                  rows={combinedPeople.map((person) => ({ id: person.id }))}
                  renderRow={({ id }) => {
                    const person = combinedPeople.find((entry) => entry.id === id)
                    if (!person) return null
                    return (
                      <button
                        type="button"
                        className="grid w-full grid-cols-[1.3fr_repeat(3,minmax(0,1fr))] gap-3 px-4 py-3 text-left transition hover:bg-white/5"
                        style={selectedPersonId === person.id ? { backgroundColor: 'rgba(252,192,26,0.08)' } : undefined}
                        onClick={() => {
                          setSelectedPersonId(person.id)
                          setPersonDraft(person)
                        }}
                      >
                        <div>
                          <div className="text-[14px] font-medium text-white">{person.fullName || 'unnamed person'}</div>
                          <small className="block text-[12px] text-[var(--foreground-secondary)]">{person.email || 'email pending'}</small>
                        </div>
                        <div className="text-[13px] text-white">{person.roles.join(', ')}</div>
                        <div className="text-[13px] text-[var(--foreground-secondary)]">
                          {combinedOrganizations.find((organization) => organization.id === person.organizationId)?.name || 'unassigned'}
                        </div>
                        <div className="space-y-1">
                          <StatusPill status={person.status} />
                          <small className="block text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-secondary)]">
                            {person.approvalState}
                          </small>
                        </div>
                      </button>
                    )
                  }}
                />
              </AtlasInsetCard>

              <AtlasInsetCard className="rounded-[22px] px-5 py-5">
                <div className="mb-4 text-[22px] font-medium text-white">Directory editor</div>
                {personDraft ? (
                  <div className="space-y-3">
                    <Field label="full name">
                      <input value={personDraft.fullName} onChange={(event) => setPersonDraft({ ...personDraft, fullName: event.target.value })} className="atlas-admin-input" />
                    </Field>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="email">
                        <input
                          value={personDraft.email}
                          onChange={(event) =>
                            setPersonDraft({
                              ...personDraft,
                              email: event.target.value,
                              linkedEmails: Array.from(
                                new Set(
                                  [event.target.value.trim().toLowerCase(), ...personDraft.linkedEmails.map((value) => value.trim().toLowerCase())].filter(Boolean)
                                )
                              )
                            })
                          }
                          className="atlas-admin-input"
                        />
                      </Field>
                      <Field label="title">
                        <input value={personDraft.title} onChange={(event) => setPersonDraft({ ...personDraft, title: event.target.value })} className="atlas-admin-input" />
                      </Field>
                    </div>
                    <Field label="linked emails (comma separated)">
                      <input
                        value={personDraft.linkedEmails.join(', ')}
                        onChange={(event) =>
                          setPersonDraft({
                            ...personDraft,
                            linkedEmails: Array.from(
                              new Set(
                                event.target.value
                                  .split(',')
                                  .map((value) => value.trim().toLowerCase())
                                  .filter(Boolean)
                              )
                            )
                          })
                        }
                        className="atlas-admin-input"
                      />
                    </Field>
                    <Field label="roles">
                      <div className="flex flex-wrap gap-2">
                        {ROLE_OPTIONS.map((role) => {
                          const isActive = personDraft.roles.includes(role)
                          return (
                            <AtlasTextButton
                              key={role}
                              onClick={() =>
                                setPersonDraft((current) =>
                                  current
                                    ? {
                                        ...current,
                                        roles: current.roles.includes(role)
                                          ? current.roles.filter((value) => value !== role)
                                          : [...current.roles, role]
                                      }
                                    : current
                                )
                              }
                              className="px-[14px] py-[7px] text-[14px] font-medium"
                              style={
                                {
                                  ['--button-border-color' as const]: isActive ? SP_COLORS.yellow : '#ffffff25',
                                  color: isActive ? SP_COLORS.yellow : SP_COLORS.white,
                                  backgroundColor: isActive ? 'rgba(252,192,26,0.08)' : 'transparent'
                                } as React.CSSProperties
                              }
                            >
                              {role}
                            </AtlasTextButton>
                          )
                        })}
                      </div>
                    </Field>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="organization">
                        <select
                          value={personDraft.organizationId || ''}
                          onChange={(event) => setPersonDraft({ ...personDraft, organizationId: event.target.value || null })}
                          className="atlas-admin-input"
                        >
                          <option value="">Unassigned</option>
                          {combinedOrganizations.map((organization) => (
                            <option key={organization.id} value={organization.id}>
                              {organization.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="reports to">
                        <select
                          value={personDraft.reportsToPersonId || ''}
                          onChange={(event) => setPersonDraft({ ...personDraft, reportsToPersonId: event.target.value || null })}
                          className="atlas-admin-input"
                        >
                          <option value="">No supervisor</option>
                          {supervisors.filter((person) => person.id !== personDraft.id).map((supervisor) => (
                            <option key={supervisor.id} value={supervisor.id}>
                              {supervisor.fullName}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <Field label="assignment board access">
                      <div className="flex flex-wrap items-center gap-2">
                        <AtlasTextButton
                          onClick={() =>
                            setPersonDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    canViewNavigatorAssignmentNames: !current.canViewNavigatorAssignmentNames,
                                    featurePolicy: {
                                      ...current.featurePolicy,
                                      actionToggles: (() => {
                                        const nextCanView = !current.canViewNavigatorAssignmentNames
                                        const roleDefaultsToAllowed = isCapabilityAllowedForAnyRole(
                                          toAtlasRoles(current.roles),
                                          'actionToggles',
                                          'assignmentBoard.viewNavigatorNames',
                                          undefined
                                        )
                                        if (nextCanView === roleDefaultsToAllowed) {
                                          const next = { ...current.featurePolicy.actionToggles }
                                          delete next['assignmentBoard.viewNavigatorNames']
                                          return next
                                        }
                                        return {
                                          ...current.featurePolicy.actionToggles,
                                          'assignmentBoard.viewNavigatorNames': nextCanView
                                        }
                                      })()
                                    }
                                  }
                                : current
                            )
                          }
                          className="px-[14px] py-[7px] text-[13px] font-medium"
                          style={
                            {
                              ['--button-border-color' as const]: personDraft.canViewNavigatorAssignmentNames ? SP_COLORS.deepGreen : '#ffffff25',
                              color: personDraft.canViewNavigatorAssignmentNames ? SP_COLORS.deepGreen : SP_COLORS.white,
                              backgroundColor: personDraft.canViewNavigatorAssignmentNames ? 'rgba(69,191,85,0.12)' : 'transparent'
                            } as React.CSSProperties
                          }
                        >
                          {personDraft.canViewNavigatorAssignmentNames ? 'navigator names enabled' : 'navigator names disabled'}
                        </AtlasTextButton>
                        <small className="text-[12px] text-[var(--foreground-secondary)]">
                          Allows this user to click assignment-count labels and view assigned navigator names.
                        </small>
                      </div>
                    </Field>
                    <Field label="signup approval">
                      <div className="flex flex-wrap items-center gap-2">
                        <AtlasTextButton
                          onClick={() =>
                            setPersonDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    approvalState: current.approvalState === 'approved' ? 'pending' : 'approved'
                                  }
                                : current
                            )
                          }
                          className="px-[14px] py-[7px] text-[13px] font-medium"
                          style={
                            {
                              ['--button-border-color' as const]:
                                personDraft.approvalState === 'approved' ? SP_COLORS.deepGreen : SP_COLORS.yellow,
                              color: personDraft.approvalState === 'approved' ? SP_COLORS.deepGreen : SP_COLORS.yellow,
                              backgroundColor:
                                personDraft.approvalState === 'approved' ? 'rgba(69,191,85,0.12)' : 'rgba(252,192,26,0.08)'
                            } as React.CSSProperties
                          }
                        >
                          {personDraft.approvalState === 'approved' ? 'approved \u2713' : 'pending approval'}
                        </AtlasTextButton>
                        <small className="text-[12px] text-[var(--foreground-secondary)]">
                          Pending users inherit role defaults; use these toggles only for explicit admin exceptions.
                        </small>
                      </div>
                    </Field>
                    <Field label="feature policy controls">
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <small className="text-[12px] uppercase tracking-[0.08em] text-[var(--foreground-secondary)]">screens</small>
                          <div className="flex flex-wrap gap-2">
                            {ADMIN_POLICY_SCREEN_KEYS.map((key) => {
                              const roleDefaultsToAllowed = isCapabilityAllowedForAnyRole(
                                toAtlasRoles(personDraft.roles),
                                'screenToggles',
                                key,
                                undefined
                              )
                              const isAllowed = isCapabilityAllowedForAnyRole(
                                toAtlasRoles(personDraft.roles),
                                'screenToggles',
                                key,
                                personDraft.featurePolicy.screenToggles
                              )
                              return (
                                <AtlasTextButton
                                  key={key}
                                  onClick={() =>
                                    setPersonDraft((current) =>
                                      current
                                        ? {
                                            ...current,
                                            featurePolicy: {
                                              ...current.featurePolicy,
                                              screenToggles: toggleCapabilityOverride(
                                                current.featurePolicy.screenToggles,
                                                roleDefaultsToAllowed,
                                                key
                                              )
                                            }
                                          }
                                        : current
                                    )
                                  }
                                  className="px-[12px] py-[6px] text-[12px] font-medium"
                                  style={
                                    {
                                      ['--button-border-color' as const]: isAllowed ? SP_COLORS.deepGreen : SP_COLORS.red,
                                      color: isAllowed ? SP_COLORS.deepGreen : SP_COLORS.red,
                                      backgroundColor: isAllowed ? 'rgba(69,191,85,0.12)' : 'rgba(239,68,68,0.1)'
                                    } as React.CSSProperties
                                  }
                                >
                                  {key}: {isAllowed ? 'allow' : 'block'}
                                </AtlasTextButton>
                              )
                            })}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <small className="text-[12px] uppercase tracking-[0.08em] text-[var(--foreground-secondary)]">cards</small>
                          <div className="flex flex-wrap gap-2">
                            {ADMIN_POLICY_CARD_KEYS.map((key) => {
                              const roleDefaultsToAllowed = isCapabilityAllowedForAnyRole(
                                toAtlasRoles(personDraft.roles),
                                'cardToggles',
                                key,
                                undefined
                              )
                              const isAllowed = isCapabilityAllowedForAnyRole(
                                toAtlasRoles(personDraft.roles),
                                'cardToggles',
                                key,
                                personDraft.featurePolicy.cardToggles
                              )
                              return (
                                <AtlasTextButton
                                  key={key}
                                  onClick={() =>
                                    setPersonDraft((current) =>
                                      current
                                        ? {
                                            ...current,
                                            featurePolicy: {
                                              ...current.featurePolicy,
                                              cardToggles: toggleCapabilityOverride(
                                                current.featurePolicy.cardToggles,
                                                roleDefaultsToAllowed,
                                                key
                                              )
                                            }
                                          }
                                        : current
                                    )
                                  }
                                  className="px-[12px] py-[6px] text-[12px] font-medium"
                                  style={
                                    {
                                      ['--button-border-color' as const]: isAllowed ? SP_COLORS.deepGreen : SP_COLORS.red,
                                      color: isAllowed ? SP_COLORS.deepGreen : SP_COLORS.red,
                                      backgroundColor: isAllowed ? 'rgba(69,191,85,0.12)' : 'rgba(239,68,68,0.1)'
                                    } as React.CSSProperties
                                  }
                                >
                                  {key}: {isAllowed ? 'allow' : 'block'}
                                </AtlasTextButton>
                              )
                            })}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <small className="text-[12px] uppercase tracking-[0.08em] text-[var(--foreground-secondary)]">actions</small>
                          <div className="flex flex-wrap gap-2">
                            {ADMIN_POLICY_ACTION_KEYS.map((key) => {
                              const roleDefaultsToAllowed = isCapabilityAllowedForAnyRole(
                                toAtlasRoles(personDraft.roles),
                                'actionToggles',
                                key,
                                undefined
                              )
                              const isAllowed = isCapabilityAllowedForAnyRole(
                                toAtlasRoles(personDraft.roles),
                                'actionToggles',
                                key,
                                personDraft.featurePolicy.actionToggles
                              )
                              return (
                                <AtlasTextButton
                                  key={key}
                                  onClick={() =>
                                    setPersonDraft((current) =>
                                      current
                                        ? {
                                            ...current,
                                            featurePolicy: {
                                              ...current.featurePolicy,
                                              actionToggles: toggleCapabilityOverride(
                                                current.featurePolicy.actionToggles,
                                                roleDefaultsToAllowed,
                                                key
                                              )
                                            }
                                          }
                                        : current
                                    )
                                  }
                                  className="px-[12px] py-[6px] text-[12px] font-medium"
                                  style={
                                    {
                                      ['--button-border-color' as const]: isAllowed ? SP_COLORS.deepGreen : SP_COLORS.red,
                                      color: isAllowed ? SP_COLORS.deepGreen : SP_COLORS.red,
                                      backgroundColor: isAllowed ? 'rgba(69,191,85,0.12)' : 'rgba(239,68,68,0.1)'
                                    } as React.CSSProperties
                                  }
                                >
                                  {key}: {isAllowed ? 'allow' : 'block'}
                                </AtlasTextButton>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </Field>
                    <Field label="status">
                      <select
                        value={personDraft.status}
                        onChange={(event) =>
                          setPersonDraft({
                            ...personDraft,
                            status: event.target.value as AdminPortalPersonRecord['status']
                          })
                        }
                        className="atlas-admin-input"
                      >
                        <option value="active">active</option>
                        <option value="invited">invited</option>
                        <option value="inactive">inactive</option>
                      </select>
                    </Field>
                    <Field label="notes">
                      <textarea
                        value={personDraft.notes}
                        onChange={(event) => setPersonDraft({ ...personDraft, notes: event.target.value })}
                        className="atlas-admin-input min-h-[96px] resize-y"
                      />
                    </Field>
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <AtlasTextButton
                        onClick={() => void handleSavePersonDraft()}
                        className="px-4 py-2 text-[13px] font-medium"
                        style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
                      >
                        save person
                      </AtlasTextButton>
                      <AtlasTextButton
                        onClick={() => void handleDeletePerson(personDraft)}
                        className="px-4 py-2 text-[13px] font-medium"
                        style={{ ['--button-border-color' as const]: SP_COLORS.red, color: SP_COLORS.red } as React.CSSProperties}
                      >
                        delete person
                      </AtlasTextButton>
                    </div>
                  </div>
                ) : (
                  <small className="text-[13px] text-[var(--foreground-secondary)]">Select a directory row or create a new person to edit role coverage.</small>
                )}
              </AtlasInsetCard>
            </div>
          ) : null}

          {activeSection === 'organizations' ? (
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <AtlasInsetCard className="rounded-[22px] px-5 py-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[22px] font-medium text-white">Organization registry</div>
                    <small className="block text-[13px] text-[var(--foreground-secondary)]">
                      Keep partner, county, and internal organizations cleanly attributed with primary contacts and member counts.
                    </small>
                  </div>
                  <AtlasTextButton
                    onClick={() => setOrganizationDraft(buildBlankOrganization())}
                    className="px-4 py-2 text-[13px] font-medium"
                    style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
                  >
                    new organization
                  </AtlasTextButton>
                </div>
                <RecordTable
                  columns={['organization', 'type', 'primary contact', 'status']}
                  rows={combinedOrganizations.map((organization) => ({ id: organization.id }))}
                  renderRow={({ id }) => {
                    const organization = combinedOrganizations.find((entry) => entry.id === id)
                    if (!organization) return null
                    const contact = combinedPeople.find((person) => person.id === organization.primaryContactPersonId)
                    return (
                      <button
                        type="button"
                        className="grid w-full grid-cols-[1.3fr_repeat(3,minmax(0,1fr))] gap-3 px-4 py-3 text-left transition hover:bg-white/5"
                        style={selectedOrganizationId === organization.id ? { backgroundColor: 'rgba(252,192,26,0.08)' } : undefined}
                        onClick={() => {
                          setSelectedOrganizationId(organization.id)
                          setOrganizationDraft(organization)
                        }}
                      >
                        <div>
                          <div className="text-[14px] font-medium text-white">{organization.name}</div>
                          <small className="block text-[12px] text-[var(--foreground-secondary)]">{organization.countyName || 'county not set'}</small>
                        </div>
                        <div className="text-[13px] text-white">{organization.type}</div>
                        <div className="text-[13px] text-[var(--foreground-secondary)]">{contact?.fullName || 'unassigned'}</div>
                        <div>
                          <StatusPill status={organization.status} />
                        </div>
                      </button>
                    )
                  }}
                />
              </AtlasInsetCard>

              <AtlasInsetCard className="rounded-[22px] px-5 py-5">
                <div className="mb-4 text-[22px] font-medium text-white">Organization editor</div>
                {organizationDraft ? (
                  <div className="space-y-3">
                    <Field label="name">
                      <input value={organizationDraft.name} onChange={(event) => setOrganizationDraft({ ...organizationDraft, name: event.target.value })} className="atlas-admin-input" />
                    </Field>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="type">
                        <select
                          value={organizationDraft.type}
                          onChange={(event) =>
                            setOrganizationDraft({
                              ...organizationDraft,
                              type: event.target.value as AdminPortalOrganizationRecord['type']
                            })
                          }
                          className="atlas-admin-input"
                        >
                          {ORG_TYPE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="county">
                        <input value={organizationDraft.countyName} onChange={(event) => setOrganizationDraft({ ...organizationDraft, countyName: event.target.value })} className="atlas-admin-input" />
                      </Field>
                    </div>
                    <Field label="primary contact">
                      <select
                        value={organizationDraft.primaryContactPersonId || ''}
                        onChange={(event) => setOrganizationDraft({ ...organizationDraft, primaryContactPersonId: event.target.value || null })}
                        className="atlas-admin-input"
                      >
                        <option value="">Unassigned</option>
                        {combinedPeople.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.fullName}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="status">
                      <select
                        value={organizationDraft.status}
                        onChange={(event) =>
                          setOrganizationDraft({
                            ...organizationDraft,
                            status: event.target.value as AdminPortalOrganizationRecord['status']
                          })
                        }
                        className="atlas-admin-input"
                      >
                        <option value="active">active</option>
                        <option value="draft">draft</option>
                        <option value="inactive">inactive</option>
                      </select>
                    </Field>
                    <Field label="notes">
                      <textarea
                        value={organizationDraft.notes}
                        onChange={(event) => setOrganizationDraft({ ...organizationDraft, notes: event.target.value })}
                        className="atlas-admin-input min-h-[96px] resize-y"
                      />
                    </Field>
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <AtlasTextButton
                        onClick={() => void handleSaveOrganizationDraft()}
                        className="px-4 py-2 text-[13px] font-medium"
                        style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
                      >
                        save organization
                      </AtlasTextButton>
                      <AtlasTextButton
                        onClick={() => void handleDeleteOrganization(organizationDraft)}
                        className="px-4 py-2 text-[13px] font-medium"
                        style={{ ['--button-border-color' as const]: SP_COLORS.red, color: SP_COLORS.red } as React.CSSProperties}
                      >
                        delete organization
                      </AtlasTextButton>
                    </div>
                  </div>
                ) : (
                  <small className="text-[13px] text-[var(--foreground-secondary)]">Select an organization row or create a new one to define ownership.</small>
                )}
              </AtlasInsetCard>
            </div>
          ) : null}

          {activeSection === 'relationships' ? (
            <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <AtlasInsetCard className="rounded-[22px] px-5 py-5">
                <div className="mb-4 text-[22px] font-medium text-white">Supervisor to navigator</div>
                <div className="space-y-3">
                  {navigators.map((navigator) => (
                    <div key={navigator.id} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-[15px] font-medium text-white">{navigator.fullName}</div>
                          <small className="text-[12px] text-[var(--foreground-secondary)]">{navigator.title || 'navigator'}</small>
                        </div>
                        <select
                          value={navigator.reportsToPersonId || ''}
                          onChange={(event) => void handlePersonSupervisorAssignment(navigator.id, event.target.value || null)}
                          className="atlas-admin-input min-w-[220px]"
                        >
                          <option value="">No supervisor</option>
                          {supervisors.filter((supervisor) => supervisor.id !== navigator.id).map((supervisor) => (
                            <option key={supervisor.id} value={supervisor.id}>
                              {supervisor.fullName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                  {!navigators.length ? <small className="text-[13px] text-[var(--foreground-secondary)]">Add navigators in the directory tab to begin building reporting lines.</small> : null}
                </div>
              </AtlasInsetCard>

              <AtlasInsetCard className="rounded-[22px] px-5 py-5">
                <div className="mb-4 text-[22px] font-medium text-white">Navigator to enrollee coverage</div>
                <div className="space-y-3">
                  {visibleEnrollees.map((row) => {
                    const label = row.kind === 'existing' ? row.intake.fullName || row.profile.fullName : row.record.fullName || row.record.caseId || 'untitled enrollee'
                    const assignment =
                      row.kind === 'existing' && row.profile.enrollmentId
                        ? accessMatrixDataset?.enrollmentAssignments.find(
                            (entry) => entry.enrollmentId === row.profile.enrollmentId
                          ) || null
                        : null
                    const selectedNavigatorIds = assignment?.navigatorPersonIds || []
                    return (
                      <div key={row.id} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-[15px] font-medium text-white">{label}</div>
                            <small className="text-[12px] text-[var(--foreground-secondary)]">
                              {row.kind === 'existing' ? row.intake.caseId || row.profile.caseId : row.record.caseId || 'case id pending'}
                            </small>
                          </div>
                          {row.kind === 'existing' ? (
                            <select
                              multiple
                              value={selectedNavigatorIds}
                              onChange={(event) =>
                                void handleNavigatorCoverageSelection(
                                  row,
                                  Array.from(event.target.selectedOptions).map((option) => option.value)
                                )
                              }
                              className="atlas-admin-input min-h-[102px] min-w-[280px]"
                            >
                              {navigatorCoverageOptions.map((navigator) => (
                                <option key={navigator.id} value={navigator.id}>
                                  {navigator.label}
                                  {navigator.email ? ` (${navigator.email})` : ''}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <select
                              value={row.record.assignedNavigator}
                              onChange={(event) => void handleNavigatorAssignment(row, event.target.value)}
                              className="atlas-admin-input min-w-[220px]"
                            >
                              <option value="">Unassigned</option>
                              {navigatorCoverageOptions.map((navigator) => (
                                <option key={navigator.id} value={navigator.label}>
                                  {navigator.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        {row.kind === 'existing' ? (
                          <small className="mt-2 block text-[12px] text-[var(--foreground-secondary)]">
                            Multi-select enabled. Hold Command/Ctrl to toggle multiple navigators quickly.
                          </small>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </AtlasInsetCard>

              <AtlasInsetCard className="rounded-[22px] px-5 py-5 xl:col-span-2">
                <div className="mb-4 text-[22px] font-medium text-white">Organization ownership map</div>
                <div className="space-y-3">
                  {combinedPeople.map((person) => (
                    <div key={person.id} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-[15px] font-medium text-white">{person.fullName}</div>
                          <small className="text-[12px] text-[var(--foreground-secondary)]">{person.roles.join(', ') || 'no roles assigned'}</small>
                        </div>
                        <select
                          value={person.organizationId || ''}
                          onChange={(event) => void handlePersonOrganizationAssignment(person.id, event.target.value || null)}
                          className="atlas-admin-input min-w-[220px]"
                        >
                          <option value="">No organization</option>
                          {combinedOrganizations.map((organization) => (
                            <option key={organization.id} value={organization.id}>
                              {organization.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </AtlasInsetCard>
            </div>
          ) : null}

          {activeSection === 'assessments' ? (
            <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <AtlasInsetCard className="rounded-[22px] px-5 py-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[22px] font-medium text-white">Interval assessment rules</div>
                    <small className="block text-[13px] text-[var(--foreground-secondary)]">
                      Define cadence, assignee scope, and rule metadata that drive recurring navigator assessments and supervision workflows.
                    </small>
                  </div>
                  <AtlasTextButton
                    onClick={() => setIntervalRuleDraft(buildBlankIntervalAssessmentRule())}
                    className="px-4 py-2 text-[13px] font-medium"
                    style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
                  >
                    new rule
                  </AtlasTextButton>
                </div>
                <div className="space-y-3">
                  {navigatorProgramState.intervalAssessmentRules.map((rule) => (
                    <button
                      key={rule.id}
                      type="button"
                      className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
                      onClick={() => setIntervalRuleDraft(rule)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[15px] font-medium text-white">{rule.title || 'Untitled rule'}</div>
                          <small className="block text-[12px] text-[var(--foreground-secondary)]">
                            {rule.assessmentType} · {rule.cadence} · {rule.navigatorName || 'all navigators'}
                          </small>
                        </div>
                        <StatusPill status={rule.isActive ? 'active' : 'inactive'} />
                      </div>
                    </button>
                  ))}
                  {!navigatorProgramState.intervalAssessmentRules.length ? (
                    <small className="text-[13px] text-[var(--foreground-secondary)]">No interval rules configured yet.</small>
                  ) : null}
                </div>
              </AtlasInsetCard>

              <AtlasInsetCard className="rounded-[22px] px-5 py-5">
                <div className="mb-4 text-[22px] font-medium text-white">Rule editor</div>
                {intervalRuleDraft ? (
                  <div className="space-y-3">
                    <Field label="title">
                      <input
                        value={intervalRuleDraft.title}
                        onChange={(event) => setIntervalRuleDraft({ ...intervalRuleDraft, title: event.target.value })}
                        className="atlas-admin-input"
                      />
                    </Field>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="assessment type">
                        <select
                          value={intervalRuleDraft.assessmentType}
                          onChange={(event) =>
                            setIntervalRuleDraft({
                              ...intervalRuleDraft,
                              assessmentType: event.target.value as IntervalAssessmentRule['assessmentType']
                            })
                          }
                          className="atlas-admin-input"
                        >
                          <option value="navigator_self_assessment">navigator self assessment</option>
                          <option value="navigator_competency_review">navigator competency review</option>
                          <option value="supervision_session">supervision session</option>
                        </select>
                      </Field>
                      <Field label="cadence">
                        <select
                          value={intervalRuleDraft.cadence}
                          onChange={(event) =>
                            setIntervalRuleDraft({
                              ...intervalRuleDraft,
                              cadence: event.target.value as IntervalAssessmentRule['cadence']
                            })
                          }
                          className="atlas-admin-input"
                        >
                          <option value="weekly">weekly</option>
                          <option value="monthly">monthly</option>
                          <option value="quarterly">quarterly</option>
                        </select>
                      </Field>
                      <Field label="assignee role">
                        <select
                          value={intervalRuleDraft.assigneeRole}
                          onChange={(event) =>
                            setIntervalRuleDraft({
                              ...intervalRuleDraft,
                              assigneeRole: event.target.value as IntervalAssessmentRule['assigneeRole']
                            })
                          }
                          className="atlas-admin-input"
                        >
                          <option value="navigator">navigator</option>
                          <option value="supervisor">supervisor</option>
                        </select>
                      </Field>
                      <Field label="navigator scope">
                        <input
                          value={intervalRuleDraft.navigatorName || ''}
                          onChange={(event) => setIntervalRuleDraft({ ...intervalRuleDraft, navigatorName: event.target.value || null })}
                          className="atlas-admin-input"
                          placeholder="Leave blank for all navigators"
                        />
                      </Field>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="starts at">
                        <input
                          type="date"
                          value={intervalRuleDraft.startsAtIso.slice(0, 10)}
                          onChange={(event) =>
                            setIntervalRuleDraft({
                              ...intervalRuleDraft,
                              startsAtIso: `${event.target.value || '2026-01-01'}T00:00:00.000Z`
                            })
                          }
                          className="atlas-admin-input"
                        />
                      </Field>
                      <Field label="weekday">
                        <select
                          value={intervalRuleDraft.weekday ?? ''}
                          onChange={(event) =>
                            setIntervalRuleDraft({
                              ...intervalRuleDraft,
                              weekday: event.target.value ? Number(event.target.value) : null
                            })
                          }
                          className="atlas-admin-input"
                        >
                          <option value="">not weekday-bound</option>
                          <option value="1">monday</option>
                          <option value="2">tuesday</option>
                          <option value="3">wednesday</option>
                          <option value="4">thursday</option>
                          <option value="5">friday</option>
                        </select>
                      </Field>
                    </div>
                    <Field label="instructions">
                      <textarea
                        value={intervalRuleDraft.instructions}
                        onChange={(event) => setIntervalRuleDraft({ ...intervalRuleDraft, instructions: event.target.value })}
                        className="atlas-admin-input min-h-[96px] resize-y"
                      />
                    </Field>
                    <label className="flex items-center gap-2 text-[13px] text-white">
                      <input
                        type="checkbox"
                        checked={intervalRuleDraft.isActive}
                        onChange={(event) => setIntervalRuleDraft({ ...intervalRuleDraft, isActive: event.target.checked })}
                      />
                      active rule
                    </label>
                    <div className="flex justify-end">
                      <AtlasTextButton
                        onClick={() => void handleSaveIntervalRule()}
                        className="px-4 py-2 text-[13px] font-medium"
                        style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
                      >
                        save rule
                      </AtlasTextButton>
                    </div>
                  </div>
                ) : (
                  <small className="text-[13px] text-[var(--foreground-secondary)]">Select a rule or create a new one to edit interval cadence.</small>
                )}
              </AtlasInsetCard>

              <AtlasInsetCard className="rounded-[22px] px-5 py-5 xl:col-span-2">
                <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
                  <div>
                    <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">due monitor</small>
                    <div className="mt-1 text-[22px] font-medium text-white">Open and completed items</div>
                  </div>
                  <AtlasMetricPill
                    label="open due items"
                    value={navigatorIntervalDueItems.filter((item) => item.status === 'open').length}
                    accentColor={SP_COLORS.red}
                    className="rounded-[18px]"
                  />
                  <AtlasMetricPill
                    label="completed due items"
                    value={navigatorIntervalDueItems.filter((item) => item.status === 'completed').length}
                    accentColor={SP_COLORS.deepGreen}
                    className="rounded-[18px]"
                  />
                </div>
                <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                  <div className="space-y-3">
                    {navigatorIntervalDueItems.map((item) => (
                      <div key={item.id} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[15px] font-medium text-white">{item.title}</div>
                            <small className="block text-[12px] text-[var(--foreground-secondary)]">
                              {item.navigatorName || 'all navigators'} · due {formatDateLabel(item.dueAtIso)} · {item.cadence}
                            </small>
                          </div>
                          <StatusPill status={item.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <AtlasInsetCard className="rounded-[18px] px-4 py-4">
                      <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">pickup queue watch</small>
                      <div className="mt-1 text-[22px] font-medium text-white">Unassigned intake pool</div>
                      <div className="mt-3 space-y-2">
                        {navigatorProgramState.pickupQueue.slice(0, 5).map((item) => (
                          <div key={item.id} className="rounded-[14px] border border-white/10 bg-white/5 px-3 py-2">
                            <div className="text-[14px] font-medium text-white">{item.fullName}</div>
                            <small className="block text-[12px] text-[var(--foreground-secondary)]">
                              {item.referrerOrganization} · {formatDateLabel(item.referredAtIso)} · {item.status}
                            </small>
                          </div>
                        ))}
                      </div>
                    </AtlasInsetCard>
                    <AtlasInsetCard className="rounded-[18px] px-4 py-4">
                      <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">submission watch</small>
                      <div className="mt-1 text-[22px] font-medium text-white">Navigator signal volume</div>
                      <div className="mt-3 grid grid-cols-3 gap-3">
                        <AtlasMetricPill label="self assessments" value={navigatorProgramState.selfAssessments.length} accentColor={SP_COLORS.yellow} className="rounded-[16px]" />
                        <AtlasMetricPill label="supervision notes" value={navigatorProgramState.supervisionSessions.length} accentColor={SP_COLORS.blue} className="rounded-[16px]" />
                        <AtlasMetricPill label="competency reviews" value={supervisorNavigatorCompetency.reduce((sum, item) => sum + item.assessmentCount, 0)} accentColor={SP_COLORS.deepGreen} className="rounded-[16px]" />
                      </div>
                    </AtlasInsetCard>
                  </div>
                </div>
              </AtlasInsetCard>
            </div>
          ) : null}
          {activeSection === 'permissions' ? (
            <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <AtlasInsetCard className="rounded-[22px] px-5 py-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
                      exception posture
                    </small>
                    <div className="mt-1 text-[22px] font-medium text-white">Person-level permission overrides</div>
                    <small className="mt-1 block text-[13px] text-[var(--foreground-secondary)]">
                      Role defaults stay uniform; this panel tracks only explicit exceptions set by administrators.
                    </small>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <AtlasMetricPill
                    label="users with exceptions"
                    value={permissionExceptionRows.length}
                    accentColor={SP_COLORS.yellow}
                    className="rounded-[18px]"
                  />
                  <AtlasMetricPill
                    label="total exception entries"
                    value={totalPermissionExceptionCount}
                    accentColor={SP_COLORS.red}
                    className="rounded-[18px]"
                  />
                </div>
                <small className="mt-4 block text-[12px] text-[var(--foreground-secondary)]">
                  Use clear actions to return users to role baseline access when temporary exceptions are no longer needed.
                </small>
              </AtlasInsetCard>
              <AtlasInsetCard className="rounded-[22px] px-5 py-5">
                <div className="mb-4 text-[22px] font-medium text-white">Exception ledger</div>
                <div className="space-y-3">
                  {permissionExceptionRows.map((row) => (
                    <div key={row.person.id} className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-[15px] font-medium text-white">{row.person.fullName || row.person.email || row.person.id}</div>
                          <small className="block text-[12px] text-[var(--foreground-secondary)]">
                            {row.person.email || 'no email'} · {row.roles.join(', ') || 'no atlas roles'} · {row.entries.length} exception
                            {row.entries.length === 1 ? '' : 's'}
                          </small>
                        </div>
                        <AtlasTextButton
                          onClick={() => void handleClearPersonPermissionExceptions(row.person)}
                          className="px-3 py-2 text-[12px] font-medium"
                          style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
                        >
                          clear exceptions
                        </AtlasTextButton>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {row.entries.map((entry) => (
                          <span
                            key={entry.id}
                            className="rounded-full border px-2 py-1 text-[11px] leading-none"
                            style={{
                              borderColor: entry.kind === 'allow' ? 'rgba(69,191,85,0.45)' : 'rgba(255,92,92,0.45)',
                              color: entry.kind === 'allow' ? SP_COLORS.deepGreen : SP_COLORS.red
                            }}
                          >
                            {entry.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!permissionExceptionRows.length ? (
                    <small className="text-[13px] text-[var(--foreground-secondary)]">
                      No person-level exceptions are set. All users currently inherit role defaults.
                    </small>
                  ) : null}
                </div>
              </AtlasInsetCard>
            </div>
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
