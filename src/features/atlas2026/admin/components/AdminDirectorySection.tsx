import React from 'react'
import { AtlasInsetCard, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import AdminPersonNameButton from '@/features/atlas2026/admin/components/AdminPersonNameButton'
import TierStandingEditor, { type TierStandingEditorProps } from '@/features/atlas2026/admin/components/TierStandingEditor'
import WarmLineAccessToggle from '@/features/atlas2026/singlepane/components/WarmLineAccessToggle'
import type {
  AdminDirectorySectionDataProps,
  FieldComponentType,
  RecordTableComponentType,
  StatusPillComponentType
} from '@/features/atlas2026/admin/components/types'
import type { PersonTierRecord } from '@/features/atlas2026/shared/contracts'
import { isTierKey, tierDisplayLabel } from '@/features/atlas2026/shared/tiers'

interface AdminDirectorySectionProps {
  setPersonDraft: AdminDirectorySectionDataProps['setPersonDraft']
  buildBlankPerson: AdminDirectorySectionDataProps['buildBlankPerson']
  combinedPeople: AdminDirectorySectionDataProps['combinedPeople']
  selectedPersonId: AdminDirectorySectionDataProps['selectedPersonId']
  setSelectedPersonId: AdminDirectorySectionDataProps['setSelectedPersonId']
  combinedOrganizations: AdminDirectorySectionDataProps['combinedOrganizations']
  personDraft: AdminDirectorySectionDataProps['personDraft']
  supervisors: AdminDirectorySectionDataProps['supervisors']
  onOpenPerson: (personId: string) => void
  handleSavePersonDraft: AdminDirectorySectionDataProps['handleSavePersonDraft']
  handleDeletePerson: AdminDirectorySectionDataProps['handleDeletePerson']
  ROLE_OPTIONS: AdminDirectorySectionDataProps['roleOptions']
  /** `atlas.people_tiers` rows from the access matrix dataset, one per person. */
  tierRecords: PersonTierRecord[]
  isSavingTier: boolean
  onSavePersonTier: TierStandingEditorProps['onSetTier']
  onMarkPersonTierAlum: TierStandingEditorProps['onMarkAlum']
  onSavePersonLucidEmployee: TierStandingEditorProps['onSetLucidEmployee']
  onSavePersonDesignation: TierStandingEditorProps['onSetDesignation']
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
  onOpenPerson,
  handleSavePersonDraft,
  handleDeletePerson,
  tierRecords,
  isSavingTier,
  onSavePersonTier,
  onMarkPersonTierAlum,
  onSavePersonLucidEmployee,
  onSavePersonDesignation,
  RecordTableComponent,
  StatusPillComponent,
  FieldComponent
}: AdminDirectorySectionProps) {
  const tierRecordByPersonId = React.useMemo(
    () => new Map(tierRecords.map((record) => [record.personId, record])),
    [tierRecords]
  )
  // Column text: the people_tiers row when one exists, else the tier key on the role list.
  function tierColumnLabel(person: { id: string; roles: readonly string[] }) {
    const record = tierRecordByPersonId.get(person.id)
    if (record) return tierDisplayLabel(record.tierKey, record.tierStatus)
    const tierRole = person.roles.find(isTierKey)
    return tierRole ? tierDisplayLabel(tierRole) : 'no tier'
  }
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
          columns={['person', 'tier', 'roles', 'organization', 'status']}
          rows={combinedPeople.map((person) => ({ id: person.id }))}
          renderRow={({ id }: { id: string }) => {
            const person = combinedPeople.find((entry) => entry.id === id)
            if (!person) return null
            return (
              <div
                role="button"
                tabIndex={0}
                className="grid w-full cursor-pointer grid-cols-[1.3fr_repeat(4,minmax(0,1fr))] gap-3 px-4 py-3 text-left transition hover:bg-white/5"
                style={selectedPersonId === person.id ? { backgroundColor: 'rgba(252,192,26,0.08)' } : undefined}
                onClick={() => {
                  setSelectedPersonId(person.id)
                  setPersonDraft(person)
                }}
                onKeyDown={(event) => {
                  // The name button opens the permission record. Enter on the row
                  // itself only selects this directory record.
                  if (event.target !== event.currentTarget) return
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  setSelectedPersonId(person.id)
                  setPersonDraft(person)
                }}
              >
                <div>
                  <AdminPersonNameButton
                    name={person.fullName || 'unnamed person'}
                    onOpen={() => onOpenPerson(person.id)}
                    className="text-[14px]"
                  />
                  <small className="block text-[12px] text-[var(--foreground-secondary)]">{person.email || 'email pending'}</small>
                </div>
                <div className="text-[13px] text-white">{tierColumnLabel(person)}</div>
                <div className="text-[13px] text-white">{person.roles.map((role) => tierDisplayLabel(role)).join(', ')}</div>
                <div className="text-[13px] text-[var(--foreground-secondary)]">
                  {combinedOrganizations.find((organization) => organization.id === person.organizationId)?.name || 'unassigned'}
                </div>
                <div className="space-y-1">
                  <StatusPillComponent status={person.status} />
                  <small className="block text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-secondary)]">
                    {person.approvalState}
                  </small>
                </div>
              </div>
            )
          }}
        />
      </AtlasInsetCard>

      <AtlasInsetCard className="rounded-[22px] px-5 py-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[22px] font-medium text-white">Directory editor</div>
          {personDraft ? (
            <AtlasTextButton
              onClick={() => onOpenPerson(personDraft.id)}
              className="px-3 py-2 text-[12px] font-medium"
              style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
            >
              open permission record
            </AtlasTextButton>
          ) : null}
        </div>
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
            <FieldComponent label="tier standing">
              <TierStandingEditor
                personId={personDraft.id}
                record={tierRecordByPersonId.get(personDraft.id) || null}
                disabled={isSavingTier}
                onSetTier={onSavePersonTier}
                onMarkAlum={onMarkPersonTierAlum}
                onSetLucidEmployee={onSavePersonLucidEmployee}
                onSetDesignation={onSavePersonDesignation}
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
                      {tierDisplayLabel(role)}
                    </AtlasTextButton>
                  )
                })}
              </div>
              <small className="mt-2 block text-[12px] text-[var(--foreground-secondary)]">
                Role chips are the directory record. The tier standing above writes the database tier through fn_set_person_tier.
              </small>
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
            <FieldComponent label="pray phone warm line">
              <WarmLineAccessToggle
                personId={personDraft.id}
                personRoles={personDraft.roles}
                mode="admin"
              />
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
                  Approval decides whether this person can sign in. Permission exceptions are edited on the permission record.
                </small>
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
