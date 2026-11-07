import React from 'react'
import { Field, RecordTable } from '@/features/atlas2026/admin/components/AdminControlPanelPrimitives'
import { ADMIN_ACTIVE_SECTION_KEY, writeAdminSessionValue } from '@/features/atlas2026/admin/components/adminDataControlPanelModel'
import { AtlasInsetCard } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import {
  ROUTE_PLAN_STOP_STATUSES,
  listPartnerStations,
  listRoutePlanStopsForStation,
  setRoutePlanStopStatus,
  updatePartnerStation,
  type PartnerStationRecord,
  type RoutePlanStopRecord,
  type RoutePlanStopStatus
} from '@/features/atlas2026/singlepane/data-access/tierFeatureRepository'
import {
  StatusWordPill,
  TierFeatureActionButton,
  TierFeatureErrorLine,
  TierFeatureListNotice,
  TierFeatureNoAccess,
  TierFeaturePanel,
  dateLabel,
  useTierFeatureList,
  useTierFeatureWrite
} from '@/features/atlas2026/singlepane/components/tierFeaturePanels/tierFeaturePanelShared'

interface PartnersPanelProps {
  /** `partner_profile.write`: station name and capacity edits. */
  canWritePartnerProfile: boolean
  /** `partner_milestones.write`: route plan stop status edits. */
  canWritePartnerMilestones: boolean
  /** Switches the workspace to the admin screen whose Organizations section edits the partner record itself. */
  onOpenAdminOrganizations?: () => void
}

interface StationDraft {
  stationName: string
  capacityTotal: string
  capacityAvailable: string
}

/**
 * Partner stewardship for the coordinator tier. The station list is
 * `v_partner_station_directory`, the view the partner's own "my station"
 * screen reads. A `partner_profile.write` holder edits the station name and
 * capacity on `atlas.partner_stations`; a `partner_milestones.write` holder
 * sets the status of each `atlas.route_plan_stops` row (the stops, or
 * milestones, that land at the station). The organization record itself is
 * edited on the admin Organizations section, reached from the button.
 */
export default function PartnersPanel({ canWritePartnerProfile, canWritePartnerMilestones, onOpenAdminOrganizations }: PartnersPanelProps) {
  const stations = useTierFeatureList(listPartnerStations)
  const [selectedStationId, setSelectedStationId] = React.useState<string | null>(null)
  const selectedStation = stations.rows.find((row) => row.stationId === selectedStationId) || null
  const stops = useTierFeatureList(() => listRoutePlanStopsForStation(selectedStationId || ''), [selectedStationId])
  const profileWrite = useTierFeatureWrite(stations.reload)
  const stopWrite = useTierFeatureWrite(stops.reload)
  const [draft, setDraft] = React.useState<StationDraft>({ stationName: '', capacityTotal: '', capacityAvailable: '' })

  // The draft follows the selected station.
  React.useEffect(() => {
    setDraft({
      stationName: selectedStation?.stationName || '',
      capacityTotal: selectedStation?.capacityTotal == null ? '' : String(selectedStation.capacityTotal),
      capacityAvailable: selectedStation?.capacityAvailable == null ? '' : String(selectedStation.capacityAvailable)
    })
  }, [selectedStation?.stationId, selectedStation?.stationName, selectedStation?.capacityTotal, selectedStation?.capacityAvailable])

  if (!canWritePartnerProfile && !canWritePartnerMilestones) {
    return <TierFeatureNoAccess permissionKey="partner_profile.write or partner_milestones.write" title="partners" />
  }

  const isProfileBusy = Boolean(profileWrite.busyKey)
  const isStopBusy = Boolean(stopWrite.busyKey)
  const capacityTotal = Number(draft.capacityTotal)
  const capacityAvailable = Number(draft.capacityAvailable)
  const canSaveStation =
    canWritePartnerProfile &&
    Boolean(selectedStation?.stationId) &&
    Boolean(draft.stationName.trim()) &&
    Number.isInteger(capacityTotal) &&
    Number.isInteger(capacityAvailable) &&
    capacityTotal >= 0 &&
    capacityAvailable >= 0 &&
    capacityAvailable <= capacityTotal

  function saveStation() {
    if (!selectedStation?.stationId || !canSaveStation) return
    const stationId = selectedStation.stationId
    void profileWrite.run('station', () => updatePartnerStation(stationId, { stationName: draft.stationName, capacityTotal, capacityAvailable }))
  }

  function openAdminOrganizations() {
    // The admin screen reads this session key on mount and opens that section.
    writeAdminSessionValue(ADMIN_ACTIVE_SECTION_KEY, 'organizations')
    onOpenAdminOrganizations?.()
  }

  return (
    <TierFeaturePanel
      kicker="partners"
      title="Partner stations"
      description="Station capacity and the stops that land at each station. Partner organizations themselves are edited on the admin Organizations section."
      actions={
        onOpenAdminOrganizations ? (
          <TierFeatureActionButton onClick={openAdminOrganizations} accent={SP_COLORS.yellow}>
            open organizations
          </TierFeatureActionButton>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <TierFeatureListNotice state={stations} emptyLabel="No partner stations on record." tableLabel="The partner station directory" />

        {stations.rows.length ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <RecordTable
              columns={['partner', 'station', 'county', 'capacity']}
              rows={stations.rows.map((row) => ({ ...row, id: row.stationId || row.partnerId }))}
              renderRow={(row) => {
                const station = row as PartnerStationRecord & { id: string }
                const isSelected = Boolean(station.stationId) && station.stationId === selectedStationId
                return (
                  <button
                    type="button"
                    onClick={() => setSelectedStationId(station.stationId)}
                    disabled={!station.stationId}
                    aria-pressed={isSelected}
                    className="grid w-full items-center gap-3 px-4 py-3 text-left text-[13px] text-white disabled:opacity-60"
                    style={{ gridTemplateColumns: '1.3fr repeat(3, minmax(0, 1fr))', backgroundColor: isSelected ? '#ffffff0d' : undefined }}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{station.organizationName}</div>
                      <small className="block truncate text-[11px] text-[var(--foreground-secondary)]">
                        {station.primaryContactName || station.primaryContactEmail || 'no primary contact'}
                      </small>
                    </div>
                    <div className="truncate text-[12px]">{station.stationName || 'no station'}</div>
                    <div className="truncate text-[12px]">{station.countyName || '—'}</div>
                    <div className="text-[12px]">
                      {station.capacityAvailable ?? '—'} / {station.capacityTotal ?? '—'}
                    </div>
                  </button>
                )
              }}
            />

            {selectedStation ? (
              <div className="space-y-4">
                <AtlasInsetCard>
                  <small className="atlas-overline block">{selectedStation.organizationName}</small>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="md:col-span-3">
                      <Field label="station name">
                        <input
                          value={draft.stationName}
                          onChange={(event) => setDraft({ ...draft, stationName: event.target.value })}
                          disabled={!canWritePartnerProfile || isProfileBusy}
                          className="atlas-admin-input"
                        />
                      </Field>
                    </div>
                    <Field label="capacity total">
                      <input
                        type="number"
                        min={0}
                        value={draft.capacityTotal}
                        onChange={(event) => setDraft({ ...draft, capacityTotal: event.target.value })}
                        disabled={!canWritePartnerProfile || isProfileBusy}
                        className="atlas-admin-input"
                      />
                    </Field>
                    <Field label="capacity available">
                      <input
                        type="number"
                        min={0}
                        value={draft.capacityAvailable}
                        onChange={(event) => setDraft({ ...draft, capacityAvailable: event.target.value })}
                        disabled={!canWritePartnerProfile || isProfileBusy}
                        className="atlas-admin-input"
                      />
                    </Field>
                    <div className="flex items-end">
                      {canWritePartnerProfile ? (
                        <TierFeatureActionButton onClick={saveStation} disabled={isProfileBusy || !canSaveStation} accent={SP_COLORS.deepGreen}>
                          {profileWrite.busyKey === 'station' ? 'saving…' : 'save station'}
                        </TierFeatureActionButton>
                      ) : (
                        <small className="atlas-caption block text-[var(--foreground-secondary)]">partner_profile.write needed to edit</small>
                      )}
                    </div>
                  </div>
                  <TierFeatureErrorLine message={profileWrite.error} />
                </AtlasInsetCard>

                <AtlasInsetCard>
                  <small className="atlas-overline block">stops at this station</small>
                  <div className="mt-3 space-y-2">
                    <TierFeatureErrorLine message={stopWrite.error} />
                    <TierFeatureListNotice state={stops} emptyLabel="No route plan stops land here yet." tableLabel="The route plan stops table" />
                    {stops.rows.map((stop: RoutePlanStopRecord) => (
                      <div key={stop.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-white/10 px-3 py-2 text-[13px] text-white">
                        <div className="min-w-0">
                          <div>stop {stop.stopOrder}</div>
                          <small className="block text-[11px] text-[var(--foreground-secondary)]">
                            assigned {dateLabel(stop.assignedDate)}
                            {stop.targetDate ? ` · target ${dateLabel(stop.targetDate)}` : ''}
                          </small>
                        </div>
                        {canWritePartnerMilestones ? (
                          <select
                            value={stop.status}
                            onChange={(event) => void stopWrite.run(`stop:${stop.id}`, () => setRoutePlanStopStatus(stop.id, event.target.value as RoutePlanStopStatus))}
                            disabled={isStopBusy}
                            className="atlas-admin-input max-w-[160px]"
                            aria-label="Stop status"
                          >
                            {ROUTE_PLAN_STOP_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <StatusWordPill status={stop.status} />
                        )}
                      </div>
                    ))}
                  </div>
                </AtlasInsetCard>
              </div>
            ) : (
              <small className="atlas-caption block text-[var(--foreground-secondary)]">Pick a station to edit it.</small>
            )}
          </div>
        ) : null}
      </div>
    </TierFeaturePanel>
  )
}
