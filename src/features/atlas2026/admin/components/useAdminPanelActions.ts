import { useMemo } from 'react'
import type { AdminPortalOrganizationRecord, AdminPortalPersonRecord, AdminPortalRegistry, RegulationReviewSettings } from '@/features/atlas2026/shared/contracts'
import type { CombinedEnrolleeRow, RegulationReviewRosterRow } from '@/features/atlas2026/admin/components/types'

type AdminPanelActionContext = Record<string, any>

/**
 * Isolates registry and assessment commands from panel rendering. The context remains
 * internal to the admin composition root so the public panel contract does not change.
 */
export function useAdminPanelActions(context: AdminPanelActionContext) {
  const {
    effectiveRegistry,
    onSaveRegistry,
    setPortalMessage,
    setEnrolleeDraft,
    selectedDraftZCodes,
    selectedDraftParentCodes,
    setActiveZCodeParentFilters,
    previousZCodeOverlayHeightRef,
    setIsZCodePickerOpen,
    enrolleeDraft,
    setIsSubmittingEnrollee,
    onOverrideEnrolleeZCodes,
    onSaveIntake,
    personDraft,
    setPersonDraft,
    selectedPersonId,
    organizationDraft,
    setOrganizationDraft,
    navigatorCoverageOptions,
    onSaveEnrollmentNavigators,
    combinedPeople,
    intervalRuleDraft,
    onSaveIntervalAssessmentRule,
    regulationReviewDraft,
    regulationReviewSettings,
    visibleEnrollees,
    setRegulationReviewDraft,
    setIsSavingRegulationReview,
    onSaveRegulationReviewSettings,
    ADMIN_Z_CODE_PARENT_CODES,
    isCapabilityAllowedForAnyRole,
    toAtlasRoles,
    createDefaultFeaturePolicy,
  } = context

  async function commitRegistry(nextRegistry: AdminPortalRegistry, successMessage: string) {
    // All registry commands share one timestamp and feedback path.
    const saved = await onSaveRegistry({ ...nextRegistry, updatedAtIso: new Date().toISOString() })
    setPortalMessage(successMessage)
    return saved
  }

  function withRegistryPerson(person: AdminPortalPersonRecord) {
    return { ...effectiveRegistry, people: [...effectiveRegistry.people.filter((entry: AdminPortalPersonRecord) => entry.id !== person.id), person] }
  }

  function withRegistryOrganization(organization: AdminPortalOrganizationRecord) {
    return {
      ...effectiveRegistry,
      organizations: [...effectiveRegistry.organizations.filter((entry: AdminPortalOrganizationRecord) => entry.id !== organization.id), organization],
    }
  }

  function updateEnrolleeDraftZCodes(nextTags: string[]) {
    const normalizedTags = Array.from(new Set(nextTags.map((value) => value.trim().toUpperCase()).filter(Boolean)))
    setEnrolleeDraft((current: CombinedEnrolleeRow | null) => {
      if (!current) return current
      return current.kind === 'existing' ? { ...current, intake: { ...current.intake, zCodeTags: normalizedTags } } : { ...current, record: { ...current.record, zCodeTags: normalizedTags } }
    })
  }

  function toggleEnrolleeDraftZCode(code: string) {
    const normalizedCode = code.trim().toUpperCase()
    if (!normalizedCode) return
    updateEnrolleeDraftZCodes(selectedDraftZCodes.includes(normalizedCode) ? selectedDraftZCodes.filter((tag: string) => tag !== normalizedCode) : [...selectedDraftZCodes, normalizedCode])
  }

  function openZCodePicker() {
    setActiveZCodeParentFilters(selectedDraftParentCodes.length ? selectedDraftParentCodes : ADMIN_Z_CODE_PARENT_CODES.slice(0, 1))
    previousZCodeOverlayHeightRef.current = null
    setIsZCodePickerOpen(true)
  }

  function toggleZCodeParentFilter(parentCode: string) {
    const normalized = parentCode.trim().toUpperCase()
    setActiveZCodeParentFilters((current: string[]) => (current.includes(normalized) ? current.filter((value) => value !== normalized) : [...current, normalized]))
  }

  async function handleSaveEnrolleeDraft() {
    if (!enrolleeDraft) return
    setIsSubmittingEnrollee(true)
    try {
      if (enrolleeDraft.kind === 'existing') {
        const activeCodes = Array.from(new Set(enrolleeDraft.profile.activeZCodeDetails.map((detail: any) => detail.zCode.trim().toUpperCase()).filter(Boolean)))
        const removedWithoutReason = activeCodes.filter((code) => !selectedDraftZCodes.includes(code))
        if (removedWithoutReason.length) {
          setPortalMessage(`Unable to remove ${removedWithoutReason.join(', ')} here because each uncheck requires a reason. Use "update z-codes" on the enrollee page to record removals.`)
          return
        }
        if (!enrolleeDraft.profile.enrollmentId) {
          setPortalMessage(`Unable to save ${enrolleeDraft.intake.fullName || enrolleeDraft.profile.fullName}: enrollment id is missing.`)
          return
        }
        const result = await onOverrideEnrolleeZCodes(enrolleeDraft.profile.enrollmentId, {
          checkedZCodes: selectedDraftZCodes,
          uncheckReasons: [],
        })
        if (!result) throw new Error('Z-code override was not persisted by the database.')
        await Promise.resolve(onSaveIntake({ ...enrolleeDraft.intake, zCodeTags: result.zCodeTags }))
        setEnrolleeDraft((current: CombinedEnrolleeRow | null) => (current?.kind === 'existing' ? { ...current, intake: { ...current.intake, zCodeTags: result.zCodeTags } } : current))
        setPortalMessage(`Saved enrollee intake for ${enrolleeDraft.intake.fullName || enrolleeDraft.profile.fullName} with canonical z-code sync.`)
      } else {
        await commitRegistry(
          {
            ...effectiveRegistry,
            customEnrollees: [...effectiveRegistry.customEnrollees.filter((record: any) => record.enrolleeId !== enrolleeDraft.record.enrolleeId), enrolleeDraft.record],
          },
          `Saved custom enrollee draft for ${enrolleeDraft.record.fullName || enrolleeDraft.record.caseId || 'new enrollee'}.`,
        )
      }
    } catch (error) {
      setPortalMessage(error instanceof Error ? error.message : 'Unable to save enrollee updates right now.')
    } finally {
      setIsSubmittingEnrollee(false)
    }
  }

  async function handleArchiveEnrollee(row: CombinedEnrolleeRow) {
    // Archive identifiers preserve source history while removing active portal rows.
    await commitRegistry(
      {
        ...effectiveRegistry,
        archivedEnrolleeIds: Array.from(new Set([...effectiveRegistry.archivedEnrolleeIds, row.id])),
        customEnrollees: row.kind === 'custom' ? effectiveRegistry.customEnrollees.filter((record: any) => record.enrolleeId !== row.id) : effectiveRegistry.customEnrollees,
      },
      'Enrollee record archived from the admin portal.',
    )
    setEnrolleeDraft(null)
  }

  async function handleSavePersonDraft() {
    if (!personDraft) return
    const primaryEmail = personDraft.email.trim().toLowerCase()
    const linkedEmails = Array.from(new Set([primaryEmail, ...personDraft.linkedEmails.map((value: string) => value.trim().toLowerCase())].filter(Boolean)))
    await commitRegistry(
      withRegistryPerson({
        ...personDraft,
        linkedEmails,
        identityGroupId: personDraft.identityGroupId.trim() || personDraft.id,
      }),
      `Saved ${personDraft.fullName || 'person'} in the directory.`,
    )
  }

  async function handleDeletePerson(person: AdminPortalPersonRecord) {
    await commitRegistry(
      {
        ...effectiveRegistry,
        people: effectiveRegistry.people.filter((entry: AdminPortalPersonRecord) => entry.id !== person.id),
        archivedPersonIds: Array.from(new Set([...effectiveRegistry.archivedPersonIds, person.id])),
      },
      'Directory record removed from the active portal view.',
    )
    setPersonDraft(null)
  }

  async function handleClearPersonPermissionExceptions(person: AdminPortalPersonRecord) {
    const canViewNames = isCapabilityAllowedForAnyRole(toAtlasRoles(person.roles), 'actionToggles', 'assignmentBoard.viewNavigatorNames', undefined)
    const resetPerson = { ...person, canViewNavigatorAssignmentNames: canViewNames, featurePolicy: createDefaultFeaturePolicy() }
    await commitRegistry(withRegistryPerson(resetPerson), `Cleared permission exceptions for ${person.fullName || person.email || 'person'}.`)
    if (selectedPersonId === resetPerson.id) setPersonDraft(resetPerson)
  }

  async function handleSaveOrganizationDraft() {
    if (organizationDraft) await commitRegistry(withRegistryOrganization(organizationDraft), `Saved ${organizationDraft.name || 'organization'} in the organization registry.`)
  }

  async function handleDeleteOrganization(organization: AdminPortalOrganizationRecord) {
    // Clear references with the archive command to avoid dangling organization ownership.
    await commitRegistry(
      {
        ...effectiveRegistry,
        organizations: effectiveRegistry.organizations.filter((entry: AdminPortalOrganizationRecord) => entry.id !== organization.id),
        archivedOrganizationIds: Array.from(new Set([...effectiveRegistry.archivedOrganizationIds, organization.id])),
        people: effectiveRegistry.people.map((person: AdminPortalPersonRecord) => (person.organizationId === organization.id ? { ...person, organizationId: null } : person)),
      },
      'Organization removed from the active portal view.',
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
        customEnrollees: effectiveRegistry.customEnrollees.map((record: any) => (record.enrolleeId === nextRecord.enrolleeId ? nextRecord : record)),
      },
      `Updated coverage assignment for ${row.record.fullName || row.record.caseId || 'custom enrollee'}.`,
    )
  }

  async function handleNavigatorCoverageSelection(row: CombinedEnrolleeRow, navigatorPersonIds: string[]) {
    if (row.kind !== 'existing') {
      await handleNavigatorAssignment(row, navigatorCoverageOptions.find((option: any) => option.id === navigatorPersonIds[0])?.label || '')
      return
    }
    if (!row.profile.enrollmentId) {
      setPortalMessage(`Unable to update ${row.intake.fullName || row.profile.fullName}: enrollment id is missing.`)
      return
    }
    await Promise.resolve(onSaveEnrollmentNavigators(row.profile.enrollmentId, navigatorPersonIds))
    setPortalMessage(`Updated coverage for ${row.intake.fullName || row.profile.fullName} to ${navigatorPersonIds.length} navigator${navigatorPersonIds.length === 1 ? '' : 's'}.`)
  }

  async function handlePersonSupervisorAssignment(personId: string, supervisorId: string | null) {
    const person = combinedPeople.find((entry: AdminPortalPersonRecord) => entry.id === personId)
    if (person) await commitRegistry(withRegistryPerson({ ...person, reportsToPersonId: supervisorId }), `Updated reporting line for ${person.fullName || 'selected person'}.`)
  }

  async function handlePersonOrganizationAssignment(personId: string, organizationId: string | null) {
    const person = combinedPeople.find((entry: AdminPortalPersonRecord) => entry.id === personId)
    if (person) await commitRegistry(withRegistryPerson({ ...person, organizationId }), `Updated organization ownership for ${person.fullName || 'selected person'}.`)
  }

  async function handleSaveIntervalRule() {
    if (!intervalRuleDraft) return
    await Promise.resolve(onSaveIntervalAssessmentRule(intervalRuleDraft))
    setPortalMessage(`Saved interval rule for ${intervalRuleDraft.title || 'assessment rule'}.`)
  }

  const effectiveRegulationReview = regulationReviewDraft ?? regulationReviewSettings
  const regulationReviewRoster = useMemo<RegulationReviewRosterRow[]>(() => {
    const rows = visibleEnrollees.map((row: CombinedEnrolleeRow) => ({
      enrolleeId: row.kind === 'existing' ? row.profile.id : row.record.enrolleeId,
      enrolleeName: row.kind === 'existing' ? row.profile.fullName : row.record.fullName,
    }))
    const knownIds = new Set(rows.map((row) => row.enrolleeId))
    Object.values(effectiveRegulationReview.enrolleeSettings).forEach((entry: any) => {
      if (!knownIds.has(entry.enrolleeId)) rows.push({ enrolleeId: entry.enrolleeId, enrolleeName: entry.enrolleeName || entry.enrolleeId })
    })
    return rows.sort((left, right) => left.enrolleeName.localeCompare(right.enrolleeName))
  }, [effectiveRegulationReview.enrolleeSettings, visibleEnrollees])

  function updateRegulationReviewEnrolleeSetting(enrolleeId: string, enrolleeName: string, patch: Partial<Pick<RegulationReviewSettings['enrolleeSettings'][string], 'isActive' | 'cadence'>>) {
    const existing = effectiveRegulationReview.enrolleeSettings[enrolleeId]
    setRegulationReviewDraft({
      ...effectiveRegulationReview,
      enrolleeSettings: {
        ...effectiveRegulationReview.enrolleeSettings,
        [enrolleeId]: {
          enrolleeId,
          enrolleeName,
          isActive: existing ? existing.isActive : effectiveRegulationReview.isActiveForNewEnrollees,
          cadence: existing ? existing.cadence : null,
          ...patch,
          updatedAtIso: new Date().toISOString(),
        },
      },
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

  return {
    toggleEnrolleeDraftZCode,
    openZCodePicker,
    toggleZCodeParentFilter,
    handleSaveEnrolleeDraft,
    handleArchiveEnrollee,
    handleSavePersonDraft,
    handleDeletePerson,
    handleClearPersonPermissionExceptions,
    handleSaveOrganizationDraft,
    handleDeleteOrganization,
    handleNavigatorAssignment,
    handleNavigatorCoverageSelection,
    handlePersonSupervisorAssignment,
    handlePersonOrganizationAssignment,
    handleSaveIntervalRule,
    effectiveRegulationReview,
    regulationReviewRoster,
    updateRegulationReviewEnrolleeSetting,
    handleSaveRegulationReviewSettings,
  }
}
