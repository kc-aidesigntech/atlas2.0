import React from 'react'
import { AtlasInsetCard, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import type { AdminPortalCustomEnrolleeRecord, AdminPortalPersonRecord } from '@/features/atlas2026/singlepane/types'
import type {
  CombinedEnrolleeRow,
  FieldComponentType,
  RecordTableComponentType,
  SetState,
  StatusPillComponentType
} from '@/features/atlas2026/admin/components/types'

interface AdminEnrolleesSectionProps {
  visibleEnrollees: CombinedEnrolleeRow[]
  selectedEnrolleeId: string | null
  setSelectedEnrolleeId: (id: string | null) => void
  setEnrolleeDraft: SetState<CombinedEnrolleeRow | null>
  createPortalId: (prefix: string) => string
  buildBlankCustomEnrollee: (id?: string) => AdminPortalCustomEnrolleeRecord
  navigators: AdminPortalPersonRecord[]
  enrolleeDraft: CombinedEnrolleeRow | null
  selectedDraftParentCodes: string[]
  openZCodePicker: () => void
  selectedDraftZCodes: string[]
  handleSaveEnrolleeDraft: () => void
  handleArchiveEnrollee: (row: CombinedEnrolleeRow) => Promise<void>
  isSubmittingEnrollee: boolean
  CUSTOM_ENROLLEE_STATUS_OPTIONS: readonly AdminPortalCustomEnrolleeRecord['status'][]
  setDraftFromUpdater: SetState<CombinedEnrolleeRow | null>
  RecordTableComponent: RecordTableComponentType
  StatusPillComponent: StatusPillComponentType
  FieldComponent: FieldComponentType
  ZCodeParentFilterCircleComponent: React.ComponentType<{ parentCode: string; selected: boolean }>
}

export default function AdminEnrolleesSection({
  visibleEnrollees,
  selectedEnrolleeId,
  setSelectedEnrolleeId,
  setEnrolleeDraft,
  createPortalId,
  buildBlankCustomEnrollee,
  navigators,
  enrolleeDraft,
  selectedDraftParentCodes,
  openZCodePicker,
  selectedDraftZCodes,
  handleSaveEnrolleeDraft,
  handleArchiveEnrollee,
  isSubmittingEnrollee,
  CUSTOM_ENROLLEE_STATUS_OPTIONS,
  setDraftFromUpdater,
  RecordTableComponent,
  StatusPillComponent,
  FieldComponent,
  ZCodeParentFilterCircleComponent
}: AdminEnrolleesSectionProps) {
  return (
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
        <RecordTableComponent
          columns={['enrollee', 'navigator', 'source', 'status']}
          rows={visibleEnrollees.map((row) => ({ id: row.id }))}
          renderRow={({ id }: { id: string }) => {
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
                  <StatusPillComponent status={status} />
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
          {enrolleeDraft ? <StatusPillComponent status={enrolleeDraft.kind === 'existing' ? 'live record' : enrolleeDraft.record.status} /> : null}
        </div>
        {enrolleeDraft ? (
          <div className="space-y-3">
            <FieldComponent label="full name">
              <input
                value={enrolleeDraft.kind === 'existing' ? enrolleeDraft.intake.fullName : enrolleeDraft.record.fullName}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setDraftFromUpdater((current) => {
                    if (!current) return current
                    if (current.kind === 'existing') return { ...current, intake: { ...current.intake, fullName: event.target.value } }
                    return { ...current, record: { ...current.record, fullName: event.target.value } }
                  })
                }
                className="atlas-admin-input"
              />
            </FieldComponent>
            <div className="grid gap-3 md:grid-cols-2">
              <FieldComponent label="date of birth">
                <input
                  value={enrolleeDraft.kind === 'existing' ? enrolleeDraft.intake.dob : enrolleeDraft.record.dob}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setDraftFromUpdater((current) => {
                      if (!current) return current
                      if (current.kind === 'existing') return { ...current, intake: { ...current.intake, dob: event.target.value } }
                      return { ...current, record: { ...current.record, dob: event.target.value } }
                    })
                  }
                  className="atlas-admin-input"
                />
              </FieldComponent>
              <FieldComponent label="case id">
                <input
                  value={enrolleeDraft.kind === 'existing' ? enrolleeDraft.intake.caseId : enrolleeDraft.record.caseId}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setDraftFromUpdater((current) => {
                      if (!current) return current
                      if (current.kind === 'existing') return { ...current, intake: { ...current.intake, caseId: event.target.value } }
                      return { ...current, record: { ...current.record, caseId: event.target.value } }
                    })
                  }
                  className="atlas-admin-input"
                />
              </FieldComponent>
              <FieldComponent label="email">
                <input
                  value={enrolleeDraft.kind === 'existing' ? enrolleeDraft.intake.email : enrolleeDraft.record.email}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setDraftFromUpdater((current) => {
                      if (!current) return current
                      if (current.kind === 'existing') return { ...current, intake: { ...current.intake, email: event.target.value } }
                      return { ...current, record: { ...current.record, email: event.target.value } }
                    })
                  }
                  className="atlas-admin-input"
                />
              </FieldComponent>
              <FieldComponent label="assigned navigator">
                <select
                  value={enrolleeDraft.kind === 'existing' ? enrolleeDraft.intake.assignedNavigator : enrolleeDraft.record.assignedNavigator}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                    setDraftFromUpdater((current) => {
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
              </FieldComponent>
              {enrolleeDraft.kind === 'custom' ? (
                <FieldComponent label="status">
                  <select
                    value={enrolleeDraft.record.status}
                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                      setDraftFromUpdater((current) =>
                        current && current.kind === 'custom'
                          ? { ...current, record: { ...current.record, status: event.target.value } }
                          : current
                      )
                    }
                    className="atlas-admin-input"
                  >
                    {CUSTOM_ENROLLEE_STATUS_OPTIONS.map((statusOption) => (
                      <option key={statusOption} value={statusOption}>
                        {statusOption}
                      </option>
                    ))}
                  </select>
                </FieldComponent>
              ) : null}
            </div>
            <FieldComponent label="enrollment start">
              <input
                type="date"
                value={(enrolleeDraft.kind === 'existing' ? enrolleeDraft.intake.enrollmentStartIso : enrolleeDraft.record.enrollmentStartIso).slice(0, 10)}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setDraftFromUpdater((current) => {
                    if (!current) return current
                    const nextIso = `${event.target.value || '2026-01-01'}T00:00:00.000Z`
                    if (current.kind === 'existing') return { ...current, intake: { ...current.intake, enrollmentStartIso: nextIso } }
                    return { ...current, record: { ...current.record, enrollmentStartIso: nextIso } }
                  })
                }
                className="atlas-admin-input"
              />
            </FieldComponent>
            <FieldComponent label="z-codes">
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
                            <ZCodeParentFilterCircleComponent parentCode={code} selected />
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
            </FieldComponent>
            {enrolleeDraft.kind === 'custom' ? (
              <FieldComponent label="notes">
                <textarea
                  value={enrolleeDraft.record.notes}
                  onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setDraftFromUpdater((current) =>
                      current && current.kind === 'custom' ? { ...current, record: { ...current.record, notes: event.target.value } } : current
                    )
                  }
                  className="atlas-admin-input min-h-[96px] resize-y"
                />
              </FieldComponent>
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
  )
}
