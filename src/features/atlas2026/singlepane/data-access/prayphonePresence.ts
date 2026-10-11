import { supabase } from '@/lib/supabaseClient'

export type PrayPhonePresenceRow = {
  deviceId: string
  lastSeenIso: string
}

/**
 * Device heartbeats land on atlas.prayphone_devices.last_seen.
 * The header counts those rows; it does not invent a second presence channel.
 */
export async function fetchPrayPhoneDevicePresence(): Promise<
  { ok: true; devices: PrayPhonePresenceRow[] } | { ok: false }
> {
  if (!supabase) return { ok: false }
  const { data, error } = await supabase.schema('atlas').from('prayphone_devices').select('device_id, last_seen')
  if (error) {
    console.warn('Pray Phone presence read failed', error.message)
    return { ok: false }
  }
  return {
    ok: true,
    devices: (data ?? []).map((row) => ({
      deviceId: String(row.device_id || ''),
      lastSeenIso: row.last_seen ? String(row.last_seen) : ''
    }))
  }
}
