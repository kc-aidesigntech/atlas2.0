/**
 * Session memory for workspace collections.
 *
 * The last successful load stays in memory for this tab and in sessionStorage
 * so a refresh can paint it before the network answers. sessionStorage is
 * cleared when the tab closes, so enrollee records are not kept on disk after
 * the working session. Keys include the signed-in user id so two accounts on
 * the same browser do not read each other's snapshot.
 */

const memory = new Map<string, unknown>()

function storageKey(userId: string, collectionKey: string) {
  return `atlas.remembered.${userId}.${collectionKey}`
}

export function readRememberedMemory<T>(userId: string, collectionKey: string): T | null {
  const value = memory.get(storageKey(userId, collectionKey))
  return value === undefined ? null : (value as T)
}

export function readRemembered<T>(userId: string, collectionKey: string): T | null {
  const cached = readRememberedMemory<T>(userId, collectionKey)
  if (cached) return cached
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(storageKey(userId, collectionKey))
    if (!raw) return null
    const parsed = JSON.parse(raw) as T
    memory.set(storageKey(userId, collectionKey), parsed)
    return parsed
  } catch {
    // A quota or parse failure just means this open loads from the network.
    return null
  }
}

export function writeRemembered<T>(userId: string, collectionKey: string, value: T) {
  const key = storageKey(userId, collectionKey)
  memory.set(key, value)
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Memory still serves this tab when sessionStorage is full.
    try {
      window.sessionStorage.removeItem(key)
    } catch {
      // Ignore a storage implementation that rejects removal too.
    }
  }
}

export function revisionMapsMatch(previous: Record<string, string> | undefined, next: Record<string, string> | undefined) {
  if (!previous || !next) return false
  const previousIds = Object.keys(previous)
  const nextIds = Object.keys(next)
  if (previousIds.length !== nextIds.length) return false
  return nextIds.every((id) => previous[id] === next[id])
}

export function describeRecordDelta(previous: Record<string, string>, next: Record<string, string>) {
  const changedIds: string[] = []
  const addedIds: string[] = []
  const removedIds: string[] = []
  for (const [id, revision] of Object.entries(next)) {
    if (!(id in previous)) addedIds.push(id)
    else if (previous[id] !== revision) changedIds.push(id)
  }
  for (const id of Object.keys(previous)) {
    if (!(id in next)) removedIds.push(id)
  }
  return { changedIds, addedIds, removedIds }
}
