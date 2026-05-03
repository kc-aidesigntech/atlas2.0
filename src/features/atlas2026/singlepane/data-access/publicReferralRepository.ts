import type { UnassignedEnrolleePickupRecord } from '@/features/atlas2026/singlepane/types'

const LOCAL_PUBLIC_REFERRAL_QUEUE_KEY = 'atlas2026.public.referral-queue.v1'

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

/**
 * Public referral entries are captured before login and merged into the same
 * queue model used by authenticated workflows, so management sees one intake rail.
 */
export function loadPublicReferralQueueRecords(): UnassignedEnrolleePickupRecord[] {
  return readQueue()
}

export function enqueuePublicReferralQueueRecord(record: UnassignedEnrolleePickupRecord) {
  const existing = readQueue()
  const deduped = [record, ...existing.filter((item) => item.id !== record.id)]
  writeQueue(deduped)
  return record
}

