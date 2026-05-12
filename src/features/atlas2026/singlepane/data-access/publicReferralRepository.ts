import type { UnassignedEnrolleePickupRecord } from '@/features/atlas2026/singlepane/types'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'

const LOCAL_PUBLIC_REFERRAL_QUEUE_KEY = 'atlas2026.public.referral-queue.v1'
let remoteQueueTableUnavailable = false

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
    .select('payload')
    .order('submitted_at', { ascending: false })
    .limit(100)
  if (error) {
    // Some deployments omit this optional table and can return different error codes
    // depending on schema cache state; stop retrying after first failure.
    remoteQueueTableUnavailable = true
    return []
  }
  return (data || [])
    .map((row: { payload?: unknown }) => parseRemotePayload(row.payload))
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
  await (supabase as any)
    .schema('atlas')
    .from('public_referral_intake_events')
    .upsert(payload, { onConflict: 'external_record_id' })
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

