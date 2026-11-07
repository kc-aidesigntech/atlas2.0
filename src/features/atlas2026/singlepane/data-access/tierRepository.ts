/**
 * Tier and permission Remote Procedure Calls (RPCs). Every call to
 * `fn_my_permissions`, `fn_my_tier`, `fn_set_person_tier`, `fn_mark_tier_alum`,
 * `fn_grant_designation`, and `fn_revoke_designation` goes through this file,
 * so a signature change on the database side is a one-file edit here.
 */
import type { PersonTierRecord } from '@/features/atlas2026/shared/contracts'
import {
  isAtlasPermissionKey,
  isTierDesignation,
  isTierKey,
  type AtlasPermissionKey,
  type TierDesignation,
  type TierKey,
  type TierStanding,
  type TierStatus
} from '@/features/atlas2026/shared/tiers'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'

export interface MyPermissionsResult {
  /** `rpc` when `fn_my_permissions` answered; `unavailable` on any error or without Supabase. */
  source: 'rpc' | 'unavailable'
  keys: AtlasPermissionKey[]
}

/** Calls `fn_my_permissions`; an error yields an empty list marked unavailable. */
export async function loadMyPermissions(): Promise<MyPermissionsResult> {
  if (!hasSupabaseConfig || !supabase) return { source: 'unavailable', keys: [] }
  const { data, error } = await supabase.schema('atlas').rpc('fn_my_permissions')
  if (error) {
    console.warn('fn_my_permissions failed', error.message)
    return { source: 'unavailable', keys: [] }
  }
  const keys = (Array.isArray(data) ? data : []).filter(isAtlasPermissionKey)
  return { source: 'rpc', keys }
}

function toTierStatus(value: unknown): TierStatus {
  return value === 'alum' ? 'alum' : 'active'
}

function toDesignations(value: unknown): TierDesignation[] {
  return (Array.isArray(value) ? value : []).filter(isTierDesignation)
}

/** Calls `fn_my_tier`; null when the RPC errors or the caller holds no tier row. */
export async function loadMyTier(): Promise<TierStanding | null> {
  if (!hasSupabaseConfig || !supabase) return null
  const { data, error } = await supabase.schema('atlas').rpc('fn_my_tier')
  if (error) {
    console.warn('fn_my_tier failed', error.message)
    return null
  }
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null | undefined
  if (!row || typeof row !== 'object') return null
  const tierKey = isTierKey(row.tier_key) ? row.tier_key : null
  if (!tierKey) return null
  return {
    tierKey,
    tierStatus: toTierStatus(row.tier_status),
    isLucidEmployee: row.is_lucid_employee === true,
    designations: toDesignations(row.designations)
  }
}

/**
 * Reads `atlas.people_tiers` and `atlas.tier_designations` for the given people.
 * Missing tables or denied reads return an empty list so the directory still renders.
 */
export async function loadPersonTierRecords(personIds: string[]): Promise<PersonTierRecord[]> {
  if (!hasSupabaseConfig || !supabase || !personIds.length) return []
  const [tierResult, designationResult] = await Promise.all([
    (supabase as any)
      .schema('atlas')
      .from('people_tiers')
      .select('person_id, tier_key, tier_status, entered_at, left_at, is_lucid_employee')
      .in('person_id', personIds),
    (supabase as any).schema('atlas').from('tier_designations').select('person_id, designation').in('person_id', personIds)
  ])
  if (tierResult.error) {
    console.warn('people_tiers read failed', tierResult.error.message)
    return []
  }
  if (designationResult.error) console.warn('tier_designations read failed', designationResult.error.message)
  const designationsByPerson = new Map<string, TierDesignation[]>()
  for (const row of (designationResult.data || []) as Array<{ person_id: string; designation: unknown }>) {
    if (!isTierDesignation(row.designation)) continue
    const current = designationsByPerson.get(row.person_id) || []
    current.push(row.designation)
    designationsByPerson.set(row.person_id, current)
  }
  // One row per person: the active row, else the newest left row.
  const byPerson = new Map<string, PersonTierRecord>()
  for (const row of (tierResult.data || []) as Array<Record<string, unknown>>) {
    const personId = String(row.person_id || '')
    if (!personId || !isTierKey(row.tier_key)) continue
    const record: PersonTierRecord = {
      personId,
      tierKey: row.tier_key,
      tierStatus: toTierStatus(row.tier_status),
      isLucidEmployee: row.is_lucid_employee === true,
      designations: designationsByPerson.get(personId) || [],
      enteredAtIso: row.entered_at ? String(row.entered_at) : null,
      leftAtIso: row.left_at ? String(row.left_at) : null
    }
    const existing = byPerson.get(personId)
    if (!existing || (existing.tierStatus !== 'active' && record.tierStatus === 'active')) byPerson.set(personId, record)
  }
  return Array.from(byPerson.values())
}

function requireSupabase() {
  if (!hasSupabaseConfig || !supabase) throw new Error('Supabase is not configured.')
  return supabase
}

/** Calls `fn_set_person_tier(target_person_id, tier_key)`: writes the role assignment and the active tier row. */
export async function setPersonTier(personId: string, tierKey: TierKey): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .schema('atlas')
    .rpc('fn_set_person_tier', { target_person_id: personId, tier_key: tierKey })
  if (error) throw new Error(error.message)
}

/** Calls `fn_mark_tier_alum(target_person_id)`: the active tier row becomes alum and keeps its tier; the tier role assignment ends today. */
export async function markPersonTierAlum(personId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.schema('atlas').rpc('fn_mark_tier_alum', { target_person_id: personId })
  if (error) throw new Error(error.message)
}

/** Calls `fn_grant_designation(target_person_id, designation)`; the database requires an active tier of t2b or higher. */
export async function grantPersonDesignation(personId: string, designation: TierDesignation): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .schema('atlas')
    .rpc('fn_grant_designation', { target_person_id: personId, designation })
  if (error) throw new Error(error.message)
}

/** Calls `fn_revoke_designation(target_person_id, designation)`. */
export async function revokePersonDesignation(personId: string, designation: TierDesignation): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .schema('atlas')
    .rpc('fn_revoke_designation', { target_person_id: personId, designation })
  if (error) throw new Error(error.message)
}

/**
 * Updates `is_lucid_employee` on the person's tier row. The migration grants
 * `update (is_lucid_employee)` on `atlas.people_tiers` for this one column;
 * every other tier write goes through an RPC above.
 */
export async function setPersonLucidEmployee(personId: string, isLucidEmployee: boolean): Promise<void> {
  const client = requireSupabase()
  const { error } = await (client as any)
    .schema('atlas')
    .from('people_tiers')
    .update({ is_lucid_employee: isLucidEmployee })
    .eq('person_id', personId)
  if (error) throw new Error(error.message)
}
