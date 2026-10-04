import React, { useMemo, useState } from 'react'
import { AtlasInsetCard, AtlasStatusPill, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import AdminPersonNameButton from '@/features/atlas2026/admin/components/AdminPersonNameButton'
import type { AdminPermissionInteraction, AdminPermissionRecordKind } from '@/features/atlas2026/admin/components/adminDataControlPanelModel'
import { toAtlasRoles } from '@/features/atlas2026/admin/components/adminDataControlPanelModel'
import type { AdminPortalFeaturePolicy, AdminPortalPersonRecord, AdminRoleCapabilityPolicies, AtlasRole } from '@/features/atlas2026/shared/contracts'
import {
  ATLAS_PERMISSION_ROLES,
  CAPABILITY_GROUPS,
  applyPersonCapabilityChoice,
  applyRoleCapabilitySetting,
  countPersonExceptions,
  countRoleChanges,
  listPersonCapabilityRows,
  listRoleCapabilityRows,
  type PersonCapabilityChoice,
  type PersonCapabilityRow,
  type RoleCapabilityRow
} from '@/features/atlas2026/shared/roleCapabilityPolicy'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'

interface AdminPermissionRecordDeskProps {
  people: AdminPortalPersonRecord[]
  rolePolicies: AdminRoleCapabilityPolicies
  recordKind: AdminPermissionRecordKind
  onRecordKindChange: (kind: AdminPermissionRecordKind) => void
  interaction: AdminPermissionInteraction
  onInteractionChange: (interaction: AdminPermissionInteraction) => void
  selectedPersonId: string | null
  onSelectPerson: (personId: string) => void
  selectedRole: AtlasRole
  onSelectRole: (role: AtlasRole) => void
  isSaving: boolean
  onSavePersonPolicy: (personId: string, featurePolicy: AdminPortalFeaturePolicy) => Promise<void>
  onSaveRolePolicies: (rolePolicies: AdminRoleCapabilityPolicies, role: AtlasRole) => Promise<void>
  onClearPersonExceptions: (person: AdminPortalPersonRecord) => Promise<void>
}

const EMPTY_POLICY: AdminPortalFeaturePolicy = { screenToggles: {}, cardToggles: {}, actionToggles: {} }

function policySignature(policy: AdminPortalFeaturePolicy) {
  const entries = (map: Record<string, boolean>) =>
    Object.keys(map)
      .sort()
      .map((key) => `${key}:${map[key] ? '1' : '0'}`)
      .join(',')
  return `${entries(policy.screenToggles)}|${entries(policy.cardToggles)}|${entries(policy.actionToggles)}`
}

function ChoiceButton({
  label,
  selected,
  tone,
  disabled,
  onClick
}: {
  label: string
  selected: boolean
  tone: 'role' | 'exception'
  disabled?: boolean
  onClick: () => void
}) {
  const color = selected ? (tone === 'exception' ? SP_COLORS.yellow : 'var(--atlas-signal-lucid-teal)') : SP_COLORS.white
  return (
    <AtlasTextButton
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 text-[12px] font-medium"
      style={
        {
          ['--button-border-color' as const]: selected ? color : '#ffffff25',
          color,
          backgroundColor: selected ? 'rgba(255,255,255,0.06)' : 'transparent'
        } as React.CSSProperties
      }
    >
      {label}
    </AtlasTextButton>
  )
}

function SourcePill({ isOverride, fromRole }: { isOverride: boolean; fromRole: boolean }) {
  if (fromRole) {
    return <AtlasStatusPill color={isOverride ? SP_COLORS.yellow : 'var(--atlas-signal-lucid-teal)'}>{isOverride ? 'exception' : 'from role'}</AtlasStatusPill>
  }
  return <AtlasStatusPill color={isOverride ? SP_COLORS.yellow : 'var(--atlas-signal-lucid-teal)'}>{isOverride ? 'changed on role' : 'system default'}</AtlasStatusPill>
}

function OutcomePill({ allowed }: { allowed: boolean }) {
  return <AtlasStatusPill color={allowed ? SP_COLORS.deepGreen : SP_COLORS.red}>{allowed ? 'allow' : 'block'}</AtlasStatusPill>
}

export default function AdminPermissionRecordDesk({
  people,
  rolePolicies,
  recordKind,
  onRecordKindChange,
  interaction,
  onInteractionChange,
  selectedPersonId,
  onSelectPerson,
  selectedRole,
  onSelectRole,
  isSaving,
  onSavePersonPolicy,
  onSaveRolePolicies,
  onClearPersonExceptions
}: AdminPermissionRecordDeskProps) {
  const [query, setQuery] = useState('')
  const [exceptionsOnly, setExceptionsOnly] = useState(false)
  const [personDrafts, setPersonDrafts] = useState<Record<string, AdminPortalFeaturePolicy>>({})
  const [roleDraft, setRoleDraft] = useState<AdminRoleCapabilityPolicies | null>(null)
  const editing = interaction === 'edit'
  const savedRolePolicies = rolePolicies || {}
  const activeRolePolicies = roleDraft || savedRolePolicies

  const indexedPeople = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return people
      .map((person) => ({
        person,
        exceptionCount: countPersonExceptions(toAtlasRoles(person.roles), personDrafts[person.id] || person.featurePolicy, activeRolePolicies)
      }))
      .filter(({ person, exceptionCount }) => {
        if (exceptionsOnly && exceptionCount === 0) return false
        if (!needle) return true
        return `${person.fullName} ${person.email} ${person.roles.join(' ')}`.toLowerCase().includes(needle)
      })
      .sort((left, right) => (left.person.fullName || left.person.email).localeCompare(right.person.fullName || right.person.email))
  }, [activeRolePolicies, exceptionsOnly, people, personDrafts, query])

  const selectedPerson = people.find((person) => person.id === selectedPersonId) || indexedPeople[0]?.person || null
  const personIndex = selectedPerson ? indexedPeople.findIndex((row) => row.person.id === selectedPerson.id) : -1
  const roleIndex = ATLAS_PERMISSION_ROLES.indexOf(selectedRole)
  const recordCount = recordKind === 'person' ? indexedPeople.length : ATLAS_PERMISSION_ROLES.length
  const recordPosition = recordKind === 'person' ? personIndex : roleIndex

  const personPolicy = selectedPerson ? personDrafts[selectedPerson.id] || selectedPerson.featurePolicy : null
  const personRows = selectedPerson && personPolicy ? listPersonCapabilityRows(toAtlasRoles(selectedPerson.roles), personPolicy, activeRolePolicies) : []
  const roleRows = listRoleCapabilityRows(selectedRole, activeRolePolicies)
  const personDirty = Boolean(selectedPerson && personPolicy && policySignature(personPolicy) !== policySignature(selectedPerson.featurePolicy))
  // A role draft can hold edits for a role you are not looking at, so save stays
  // available until every changed role is stored or discarded.
  const roleDirty = ATLAS_PERMISSION_ROLES.some(
    (role) => policySignature(activeRolePolicies[role] || EMPTY_POLICY) !== policySignature(savedRolePolicies[role] || EMPTY_POLICY)
  )
  const peopleOnRole = people.filter((person) => person.roles.includes(selectedRole))

  function stepRecord(direction: -1 | 1) {
    if (recordKind === 'person') {
      const next = indexedPeople[personIndex + direction]
      if (next) onSelectPerson(next.person.id)
      return
    }
    const nextRole = ATLAS_PERMISSION_ROLES[roleIndex + direction]
    if (nextRole) onSelectRole(nextRole)
  }

  function updatePersonChoice(row: PersonCapabilityRow, choice: PersonCapabilityChoice) {
    if (!selectedPerson || !personPolicy || !editing) return
    const nextScope = applyPersonCapabilityChoice(personPolicy[row.scope], row.key, choice, row.roleAllowed)
    setPersonDrafts((current) => ({
      ...current,
      [selectedPerson.id]: { ...personPolicy, [row.scope]: nextScope }
    }))
  }

  function updateRoleSetting(row: RoleCapabilityRow, allowed: boolean) {
    if (!editing) return
    setRoleDraft(applyRoleCapabilitySetting(activeRolePolicies, selectedRole, row.scope, row.key, allowed))
  }

  async function savePersonRecord() {
    if (!selectedPerson || !personPolicy) return
    await onSavePersonPolicy(selectedPerson.id, personPolicy)
    setPersonDrafts((current) => {
      const next = { ...current }
      delete next[selectedPerson.id]
      return next
    })
  }

  async function saveRoleRecord() {
    if (!roleDraft) return
    await onSaveRolePolicies(roleDraft, selectedRole)
    setRoleDraft(null)
  }

  function discardPersonRecord() {
    if (!selectedPerson) return
    setPersonDrafts((current) => {
      const next = { ...current }
      delete next[selectedPerson.id]
      return next
    })
  }

  async function clearPerson() {
    if (!selectedPerson) return
    setPersonDrafts((current) => {
      const next = { ...current }
      delete next[selectedPerson.id]
      return next
    })
    await onClearPersonExceptions(selectedPerson)
  }

  return (
    <div className="space-y-4">
      <AtlasInsetCard className="rounded-[22px] px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <div className="text-[22px] font-medium text-white">Permission records</div>
            <small className="mt-1 block text-[13px] leading-relaxed text-[var(--foreground-secondary)]">
              Open one person or one role at a time. A person keeps the role permissions unless you set an exception. Navigate moves between records. Edit changes the record that is open.
            </small>
          </div>
          <div className="flex flex-wrap gap-2">
            <ChoiceButton label="Navigate" selected={!editing} tone="role" onClick={() => onInteractionChange('navigate')} />
            <ChoiceButton label="Edit" selected={editing} tone="exception" onClick={() => onInteractionChange('edit')} />
          </div>
        </div>
      </AtlasInsetCard>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <AtlasInsetCard className="rounded-[22px] px-4 py-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <ChoiceButton label="People" selected={recordKind === 'person'} tone="role" onClick={() => onRecordKindChange('person')} />
            <ChoiceButton label="Roles" selected={recordKind === 'role'} tone="role" onClick={() => onRecordKindChange('role')} />
          </div>
          {recordKind === 'person' ? (
            <div className="space-y-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a person"
                className="atlas-admin-input"
              />
              <ChoiceButton
                label={exceptionsOnly ? 'Exceptions only' : 'All people'}
                selected={exceptionsOnly}
                tone="exception"
                onClick={() => setExceptionsOnly((current) => !current)}
              />
              <div className="max-h-[640px] space-y-1 overflow-y-auto">
                {indexedPeople.map(({ person, exceptionCount }) => {
                  const selected = person.id === selectedPerson?.id
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => onSelectPerson(person.id)}
                      className="block w-full rounded-[14px] px-3 py-2 text-left hover:bg-white/5"
                      style={selected ? { backgroundColor: 'rgba(252,192,26,0.08)' } : undefined}
                    >
                      <div className="text-[14px] font-medium text-white">{person.fullName || person.email || 'unnamed person'}</div>
                      <small className="block text-[12px] text-[var(--foreground-secondary)]">
                        {person.roles.join(', ') || 'no roles'}
                        {exceptionCount ? ` · ${exceptionCount} exception${exceptionCount === 1 ? '' : 's'}` : ' · inherits role'}
                      </small>
                    </button>
                  )
                })}
                {!indexedPeople.length ? <small className="block px-1 text-[12px] text-[var(--foreground-secondary)]">No matching people.</small> : null}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {ATLAS_PERMISSION_ROLES.map((role) => {
                const changes = countRoleChanges(role, activeRolePolicies)
                const selected = role === selectedRole
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => onSelectRole(role)}
                    className="block w-full rounded-[14px] px-3 py-2 text-left hover:bg-white/5"
                    style={selected ? { backgroundColor: 'rgba(252,192,26,0.08)' } : undefined}
                  >
                    <div className="text-[14px] font-medium capitalize text-white">{role}</div>
                    <small className="block text-[12px] text-[var(--foreground-secondary)]">
                      {changes ? `${changes} changed from the system default` : 'system default'}
                    </small>
                  </button>
                )
              })}
            </div>
          )}
        </AtlasInsetCard>

        <AtlasInsetCard className="rounded-[22px] px-5 py-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
                {[
                  recordKind === 'person' ? 'person record' : 'role record',
                  personDirty ? 'unsaved person' : '',
                  roleDirty ? 'unsaved role' : ''
                ].filter(Boolean).join(' · ')}
              </small>
              {recordKind === 'person' ? (
                selectedPerson ? (
                <>
                  <div className="mt-1 text-[22px] font-medium text-white">{selectedPerson.fullName || selectedPerson.email || 'unnamed person'}</div>
                  <small className="mt-1 block text-[13px] text-[var(--foreground-secondary)]">
                    {selectedPerson.email || 'no email'} · {selectedPerson.roles.join(', ') || 'no roles'}
                  </small>
                  {toAtlasRoles(selectedPerson.roles).length ? (
                    <div className="mt-3">
                      <small className="mb-2 block text-[12px] text-[var(--foreground-secondary)]">Open a role record to change what that role grants everyone.</small>
                      <div className="flex flex-wrap gap-2">
                        {toAtlasRoles(selectedPerson.roles).map((role) => (
                          <ChoiceButton
                            key={role}
                            label={`open ${role}`}
                            selected={false}
                            tone="role"
                            onClick={() => {
                              onSelectRole(role)
                              onRecordKindChange('role')
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
                ) : (
                  <div className="mt-1 text-[22px] font-medium text-white">No person open</div>
                )
              ) : (
                <>
                  <div className="mt-1 text-[22px] font-medium capitalize text-white">{selectedRole}</div>
                  <small className="mt-1 block text-[13px] text-[var(--foreground-secondary)]">
                    People with this role inherit these permissions unless their own record has an exception.
                  </small>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AtlasTextButton
                onClick={() => stepRecord(-1)}
                disabled={recordPosition <= 0}
                className="px-3 py-2 text-[12px] font-medium"
                style={{ ['--button-border-color' as const]: '#ffffff25', color: SP_COLORS.white } as React.CSSProperties}
              >
                previous
              </AtlasTextButton>
              <small className="text-[12px] text-[var(--foreground-secondary)]">
                {recordPosition < 0 ? `filtered · ${recordCount} in list` : recordCount ? `${recordPosition + 1} of ${recordCount}` : '0 of 0'}
              </small>
              <AtlasTextButton
                onClick={() => stepRecord(1)}
                disabled={recordPosition < 0 || recordPosition >= recordCount - 1}
                className="px-3 py-2 text-[12px] font-medium"
                style={{ ['--button-border-color' as const]: '#ffffff25', color: SP_COLORS.white } as React.CSSProperties}
              >
                next
              </AtlasTextButton>
            </div>
          </div>

          {!editing ? (
            <small className="mb-4 block text-[12px] text-[var(--foreground-secondary)]">
              Navigate is on, so this record stays as it is. Switch to Edit to change what the role grants or to set an exception.
            </small>
          ) : null}

          {personDirty || roleDirty ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {personDirty ? (
                <>
                  <AtlasTextButton
                    onClick={() => void savePersonRecord()}
                    disabled={isSaving}
                    className="px-3 py-2 text-[12px] font-medium"
                    style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
                  >
                    save person
                  </AtlasTextButton>
                  <AtlasTextButton
                    onClick={discardPersonRecord}
                    disabled={isSaving}
                    className="px-3 py-2 text-[12px] font-medium"
                    style={{ ['--button-border-color' as const]: '#ffffff25', color: SP_COLORS.white } as React.CSSProperties}
                  >
                    discard person
                  </AtlasTextButton>
                </>
              ) : null}
              {roleDirty ? (
                <>
                  <AtlasTextButton
                    onClick={() => void saveRoleRecord()}
                    disabled={isSaving}
                    className="px-3 py-2 text-[12px] font-medium"
                    style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
                  >
                    save role
                  </AtlasTextButton>
                  <AtlasTextButton
                    onClick={() => setRoleDraft(null)}
                    disabled={isSaving}
                    className="px-3 py-2 text-[12px] font-medium"
                    style={{ ['--button-border-color' as const]: '#ffffff25', color: SP_COLORS.white } as React.CSSProperties}
                  >
                    discard role
                  </AtlasTextButton>
                </>
              ) : null}
            </div>
          ) : null}

          {recordKind === 'person' && selectedPerson && editing ? (
            <div className="mb-4">
              <AtlasTextButton
                onClick={() => void clearPerson()}
                disabled={isSaving || countPersonExceptions(toAtlasRoles(selectedPerson.roles), selectedPerson.featurePolicy, savedRolePolicies) === 0}
                className="px-3 py-2 text-[12px] font-medium"
                style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
              >
                clear saved exceptions
              </AtlasTextButton>
            </div>
          ) : null}

          {recordKind === 'role' ? (
            <div className="mb-4">
              <small className="mb-2 block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
                {peopleOnRole.length} {peopleOnRole.length === 1 ? 'person inherits' : 'people inherit'} this role
              </small>
              <div className="flex max-h-28 flex-wrap gap-x-3 gap-y-1 overflow-y-auto">
                {peopleOnRole.map((person) => (
                  <AdminPersonNameButton
                    key={person.id}
                    name={person.fullName || person.email}
                    onOpen={() => {
                      onRecordKindChange('person')
                      onSelectPerson(person.id)
                    }}
                    className="text-[13px]"
                  />
                ))}
                {!peopleOnRole.length ? <small className="text-[12px] text-[var(--foreground-secondary)]">No people currently hold this role.</small> : null}
              </div>
            </div>
          ) : null}

          {!selectedPerson && recordKind === 'person' ? (
            <small className="text-[13px] text-[var(--foreground-secondary)]">Select a person to open their permission record.</small>
          ) : (
            <div className="space-y-4">
              {CAPABILITY_GROUPS.map((group) => (
                <CapabilityGroup
                  key={group.scope}
                  label={group.label}
                  editing={editing}
                  rows={
                    recordKind === 'person'
                      ? personRows.filter((row) => row.scope === group.scope)
                      : roleRows.filter((row) => row.scope === group.scope)
                  }
                  onPersonChoice={updatePersonChoice}
                  onRoleSetting={updateRoleSetting}
                />
              ))}
            </div>
          )}
        </AtlasInsetCard>
      </div>
    </div>
  )
}

function CapabilityGroup({
  label,
  editing,
  rows,
  onPersonChoice,
  onRoleSetting
}: {
  label: string
  editing: boolean
  rows: Array<PersonCapabilityRow | RoleCapabilityRow>
  onPersonChoice: (row: PersonCapabilityRow, choice: PersonCapabilityChoice) => void
  onRoleSetting: (row: RoleCapabilityRow, allowed: boolean) => void
}) {
  return (
    <div>
      <small className="mb-2 block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">{label}</small>
      <div className="divide-y divide-white/10 rounded-[16px] border border-white/10">
        {rows.map((row) => {
          const personRow = 'isException' in row ? row : null
          const roleRow = personRow ? null : (row as RoleCapabilityRow)
          const allowed = personRow ? personRow.effectiveAllowed : roleRow?.allowed || false
          const isOverride = personRow ? personRow.isException : Boolean(roleRow?.isRoleChange)
          return (
            <div key={`${row.scope}:${row.key}`} className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1.3fr)_auto_minmax(0,1fr)] md:items-center">
              <div>
                <div className="text-[14px] text-white">{row.label}</div>
                <small className="block text-[12px] text-[var(--foreground-secondary)]">
                  {personRow
                    ? personRow.isException
                      ? `Role would ${personRow.roleAllowed ? 'allow' : 'block'} · ${personRow.roleDetail}`
                      : personRow.roleDetail
                    : roleRow?.isRoleChange
                      ? 'This role no longer uses the shipped default.'
                      : 'Shipped default for this role.'}
                </small>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SourcePill isOverride={isOverride} fromRole={Boolean(personRow)} />
                <OutcomePill allowed={allowed} />
              </div>
              {editing && personRow ? (
                <div className="flex flex-wrap gap-2">
                  <ChoiceButton label="Use role" selected={!personRow.isException} tone="role" onClick={() => onPersonChoice(personRow, 'inherit')} />
                  <ChoiceButton label="Allow" selected={personRow.isException && personRow.effectiveAllowed} tone="exception" onClick={() => onPersonChoice(personRow, 'allow')} />
                  <ChoiceButton label="Block" selected={personRow.isException && !personRow.effectiveAllowed} tone="exception" onClick={() => onPersonChoice(personRow, 'block')} />
                </div>
              ) : null}
              {editing && roleRow ? (
                <div className="flex flex-wrap gap-2">
                  <ChoiceButton label="Allow" selected={roleRow.allowed} tone={roleRow.isRoleChange && roleRow.allowed ? 'exception' : 'role'} onClick={() => onRoleSetting(roleRow, true)} />
                  <ChoiceButton label="Block" selected={!roleRow.allowed} tone={roleRow.isRoleChange && !roleRow.allowed ? 'exception' : 'role'} onClick={() => onRoleSetting(roleRow, false)} />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
