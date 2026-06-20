import type { UnassignedEnrolleePickupRecord } from '@/features/atlas2026/singlepane/types'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'

const LOCAL_PUBLIC_REFERRAL_QUEUE_KEY = 'atlas2026.public.referral-queue.v1'
let remoteQueueTableUnavailable = false
type ReferralQueueStatus = UnassignedEnrolleePickupRecord['status']

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function parseStoredQueue(rawValue: string | null): UnassignedEnrolleePickupRecord[] {
  if (!rawValue) return []
  try {
    const parsed = JSON.parse(rawValue) as unknown
    return Array.isArray(parsed) ? (parsed.filter(Boolean) as UnassignedEnrolleePickupRecord[]) : []
  } catch {
    return []
  }
}

function readQueue() {
  if (!canUseLocalStorage()) return []
  return parseStoredQueue(window.localStorage.getItem(LOCAL_PUBLIC_REFERRAL_QUEUE_KEY))
}

function writeQueue(records: UnassignedEnrolleePickupRecord[]) {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(LOCAL_PUBLIC_REFERRAL_QUEUE_KEY, JSON.stringify(records))
}

function parseRemotePayload(payload: unknown): UnassignedEnrolleePickupRecord | null {
  if (!payload || typeof payload !== 'object') return null
  const candidate = payload as Partial<UnassignedEnrolleePickupRecord>
  if (typeof candidate.id !== 'string' || typeof candidate.fullName !== 'string') return null
  if (!Array.isArray(candidate.zCodeTags)) return null
  if (!['available', 'accepted', 'claimed', 'archived'].includes(String(candidate.status))) return null
  return {
    id: candidate.id,
    fullName: candidate.fullName,
    dob: String(candidate.dob || ''),
    caseId: String(candidate.caseId || ''),
    email: String(candidate.email || ''),
    phone: String(candidate.phone || ''),
    demographicsSummary: String(candidate.demographicsSummary || ''),
    referredAtIso: String(candidate.referredAtIso || ''),
    referrerName: String(candidate.referrerName || ''),
    referrerOrganization: String(candidate.referrerOrganization || ''),
    backgroundNotes: String(candidate.backgroundNotes || ''),
    referrerMessage: String(candidate.referrerMessage || ''),
    zCodeTags: candidate.zCodeTags.map((value) => String(value)),
    status: candidate.status,
    claimedByNavigatorName: candidate.claimedByNavigatorName ? String(candidate.claimedByNavigatorName) : null,
    claimedAtIso: candidate.claimedAtIso ? String(candidate.claimedAtIso) : null
  }
}

async function loadRemoteQueueRecords() {
  if (remoteQueueTableUnavailable) return []
  if (!hasSupabaseConfig || !supabase) return []
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !sessionData.session) return []
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('public_referral_intake_events')
    .select('external_record_id,payload,submitted_at')
    .order('submitted_at', { ascending: false })
    .limit(100)
  if (error) {
    // Some deployments omit this optional table and can return different error codes
    // depending on schema cache state; stop retrying after first failure.
    remoteQueueTableUnavailable = true
    return []
  }
  return (data || [])
    .map((row: { payload?: unknown; external_record_id?: string; submitted_at?: string }) => {
      const parsed = parseRemotePayload(row.payload)
      if (!parsed) return null
      // Keep ids/timestamps deterministic from canonical row metadata when present.
      return {
        ...parsed,
        id: String(row.external_record_id || parsed.id || '').trim() || parsed.id,
        referredAtIso: String(parsed.referredAtIso || row.submitted_at || '').trim() || parsed.referredAtIso
      } satisfies UnassignedEnrolleePickupRecord
    })
    .filter((row: UnassignedEnrolleePickupRecord | null): row is UnassignedEnrolleePickupRecord => row !== null)
}

async function persistRemoteQueueRecord(record: UnassignedEnrolleePickupRecord) {
  if (!hasSupabaseConfig || !supabase) return
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) return
  const session = sessionData.session
  const roleLabel = String(record.referrerMessage || '').toLowerCase().includes('public partner inquiry')
    ? 'partner_inquiry'
    : 'referral'
  const payload = {
    external_record_id: record.id,
    event_type: roleLabel,
    source: 'public_landing',
    payload: record,
    submitted_by_email: session?.user?.email || null
  }
  // Public submitters act as the anon role, which is granted INSERT only (no SELECT/UPDATE).
  // A Supabase upsert emits INSERT ... ON CONFLICT, and Postgres requires SELECT (and UPDATE for
  // DO UPDATE) to evaluate the conflict — privileges anon/authenticated intentionally lack — so an
  // upsert is silently rejected and referrals never reach staff. A plain insert matches the granted
  // privilege. The external_record_id UNIQUE constraint keeps retries idempotent: a duplicate key
  // (23505) means the referral already persisted and is safe to ignore; any other error is surfaced
  // so a failed public referral fails loudly instead of being dropped.
  const { error } = await (supabase as any)
    .schema('atlas')
    .from('public_referral_intake_events')
    .insert(payload)
  if (error && (error as { code?: string }).code !== '23505') {
    throw new Error(`Referral could not be saved to the database: ${error.message || 'unknown error'}`)
  }
}

/**
 * Public referral entries are captured before login and merged into the same
 * queue model used by authenticated workflows, so management sees one intake rail.
 */
export async function loadPublicReferralQueueRecords(): Promise<UnassignedEnrolleePickupRecord[]> {
  const localRecords = readQueue()
  const remoteRecords = await loadRemoteQueueRecords()
  if (!remoteRecords.length) return localRecords
  const merged = [...localRecords]
  for (const remoteRecord of remoteRecords) {
    if (!merged.some((item) => item.id === remoteRecord.id)) {
      merged.push(remoteRecord)
    }
  }
  return merged
}

export async function enqueuePublicReferralQueueRecord(record: UnassignedEnrolleePickupRecord) {
  const existing = readQueue()
  const deduped = [record, ...existing.filter((item) => item.id !== record.id)]
  writeQueue(deduped)
  // Dual-write to Database (DB) so referral continuity survives browser/device changes.
  await persistRemoteQueueRecord(record)
  return record
}

export async function setPublicReferralQueueRecordStatus(
  recordId: string,
  status: ReferralQueueStatus,
  options: { claimedByNavigatorName?: string | null } = {}
): Promise<UnassignedEnrolleePickupRecord> {
  const normalizedRecordId = recordId.trim()
  if (!normalizedRecordId) {
    throw new Error('A referral queue record id is required to update status.')
  }
  const currentQueue = await loadPublicReferralQueueRecords()
  const existing = currentQueue.find((record) => record.id === normalizedRecordId)
  if (!existing) {
    throw new Error(`Referral queue record ${normalizedRecordId} was not found in canonical intake events.`)
  }
  const nextRecord: UnassignedEnrolleePickupRecord = {
    ...existing,
    status,
    claimedByNavigatorName: status === 'claimed' ? options.claimedByNavigatorName?.trim() || null : null,
    claimedAtIso: status === 'claimed' ? new Date().toISOString() : null
  }
  writeQueue([nextRecord, ...currentQueue.filter((record) => record.id !== normalizedRecordId)])
  if (hasSupabaseConfig && supabase) {
    const { error } = await (supabase as any)
      .schema('atlas')
      .from('public_referral_intake_events')
      .update({
        payload: nextRecord
      })
      .eq('external_record_id', normalizedRecordId)
      .eq('source', 'public_landing')
      .in('event_type', ['referral', 'partner_inquiry'])
    if (error) {
      throw new Error(`Referral status could not be persisted to canonical intake events: ${error.message || 'unknown error'}`)
    }
  }
  return nextRecord
}

