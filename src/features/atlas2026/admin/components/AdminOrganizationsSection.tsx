import React from 'react'
import { AtlasInsetCard, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import type {
  AdminOrganizationsSectionDataProps,
  FieldComponentType,
  RecordTableComponentType,
  StatusPillComponentType
} from '@/features/atlas2026/admin/components/types'

interface AdminOrganizationsSectionProps {
  setOrganizationDraft: AdminOrganizationsSectionDataProps['setOrganizationDraft']
  buildBlankOrganization: AdminOrganizationsSectionDataProps['buildBlankOrganization']
  combinedOrganizations: AdminOrganizationsSectionDataProps['combinedOrganizations']
  selectedOrganizationId: AdminOrganizationsSectionDataProps['selectedOrganizationId']
  setSelectedOrganizationId: AdminOrganizationsSectionDataProps['setSelectedOrganizationId']
  combinedPeople: AdminOrganizationsSectionDataProps['combinedPeople']
  organizationDraft: AdminOrganizationsSectionDataProps['organizationDraft']
  handleSaveOrganizationDraft: AdminOrganizationsSectionDataProps['handleSaveOrganizationDraft']
  handleDeleteOrganization: AdminOrganizationsSectionDataProps['handleDeleteOrganization']
  ORG_TYPE_OPTIONS: AdminOrganizationsSectionDataProps['organizationTypeOptions']
  RecordTableComponent: RecordTableComponentType
  StatusPillComponent: StatusPillComponentType
  FieldComponent: FieldComponentType
}

export default function AdminOrganizationsSection({
  setOrganizationDraft,
  buildBlankOrganization,
  combinedOrganizations,
  selectedOrganizationId,
  setSelectedOrganizationId,
  combinedPeople,
  organizationDraft,
  ORG_TYPE_OPTIONS,
  handleSaveOrganizationDraft,
  handleDeleteOrganization,
  RecordTableComponent,
  StatusPillComponent,
  FieldComponent
}: AdminOrganizationsSectionProps) {
  // Organization CRUD remains grouped to preserve contact ownership workflows
  // while the parent component focuses on cross-section orchestration.
  return (
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
        <RecordTableComponent
          columns={['organization', 'type', 'primary contact', 'status']}
          rows={combinedOrganizations.map((organization) => ({ id: organization.id }))}
          renderRow={({ id }: { id: string }) => {
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
                  <StatusPillComponent status={organization.status} />
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
            <FieldComponent label="name">
              <input value={organizationDraft.name} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setOrganizationDraft({ ...organizationDraft, name: event.target.value })} className="atlas-admin-input" />
            </FieldComponent>
            <div className="grid gap-3 md:grid-cols-2">
              <FieldComponent label="type">
                <select
                  value={organizationDraft.type}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                    setOrganizationDraft({
                      ...organizationDraft,
                      type: event.target.value
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
              </FieldComponent>
              <FieldComponent label="county">
                <input value={organizationDraft.countyName} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setOrganizationDraft({ ...organizationDraft, countyName: event.target.value })} className="atlas-admin-input" />
              </FieldComponent>
            </div>
            <FieldComponent label="primary contact">
              <select
                value={organizationDraft.primaryContactPersonId || ''}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setOrganizationDraft({ ...organizationDraft, primaryContactPersonId: event.target.value || null })}
                className="atlas-admin-input"
              >
                <option value="">Unassigned</option>
                {combinedPeople.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName}
                  </option>
                ))}
              </select>
            </FieldComponent>
            <FieldComponent label="status">
              <select
                value={organizationDraft.status}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                  setOrganizationDraft({
                    ...organizationDraft,
                    status: event.target.value
                  })
                }
                className="atlas-admin-input"
              >
                <option value="active">active</option>
                <option value="draft">draft</option>
                <option value="inactive">inactive</option>
              </select>
            </FieldComponent>
            <FieldComponent label="notes">
              <textarea
                value={organizationDraft.notes}
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setOrganizationDraft({ ...organizationDraft, notes: event.target.value })}
                className="atlas-admin-input min-h-[96px] resize-y"
              />
            </FieldComponent>
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
  )
}
