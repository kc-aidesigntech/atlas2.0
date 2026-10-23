import { supabase } from '@/lib/supabaseClient'

export type PrayPhonePresenceRow = {
  deviceId: string
  lastSeenIso: string
  model: string
}

/**
 * Selects device_id, last_seen, and model from atlas.prayphone_devices.
 */
export async function fetchPrayPhoneDevicePresence(): Promise<
  { ok: true; devices: PrayPhonePresenceRow[] } | { ok: false }
> {
  if (!supabase) return { ok: false }
  const { data, error } = await supabase
    .schema('atlas')
    .from('prayphone_devices')
    .select('device_id, last_seen, model')
  if (error) {
    console.warn('Pray Phone presence read failed', error.message)
    return { ok: false }
  }
  return {
    ok: true,
    devices: (data ?? []).map((row) => ({
      deviceId: String(row.device_id || ''),
      lastSeenIso: row.last_seen ? String(row.last_seen) : '',
      model: String(row.model || '')
    }))
  }
}
