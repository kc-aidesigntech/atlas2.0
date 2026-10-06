/**
 * Device list and site configuration for one Pray Phone.
 * Wi-Fi username is the network name (Service Set Identifier (SSID)). The
 * passphrase is write-only: a blank field keeps the password already stored.
 */
import type { CSSProperties } from 'react'
import {
  AtlasBodyText,
  AtlasInsetCard,
  AtlasMetaText,
  AtlasPanel,
  AtlasStatusPill,
  AtlasTextButton
} from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import {
  formatWhen,
  isDeviceOnline,
  summarizeDeviceLog,
  type FleetDevice,
  type FleetDeviceLog,
  type FleetNetworkSummary
} from '@/features/atlas2026/fleet/fleetPresence'

export type DeviceDraft = {
  address: string
  wifiUsername: string
  wifiPassword: string
  clearPassword: boolean
}

export function draftFromDevice(device: FleetDevice, network: FleetNetworkSummary | undefined): DeviceDraft {
  return {
    address: device.locationAddress,
    wifiUsername: network?.wifiUsername || '',
    wifiPassword: '',
    clearPassword: false
  }
}

export default function FleetDevicesPanel({
  devices,
  networkByDeviceId,
  logs,
  selectedDeviceId,
  onSelectDevice,
  draft,
  onDraftChange,
  onSave,
  onClearPassword,
  isSaving,
  saveMessage,
  saveError
}: {
  devices: FleetDevice[]
  networkByDeviceId: Map<string, FleetNetworkSummary>
  logs: FleetDeviceLog[]
  selectedDeviceId: string
  onSelectDevice: (deviceId: string) => void
  draft: DeviceDraft
  onDraftChange: (draft: DeviceDraft) => void
  onSave: () => void
  onClearPassword: () => void
  isSaving: boolean
  saveMessage: string
  saveError: string
}) {
  const selected = devices.find((device) => device.deviceId === selectedDeviceId) || null
  const network = selected ? networkByDeviceId.get(selected.deviceId) : undefined
  const recentLogs = logs.filter((log) => log.deviceId === selectedDeviceId).slice(0, 12)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <AtlasPanel kicker="phones" title="Each kiosk" description="Online means a heartbeat arrived in the last three minutes.">
        {devices.length === 0 ? (
          <AtlasBodyText>No phones have checked in yet. A kiosk appears here after it boots and can reach the fleet ingest.</AtlasBodyText>
        ) : (
          <div className="space-y-2">
            {devices.map((device) => {
              const online = isDeviceOnline(device.lastSeenIso)
              const selectedRow = device.deviceId === selectedDeviceId
              return (
                <button
                  key={device.id || device.deviceId}
                  type="button"
                  onClick={() => onSelectDevice(device.deviceId)}
                  className="block w-full text-left"
                >
                  <AtlasInsetCard className={selectedRow ? 'ring-1 ring-white' : undefined}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[15px] font-medium text-white">{device.name || device.deviceId}</div>
                        <AtlasMetaText className="mt-1 block text-[#9eacb9]">
                          {device.locationAddress || 'No address yet'}
                          {device.appVersion ? ` · ${device.appVersion}` : ''}
                        </AtlasMetaText>
                      </div>
                      <AtlasStatusPill color={online ? SP_COLORS.green : SP_COLORS.steel}>
                        {online ? 'online' : 'offline'}
                      </AtlasStatusPill>
                    </div>
                    <AtlasMetaText className="mt-2 block text-[#9eacb9]">last seen {formatWhen(device.lastSeenIso)}</AtlasMetaText>
                  </AtlasInsetCard>
                </button>
              )
            })}
          </div>
        )}
      </AtlasPanel>

      <AtlasPanel
        kicker="configuration"
        title={selected ? selected.name || selected.deviceId : 'Choose a phone'}
        description={
          selected
            ? 'Address is for your records. Wi-Fi is sent to the phone, which joins that network when it is not in a call.'
            : 'Select a phone to set where it sits and which network it should join.'
        }
      >
        {selected ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              onSave()
            }}
          >
            <label className="block">
              <small className="atlas-overline block text-[#9eacb9]">address</small>
              <input
                value={draft.address}
                onChange={(event) => onDraftChange({ ...draft, address: event.target.value })}
                className="atlas-admin-input mt-1 w-full"
                autoComplete="street-address"
                placeholder="Street, city"
              />
            </label>
            <label className="block">
              <small className="atlas-overline block text-[#9eacb9]">wi-fi username</small>
              <input
                value={draft.wifiUsername}
                onChange={(event) => onDraftChange({ ...draft, wifiUsername: event.target.value, clearPassword: false })}
                className="atlas-admin-input mt-1 w-full"
                autoComplete="off"
                placeholder="Network name"
                spellCheck={false}
              />
            </label>
            <label className="block">
              <small className="atlas-overline block text-[#9eacb9]">wi-fi password</small>
              <input
                value={draft.wifiPassword}
                onChange={(event) => onDraftChange({ ...draft, wifiPassword: event.target.value, clearPassword: false })}
                className="atlas-admin-input mt-1 w-full"
                type="password"
                autoComplete="new-password"
                placeholder={network?.hasWifiPassword ? 'Leave blank to keep the saved password' : 'Network password'}
              />
            </label>
            <AtlasMetaText className="block text-[#9eacb9]">
              {draft.clearPassword
                ? 'The saved password will be removed when you save.'
                : network?.hasWifiPassword
                  ? 'A password is already saved on this phone.'
                  : 'No password saved yet.'}
            </AtlasMetaText>
            <div className="flex flex-wrap items-center gap-3">
              <AtlasTextButton type="submit" disabled={isSaving} className="px-4 py-2 text-[14px]">
                {isSaving ? 'saving…' : 'save configuration'}
              </AtlasTextButton>
              {network?.hasWifiPassword ? (
                <AtlasTextButton
                  type="button"
                  disabled={isSaving}
                  onClick={onClearPassword}
                  className="px-4 py-2 text-[14px]"
                  style={{ ['--button-border-color' as const]: '#ffffff2f', color: SP_COLORS.white } as CSSProperties}
                >
                  {draft.clearPassword ? 'keep saved password' : 'clear saved password'}
                </AtlasTextButton>
              ) : null}
            </div>
            {saveError ? <AtlasBodyText className="text-[#ee352e]">{saveError}</AtlasBodyText> : null}
            {saveMessage ? <AtlasBodyText>{saveMessage}</AtlasBodyText> : null}

            <div className="space-y-2 pt-2">
              <small className="atlas-overline block text-[#9eacb9]">recent activity</small>
              {recentLogs.length === 0 ? (
                <AtlasMetaText className="block text-[#9eacb9]">No keypad, hook, or network logs for this phone yet.</AtlasMetaText>
              ) : (
                recentLogs.map((log) => (
                  <AtlasInsetCard key={log.id}>
                    <div className="text-[14px] text-white">{summarizeDeviceLog(log)}</div>
                    <AtlasMetaText className="mt-1 block text-[#9eacb9]">
                      {log.apiSubject.replace(/_/g, ' ')} · {formatWhen(log.createdAtIso)}
                    </AtlasMetaText>
                  </AtlasInsetCard>
                ))
              )}
            </div>
          </form>
        ) : null}
      </AtlasPanel>
    </div>
  )
}
