import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getZCodeParentColor } from '@atlas/shared'
import { AtlasCloseButton } from '@/features/atlas2026/components/AtlasPrimitives'
import ZCodeBadge from '@/features/atlas2026/components/ZCodeBadge'
import {
  PartnerRecordTracePanel,
  RouteBoardScoreTraceCell,
  SummaryChip,
  buildPartnerAnswerTraceByRowId,
  formatBucketLabel,
  formatMetricValue,
  getAverageServiceCapacity,
  groupBreakdownRows
} from '@/features/atlas2026/singlepane/components/radialLoadTableOverlay/model'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type {
  DomainLoad,
  DomainLoadBreakdown,
  DomainLoadDrilldownTarget,
  NavigatorLoadContributor,
  PartnerServiceCapacitySubmissionRecord
} from '@/features/atlas2026/shared/contracts'

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
