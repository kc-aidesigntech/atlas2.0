import { useMemo } from 'react'
import type {
  AccessMatrixDataset,
  AdminPortalOrganizationRecord,
  AdminPortalPersonRecord,
  AdminPortalRegistry,
  EnrolleeIntakeRecord,
  EnrolleeProfile,
  SupervisorNavigatorCompetencySummary
} from '@/features/atlas2026/shared/contracts'
import {
  ADMIN_POLICY_ACTION_KEYS,
  ADMIN_POLICY_CARD_KEYS,
  ADMIN_POLICY_SCREEN_KEYS,
  isCapabilityAllowedForAnyRole
} from '@/features/atlas2026/shared/roleCapabilityPolicy'
import type { CombinedEnrolleeRow, NavigatorCoverageOption, PermissionExceptionRow } from './types'
import {
  buildExistingEnrolleeIntake,
  createDefaultFeaturePolicy,
  createSeedOrganizationId,
  createSeedPersonId,
  getEmptyRegistry,
  hasCapabilityOverride,
  mergeById,
  toAtlasRoles
} from './adminDataControlPanelModel'

interface AdminRegistryViewModelInput {
  registry: AdminPortalRegistry | null
  accountSettings: { fullName: string; email: string; organization: string }
  accessMatrixDataset: AccessMatrixDataset | null
  enrollees: EnrolleeProfile[]
  intakeFormsByEnrolleeId: Record<string, EnrolleeIntakeRecord>
  supervisorNavigatorCompetency: SupervisorNavigatorCompetencySummary[]
}

// Merge seeded operational records with persisted admin edits in one place so all
// sections consume the same identity, archive, and permission semantics.
export function useAdminRegistryViewModel({
  registry,
  accountSettings,
  accessMatrixDataset,
  enrollees,
  intakeFormsByEnrolleeId,
  supervisorNavigatorCompetency
}: AdminRegistryViewModelInput) {
  const effectiveRegistry = registry || getEmptyRegistry()
  const seedOrganizations = useMemo<AdminPortalOrganizationRecord[]>(() => {
    if (!accountSettings.organization.trim()) return []
    return [{
      id: createSeedOrganizationId(accountSettings.organization),
      name: accountSettings.organization,
      type: 'internal',
      countyName: '',
      primaryContactPersonId: createSeedPersonId(accountSettings.fullName || 'atlas operator'),
      status: 'active',
      notes: 'Seeded from the current administrator account context.'
    }]
  }, [accountSettings.fullName, accountSettings.organization])

  const seedPeople = useMemo<AdminPortalPersonRecord[]>(() => {
    const rows: AdminPortalPersonRecord[] = []
    const seenIds = new Set<string>()
    const seenEmails = new Set<string>()
    const register = (person: AdminPortalPersonRecord) => {
      const email = person.email.trim().toLowerCase()
      if (seenIds.has(person.id) || (email && seenEmails.has(email))) return
      rows.push(person)
      seenIds.add(person.id)
      if (email) seenEmails.add(email)
    }
    if (accountSettings.fullName.trim() || accountSettings.email.trim()) {
      const id = createSeedPersonId(accountSettings.fullName || accountSettings.email || 'atlas operator')
      register({
        id,
        fullName: accountSettings.fullName || 'atlas operator',
        email: accountSettings.email,
        title: 'System administrator',
        roles: ['administrator'],
        canViewNavigatorAssignmentNames: true,
        approvalState: 'approved',
        identityGroupId: id,
        linkedEmails: accountSettings.email ? [accountSettings.email.trim().toLowerCase()] : [],
        featurePolicy: createDefaultFeaturePolicy(),
        organizationId: accountSettings.organization.trim() ? createSeedOrganizationId(accountSettings.organization) : null,
        reportsToPersonId: null,
        linkedEnrolleeId: null,
        status: 'active',
        notes: 'Seeded from account settings.'
      })
    }
    accessMatrixDataset?.people.forEach((person) => register({
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
    }))
    const navigatorNames = new Set([
      ...enrollees.map((enrollee) => enrollee.assignedNavigator),
      ...supervisorNavigatorCompetency.map((summary) => summary.navigatorName)
    ].map((value) => value.trim()).filter(Boolean))
    navigatorNames.forEach((name) => register({
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
    }))
    return rows
  }, [accessMatrixDataset, accountSettings, enrollees, supervisorNavigatorCompetency])

  const combinedOrganizations = useMemo(
    () => mergeById(seedOrganizations, effectiveRegistry.organizations, effectiveRegistry.archivedOrganizationIds),
    [effectiveRegistry.archivedOrganizationIds, effectiveRegistry.organizations, seedOrganizations]
  )
  const combinedPeople = useMemo(
    () => mergeById(seedPeople, effectiveRegistry.people, effectiveRegistry.archivedPersonIds),
    [effectiveRegistry.archivedPersonIds, effectiveRegistry.people, seedPeople]
  )
  const visibleEnrollees = useMemo<CombinedEnrolleeRow[]>(() => {
    // User Experience (UX) presents live and admin-authored records together while
    // preserving source kind for the correct save path.
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
      .map((record) => ({ kind: 'custom' as const, id: record.enrolleeId, record }))
    return [...existingRows, ...customRows]
  }, [effectiveRegistry, enrollees, intakeFormsByEnrolleeId])

  const navigators = useMemo(() => combinedPeople.filter((person) => person.roles.includes('navigator')), [combinedPeople])
  const supervisors = useMemo(
    () => combinedPeople.filter((person) => person.roles.includes('supervisor') || person.roles.includes('administrator')),
    [combinedPeople]
  )
  const navigatorCoverageOptions = useMemo<NavigatorCoverageOption[]>(
    () => (accessMatrixDataset?.people || [])
      .filter((person) => person.roleKeys.includes('navigator'))
      .map((person) => ({
        id: person.id,
        label: person.fullName.trim() || person.email.trim() || person.id,
        email: person.email.trim()
      }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    [accessMatrixDataset?.people]
  )
  const permissionExceptionRows = useMemo<PermissionExceptionRow[]>(() => combinedPeople
    .map((person) => {
      const roles = toAtlasRoles(person.roles)
      const baseline = isCapabilityAllowedForAnyRole(
        roles, 'actionToggles', 'assignmentBoard.viewNavigatorNames', undefined
      )
      const entries: PermissionExceptionRow['entries'] = []
      const collect = (scope: 'screen' | 'card' | 'action', keys: readonly string[], overrides: Record<string, boolean>) => {
        keys.forEach((key) => {
          if (!hasCapabilityOverride(overrides, key)) return
          const allowed = Boolean(overrides[key])
          entries.push({ id: `${scope}:${key}`, label: `${scope} ${key} -> ${allowed ? 'allow' : 'block'}`, kind: allowed ? 'allow' : 'block' })
        })
      }
      collect('screen', ADMIN_POLICY_SCREEN_KEYS, person.featurePolicy.screenToggles)
      collect('card', ADMIN_POLICY_CARD_KEYS, person.featurePolicy.cardToggles)
      collect('action', ADMIN_POLICY_ACTION_KEYS, person.featurePolicy.actionToggles)
      if (person.canViewNavigatorAssignmentNames !== baseline) {
        entries.push({
          id: 'legacy:assignmentBoard.viewNavigatorNames',
          label: `legacy navigator-name visibility -> ${person.canViewNavigatorAssignmentNames ? 'allow' : 'block'}`,
          kind: person.canViewNavigatorAssignmentNames ? 'allow' : 'block'
        })
      }
      return entries.length ? { person, roles, entries } : null
    })
    .filter((row): row is PermissionExceptionRow => Boolean(row))
    .sort((left, right) => right.entries.length - left.entries.length), [combinedPeople])

  return {
    effectiveRegistry,
    combinedOrganizations,
    combinedPeople,
    visibleEnrollees,
    navigators,
    supervisors,
    navigatorCoverageOptions,
    permissionExceptionRows,
    totalPermissionExceptionCount: permissionExceptionRows.reduce((sum, row) => sum + row.entries.length, 0)
  }
}
