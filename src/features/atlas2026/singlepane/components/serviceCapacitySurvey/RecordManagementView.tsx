import React from 'react'
import { Trash2 } from 'lucide-react'
import { AtlasIconButton, AtlasInsetCard, AtlasPanel, AtlasPlusButton, AtlasStatusPill, AtlasTextButton } from '../../../components/AtlasPrimitives'
import { SP_COLORS } from '../../theme'
import type { PartnerServiceCapacitySubmissionRecord } from '../../types'
import { formatDateTimeLabel } from './draft'

export function RecordManagementView({
  records,
  totalSurveyCardCount,
  resumeDraftRecord,
  resumeDraftPersistedAtLabel,
  hasPersistedDraft,
  isResolvingResumeDraft,
  resumeDraftError,
  onCheckoutNewRecord,
  onResumeDraft,
  onEditDraftRecord,
  onDeleteDraftRecord
}: {
  records: PartnerServiceCapacitySubmissionRecord[]
  totalSurveyCardCount: number
  resumeDraftRecord: PartnerServiceCapacitySubmissionRecord | null
  resumeDraftPersistedAtLabel: string | null
  hasPersistedDraft: boolean
  isResolvingResumeDraft: boolean
  resumeDraftError: string | null
  onCheckoutNewRecord: () => void
  onResumeDraft: () => void
  onEditDraftRecord: (record: PartnerServiceCapacitySubmissionRecord) => void
  onDeleteDraftRecord: (record: PartnerServiceCapacitySubmissionRecord) => void
}) {
  return (
    <AtlasPanel
      kicker="partner service capacity"
      title="Record management"
      description="Review service-capacity submission history in read-only mode, then check out a new blank survey record when you are ready to reassess."
      className="rounded-[21px] bg-[var(--surface-panel-soft)]"
      actions={
        <AtlasPlusButton
          onClick={onCheckoutNewRecord}
          label="Conduct a new service capacity survey"
        />
      }
    >
      <div className="space-y-3">
        {isResolvingResumeDraft || hasPersistedDraft || resumeDraftError ? (
          <AtlasInsetCard className="rounded-[16px] border-white/20 bg-[#090909] px-4 py-4 md:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <small className="block text-[11px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
                  resume draft
                </small>
                {resumeDraftError ? (
                  <div className="mt-1 text-[13px]" style={{ color: SP_COLORS.red }}>
                    {resumeDraftError}
                  </div>
                ) : isResolvingResumeDraft ? (
                  <div className="mt-1 text-[14px] text-white md:text-[15px]">Checking for your unfinished survey...</div>
                ) : (
                  <>
                    <div className="mt-1 text-[16px] font-medium text-white md:text-[18px]">
                      {resumeDraftRecord
                        ? [resumeDraftRecord.header.firstName, resumeDraftRecord.header.lastName].filter(Boolean).join(' ') || 'unfinished survey'
                        : 'unfinished survey'}
                    </div>
                    <small className="mt-1 block text-[12px] text-[var(--foreground-secondary)] md:text-[13px]">
                      {resumeDraftRecord?.header.organizationName || 'Draft available in this browser'}
                      {resumeDraftPersistedAtLabel ? ` · last updated ${resumeDraftPersistedAtLabel}` : ''}
                    </small>
                  </>
                )}
              </div>
              {hasPersistedDraft && !resumeDraftError ? (
                <AtlasTextButton
                  onClick={onResumeDraft}
                  disabled={isResolvingResumeDraft}
                  className="px-4 py-2 text-[13px] font-medium md:text-[14px]"
                  style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
                >
                  resume draft
                </AtlasTextButton>
              ) : null}
            </div>
          </AtlasInsetCard>
        ) : null}
        {records.length ? (
          records.map((record) => {
            const updatedLabel = formatDateTimeLabel(record.updatedAtIso || record.submittedAtIso)
            const completedLabel = formatDateTimeLabel(record.completedAtIso)
            const respondentName = [record.header.firstName, record.header.lastName].filter(Boolean).join(' ').trim() || 'respondent not recorded'
            return (
              <AtlasInsetCard key={record.id} className="rounded-[16px] border-white/15 bg-[var(--surface-panel-raised)] px-4 py-4 md:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {record.status === 'draft' ? (
                        <>
                          <AtlasIconButton
                            onClick={() => onEditDraftRecord(record)}
                            className="h-7 w-7"
                            style={{ ['--button-border-color' as const]: '#ffffff2f', color: SP_COLORS.white } as React.CSSProperties}
                            aria-label={`Edit draft record ${record.id}`}
                            title="Edit draft"
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.8">
                              <path d="M4 20h4l10-10-4-4L4 16v4Z" />
                              <path d="m12 6 4 4" />
                            </svg>
                          </AtlasIconButton>
                          <AtlasIconButton
                            onClick={() => onDeleteDraftRecord(record)}
                            className="h-7 w-7"
                            style={{ ['--button-border-color' as const]: '#ffffff2f', color: SP_COLORS.red } as React.CSSProperties}
                            aria-label={`Delete draft record ${record.id}`}
                            title="Delete draft"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </AtlasIconButton>
                        </>
                      ) : null}
                      <StatusPill status={record.status} />
                      <small className="text-[12px] text-[var(--foreground-secondary)] md:text-[13px]">
                        {formatDateTimeLabel(record.completedAtIso || record.updatedAtIso || record.submittedAtIso) || 'timestamp unavailable'}
                      </small>
                    </div>
                    <div className="text-[18px] font-medium text-white md:text-[20px]">{respondentName}</div>
                  </div>
                  <small className="font-mono text-[11px] lowercase text-[var(--foreground-secondary)] md:text-[12px]">
                    record id {record.id}
                  </small>
                </div>

                <div className="mt-3 grid gap-3 text-[13px] md:grid-cols-4 md:text-[14px]">
                  <ReadOnlyMetric label="organization" value={record.header.organizationName || 'not recorded'} />
                  <ReadOnlyMetric label="updated" value={updatedLabel || 'not recorded'} />
                  <ReadOnlyMetric label="completed" value={completedLabel || 'not completed'} />
                  <ReadOnlyMetric label="ratings captured" value={`${record.answers.length} / ${totalSurveyCardCount}`} />
                </div>
              </AtlasInsetCard>
            )
          })
        ) : (
          <AtlasInsetCard className="rounded-[16px] border-white/15 bg-[var(--surface-panel-raised)] px-4 py-6 text-center md:px-5">
            <div className="text-[18px] font-medium text-white md:text-[20px]">No service-capacity records yet</div>
            <small className="mt-2 block text-[13px] text-[var(--foreground-secondary)] md:text-[15px]">
              Use the + action to check out the first blank survey record for this partner.
            </small>
          </AtlasInsetCard>
        )}
      </div>
    </AtlasPanel>
  )
}

function StatusPill({ status }: { status: PartnerServiceCapacitySubmissionRecord['status'] }) {
  const isCompleted = status === 'completed'
  return <AtlasStatusPill color={isCompleted ? SP_COLORS.deepGreen : SP_COLORS.yellow}>{status}</AtlasStatusPill>
}

function ReadOnlyMetric({ label, value }: { label: string; value: string }) {
  return (
    <AtlasInsetCard className="rounded-[12px] border-white/10 px-3 py-2">
      <small className="block text-[11px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
        {label}
      </small>
      <div className="mt-1 text-white">{value}</div>
    </AtlasInsetCard>
  )
}
