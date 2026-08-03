import React from 'react'
import { selectCompletedPartnerSurveysNewestFirst } from '@/features/atlas2026/singlepane/data-access/domainLoadMapping'
import { ZCODE_DOMAIN_SURVEY_FORM_VERSION } from '@/features/atlas2026/singlepane/data/serviceCapacitySurveyCatalog'
import type {
  DomainLoadBreakdown,
  PartnerServiceCapacitySubmissionRecord
} from '@/features/atlas2026/shared/contracts'

export interface PartnerAnswerTraceEntry {
  submissionId: string
  submissionLabel: string
  submittedAtIso: string
  respondentName: string
  respondentEmail: string
  score: number
  contribution: number
}

export interface GroupedBreakdownRows {
  parentCode: string
  rows: DomainLoadBreakdown['rows']
  averageScore: number
  serviceCapacityAverage: number
  responseCount: number
}

export function groupBreakdownRows(
  rows: DomainLoadBreakdown['rows'],
  partnerAnswerTraceByRowId: Record<string, PartnerAnswerTraceEntry[]> = {}
): GroupedBreakdownRows[] {
  const grouped = new Map<string, DomainLoadBreakdown['rows']>()
  rows.forEach((row) => {
    const parentCode = normalizeParentCode(row)
    const existing = grouped.get(parentCode) || []
    existing.push(row)
    grouped.set(parentCode, existing)
  })
  return Array.from(grouped.entries())
    .map(([parentCode, parentRows]) => ({
      parentCode,
      rows: parentRows.sort((left, right) => left.zCodeGroup.localeCompare(right.zCodeGroup, undefined, { numeric: true })),
      averageScore: parentRows.length ? parentRows.reduce((sum, row) => sum + row.rawCount, 0) / parentRows.length : 0,
      serviceCapacityAverage: parentRows.length
        ? parentRows.reduce((sum, row) => sum + getAverageServiceCapacity(partnerAnswerTraceByRowId[row.id] || []), 0) / parentRows.length
        : 0,
      responseCount: parentRows.reduce((sum, row) => sum + (row.responseCount || 0), 0)
    }))
    .sort((left, right) => left.parentCode.localeCompare(right.parentCode, undefined, { numeric: true }))
}

function normalizeParentCode(row: DomainLoadBreakdown['rows'][number]) {
  const explicitParent = (row.parentCode || '').trim().toUpperCase()
  if (explicitParent) return explicitParent
  return row.zCodeGroup.split('.')[0]?.trim().toUpperCase() || row.zCodeGroup.trim().toUpperCase()
}

function projectDomainSpectrumToBurden(
  score: number,
  mappedDomain: DomainLoadBreakdown['rows'][number]['mappedDomain']
) {
  const clamped = Math.max(1, Math.min(99, score))
  if (clamped <= 33) {
    const ratio = (clamped - 1) / 32
    const habitat = (1 - ratio) * 9
    const socialNetworks = ratio * 9
    return mappedDomain === 'habitat' ? habitat : mappedDomain === 'work' ? 0 : socialNetworks
  }
  if (clamped <= 66) {
    const ratio = (clamped - 33) / 33
    const socialNetworks = (1 - ratio) * 9
    const work = ratio * 9
    return mappedDomain === 'habitat' ? 0 : mappedDomain === 'work' ? work : socialNetworks
  }
  const ratio = (clamped - 66) / 33
  const habitat = ratio * 9
  const work = (1 - ratio) * 9
  return mappedDomain === 'habitat' ? habitat : mappedDomain === 'work' ? work : 0
}

export function buildPartnerAnswerTraceByRowId(
  rows: DomainLoadBreakdown['rows'],
  history: PartnerServiceCapacitySubmissionRecord[]
): Record<string, PartnerAnswerTraceEntry[]> {
  const selectedSubmissions = selectCompletedPartnerSurveysNewestFirst(history).slice(0, 3)
  const rowsById: Record<string, PartnerAnswerTraceEntry[]> = {}
  rows.forEach((row) => {
    const normalizedRowCode = row.zCodeGroup.trim().toUpperCase()
    rowsById[row.id] = selectedSubmissions
      .flatMap((submission) => {
        const matchingAnswer = submission.answers.find((answer) => {
          if (answer.notEncountered || typeof answer.score !== 'number') return false
          return (answer.normalizedZCode || answer.zCode).trim().toUpperCase() === normalizedRowCode
        })
        if (!matchingAnswer || typeof matchingAnswer.score !== 'number') return []
        const isDomainSpectrum = submission.formVersion.trim() === ZCODE_DOMAIN_SURVEY_FORM_VERSION
        return [{
          submissionId: submission.id,
          submissionLabel: isDomainSpectrum ? 'domain spectrum' : 'burden survey',
          submittedAtIso: submission.completedAtIso || submission.updatedAtIso || submission.submittedAtIso,
          respondentName: `${submission.header.firstName || ''} ${submission.header.lastName || ''}`.trim() || 'Unknown respondent',
          respondentEmail: submission.header.email || '',
          score: matchingAnswer.score,
          contribution: isDomainSpectrum
            ? projectDomainSpectrumToBurden(matchingAnswer.score, row.mappedDomain)
            : Math.max(0, 9 - matchingAnswer.score)
        } satisfies PartnerAnswerTraceEntry]
      })
      .sort((left, right) => new Date(right.submittedAtIso).getTime() - new Date(left.submittedAtIso).getTime())
  })
  return rowsById
}

export function getAverageServiceCapacity(entries: PartnerAnswerTraceEntry[]) {
  if (!entries.length) return 0
  return entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length
}

export function PartnerRecordTracePanel({
  row,
  entries
}: {
  row: DomainLoadBreakdown['rows'][number]
  entries: PartnerAnswerTraceEntry[]
}) {
  const averageServiceCapacity = getAverageServiceCapacity(entries)
  const averageContribution = entries.length
    ? entries.reduce((sum, entry) => sum + entry.contribution, 0) / entries.length
    : 0
  return (
    <div className="rounded-[16px] border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <small className="text-[12px] uppercase tracking-[0.08em] text-[#a9a9a9]">
          canonical record trace · {row.zCodeGroup.toUpperCase()}
        </small>
        <small className="text-[12px] text-[#d0d0d0]">
          avg service capacity {formatMetricValue(averageServiceCapacity)} · avg z-code burden {formatMetricValue(averageContribution)} · chart {formatMetricValue(row.rawCount)}
        </small>
      </div>
      {entries.length ? (
        <div className="space-y-1.5">
          {entries.map((entry) => (
            <div key={`${entry.submissionId}:${entry.submittedAtIso}`} className="grid gap-2 rounded-[12px] border border-white/10 px-3 py-2 md:grid-cols-[1.1fr_0.9fr_auto_auto]">
              <div>
                <div className="text-[12px] text-white">{entry.respondentName}</div>
                <small className="text-[11px] text-[#a8a8a8]">{entry.respondentEmail || 'email unavailable'}</small>
              </div>
              <div>
                <div className="text-[12px] text-[#d8d8d8]">{entry.submissionLabel}</div>
                <small className="text-[11px] text-[#a8a8a8]">{formatDateLabel(entry.submittedAtIso)}</small>
              </div>
              <div className="text-right">
                <small className="block text-[10px] uppercase tracking-[0.08em] text-[#9a9a9a]">service capacity</small>
                <span className="text-[12px] text-white">{formatMetricValue(entry.score)}</span>
              </div>
              <div className="text-right">
                <small className="block text-[10px] uppercase tracking-[0.08em] text-[#9a9a9a]">z-code burden</small>
                <span className="text-[12px] text-[#b9f6ea]">{formatMetricValue(entry.contribution)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <small className="text-[12px] text-[#9d9d9d]">
          No canonical survey answer rows were found in the latest completed submissions for this Z-code.
        </small>
      )}
    </div>
  )
}

export function SummaryChip({
  label,
  rawTotal,
  chartValue,
  color
}: {
  label: string
  rawTotal: number
  chartValue: number
  color: string
}) {
  return (
    <div className="rounded-[22px] border px-4 py-3" style={{ borderColor: '#ffffff20', backgroundColor: '#050505' }}>
      <small className="block text-[11px] uppercase tracking-[0.08em] text-[#9f9f9f]">{label}</small>
      <div className="mt-1 text-[22px] font-medium" style={{ color }}>{formatMetricValue(chartValue)}</div>
      <small className="text-[12px] text-[#bdbdbd]">domain average {formatMetricValue(rawTotal)}</small>
    </div>
  )
}

export function RouteBoardScoreTraceCell({ row }: { row: DomainLoadBreakdown['rows'][number] }) {
  const traceRows = row.partnerScoreTrace || []
  if (!traceRows.length) return <span className="text-[#a5a5a5]">No candidate score rows</span>
  return (
    <div className="space-y-1">
      <div className="text-[11px] text-[#a7a7a7]">
        avg strength {formatMetricValue(row.averagePartnerStrength ?? 0)} {'->'} burden {formatMetricValue(row.rawCount)}
      </div>
      {traceRows.map((traceRow, index) => (
        <div key={`${row.id}:trace:${traceRow.partnerId || index}`} className="flex items-center justify-between gap-4 text-[12px]">
          <span className="truncate text-[#dfdfdf]">{traceRow.partnerLabel}</span>
          <span className="shrink-0 text-[#b9f6ea]">{formatMetricValue(traceRow.score)}</span>
        </div>
      ))}
    </div>
  )
}

function formatDateLabel(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatBucketLabel(bucket: DomainLoadBreakdown['rows'][number]['mappedDomain']) {
  return bucket === 'socialNetworks' ? 'social networks' : bucket
}

export function formatMetricValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
