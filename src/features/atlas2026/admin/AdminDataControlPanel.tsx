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
import { useAdminPanelActions } from '@/features/atlas2026/admin/components/useAdminPanelActions'
import type { CombinedEnrolleeRow } from '@/features/atlas2026/admin/components/types'
import {
  ADMIN_ACTIVE_SECTION_KEY, ADMIN_PERMISSION_INTERACTION_KEY, ADMIN_PERMISSION_RECORD_KIND_KEY,
  ADMIN_SELECTED_ENROLLEE_KEY, ADMIN_SELECTED_ORGANIZATION_KEY, ADMIN_SELECTED_PERMISSION_ROLE_KEY,
  ADMIN_SELECTED_PERSON_KEY, ADMIN_Z_CODE_OPTIONS, ADMIN_Z_CODE_PARENT_CODES,
  CUSTOM_ENROLLEE_STATUS_OPTIONS, ORG_TYPE_OPTIONS, ROLE_OPTIONS, buildBlankCustomEnrollee,
  buildBlankIntervalAssessmentRule, buildBlankOrganization, buildBlankPerson,
  createDefaultFeaturePolicy, createPortalId, formatDateLabel, formatMetricLabel,
  isAdminMatrixSection, readAdminSessionValue, readPermissionInteraction, readPermissionRecordKind,
  readStoredAdminPortalSection, toAtlasRoles, writeAdminSessionValue,
  type AdminDataControlPanelProps, type AdminMatrixSection, type AdminPortalSection,
} from '@/features/atlas2026/admin/components/adminDataControlPanelModel'
import { Field, RecordTable, StatusPill, ZCodeParentFilterCircle } from '@/features/atlas2026/admin/components/AdminControlPanelPrimitives'
import LiveAccessMatrixPanel, { type LiveAccessMatrixSection } from '@/features/atlas2026/singlepane/components/LiveAccessMatrixPanel'
import type { AdminPortalOrganizationRecord, AdminPortalPersonRecord, AdminPortalRegistry, AtlasRole, IntervalAssessmentRule, RegulationReviewSettings } from '@/features/atlas2026/shared/contracts'
import { ATLAS_PERMISSION_ROLES, isCapabilityAllowedForAnyRole } from '@/features/atlas2026/shared/roleCapabilityPolicy'

function toLiveAccessMatrixSection(section: AdminMatrixSection): LiveAccessMatrixSection {
  switch (section) {
    case 'matrix-person-roles':
      return 'person-roles'
    case 'matrix-navigator-enrollee':
      return 'navigator-enrollee'
    case 'matrix-supervisor-navigator':
      return 'supervisor-navigator'
    case 'matrix-partner-ownership':
      return 'partner-ownership'
    default: {
      const unknownSection: never = section
      return unknownSection
    }
  }
}

export default function AdminDataControlPanel(props: AdminDataControlPanelProps) {
  const {
    metrics,
    zCodeDomainSurveyHistorySummary,
    deletableServiceCapacitySubmissions,
    isLoadingDeletableServiceCapacitySubmissions,
    deletingServiceCapacitySubmissionId,
    serviceCapacityDeletionError,
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
    onDeleteServiceCapacitySubmission,
    requestedDomainSurveyZCode,
    onAcknowledgeRequestedDomainSurveyZCode,
    onSaveEnrollmentNavigators,
    onSaveAccessMatrixPersonRoles,
    onSaveAccessMatrixSupervisorAssignments,
    onSaveAccessMatrixPartnerPrimaryContacts,
    accessMatrixError,
    isSavingAccessMatrix,
    remoteSession,
    partnerTroubleshootingGrants,
    onStartTroubleshooting,
    onStopTroubleshooting,
    onSaveIntervalAssessmentRule,
    onSaveIntake,
    onOverrideEnrolleeZCodes,
    onScribeMenuChanged,
  } = props
  const [activeSection, setActiveSection] = useState<AdminPortalSection>(() => readStoredAdminPortalSection(readAdminSessionValue(ADMIN_ACTIVE_SECTION_KEY)))
  const [selectedEnrolleeId, setSelectedEnrolleeId] = useState<string | null>(() => readAdminSessionValue(ADMIN_SELECTED_ENROLLEE_KEY) || selectedEnrollee?.id || null)
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(() => readAdminSessionValue(ADMIN_SELECTED_PERSON_KEY))
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(() => readAdminSessionValue(ADMIN_SELECTED_ORGANIZATION_KEY))
  const [permissionInteraction, setPermissionInteraction] = useState(() => readPermissionInteraction(readAdminSessionValue(ADMIN_PERMISSION_INTERACTION_KEY)))
  const [permissionRecordKind, setPermissionRecordKind] = useState(() => readPermissionRecordKind(readAdminSessionValue(ADMIN_PERMISSION_RECORD_KIND_KEY)))
  const [selectedPermissionRole, setSelectedPermissionRole] = useState<AtlasRole>(() => {
    const stored = readAdminSessionValue(ADMIN_SELECTED_PERMISSION_ROLE_KEY)
    return ATLAS_PERMISSION_ROLES.find((role) => role === stored) || 'administrator'
  })
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
  const { effectiveRegistry, combinedOrganizations, combinedPeople, visibleEnrollees, navigators, supervisors, navigatorCoverageOptions } = useAdminRegistryViewModel({
    registry,
    accountSettings,
    accessMatrixDataset,
    enrollees,
    intakeFormsByEnrolleeId,
    supervisorNavigatorCompetency,
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

  useEffect(() => {
    writeAdminSessionValue(ADMIN_PERMISSION_INTERACTION_KEY, permissionInteraction)
  }, [permissionInteraction])

  useEffect(() => {
    writeAdminSessionValue(ADMIN_PERMISSION_RECORD_KIND_KEY, permissionRecordKind)
  }, [permissionRecordKind])

  useEffect(() => {
    writeAdminSessionValue(ADMIN_SELECTED_PERMISSION_ROLE_KEY, selectedPermissionRole)
  }, [selectedPermissionRole])

  const selectedEnrolleeRow = useMemo(() => visibleEnrollees.find((row) => row.id === selectedEnrolleeId) || null, [selectedEnrolleeId, visibleEnrollees])
  const selectedDraftZCodes = useMemo(() => Array.from(new Set((enrolleeDraft ? (enrolleeDraft.kind === 'existing' ? enrolleeDraft.intake.zCodeTags : enrolleeDraft.record.zCodeTags) : []).map((value) => value.trim().toUpperCase()).filter(Boolean))), [enrolleeDraft])
  const selectedDraftParentCodes = useMemo(() => Array.from(new Set(selectedDraftZCodes.map((code) => code.split('.')[0]?.trim().toUpperCase() || '').filter(Boolean))), [selectedDraftZCodes])
  const visibleZCodeOptions = useMemo(() => ADMIN_Z_CODE_OPTIONS.filter((option) => !activeZCodeParentFilters.length || activeZCodeParentFilters.includes(option.parentCode.trim().toUpperCase())), [activeZCodeParentFilters])
  const selectedPerson = useMemo(() => combinedPeople.find((person) => person.id === selectedPersonId) || null, [combinedPeople, selectedPersonId])
  const selectedOrganization = useMemo(() => combinedOrganizations.find((org) => org.id === selectedOrganizationId) || null, [combinedOrganizations, selectedOrganizationId])

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
        { transform: 'translateY(0px) scale(1)', opacity: 1 },
      ],
      {
        duration: 240,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    )
    zCodeOverlayListRef.current?.animate(
      [
        { transform: 'translateY(8px)', opacity: 0.72 },
        { transform: 'translateY(0px)', opacity: 1 },
      ],
      {
        duration: 220,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
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

  const {
    toggleEnrolleeDraftZCode, openZCodePicker, toggleZCodeParentFilter, handleSaveEnrolleeDraft,
    handleArchiveEnrollee, handleSavePersonDraft, handleDeletePerson, handleSavePersonFeaturePolicy,
    handleSaveRolePolicies, handleClearPersonPermissionExceptions,
    handleSaveOrganizationDraft, handleDeleteOrganization, handleNavigatorAssignment, handleNavigatorCoverageSelection,
    handlePersonSupervisorAssignment, handlePersonOrganizationAssignment, handleSaveIntervalRule,
    effectiveRegulationReview, regulationReviewRoster, updateRegulationReviewEnrolleeSetting,
    handleSaveRegulationReviewSettings,
  } = useAdminPanelActions({
    effectiveRegistry, onSaveRegistry, setPortalMessage, setEnrolleeDraft, selectedDraftZCodes,
    selectedDraftParentCodes, setActiveZCodeParentFilters, previousZCodeOverlayHeightRef,
    setIsZCodePickerOpen, enrolleeDraft, setIsSubmittingEnrollee, onOverrideEnrolleeZCodes,
    onSaveIntake, personDraft, setPersonDraft, selectedPersonId, organizationDraft,
    setOrganizationDraft, navigatorCoverageOptions, onSaveEnrollmentNavigators, combinedPeople,
    intervalRuleDraft, onSaveIntervalAssessmentRule, regulationReviewDraft, regulationReviewSettings,
    visibleEnrollees, setRegulationReviewDraft, setIsSavingRegulationReview,
    onSaveRegulationReviewSettings, ADMIN_Z_CODE_PARENT_CODES, isCapabilityAllowedForAnyRole,
    toAtlasRoles, createDefaultFeaturePolicy,
  })

  function openPersonPermissionRecord(personId: string) {
    // Name clicks always open the person record. Navigate versus Edit decides
    // whether that record can be changed, and is chosen on the permission desk.
    setSelectedPersonId(personId)
    setPermissionRecordKind('person')
    setActiveSection('permissions')
    const person = combinedPeople.find((entry) => entry.id === personId)
    if (!person) return
    setPersonDraft((current) => (current && current.id === person.id ? current : person))
  }

  function openRolePermissionRecord(role: AtlasRole) {
    setSelectedPermissionRole(role)
    setPermissionRecordKind('role')
    setActiveSection('permissions')
  }

  const overviewCards = useMemo(
    () => [
      { label: 'Active enrollees', value: visibleEnrollees.length, accentColor: SP_COLORS.blue },
      { label: 'People directory', value: combinedPeople.length, accentColor: SP_COLORS.yellow },
      { label: 'Organizations', value: combinedOrganizations.length, accentColor: SP_COLORS.deepGreen },
      { label: 'Pending requests', value: enrollmentRequests.filter((item) => item.status === 'pending').length, accentColor: SP_COLORS.red },
      { label: 'Pickup queue', value: navigatorProgramState.pickupQueue.filter((item) => item.status === 'available').length, accentColor: SP_COLORS.yellow },
      { label: 'Assessment rules', value: navigatorProgramState.intervalAssessmentRules.length, accentColor: SP_COLORS.blue },
    ],
    [combinedOrganizations.length, combinedPeople.length, enrollmentRequests, navigatorProgramState.intervalAssessmentRules.length, navigatorProgramState.pickupQueue, visibleEnrollees.length],
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

  const selectedDomainSurveySummary = useMemo(() => zCodeDomainSurveyHistorySummary.find((entry) => entry.normalizedZCode === selectedDomainSurveyZCode) || null, [selectedDomainSurveyZCode, zCodeDomainSurveyHistorySummary])

  async function handleSetDomainSurveyNullification(answerId: string, isNullified: boolean) {
    const reason = nullificationReasonByAnswerId[answerId]?.trim() || null
    await Promise.resolve(
      onSetZCodeDomainSurveyAnswerNullification({
        answerId,
        isNullified,
        nullifiedReason: reason,
      }),
    )
    setPortalMessage(isNullified ? 'Answer has been nullified from the aggregate average.' : 'Answer has been restored to the aggregate average.')
  }

  return (
    <>
      <AdminDataControlPanelFrame accountSettings={accountSettings} activeSection={activeSection} onSelectSection={setActiveSection} onJumpToAssignments={() => setActiveSection('relationships')} portalMessage={portalMessage} registryError={registryError} isSavingRegistry={isSavingRegistry} overviewCards={overviewCards}>
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
            onOpenPerson={openPersonPermissionRecord}
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
            onOpenPerson={openPersonPermissionRecord}
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
            onOpenPerson={openPersonPermissionRecord}
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
            people={combinedPeople}
            rolePolicies={effectiveRegistry.rolePolicies}
            recordKind={permissionRecordKind}
            onRecordKindChange={setPermissionRecordKind}
            interaction={permissionInteraction}
            onInteractionChange={setPermissionInteraction}
            selectedPersonId={selectedPersonId}
            onSelectPerson={openPersonPermissionRecord}
            selectedRole={selectedPermissionRole}
            onSelectRole={openRolePermissionRecord}
            isSaving={isSavingRegistry}
            onSavePersonPolicy={handleSavePersonFeaturePolicy}
            onSaveRolePolicies={handleSaveRolePolicies}
            onClearPersonExceptions={handleClearPersonPermissionExceptions}
            onScribeMenuChanged={onScribeMenuChanged}
          />
        ) : null}
        {isAdminMatrixSection(activeSection) ? (
          <LiveAccessMatrixPanel
            section={toLiveAccessMatrixSection(activeSection)}
            dataset={accessMatrixDataset}
            error={accessMatrixError}
            isSaving={isSavingAccessMatrix}
            onSavePersonRoles={onSaveAccessMatrixPersonRoles}
            onSaveEnrollmentNavigator={onSaveEnrollmentNavigators}
            onSaveSupervisorAssignment={onSaveAccessMatrixSupervisorAssignments}
            onSavePartnerPrimaryContact={onSaveAccessMatrixPartnerPrimaryContacts}
            remoteSession={remoteSession}
            partnerTroubleshootingGrants={partnerTroubleshootingGrants}
            onStartTroubleshooting={onStartTroubleshooting}
            onStopTroubleshooting={onStopTroubleshooting}
            onOpenPerson={openPersonPermissionRecord}
          />
        ) : null}
      </AdminDataControlPanelFrame>
      {isZCodePickerOpen ? <AdminZCodePickerOverlay panelRef={zCodeOverlayPanelRef} listRef={zCodeOverlayListRef} activeParentFilters={activeZCodeParentFilters} selectedZCodes={selectedDraftZCodes} visibleOptions={visibleZCodeOptions} onClose={() => setIsZCodePickerOpen(false)} onToggleParentFilter={toggleZCodeParentFilter} onToggleZCode={toggleEnrolleeDraftZCode} /> : null}
    </>
  )
}
