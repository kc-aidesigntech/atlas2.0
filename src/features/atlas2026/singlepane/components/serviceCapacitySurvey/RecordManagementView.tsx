import React, { useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { AtlasInsetCard, AtlasPanel, AtlasPlusButton, AtlasStatusPill } from '../../../components/AtlasPrimitives'
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
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7549/ingest/0a2b055f-3c79-424f-9cff-1288c71c5ade',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0b07da'},body:JSON.stringify({sessionId:'0b07da',runId:'service-capacity-debug-1',hypothesisId:'H3',location:'RecordManagementView.tsx:33',message:'record management render state',data:{recordCount:records.length,hasPersistedDraft,isResolvingResumeDraft,resumeDraftError:resumeDraftError??null,resumeDraftRecordId:resumeDraftRecord?.id??null,resumeDraftPersistedAtLabel:resumeDraftPersistedAtLabel??null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [hasPersistedDraft, isResolvingResumeDraft, records.length, resumeDraftError, resumeDraftPersistedAtLabel, resumeDraftRecord?.id])

  return (
    <AtlasPanel
      kicker="partner service capacity"
      title="Record management"
      description="Review service-capacity submission history in read-only mode, then check out a new blank survey record when you are ready to reassess."
      className="rounded-[21px] bg-[#020202]"
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
                <button
                  type="button"
                  onClick={onResumeDraft}
                  disabled={isResolvingResumeDraft}
                  className="atlas-sign-button [--button-line-inset:8px] [--button-radius:10px] rounded-[10px] border px-4 py-2 text-[13px] font-medium transition-[box-shadow,border-color] duration-150 ease-out hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_18px_rgba(255,255,255,0.1)] disabled:opacity-60 md:text-[14px]"
                  style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
                >
                  resume draft
                </button>
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
              <AtlasInsetCard key={record.id} className="rounded-[16px] border-white/15 bg-[#060606] px-4 py-4 md:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {record.status === 'draft' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onEditDraftRecord(record)}
                            className="atlas-sign-button atlas-sign-button-icon [--button-line-inset:5px] [--button-radius:8px] inline-flex h-7 w-7 items-center justify-center rounded-[8px] border transition-[box-shadow,border-color,background-color] duration-150 ease-out hover:border-white/50 hover:bg-white/5 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_14px_rgba(255,255,255,0.08)]"
                            style={{ ['--button-border-color' as const]: '#ffffff2f', color: SP_COLORS.white } as React.CSSProperties}
                            aria-label={`Edit draft record ${record.id}`}
                            title="Edit draft"
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.8">
                              <path d="M4 20h4l10-10-4-4L4 16v4Z" />
                              <path d="m12 6 4 4" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteDraftRecord(record)}
                            className="atlas-sign-button atlas-sign-button-icon [--button-line-inset:5px] [--button-radius:8px] inline-flex h-7 w-7 items-center justify-center rounded-[8px] border transition-[box-shadow,border-color,background-color] duration-150 ease-out hover:border-red-400/70 hover:bg-red-500/10 hover:shadow-[0_0_0_1px_rgba(238,53,46,0.18),0_0_14px_rgba(238,53,46,0.08)]"
                            style={{ ['--button-border-color' as const]: '#ffffff2f', color: SP_COLORS.red } as React.CSSProperties}
                            aria-label={`Delete draft record ${record.id}`}
                            title="Delete draft"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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
          <AtlasInsetCard className="rounded-[16px] border-white/15 bg-[#060606] px-4 py-6 text-center md:px-5">
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
