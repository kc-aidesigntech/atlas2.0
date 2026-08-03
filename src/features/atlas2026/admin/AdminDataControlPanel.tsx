import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import AdminDataControlPanelFrame from '@/features/atlas2026/admin/components/AdminDataControlPanelFrame'
import AdminZCodePickerOverlay from '@/features/atlas2026/admin/components/AdminZCodePickerOverlay'
import { useAdminRegistryViewModel } from '@/features/atlas2026/admin/components/useAdminRegistryViewModel'
import AdminEnrolleesSection from '@/features/atlas2026/admin/components/AdminEnrolleesSection'
import AdminOverviewSection from '@/features/atlas2026/admin/components/AdminOverviewSection'
import AdminDirectorySection from '@/features/atlas2026/admin/components/AdminDirectorySection'
import AdminOrganizationsSection from '@/features/atlas2026/admin/components/AdminOrganizationsSection'
import AdminRelationshipsSection from '@/features/atlas2026/admin/components/AdminRelationshipsSection'
import AdminAssessmentsSection from '@/features/atlas2026/admin/components/AdminAssessmentsSection'
import AdminPermissionsSection from '@/features/atlas2026/admin/components/AdminPermissionsSection'
import type { CombinedEnrolleeRow, RegulationReviewRosterRow } from '@/features/atlas2026/admin/components/types'
import {
  ADMIN_ACTIVE_SECTION_KEY, ADMIN_SELECTED_ENROLLEE_KEY, ADMIN_SELECTED_ORGANIZATION_KEY,
  ADMIN_SELECTED_PERSON_KEY, ADMIN_Z_CODE_OPTIONS, ADMIN_Z_CODE_PARENT_CODES,
  CUSTOM_ENROLLEE_STATUS_OPTIONS, ORG_TYPE_OPTIONS, ROLE_OPTIONS, buildBlankCustomEnrollee,
  buildBlankIntervalAssessmentRule, buildBlankOrganization, buildBlankPerson, createPortalId,
  formatDateLabel, formatMetricLabel, readAdminSessionValue, toAtlasRoles, writeAdminSessionValue,
  type AdminDataControlPanelProps, type AdminPortalSection
} from '@/features/atlas2026/admin/components/adminDataControlPanelModel'
import { Field, RecordTable, StatusPill, ZCodeParentFilterCircle } from '@/features/atlas2026/admin/components/AdminControlPanelPrimitives'
import type { AdminPortalOrganizationRecord, AdminPortalPersonRecord, AdminPortalRegistry, IntervalAssessmentRule, RegulationReviewSettings } from '@/features/atlas2026/shared/contracts'
import { ADMIN_POLICY_ACTION_KEYS, ADMIN_POLICY_CARD_KEYS, ADMIN_POLICY_SCREEN_KEYS, isCapabilityAllowedForAnyRole, toggleCapabilityOverride } from '@/features/atlas2026/shared/roleCapabilityPolicy'

export default function AdminDataControlPanel(props: AdminDataControlPanelProps) {
  const {
    metrics, zCodeDomainSurveyHistorySummary, deletableServiceCapacitySubmissions,
    isLoadingDeletableServiceCapacitySubmissions, deletingServiceCapacitySubmissionId, serviceCapacityDeletionError,
    isLoadingZCodeDomainSurveyHistorySummary, isSavingZCodeDomainSurveyNullification, zCodeDomainSurveyHistoryError,
    enrollees, intakeFormsByEnrolleeId, selectedEnrollee, accountSettings, enrollmentRequests,
    supervisorNavigatorCompetency, navigatorProgramState, navigatorIntervalDueItems, regulationReviewSettings,
    regulationReviewDueItems, regulationReviewError, onSaveRegulationReviewSettings, accessMatrixDataset,
    registry, isSavingRegistry, registryError, onSaveRegistry, onSetZCodeDomainSurveyAnswerNullification,
    onDeleteServiceCapacitySubmission, requestedDomainSurveyZCode, onAcknowledgeRequestedDomainSurveyZCode,
    onSaveEnrollmentNavigators, onSaveIntervalAssessmentRule, onSaveIntake, onOverrideEnrolleeZCodes
  } = props
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
  const {
    effectiveRegistry,
    combinedOrganizations,
    combinedPeople,
    visibleEnrollees,
    navigators,
    supervisors,
    navigatorCoverageOptions,
    permissionExceptionRows,
    totalPermissionExceptionCount
  } = useAdminRegistryViewModel({
    registry,
    accountSettings,
    accessMatrixDataset,
    enrollees,
    intakeFormsByEnrolleeId,
    supervisorNavigatorCompetency
  })
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

  useEffect(() => {
    const normalized = requestedDomainSurveyZCode?.trim().toUpperCase()
    if (!normalized) return
    // Chart drilldown should land admins in the exact overview workflow where
    // source answer rows can be nullified/restored against the canonical records.
    setActiveSection('overview')
    setSelectedDomainSurveyZCode(normalized)
    onAcknowledgeRequestedDomainSurveyZCode?.()
  }, [onAcknowledgeRequestedDomainSurveyZCode, requestedDomainSurveyZCode])

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
    <>
      <AdminDataControlPanelFrame
        accountSettings={accountSettings}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onJumpToAssignments={() => setActiveSection('relationships')}
        portalMessage={portalMessage}
        registryError={registryError}
        isSavingRegistry={isSavingRegistry}
        overviewCards={overviewCards}
      >
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
              deletableServiceCapacitySubmissions={deletableServiceCapacitySubmissions}
              isLoadingDeletableServiceCapacitySubmissions={isLoadingDeletableServiceCapacitySubmissions}
              deletingServiceCapacitySubmissionId={deletingServiceCapacitySubmissionId}
              serviceCapacityDeletionError={serviceCapacityDeletionError}
              selectedDomainSurveySummary={selectedDomainSurveySummary}
              setSelectedDomainSurveyZCode={setSelectedDomainSurveyZCode}
              nullificationReasonByAnswerId={nullificationReasonByAnswerId}
              setNullificationReasonByAnswerId={setNullificationReasonByAnswerId}
              handleSetDomainSurveyNullification={handleSetDomainSurveyNullification}
              handleDeleteServiceCapacitySubmission={async (input) => {
                await onDeleteServiceCapacitySubmission(input)
              }}
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
      </AdminDataControlPanelFrame>
        {isZCodePickerOpen ? (
          <AdminZCodePickerOverlay
            panelRef={zCodeOverlayPanelRef}
            listRef={zCodeOverlayListRef}
            activeParentFilters={activeZCodeParentFilters}
            selectedZCodes={selectedDraftZCodes}
            visibleOptions={visibleZCodeOptions}
            onClose={() => setIsZCodePickerOpen(false)}
            onToggleParentFilter={toggleZCodeParentFilter}
            onToggleZCode={toggleEnrolleeDraftZCode}
          />
        ) : null}
    </>
  )
}
