/**
 * Reads and writes for `atlas.wallet_task_checks` (migration
 * `20261116090000_wallet_task_checks.sql`): one row per task the signed-in
 * person checked on the My Wallet task pad. Row-Level Security (RLS) returns
 * and accepts the caller's own rows only, so no call here names a person.
 */
import type { WalletTaskCheck } from '@/features/atlas2026/singlepane/domain/walletTaskChecks'
import { parseWalletTask, type WalletTask } from '@/features/atlas2026/singlepane/domain/walletTasks'
import { hasSupabaseConfig, isSinglePaneSupabaseBootstrapEnabled, supabase } from '@/lib/supabaseClient'

/** The most checks one read returns; the completed list holds the latest ones up to this count. */
const CHECK_READ_LIMIT = 500

type Row = Record<string, unknown>

/** The table handle, or null when the app runs with no database session (no config, or the dev server without sign-in). */
function checksTable() {
  if (!hasSupabaseConfig || !supabase || !isSinglePaneSupabaseBootstrapEnabled) return null
  return (supabase as any).schema('atlas').from('wallet_task_checks')
}

function toCheck(row: Row): WalletTaskCheck | null {
  const task = parseWalletTask(row.task)
  const doneAtIso = typeof row.done_at === 'string' ? row.done_at : ''
  // A row whose stored task this version cannot read, or whose key and task disagree, is left out.
  if (!task || !doneAtIso || task.id !== row.task_key) return null
  return { taskId: task.id, task, doneAtIso }
}

function errorMessage(error: unknown, fallback: string): string {
  const message = (error as { message?: unknown } | null)?.message
  return typeof message === 'string' && message.trim() ? message : fallback
}

export type WalletTaskCheckLoad = { source: 'table'; checks: WalletTaskCheck[] } | { source: 'unavailable'; reason: string | null }

/**
 * Reads the caller's checks that have not been unchecked, latest first.
 * `unavailable` with a null reason means there is no database session;
 * with a reason it means the read failed.
 */
export async function loadWalletTaskChecks(): Promise<WalletTaskCheckLoad> {
  const table = checksTable()
  if (!table) return { source: 'unavailable', reason: null }
  const { data, error } = await table
    .select('task_key, task, done_at')
    .is('reopened_at', null)
    .order('done_at', { ascending: false })
    .limit(CHECK_READ_LIMIT)
  if (error) return { source: 'unavailable', reason: errorMessage(error, 'The checked tasks could not be read.') }
  return {
    source: 'table',
    checks: ((data || []) as Row[]).map(toCheck).filter((check): check is WalletTaskCheck => check !== null)
  }
}

/** Inserts one check for the caller. The database writes the person and the check time; the stored row is returned. */
export async function insertWalletTaskCheck(task: WalletTask): Promise<WalletTaskCheck> {
  const table = checksTable()
  if (!table) throw new Error('Supabase is not configured.')
  const { data, error } = await table.insert({ task_key: task.id, task }).select('task_key, task, done_at').single()
  if (error) throw new Error(errorMessage(error, 'The check could not be saved.'))
  const check = toCheck((data || {}) as Row)
  if (!check) throw new Error('The check was saved but could not be read back.')
  return check
}

/** Deletes the caller's open check for one task. The database accepts this for a check made in the last 24 hours. */
export async function deleteWalletTaskCheck(taskId: string): Promise<void> {
  const table = checksTable()
  if (!table) throw new Error('Supabase is not configured.')
  const { data, error } = await table.delete().eq('task_key', taskId).is('reopened_at', null).select('task_key')
  if (error) throw new Error(errorMessage(error, 'The task could not be unchecked.'))
  if (!(data || []).length) throw new Error('The task could not be unchecked.')
}

/** Writes the uncheck time and the reason on the caller's open check for one task; the row stays in the table. */
export async function reopenWalletTaskCheck(taskId: string, reason: string): Promise<void> {
  const table = checksTable()
  if (!table) throw new Error('Supabase is not configured.')
  const { data, error } = await table
    .update({ reopened_at: new Date().toISOString(), reopen_reason: reason.trim() })
    .eq('task_key', taskId)
    .is('reopened_at', null)
    .select('task_key')
  if (error) throw new Error(errorMessage(error, 'The task could not be unchecked.'))
  if (!(data || []).length) throw new Error('The task could not be unchecked.')
}
