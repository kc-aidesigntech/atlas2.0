import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getZCodeParentColor } from '@atlas/shared'
import { AtlasCloseButton } from '@/features/atlas2026/components/AtlasPrimitives'
import ZCodeBadge from '@/features/atlas2026/components/ZCodeBadge'
import { selectCompletedPartnerSurveysNewestFirst } from '@/features/atlas2026/singlepane/data-access/domainLoadMapping'
import { ZCODE_DOMAIN_SURVEY_FORM_VERSION } from '@/features/atlas2026/singlepane/data/serviceCapacitySurveyCatalog'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import type {
  DomainLoad,
  DomainLoadBreakdown,
  DomainLoadDrilldownTarget,
  NavigatorLoadContributor,
  PartnerServiceCapacitySubmissionRecord
} from '@/features/atlas2026/singlepane/types'

interface RadialLoadTableOverlayProps {
  isOpen: boolean
  load: DomainLoad | null
  breakdown: DomainLoadBreakdown | null
  navigatorContributors?: NavigatorLoadContributor[]
  partnerSurveyHistory?: PartnerServiceCapacitySubmissionRecord[]
  onOpenTrueRecord?: (target: DomainLoadDrilldownTarget) => void
  onSelectPreviousPartner?: () => void
  onSelectNextPartner?: () => void
  canSelectPreviousPartner?: boolean
  canSelectNextPartner?: boolean
  onClose: () => void
}

export default function RadialLoadTableOverlay({
  isOpen,
  load,
  breakdown,
  navigatorContributors = [],
  partnerSurveyHistory = [],
  onOpenTrueRecord,
  onSelectPreviousPartner,
  onSelectNextPartner,
  canSelectPreviousPartner = false,
  canSelectNextPartner = false,
  onClose
}: RadialLoadTableOverlayProps) {
  if (!isOpen) return null

  // Snapshot rows immediately so rendering remains stable even if upstream data refreshes while overlay is open.
  const rows = breakdown?.rows || []
  const isNavigatorAggregate = (breakdown?.subjectId || '').toLowerCase() === 'navigator-aggregate'
  const isPartnerSurvey = breakdown?.sourceKind === 'partnerSurvey'
  const isPartnerDomainSpectrum = isPartnerSurvey && (breakdown?.sourceLabel || '').toLowerCase().includes('domain spectrum')
  const isRouteBoardCapacityInversion = (breakdown?.sourceLabel || '').toLowerCase().includes('route-board capacity inversion')
  const isWeightedSurvey = breakdown?.sourceKind === 'partnerSurvey' || breakdown?.sourceKind === 'enrolleeSurvey'
  const hasDrilldownRows = rows.some((row) => Boolean(row.drilldownTarget))
  const partnerAnswerTraceByRowId = React.useMemo(() => {
    if (!isPartnerSurvey) return {}
    return buildPartnerAnswerTraceByRowId(rows, partnerSurveyHistory)
  }, [isPartnerSurvey, partnerSurveyHistory, rows])
  const groupedRows = React.useMemo(
    () => groupBreakdownRows(rows, partnerAnswerTraceByRowId),
    [partnerAnswerTraceByRowId, rows]
  )
  const [expandedParentCodes, setExpandedParentCodes] = React.useState<Record<string, boolean>>({})
  const [activePartnerDrilldownRowId, setActivePartnerDrilldownRowId] = React.useState<string | null>(null)

  React.useEffect(() => {
    setExpandedParentCodes(() =>
      Object.fromEntries(groupedRows.map((group) => [group.parentCode, false]))
    )
  }, [groupedRows])

  React.useEffect(() => {
    setActivePartnerDrilldownRowId(null)
  }, [breakdown?.subjectId, breakdown?.sourceLabel])

  function toggleParentCodeGroup(parentCode: string) {
    setExpandedParentCodes((current) => ({
      ...current,
      [parentCode]: !current[parentCode]
    }))
  }

  function handleOpenRecordForRow(row: DomainLoadBreakdown['rows'][number]) {
    if (!row.drilldownTarget) return
    if (isPartnerSurvey) {
      setActivePartnerDrilldownRowId((current) => (current === row.id ? null : row.id))
      return
    }
    onOpenTrueRecord?.(row.drilldownTarget)
  }

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-black/65 px-5 py-6 backdrop-blur-[2px]" onClick={onClose}>
      {onSelectPreviousPartner ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onSelectPreviousPartner()
          }}
          disabled={!canSelectPreviousPartner}
          className="absolute left-2 top-1/2 z-40 -translate-y-1/2 rounded-full border p-2 transition"
          style={{
            borderColor: canSelectPreviousPartner ? '#ffffff55' : '#ffffff1f',
            color: canSelectPreviousPartner ? SP_COLORS.white : '#7c7c7c',
            backgroundColor: '#020202'
          }}
          aria-label="Previous partner"
          title="Previous partner"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      ) : null}
      {onSelectNextPartner ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onSelectNextPartner()
          }}
          disabled={!canSelectNextPartner}
          className="absolute right-2 top-1/2 z-40 -translate-y-1/2 rounded-full border p-2 transition"
          style={{
            borderColor: canSelectNextPartner ? '#ffffff55' : '#ffffff1f',
            color: canSelectNextPartner ? SP_COLORS.white : '#7c7c7c',
            backgroundColor: '#020202'
          }}
          aria-label="Next partner"
          title="Next partner"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      ) : null}
      <div
        className="max-h-[calc(100vh-72px)] w-full max-w-[980px] overflow-y-auto rounded-[34px] border px-6 py-5"
        style={{ borderColor: SP_COLORS.white, backgroundColor: '#020202' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <small className="block text-[12px] uppercase tracking-[0.18em] text-[#9f9f9f]">radial load inputs</small>
            <h3 className="text-[28px] font-medium text-white">{breakdown?.subjectLabel || 'Load details'}</h3>
            <small className="text-[13px] text-[#c7c7c7]">{breakdown?.sourceLabel || 'No source data available.'}</small>
          </div>
          <AtlasCloseButton
            onClick={onClose}
            style={{ ['--button-border-color' as const]: SP_COLORS.white } as React.CSSProperties}
          />
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <SummaryChip label="habitat" rawTotal={breakdown?.habitatTotal || 0} chartValue={load?.habitat || 0} color={SP_COLORS.orange} />
          <SummaryChip label="work" rawTotal={breakdown?.workTotal || 0} chartValue={load?.work || 0} color={SP_COLORS.yellow} />
          <SummaryChip
            label="social networks"
            rawTotal={breakdown?.socialNetworksTotal || 0}
            chartValue={load?.socialNetworks || 0}
            color={SP_COLORS.blue}
          />
        </div>

        {isNavigatorAggregate && navigatorContributors.length ? (
          <div className="mb-5 rounded-[26px] border p-4" style={{ borderColor: '#ffffff25' }}>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <small className="block text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd]">
                  assigned enrollee load scores
                </small>
                <small className="text-[12px] text-[#8f8f8f]">
                  These are the per-enrollee radial values that substantiate the navigator average.
                </small>
              </div>
              <small className="text-[12px] text-[#9f9f9f]">
                {navigatorContributors.length} enrollee{navigatorContributors.length === 1 ? '' : 's'}
              </small>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left text-[13px] text-white">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.08em] text-[#9f9f9f]">
                    <th className="border-b border-white/10 px-3 py-2 font-medium">enrollee</th>
                    <th className="border-b border-white/10 px-3 py-2 font-medium text-right">habitat</th>
                    <th className="border-b border-white/10 px-3 py-2 font-medium text-right">work</th>
                    <th className="border-b border-white/10 px-3 py-2 font-medium text-right">social networks</th>
                  </tr>
                </thead>
                <tbody>
                  {navigatorContributors.map((row) => (
                    <tr key={row.enrolleeId}>
                      <td className="border-b border-white/5 px-3 py-3">{row.enrolleeName}</td>
                      <td className="border-b border-white/5 px-3 py-3 text-right">{formatMetricValue(row.habitat)}</td>
                      <td className="border-b border-white/5 px-3 py-3 text-right">{formatMetricValue(row.work)}</td>
                      <td className="border-b border-white/5 px-3 py-3 text-right">{formatMetricValue(row.socialNetworks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div className="rounded-[26px] border p-4" style={{ borderColor: '#ffffff25' }}>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <small className="block text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd]">derived source rows</small>
              <small className="text-[12px] text-[#8f8f8f]">
                {isRouteBoardCapacityInversion
                  ? 'Navigator chart values invert average partner strength (1-9) across route-board candidates for each enrollee Z-code.'
                  : isPartnerSurvey
                  ? isPartnerDomainSpectrum
                    ? 'Partner chart values are weighted domain-spectrum averages from the last three completed Z-code domain surveys.'
                    : 'Partner chart values are inverted burden averages from the last three completed service-capacity surveys.'
                  : isWeightedSurvey
                    ? 'Enrollee chart values are weighted domain averages from the latest burden survey.'
                    : 'Enrollee chart values are derived from active Z-Code records mapped into habitat, work, and social domains.'}
              </small>
              {hasDrilldownRows ? (
                <small className="mt-1 block text-[12px] text-[#9f9f9f]">
                  Use open record to audit or edit the canonical source row for each chart input.
                </small>
              ) : null}
            </div>
            <small className="text-[12px] text-[#9f9f9f]">
              {rows.length} grouped row{rows.length === 1 ? '' : 's'} · {groupedRows.length} parent group{groupedRows.length === 1 ? '' : 's'}
            </small>
          </div>

          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left text-[13px] text-white">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.08em] text-[#9f9f9f]">
                    <th className="border-b border-white/10 px-3 py-2 font-medium">z-code</th>
                    <th className="border-b border-white/10 px-3 py-2 font-medium">mapped domain</th>
                    <th className="border-b border-white/10 px-3 py-2 font-medium text-right">
                      {isRouteBoardCapacityInversion
                        ? 'inverted burden'
                        : isPartnerSurvey
                          ? isPartnerDomainSpectrum
                            ? 'z-code burden'
                            : 'z-code burden'
                          : 'chart input'}
                    </th>
                    {isRouteBoardCapacityInversion ? (
                      <th className="border-b border-white/10 px-3 py-2 font-medium">partner score trace</th>
                    ) : null}
                    {isPartnerSurvey ? <th className="border-b border-white/10 px-3 py-2 font-medium text-right">service capacity</th> : null}
                    {isPartnerSurvey ? <th className="border-b border-white/10 px-3 py-2 font-medium text-right">surveys</th> : null}
                    {hasDrilldownRows ? <th className="border-b border-white/10 px-3 py-2 font-medium text-right">true record</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {groupedRows.map((group) => {
                    const isExpanded = Boolean(expandedParentCodes[group.parentCode])
                    const parentColor = getZCodeParentColor(group.parentCode) || SP_COLORS.white
                    return (
                      <React.Fragment key={`group:${group.parentCode}`}>
                        <tr className="bg-white/[0.02]">
                          <td className="border-b border-white/10 px-3 py-2">
                            <button
                              type="button"
                              onClick={() => toggleParentCodeGroup(group.parentCode)}
                              className="inline-flex items-center gap-2"
                            >
                              <ZCodeBadge
                                value={group.parentCode}
                                fill={parentColor}
                                size="board"
                                stripLeadingZ
                              />
                              <span className="text-[12px] uppercase tracking-[0.08em] text-[#bdbdbd]">
                                {isExpanded ? 'collapse' : 'expand'}
                              </span>
                            </button>
                          </td>
                          <td className="border-b border-white/10 px-3 py-2 text-[12px] text-[#bdbdbd]">
                            {group.rows.length} z-codes
                          </td>
                          <td className="border-b border-white/10 px-3 py-2 text-right text-[12px] text-[#d9d9d9]">
                            {formatMetricValue(group.averageScore)}
                          </td>
                          {isRouteBoardCapacityInversion ? <td className="border-b border-white/10 px-3 py-2" /> : null}
                          {isPartnerSurvey ? (
                            <td className="border-b border-white/10 px-3 py-2 text-right text-[12px] text-[#d9d9d9]">
                              {formatMetricValue(group.serviceCapacityAverage)}
                            </td>
                          ) : null}
                          {isPartnerSurvey ? (
                            <td className="border-b border-white/10 px-3 py-2 text-right text-[12px] text-[#d9d9d9]">
                              {group.responseCount}
                            </td>
                          ) : null}
                          {hasDrilldownRows ? <td className="border-b border-white/10 px-3 py-2" /> : null}
                        </tr>
                        {isExpanded
                          ? group.rows.map((row) => (
                              <React.Fragment key={row.id}>
                                <tr>
                                  <td className="border-b border-white/5 px-3 py-3">{row.zCodeGroup.toUpperCase()}</td>
                                  <td className="border-b border-white/5 px-3 py-3">{formatBucketLabel(row.mappedDomain)}</td>
                                  <td className="border-b border-white/5 px-3 py-3 text-right">{formatMetricValue(row.rawCount)}</td>
                                  {isRouteBoardCapacityInversion ? (
                                    <td className="border-b border-white/5 px-3 py-3">
                                      <RouteBoardScoreTraceCell row={row} />
                                    </td>
                                  ) : null}
                                  {isPartnerSurvey ? (
                                    <td className="border-b border-white/5 px-3 py-3 text-right">
                                      {formatMetricValue(getAverageServiceCapacity(partnerAnswerTraceByRowId[row.id] || []))}
                                    </td>
                                  ) : null}
                                  {isPartnerSurvey ? (
                                    <td className="border-b border-white/5 px-3 py-3 text-right">{row.responseCount || 0}</td>
                                  ) : null}
                                  {hasDrilldownRows ? (
                                    <td className="border-b border-white/5 px-3 py-3 text-right">
                                      {row.drilldownTarget ? (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenRecordForRow(row)}
                                          className="rounded-full border border-white/20 px-3 py-1 text-[11px] uppercase tracking-[0.08em] text-[#d9f5ef] transition hover:border-[#9ce6d7] hover:text-[#9ce6d7]"
                                        >
                                          {isPartnerSurvey && activePartnerDrilldownRowId === row.id ? 'hide record' : 'open record'}
                                        </button>
                                      ) : (
                                        <span className="text-[#7f7f7f]">n/a</span>
                                      )}
                                    </td>
                                  ) : null}
                                </tr>
                                {isPartnerSurvey && activePartnerDrilldownRowId === row.id ? (
                                  <tr>
                                    <td
                                      colSpan={
                                        3 +
                                        (isRouteBoardCapacityInversion ? 1 : 0) +
                                        (isPartnerSurvey ? 1 : 0) +
                                        (hasDrilldownRows ? 1 : 0)
                                      }
                                      className="border-b border-white/10 px-3 py-3"
                                    >
                                      <PartnerRecordTracePanel row={row} entries={partnerAnswerTraceByRowId[row.id] || []} />
                                    </td>
                                  </tr>
                                ) : null}
                              </React.Fragment>
                            ))
                          : null}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-[22px] border px-4 py-6 text-[13px] text-[#cfcfcf]" style={{ borderColor: '#ffffff20' }}>
              No mapped Z-Code rows are available for this radial chart yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface PartnerAnswerTraceEntry {
  submissionId: string
  submissionLabel: string
  submittedAtIso: string
  respondentName: string
  respondentEmail: string
  score: number
  contribution: number
}

interface GroupedBreakdownRows {
  parentCode: string
  rows: DomainLoadBreakdown['rows']
  averageScore: number
  serviceCapacityAverage: number
  responseCount: number
}

function groupBreakdownRows(
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

function normalizeZCode(value: string) {
  return value.trim().toUpperCase()
}

function getSurveySortStamp(submission: PartnerServiceCapacitySubmissionRecord) {
  return submission.completedAtIso || submission.updatedAtIso || submission.submittedAtIso
}

function projectDomainSpectrumToBurden(score: number, mappedDomain: DomainLoadBreakdown['rows'][number]['mappedDomain']) {
  const clamped = Math.max(1, Math.min(99, score))
  if (clamped <= 33) {
    const t = (clamped - 1) / 32
    const habitat = (1 - t) * 9
    const socialNetworks = t * 9
    const work = 0
    return mappedDomain === 'habitat' ? habitat : mappedDomain === 'work' ? work : socialNetworks
  }
  if (clamped <= 66) {
    const t = (clamped - 33) / 33
    const habitat = 0
    const socialNetworks = (1 - t) * 9
    const work = t * 9
    return mappedDomain === 'habitat' ? habitat : mappedDomain === 'work' ? work : socialNetworks
  }
  const t = (clamped - 66) / 33
  const habitat = t * 9
  const socialNetworks = 0
  const work = (1 - t) * 9
  return mappedDomain === 'habitat' ? habitat : mappedDomain === 'work' ? work : socialNetworks
}

function buildPartnerAnswerTraceByRowId(
  rows: DomainLoadBreakdown['rows'],
  history: PartnerServiceCapacitySubmissionRecord[]
): Record<string, PartnerAnswerTraceEntry[]> {
  const selectedSubmissions = selectCompletedPartnerSurveysNewestFirst(history).slice(0, 3)
  const rowsById: Record<string, PartnerAnswerTraceEntry[]> = {}
  rows.forEach((row) => {
    const normalizedRowCode = normalizeZCode(row.zCodeGroup)
    const matchingEntries = selectedSubmissions
      .flatMap((submission) => {
        const matchingAnswer = submission.answers.find((answer) => {
          if (answer.notEncountered || typeof answer.score !== 'number') return false
          return normalizeZCode(answer.normalizedZCode || answer.zCode) === normalizedRowCode
        })
        if (!matchingAnswer || typeof matchingAnswer.score !== 'number') return []
        const isDomainSpectrumSubmission = submission.formVersion.trim() === ZCODE_DOMAIN_SURVEY_FORM_VERSION
        const contribution = isDomainSpectrumSubmission
          ? projectDomainSpectrumToBurden(matchingAnswer.score, row.mappedDomain)
          : Math.max(0, 9 - matchingAnswer.score)
        return [
          {
            submissionId: submission.id,
            submissionLabel: submission.formVersion.trim() === ZCODE_DOMAIN_SURVEY_FORM_VERSION ? 'domain spectrum' : 'burden survey',
            submittedAtIso: getSurveySortStamp(submission),
            respondentName: `${submission.header.firstName || ''} ${submission.header.lastName || ''}`.trim() || 'Unknown respondent',
            respondentEmail: submission.header.email || '',
            score: matchingAnswer.score,
            contribution
          } satisfies PartnerAnswerTraceEntry
        ]
      })
      .sort((left, right) => new Date(right.submittedAtIso).getTime() - new Date(left.submittedAtIso).getTime())
    rowsById[row.id] = matchingEntries
  })
  return rowsById
}

function getAverageServiceCapacity(entries: PartnerAnswerTraceEntry[]) {
  if (!entries.length) return 0
  return entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length
}

function PartnerRecordTracePanel({
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

function formatDateLabel(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function SummaryChip({
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
      <div className="mt-1 text-[22px] font-medium" style={{ color }}>
        {formatMetricValue(chartValue)}
      </div>
      <small className="text-[12px] text-[#bdbdbd]">domain average {formatMetricValue(rawTotal)}</small>
    </div>
  )
}

function formatBucketLabel(bucket: DomainLoadBreakdown['rows'][number]['mappedDomain']) {
  if (bucket === 'socialNetworks') return 'social networks'
  return bucket
}

function formatMetricValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function RouteBoardScoreTraceCell({ row }: { row: DomainLoadBreakdown['rows'][number] }) {
  const traceRows = row.partnerScoreTrace || []
  if (!traceRows.length) {
    return <span className="text-[#a5a5a5]">No candidate score rows</span>
  }
  const avgStrength = row.averagePartnerStrength ?? 0
  return (
    <div className="space-y-1">
      <div className="text-[11px] text-[#a7a7a7]">
        avg strength {formatMetricValue(avgStrength)} {'->'} burden {formatMetricValue(row.rawCount)}
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
