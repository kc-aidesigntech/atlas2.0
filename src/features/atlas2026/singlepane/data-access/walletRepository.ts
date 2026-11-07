/**
 * My Wallet reads. `loadWalletOverview` calls the Remote Procedure Call (RPC)
 * `atlas.fn_wallet_overview()` (migration `20261104190500_tier_feature_tables.sql`),
 * which returns one JavaScript Object Notation (JSON) document for the caller's
 * person id. `loadMySupervisor` reads the caller's open row in
 * `atlas.supervisor_navigator_assignments`. Both tolerate a database that has
 * not been migrated yet by returning null.
 */
import { isTierDesignation, isTierKey, type TierStanding } from '@/features/atlas2026/shared/tiers'
import { resolveSessionPersonIdFromMetadata } from '@/features/atlas2026/singlepane/data-access/enrollmentAssignmentRepository'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'

export interface WalletCompetencyCard {
  cardKey: string
  title: string
  earnedAtIso: string | null
}

export type WalletSponsorshipStatus = 'active' | 'ended'

export interface WalletSponsorship {
  id: string
  /** The other party: the sponsored person on a given row, the sponsor on a received row. */
  personId: string
  displayName: string
  status: WalletSponsorshipStatus
  startedAtIso: string | null
  endedAtIso: string | null
}

export type WalletRespiteShiftStatus = 'scheduled' | 'completed' | 'cancelled'

export interface WalletRespiteShift {
  id: string
  site: string
  startsAtIso: string | null
  endsAtIso: string | null
  status: WalletRespiteShiftStatus
}

export interface WalletSecondmentScheduleSlot {
  /** 0 is Sunday through 6 Saturday, as stored in `secondment_schedule.day_of_week`. */
  dayOfWeek: number
  startsTime: string
  endsTime: string
  location: string | null
}

export type WalletSecondmentStatus = 'planned' | 'active' | 'completed' | 'cancelled'

export interface WalletSecondment {
  id: string
  hostOrganization: string
  partnerId: string | null
  startsOn: string | null
  endsOn: string | null
  status: WalletSecondmentStatus
  schedule: WalletSecondmentScheduleSlot[]
}

export interface WalletOverview {
  /** The caller's `fn_my_tier` row as embedded by the RPC; null when the caller holds no tier row. */
  tier: TierStanding | null
  competencyCards: WalletCompetencyCard[]
  sponsorshipsGiven: WalletSponsorship[]
  sponsorshipsReceived: WalletSponsorship[]
  respiteShifts: WalletRespiteShift[]
  secondments: WalletSecondment[]
  leadsOwnedCount: number
}

export interface WalletSupervisor {
  personId: string
  displayName: string
  startsOn: string | null
}

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
}

function asRecordList(value: unknown): JsonRecord[] {
  return (Array.isArray(value) ? value : []).map(asRecord).filter((row): row is JsonRecord => row !== null)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value)
}

function asNullableString(value: unknown): string | null {
  const text = asString(value).trim()
  return text ? text : null
}

function toSponsorshipStatus(value: unknown): WalletSponsorshipStatus {
  return value === 'ended' ? 'ended' : 'active'
}

function toRespiteShiftStatus(value: unknown): WalletRespiteShiftStatus {
  return value === 'completed' || value === 'cancelled' ? value : 'scheduled'
}

function toSecondmentStatus(value: unknown): WalletSecondmentStatus {
  return value === 'active' || value === 'completed' || value === 'cancelled' ? value : 'planned'
}

function toTierStanding(value: unknown): TierStanding | null {
  const row = asRecord(value)
  if (!row || !isTierKey(row.tier_key)) return null
  return {
    tierKey: row.tier_key,
    tierStatus: row.tier_status === 'alum' ? 'alum' : 'active',
    isLucidEmployee: row.is_lucid_employee === true,
    designations: (Array.isArray(row.designations) ? row.designations : []).filter(isTierDesignation)
  }
}

/** One sponsorship row; `personKey` and `nameKey` pick the sponsored or the sponsor columns. */
function toSponsorship(row: JsonRecord, personKey: string, nameKey: string): WalletSponsorship {
  return {
    id: asString(row.id),
    personId: asString(row[personKey]),
    displayName: asNullableString(row[nameKey]) || 'unnamed',
    status: toSponsorshipStatus(row.status),
    startedAtIso: asNullableString(row.started_at),
    endedAtIso: asNullableString(row.ended_at)
  }
}

function toWalletOverview(value: unknown): WalletOverview | null {
  const root = asRecord(value)
  if (!root) return null
  return {
    tier: toTierStanding(root.tier),
    competencyCards: asRecordList(root.competency_cards).map((row) => ({
      cardKey: asString(row.card_key),
      title: asNullableString(row.title) || asString(row.card_key),
      earnedAtIso: asNullableString(row.earned_at)
    })),
    sponsorshipsGiven: asRecordList(root.sponsorships_given).map((row) =>
      toSponsorship(row, 'sponsored_person_id', 'sponsored_display_name')
    ),
    sponsorshipsReceived: asRecordList(root.sponsorships_received).map((row) =>
      toSponsorship(row, 'sponsor_person_id', 'sponsor_display_name')
    ),
    respiteShifts: asRecordList(root.respite_shifts).map((row) => ({
      id: asString(row.id),
      site: asNullableString(row.site) || 'site not recorded',
      startsAtIso: asNullableString(row.starts_at),
      endsAtIso: asNullableString(row.ends_at),
      status: toRespiteShiftStatus(row.status)
    })),
    secondments: asRecordList(root.secondments).map((row) => ({
      id: asString(row.id),
      hostOrganization: asNullableString(row.host_organization) || 'host not recorded',
      partnerId: asNullableString(row.partner_id),
      startsOn: asNullableString(row.starts_on),
      endsOn: asNullableString(row.ends_on),
      status: toSecondmentStatus(row.status),
      schedule: asRecordList(row.schedule).map((slot) => ({
        dayOfWeek: Number.isInteger(slot.day_of_week) ? Number(slot.day_of_week) : -1,
        startsTime: asString(slot.starts_time),
        endsTime: asString(slot.ends_time),
        location: asNullableString(slot.location)
      }))
    })),
    leadsOwnedCount: Number.isFinite(Number(root.leads_owned_count)) ? Number(root.leads_owned_count) : 0
  }
}

/** Calls `fn_wallet_overview`; null when Supabase is absent, the RPC errors, or the payload is not an object. */
export async function loadWalletOverview(): Promise<WalletOverview | null> {
  if (!hasSupabaseConfig || !supabase) return null
  const { data, error } = await (supabase as any).schema('atlas').rpc('fn_wallet_overview')
  if (error) {
    console.warn('fn_wallet_overview failed', error.message)
    return null
  }
  return toWalletOverview(data)
}

/**
 * Reads the caller's open supervisor assignment: the row in
 * `supervisor_navigator_assignments` where the caller is the navigator and
 * `ends_on` is null. The select policy already scopes rows to the caller, so
 * the person id filter only drops rows where the caller is the supervisor.
 * Null when there is no open row, no person id, or the read fails.
 */
export async function loadMySupervisor(): Promise<WalletSupervisor | null> {
  if (!hasSupabaseConfig || !supabase) return null
  let personId: string | null = null
  try {
    personId = await resolveSessionPersonIdFromMetadata()
  } catch (caught) {
    console.warn('session person id lookup failed', caught instanceof Error ? caught.message : caught)
    return null
  }
  if (!personId) return null
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('supervisor_navigator_assignments')
    .select('supervisor_person_id, starts_on, supervisor:people!supervisor_person_id(display_name)')
    .eq('navigator_person_id', personId)
    .is('ends_on', null)
    .order('starts_on', { ascending: false })
    .limit(1)
  if (error) {
    console.warn('supervisor_navigator_assignments read failed', error.message)
    return null
  }
  const row = asRecord(Array.isArray(data) ? data[0] : null)
  if (!row) return null
  const supervisor = asRecord(row.supervisor)
  return {
    personId: asString(row.supervisor_person_id),
    displayName: asNullableString(supervisor?.display_name) || 'supervisor on record',
    startsOn: asNullableString(row.starts_on)
  }
}
