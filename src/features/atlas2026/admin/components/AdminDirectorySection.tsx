import React from 'react'
import { AtlasInsetCard, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import type {
  AdminDirectorySectionDataProps,
  FieldComponentType,
  RecordTableComponentType,
  StatusPillComponentType
} from '@/features/atlas2026/admin/components/types'

interface AdminDirectorySectionProps {
  setPersonDraft: AdminDirectorySectionDataProps['setPersonDraft']
  buildBlankPerson: AdminDirectorySectionDataProps['buildBlankPerson']
  combinedPeople: AdminDirectorySectionDataProps['combinedPeople']
  selectedPersonId: AdminDirectorySectionDataProps['selectedPersonId']
  setSelectedPersonId: AdminDirectorySectionDataProps['setSelectedPersonId']
  combinedOrganizations: AdminDirectorySectionDataProps['combinedOrganizations']
  personDraft: AdminDirectorySectionDataProps['personDraft']
  supervisors: AdminDirectorySectionDataProps['supervisors']
  isCapabilityAllowedForAnyRole: AdminDirectorySectionDataProps['isCapabilityAllowedForAnyRole']
  toAtlasRoles: AdminDirectorySectionDataProps['toAtlasRoles']
  toggleCapabilityOverride: AdminDirectorySectionDataProps['toggleCapabilityOverride']
  handleSavePersonDraft: AdminDirectorySectionDataProps['handleSavePersonDraft']
  handleDeletePerson: AdminDirectorySectionDataProps['handleDeletePerson']
  ROLE_OPTIONS: AdminDirectorySectionDataProps['roleOptions']
  ADMIN_POLICY_SCREEN_KEYS: AdminDirectorySectionDataProps['adminPolicyScreenKeys']
  ADMIN_POLICY_CARD_KEYS: AdminDirectorySectionDataProps['adminPolicyCardKeys']
  ADMIN_POLICY_ACTION_KEYS: AdminDirectorySectionDataProps['adminPolicyActionKeys']
  RecordTableComponent: RecordTableComponentType
  StatusPillComponent: StatusPillComponentType
  FieldComponent: FieldComponentType
}

export default function AdminDirectorySection({
  setPersonDraft,
  buildBlankPerson,
  combinedPeople,
  selectedPersonId,
  setSelectedPersonId,
  combinedOrganizations,
  personDraft,
  ROLE_OPTIONS,
  supervisors,
  isCapabilityAllowedForAnyRole,
  toAtlasRoles,
  toggleCapabilityOverride,
  ADMIN_POLICY_SCREEN_KEYS,
  ADMIN_POLICY_CARD_KEYS,
  ADMIN_POLICY_ACTION_KEYS,
  handleSavePersonDraft,
  handleDeletePerson,
  RecordTableComponent,
  StatusPillComponent,
  FieldComponent
}: AdminDirectorySectionProps) {
  return (
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
        <RecordTableComponent
          columns={['person', 'roles', 'organization', 'status']}
          rows={combinedPeople.map((person) => ({ id: person.id }))}
          renderRow={({ id }: { id: string }) => {
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
                  <StatusPillComponent status={person.status} />
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
            <FieldComponent label="full name">
              <input value={personDraft.fullName} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPersonDraft({ ...personDraft, fullName: event.target.value })} className="atlas-admin-input" />
            </FieldComponent>
            <div className="grid gap-3 md:grid-cols-2">
              <FieldComponent label="email">
                <input
                  value={personDraft.email}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setPersonDraft({
                      ...personDraft,
                      email: event.target.value,
                      linkedEmails: Array.from(
                        new Set(
                          [event.target.value.trim().toLowerCase(), ...personDraft.linkedEmails.map((value: string) => value.trim().toLowerCase())].filter(Boolean)
                        )
                      )
                    })
                  }
                  className="atlas-admin-input"
                />
              </FieldComponent>
              <FieldComponent label="title">
                <input value={personDraft.title} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPersonDraft({ ...personDraft, title: event.target.value })} className="atlas-admin-input" />
              </FieldComponent>
            </div>
            <FieldComponent label="linked emails (comma separated)">
              <input
                value={personDraft.linkedEmails.join(', ')}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
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
            </FieldComponent>
            <FieldComponent label="roles">
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
            </FieldComponent>
            <div className="grid gap-3 md:grid-cols-2">
              <FieldComponent label="organization">
                <select
                  value={personDraft.organizationId || ''}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setPersonDraft({ ...personDraft, organizationId: event.target.value || null })}
                  className="atlas-admin-input"
                >
                  <option value="">Unassigned</option>
                  {combinedOrganizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </FieldComponent>
              <FieldComponent label="reports to">
                <select
                  value={personDraft.reportsToPersonId || ''}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setPersonDraft({ ...personDraft, reportsToPersonId: event.target.value || null })}
                  className="atlas-admin-input"
                >
                  <option value="">No supervisor</option>
                  {supervisors.filter((person) => person.id !== personDraft.id).map((supervisor) => (
                    <option key={supervisor.id} value={supervisor.id}>
                      {supervisor.fullName}
                    </option>
                  ))}
                </select>
              </FieldComponent>
            </div>
            <FieldComponent label="assignment board access">
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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <AtlasTextButton
                  onClick={() =>
                    setPersonDraft((current) =>
                      current
                        ? {
                            ...current,
                            featurePolicy: {
                              ...current.featurePolicy,
                              actionToggles: (() => {
                                const roleDefaultsToAllowed = isCapabilityAllowedForAnyRole(
                                  toAtlasRoles(current.roles),
                                  'actionToggles',
                                  'assignmentBoard.addReferral',
                                  undefined
                                )
                                return toggleCapabilityOverride(
                                  current.featurePolicy.actionToggles,
                                  roleDefaultsToAllowed,
                                  'assignmentBoard.addReferral'
                                )
                              })()
                            }
                          }
                        : current
                    )
                  }
                  className="px-[14px] py-[7px] text-[13px] font-medium"
                  style={
                    (() => {
                      const canAddFromBoard = isCapabilityAllowedForAnyRole(
                        toAtlasRoles(personDraft.roles),
                        'actionToggles',
                        'assignmentBoard.addReferral',
                        personDraft.featurePolicy.actionToggles
                      )
                      return {
                        ['--button-border-color' as const]: canAddFromBoard ? SP_COLORS.deepGreen : '#ffffff25',
                        color: canAddFromBoard ? SP_COLORS.deepGreen : SP_COLORS.white,
                        backgroundColor: canAddFromBoard ? 'rgba(69,191,85,0.12)' : 'transparent'
                      } as React.CSSProperties
                    })()
                  }
                >
                  {isCapabilityAllowedForAnyRole(
                    toAtlasRoles(personDraft.roles),
                    'actionToggles',
                    'assignmentBoard.addReferral',
                    personDraft.featurePolicy.actionToggles
                  )
                    ? 'assignment board + enabled'
                    : 'assignment board + disabled'}
                </AtlasTextButton>
                <small className="text-[12px] text-[var(--foreground-secondary)]">
                  Controls whether this user can add an enrollee from the assignment board using the referral workflow.
                </small>
              </div>
            </FieldComponent>
            <FieldComponent label="signup approval">
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
                  {personDraft.approvalState === 'approved' ? 'approved ✓' : 'pending approval'}
                </AtlasTextButton>
                <small className="text-[12px] text-[var(--foreground-secondary)]">
                  Pending users inherit role defaults; use these toggles only for explicit admin exceptions.
                </small>
              </div>
            </FieldComponent>
            <FieldComponent label="feature policy controls">
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
            </FieldComponent>
            <FieldComponent label="status">
              <select
                value={personDraft.status}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                  setPersonDraft({
                    ...personDraft,
                    status: event.target.value
                  })
                }
                className="atlas-admin-input"
              >
                <option value="active">active</option>
                <option value="invited">invited</option>
                <option value="inactive">inactive</option>
              </select>
            </FieldComponent>
            <FieldComponent label="notes">
              <textarea
                value={personDraft.notes}
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setPersonDraft({ ...personDraft, notes: event.target.value })}
                className="atlas-admin-input min-h-[96px] resize-y"
              />
            </FieldComponent>
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
  )
}
