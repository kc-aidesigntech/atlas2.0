/**
 * Atlas fleet subapp: which Pray Phones are online, where each one sits,
 * which Wi-Fi network it should join, and the call sessions those phones log.
 * Served from the dedicated fleet hostname or the /fleet path (see RootApp.jsx).
 */
import React from 'react'
import {
  AtlasBodyText,
  AtlasMetricPill,
  AtlasOverline,
  AtlasPanel,
  AtlasTextButton
} from '@/features/atlas2026/components/AtlasPrimitives'
import AtlasArrowIcon from '@/features/atlas2026/components/AtlasArrowIcon'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import {
  fetchCanManagePrayphoneFleet,
  loadFleetCollections,
  loadFleetDeviceLogs,
  loadFleetDevices,
  loadFleetNetwork,
  loadFleetSessions,
  saveFleetDeviceConfig
} from '@/features/atlas2026/fleet/data-access/fleetRepository'
import FleetDevicesPanel, { draftFromDevice, type DeviceDraft } from '@/features/atlas2026/fleet/FleetDevicesPanel'
import FleetSessionsPanel, { type FleetSessionRow } from '@/features/atlas2026/fleet/FleetSessionsPanel'
import {
  averageClosedDurationMs,
  formatDuration,
  isDeviceOnline,
  isRecentlyOpenSession,
  resolveSessionDeviceId,
  sessionCountsByDay,
  sessionDeviceIdsFromLogs,
  sessionsInLastDays,
  sortDevicesForFleet,
  type FleetCollection,
  type FleetDevice,
  type FleetDeviceLog,
  type FleetNetworkSummary,
  type FleetSession
} from '@/features/atlas2026/fleet/fleetPresence'

type FleetTab = 'devices' | 'sessions'

const EMPTY_DRAFT: DeviceDraft = { address: '', wifiUsername: '', wifiPassword: '', clearPassword: false }

/**
 * Workspace URL for the back button. On the dedicated fleet hostname every
 * path renders fleet, so back must target the primary domain (drop the
 * leading "fleet." label). On the primary domain a plain /app path works.
 */
function getWorkspaceUrl(): string {
  if (typeof window === 'undefined') return '/app'
  const { hostname, protocol } = window.location
  if (hostname.toLowerCase().startsWith('fleet.')) {
    return `${protocol}//${hostname.slice('fleet.'.length)}/app`
  }
  return '/app'
}

function deviceLabel(devices: FleetDevice[], deviceId: string): string {
  if (!deviceId) return 'Unassigned'
  const match = devices.find((device) => device.deviceId === deviceId)
  return match?.name || match?.deviceId || deviceId
}

export default function StandaloneFleetPage() {
  const [allowed, setAllowed] = React.useState<boolean | null>(null)
  const [loadError, setLoadError] = React.useState('')
  const [tab, setTab] = React.useState<FleetTab>('devices')
  const [devices, setDevices] = React.useState<FleetDevice[]>([])
  const [networkByDeviceId, setNetworkByDeviceId] = React.useState<Map<string, FleetNetworkSummary>>(new Map())
  const [sessions, setSessions] = React.useState<FleetSession[]>([])
  const [logs, setLogs] = React.useState<FleetDeviceLog[]>([])
  const [collections, setCollections] = React.useState<FleetCollection[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = React.useState('')
  const [draft, setDraft] = React.useState<DeviceDraft>(EMPTY_DRAFT)
  const [draftDirty, setDraftDirty] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [saveMessage, setSaveMessage] = React.useState('')
  const [saveError, setSaveError] = React.useState('')
  const selectedDeviceIdRef = React.useRef(selectedDeviceId)
  const draftDirtyRef = React.useRef(draftDirty)
  selectedDeviceIdRef.current = selectedDeviceId
  draftDirtyRef.current = draftDirty

  React.useEffect(() => {
    const previousTitle = document.title
    document.title = 'ATLAS Fleet'
    return () => {
      document.title = previousTitle
    }
  }, [])

  const applySelection = React.useCallback((deviceId: string, nextDevices: FleetDevice[], nextNetwork: Map<string, FleetNetworkSummary>) => {
    setSelectedDeviceId(deviceId)
    const device = nextDevices.find((item) => item.deviceId === deviceId)
    setDraft(device ? draftFromDevice(device, nextNetwork.get(deviceId)) : EMPTY_DRAFT)
    setDraftDirty(false)
  }, [])

  const refresh = React.useCallback(async () => {
    const [nextDevices, nextNetworkRows, nextSessions, nextLogs, nextCollections] = await Promise.all([
      loadFleetDevices(),
      loadFleetNetwork(),
      loadFleetSessions(),
      loadFleetDeviceLogs(),
      loadFleetCollections()
    ])
    const sorted = sortDevicesForFleet(nextDevices)
    const nextNetwork = new Map(nextNetworkRows.map((row) => [row.deviceId, row]))
    setDevices(sorted)
    setNetworkByDeviceId(nextNetwork)
    setSessions(nextSessions)
    setLogs(nextLogs)
    setCollections(nextCollections)
    setLoadError('')

    const currentId = selectedDeviceIdRef.current
    const stillThere = sorted.some((device) => device.deviceId === currentId)
    const nextId = stillThere ? currentId : sorted[0]?.deviceId || ''
    if (!draftDirtyRef.current || nextId !== currentId) {
      applySelection(nextId, sorted, nextNetwork)
      setSaveMessage('')
      setSaveError('')
    }
  }, [applySelection])

  React.useEffect(() => {
    let cancelled = false
    async function boot() {
      let canManage = false
      try {
        canManage = await fetchCanManagePrayphoneFleet()
      } catch (error) {
        if (cancelled) return
        console.warn('Failed to check fleet access.', error)
        setAllowed(false)
        setLoadError('Could not load the fleet. Apply the fleet migration, then refresh.')
        return
      }
      if (cancelled) return
      setAllowed(canManage)
      if (!canManage) return
      try {
        await refresh()
      } catch (error) {
        if (cancelled) return
        console.warn('Failed to load fleet.', error)
        setLoadError('Could not load phones and sessions. Apply the fleet migration, then refresh.')
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [refresh])

  React.useEffect(() => {
    if (allowed !== true) return
    const timer = window.setInterval(() => {
      void refresh().catch((error) => {
        console.warn('Fleet refresh failed.', error)
      })
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [allowed, refresh])

  function handleSelectDevice(deviceId: string) {
    applySelection(deviceId, devices, networkByDeviceId)
    setSaveMessage('')
    setSaveError('')
  }

  function handleDraftChange(next: DeviceDraft) {
    setDraft(next)
    setDraftDirty(true)
    setSaveMessage('')
    setSaveError('')
  }

  async function handleSave() {
    if (!selectedDeviceId) return
    setIsSaving(true)
    setSaveError('')
    setSaveMessage('')
    const replacePassword = draft.clearPassword || draft.wifiPassword.trim().length > 0
    try {
      await saveFleetDeviceConfig({
        deviceId: selectedDeviceId,
        address: draft.address,
        wifiUsername: draft.wifiUsername,
        wifiPassword: draft.clearPassword ? '' : draft.wifiPassword,
        replacePassword
      })
      setDraftDirty(false)
      draftDirtyRef.current = false
      await refresh()
      setSaveMessage('Saved. The phone picks up Wi-Fi the next time it checks in and is not on a call.')
    } catch (error) {
      console.warn('Failed to save fleet configuration.', error)
      setSaveError(error instanceof Error ? error.message : 'Could not save this phone.')
    } finally {
      setIsSaving(false)
    }
  }

  const onlineCount = devices.filter((device) => isDeviceOnline(device.lastSeenIso)).length
  const logLinks = sessionDeviceIdsFromLogs(logs)
  const knownDeviceIds = new Set(devices.map((device) => device.deviceId))
  const keywordCountBySession = new Map<string, number>()
  for (const collection of collections) {
    if (!collection.sessionId) continue
    keywordCountBySession.set(
      collection.sessionId,
      (keywordCountBySession.get(collection.sessionId) || 0) + collection.keywordCount
    )
  }
  const sessionRows: FleetSessionRow[] = sessions.map((session) => ({
    ...session,
    deviceLabel: deviceLabel(devices, resolveSessionDeviceId(session, logLinks, collections, knownDeviceIds)),
    keywordCount: keywordCountBySession.get(session.id) || 0
  }))
  const weekSessions = sessionsInLastDays(sessions, 7)
  const openCount = sessions.filter((session) => isRecentlyOpenSession(session)).length

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-black text-white"
      style={{ backgroundColor: SP_COLORS.bg, color: SP_COLORS.text, fontFamily: 'Helvetica, Arial, sans-serif' }}
    >
      <header className="border-b bg-black" style={{ borderColor: '#ffffff70' }}>
        <div className="atlas-shell-edge-buffer flex h-[54px] items-center justify-between border-b" style={{ borderColor: '#ffffff45' }}>
          <a
            href={getWorkspaceUrl()}
            className="atlas-font-heading text-[17px] font-medium tracking-[0.08em] text-white"
            aria-label="Go to ATLAS workspace"
          >
            ATLAS
          </a>
          <AtlasOverline className="text-[#9eacb9]">fleet</AtlasOverline>
        </div>
        <div className="atlas-shell-edge-buffer flex min-h-[54px] items-center py-2">
          <AtlasTextButton
            onClick={() => window.location.assign(getWorkspaceUrl())}
            className="inline-flex items-center gap-2 px-[14px] py-[7px] text-[13px] font-medium"
            style={{ ['--button-border-color' as const]: '#ffffff2f', color: SP_COLORS.white } as React.CSSProperties}
          >
            <AtlasArrowIcon decorative direction="left" className="h-[1.1rem] w-[1.1rem] opacity-90" />
            back to workspace
          </AtlasTextButton>
        </div>
      </header>

      <main className="atlas-shell-edge-buffer mx-auto w-full max-w-[1240px] space-y-4 py-6 md:py-8">
        {allowed === null ? <AtlasBodyText>Loading fleet…</AtlasBodyText> : null}
        {allowed === false ? (
          <AtlasPanel kicker="fleet" title="Pray Phone fleet" description="Administrators and supervisors can monitor phones and set where each one sits.">
            <AtlasBodyText>
              {loadError || 'This account cannot open the fleet. Sign in as an administrator or supervisor.'}
            </AtlasBodyText>
          </AtlasPanel>
        ) : null}
        {allowed === true ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <AtlasMetricPill label="phones online" value={`${onlineCount} / ${devices.length}`} accentColor={SP_COLORS.green} />
              <AtlasMetricPill label="phones offline" value={Math.max(0, devices.length - onlineCount)} />
              <AtlasMetricPill label="sessions loaded" value={sessions.length} />
            </div>
            <div className="flex flex-wrap gap-2">
              <AtlasTextButton
                onClick={() => setTab('devices')}
                className="px-4 py-2 text-[14px]"
                style={{ ['--button-border-color' as const]: tab === 'devices' ? SP_COLORS.white : '#ffffff2f', color: SP_COLORS.white } as React.CSSProperties}
              >
                phones
              </AtlasTextButton>
              <AtlasTextButton
                onClick={() => setTab('sessions')}
                className="px-4 py-2 text-[14px]"
                style={{ ['--button-border-color' as const]: tab === 'sessions' ? SP_COLORS.white : '#ffffff2f', color: SP_COLORS.white } as React.CSSProperties}
              >
                sessions
              </AtlasTextButton>
            </div>
            {loadError ? <AtlasBodyText className="text-[#ee352e]">{loadError}</AtlasBodyText> : null}
            <FleetTabBody
              tab={tab}
              devices={devices}
              networkByDeviceId={networkByDeviceId}
              logs={logs}
              selectedDeviceId={selectedDeviceId}
              draft={draft}
              onSelectDevice={handleSelectDevice}
              onDraftChange={handleDraftChange}
              onSave={() => void handleSave()}
              onClearPassword={() => handleDraftChange({ ...draft, wifiPassword: '', clearPassword: !draft.clearPassword })}
              isSaving={isSaving}
              saveMessage={saveMessage}
              saveError={saveError}
              sessionRows={sessionRows}
              weekCount={weekSessions.length}
              openCount={openCount}
              averageLabel={formatDuration(averageClosedDurationMs(sessions))}
            />
          </>
        ) : null}
      </main>
    </div>
  )
}

function FleetTabBody({
  tab,
  devices,
  networkByDeviceId,
  logs,
  selectedDeviceId,
  draft,
  onSelectDevice,
  onDraftChange,
  onSave,
  onClearPassword,
  isSaving,
  saveMessage,
  saveError,
  sessionRows,
  weekCount,
  openCount,
  averageLabel
}: {
  tab: FleetTab
  devices: FleetDevice[]
  networkByDeviceId: Map<string, FleetNetworkSummary>
  logs: FleetDeviceLog[]
  selectedDeviceId: string
  draft: DeviceDraft
  onSelectDevice: (deviceId: string) => void
  onDraftChange: (draft: DeviceDraft) => void
  onSave: () => void
  onClearPassword: () => void
  isSaving: boolean
  saveMessage: string
  saveError: string
  sessionRows: FleetSessionRow[]
  weekCount: number
  openCount: number
  averageLabel: string
}) {
  switch (tab) {
    case 'devices':
      return (
        <FleetDevicesPanel
          devices={devices}
          networkByDeviceId={networkByDeviceId}
          logs={logs}
          selectedDeviceId={selectedDeviceId}
          onSelectDevice={onSelectDevice}
          draft={draft}
          onDraftChange={onDraftChange}
          onSave={onSave}
          onClearPassword={onClearPassword}
          isSaving={isSaving}
          saveMessage={saveMessage}
          saveError={saveError}
        />
      )
    case 'sessions':
      return (
        <FleetSessionsPanel
          rows={sessionRows}
          dayCounts={sessionCountsByDay(sessionRows)}
          weekCount={weekCount}
          openCount={openCount}
          averageLabel={averageLabel}
        />
      )
    default: {
      const unreachable: never = tab
      return unreachable
    }
  }
}
