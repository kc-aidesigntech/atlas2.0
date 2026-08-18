import { supabase } from '@/lib/supabaseClient'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuidPersonId(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value))
}

export type WarmLineAccessRow = {
  person_id: string
  has_access: boolean
  exception_effect: 'allow' | 'deny' | null
}

export async function fetchCanAccessWarmLineAgent(): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.schema('atlas').rpc('fn_can_access_warmline_agent')
  if (error) {
    console.warn('fn_can_access_warmline_agent failed', error.message)
    return false
  }
  return data === true
}

export async function listWarmLineAccess(personIds: string[]): Promise<WarmLineAccessRow[]> {
  if (!supabase) return []
  const ids = personIds.filter(isUuidPersonId)
  if (ids.length === 0) return []
  const { data, error } = await supabase.schema('atlas').rpc('fn_list_warmline_access', {
    target_person_ids: ids
  })
  if (error) {
    console.warn('fn_list_warmline_access failed', error.message)
    return []
  }
  return (Array.isArray(data) ? data : []).map((row) => ({
    person_id: String(row.person_id),
    has_access: row.has_access === true,
    exception_effect:
      row.exception_effect === 'allow' || row.exception_effect === 'deny' ? row.exception_effect : null
  }))
}

export async function adminSetWarmLineAccess(
  personId: string,
  nextEffect: 'allow' | 'deny' | 'clear'
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.schema('atlas').rpc('fn_admin_set_warmline_access', {
    target_person_id: personId,
    next_effect: nextEffect
  })
  if (error) throw new Error(error.message)
}

export async function supervisorSetNavigatorWarmLineAccess(
  navigatorPersonId: string,
  enabled: boolean
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.schema('atlas').rpc('fn_supervisor_set_navigator_warmline_access', {
    target_navigator_person_id: navigatorPersonId,
    enabled
  })
  if (error) throw new Error(error.message)
}
