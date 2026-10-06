/**
 * Atlas fleet reads. Device rows, call sessions, and kiosk logs already live
 * in the atlas schema. Wi-Fi passphrases stay behind Remote Procedure Call
 * (RPC) functions so a list query cannot return them.
 */
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'
import type {
  FleetCollection,
  FleetDevice,
  FleetDeviceLog,
  FleetNetworkSummary,
  FleetSession
} from '@/features/atlas2026/fleet/fleetPresence'

const SESSION_LIMIT = 400
const LOG_LIMIT = 500
const COLLECTION_LIMIT = 400

function requireClient() {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Supabase is not configured.')
  }
  return supabase
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function mapDevice(row: Record<string, unknown>): FleetDevice {
  return {
    id: String(row.id || ''),
    deviceId: String(row.device_id || ''),
    name: String(row.name || ''),
    status: String(row.status || ''),
    model: String(row.model || ''),
    appVersion: String(row.app_version || ''),
    otaChannel: String(row.ota_channel || ''),
    lastSeenIso: String(row.last_seen || ''),
    locationAddress: String(row.location_address || ''),
    enabled: row.enabled !== false
  }
}

function mapSession(row: Record<string, unknown>): FleetSession {
  return {
    id: String(row.id || ''),
    state: String(row.state || ''),
    fromAor: String(row.from_aor || ''),
    createdAtIso: String(row.created_at || ''),
    startedAtIso: String(row.started_at || ''),
    answeredAtIso: String(row.answered_at || ''),
    endedAtIso: String(row.ended_at || ''),
    endReason: String(row.end_reason || ''),
    error: String(row.error || '')
  }
}

function mapLog(row: Record<string, unknown>): FleetDeviceLog {
  return {
    id: String(row.id || ''),
    deviceId: String(row.device_id || ''),
    apiSubject: String(row.api_subject || ''),
    payload: asRecord(row.payload),
    createdAtIso: String(row.created_at || '')
  }
}

function mapCollection(row: Record<string, unknown>): FleetCollection {
  const payload = asRecord(row.payload)
  const keywords = payload.keywords
  return {
    id: String(row.id || ''),
    sessionId: String(row.session_id || ''),
    deviceId: String(row.device_id || ''),
    collectedAtIso: String(row.collected_at || ''),
    keywordCount: Array.isArray(keywords) ? keywords.length : 0
  }
}

export async function fetchCanManagePrayphoneFleet(): Promise<boolean> {
  const client = requireClient()
  const { data, error } = await client.schema('atlas').rpc('fn_can_manage_prayphone_fleet')
  if (error) throw error
  return data === true
}

export async function loadFleetDevices(): Promise<FleetDevice[]> {
  const client = requireClient()
  const { data, error } = await client
    .schema('atlas')
    .from('prayphone_devices')
    .select('id, device_id, name, status, model, app_version, ota_channel, last_seen, location_address, enabled')
    .order('last_seen', { ascending: false })
  if (error) throw error
  return (data || []).map((row) => mapDevice(row as Record<string, unknown>))
}

export async function loadFleetNetwork(): Promise<FleetNetworkSummary[]> {
  const client = requireClient()
  const { data, error } = await client.schema('atlas').rpc('fn_list_prayphone_device_network')
  if (error) throw error
  return (Array.isArray(data) ? data : []).map((row) => {
    const record = row as Record<string, unknown>
    return {
      deviceId: String(record.device_id || ''),
      wifiUsername: String(record.wifi_username || ''),
      hasWifiPassword: record.has_wifi_password === true,
      updatedAtIso: String(record.updated_at || '')
    }
  })
}

export async function loadFleetSessions(): Promise<FleetSession[]> {
  const client = requireClient()
  const { data, error } = await client
    .schema('atlas')
    .from('prayphone_call_sessions')
    .select('id, state, from_aor, created_at, started_at, answered_at, ended_at, end_reason, error')
    .order('created_at', { ascending: false })
    .limit(SESSION_LIMIT)
  if (error) throw error
  return (data || []).map((row) => mapSession(row as Record<string, unknown>))
}

export async function loadFleetDeviceLogs(): Promise<FleetDeviceLog[]> {
  const client = requireClient()
  const { data, error } = await client
    .schema('atlas')
    .from('prayphone_device_logs')
    .select('id, device_id, api_subject, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(LOG_LIMIT)
  if (error) throw error
  return (data || []).map((row) => mapLog(row as Record<string, unknown>))
}

export async function loadFleetCollections(): Promise<FleetCollection[]> {
  const client = requireClient()
  const { data, error } = await client
    .schema('atlas')
    .from('prayphone_kiosk_collections')
    .select('id, session_id, device_id, collected_at, payload')
    .order('collected_at', { ascending: false })
    .limit(COLLECTION_LIMIT)
  if (error) throw error
  return (data || []).map((row) => mapCollection(row as Record<string, unknown>))
}

export async function saveFleetDeviceConfig(input: {
  deviceId: string
  address: string
  wifiUsername: string
  wifiPassword: string
  replacePassword: boolean
}): Promise<void> {
  const client = requireClient()
  const { error } = await client.schema('atlas').rpc('fn_save_prayphone_device_config', {
    target_device_id: input.deviceId,
    next_address: input.address,
    next_wifi_username: input.wifiUsername,
    next_wifi_password: input.replacePassword ? input.wifiPassword : '',
    replace_password: input.replacePassword
  })
  if (error) throw error
}
