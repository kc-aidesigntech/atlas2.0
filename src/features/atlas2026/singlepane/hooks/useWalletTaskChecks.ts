import { useCallback, useEffect, useRef, useState } from 'react'
import {
  deleteWalletTaskCheck,
  insertWalletTaskCheck,
  loadWalletTaskChecks,
  reopenWalletTaskCheck
} from '@/features/atlas2026/singlepane/data-access/walletTaskCheckRepository'
import { startOfNextBusinessDay, type WalletTaskCheck } from '@/features/atlas2026/singlepane/domain/walletTaskChecks'
import type { WalletTask } from '@/features/atlas2026/singlepane/domain/walletTasks'

/** `table`: each change is written to `atlas.wallet_task_checks`. `memory`: changes live in this hook's state until the page reloads. */
type CheckStorage = 'loading' | 'table' | 'memory'

/**
 * The current time as state. It is rewritten at the first moment of the next
 * local calendar day, and when the page becomes visible again, so a wallet
 * left open overnight moves yesterday's checked rows to the completed list.
 */
export function useBusinessDayClock(): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(new Date()), Math.max(1000, startOfNextBusinessDay(now).getTime() - Date.now() + 1000))
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(new Date())
    }
    document.addEventListener('visibilitychange', onVisible)
    // The unmount function clears the midnight timer and removes the visibility listener.
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [now])

  return now
}

/**
 * The signed-in person's checked tasks, and the three writes the pad makes.
 * Each write changes the state first and then the table; a write the table
 * rejects is rolled back in state and its message is returned as `error`.
 * With no database session, or after a failed first read, the checks are
 * kept in state only and `storage` is `memory`.
 */
export function useWalletTaskChecks() {
  const [checks, setChecks] = useState<WalletTaskCheck[]>([])
  const [storage, setStorage] = useState<CheckStorage>('loading')
  const [error, setError] = useState<string | null>(null)
  // The first read, as a promise of the storage it settled on; every write waits for it.
  const loadRef = useRef<Promise<CheckStorage> | null>(null)

  useEffect(() => {
    let isMounted = true
    loadRef.current = loadWalletTaskChecks().then((result) => {
      const nextStorage: CheckStorage = result.source === 'table' ? 'table' : 'memory'
      if (!isMounted) return nextStorage
      setStorage(nextStorage)
      if (result.source === 'table') {
        // Checks made while the read was in flight stay; a stored check with the same task id is dropped in their favor.
        setChecks((current) => [...current, ...result.checks.filter((stored) => !current.some((check) => check.taskId === stored.taskId))])
      } else {
        setError(result.reason)
      }
      return nextStorage
    })
    return () => {
      isMounted = false
    }
  }, [])

  // The tail of the write queue; each write starts after the one before it has finished, so a check and its uncheck reach the table in order.
  const queueRef = useRef<Promise<unknown>>(Promise.resolve())

  /** Queues `write` behind the first read and the earlier writes; skips it when the checks are kept in memory. */
  const writeToTable = useCallback((write: () => Promise<unknown>) => {
    const run = queueRef.current.then(async () => {
      const settled = await (loadRef.current ?? Promise.resolve<CheckStorage>('memory'))
      if (settled === 'table') await write()
    })
    // The queue's tail swallows a rejection so the next write still runs; the caller receives `run` and its rejection.
    queueRef.current = run.catch(() => undefined)
    return run
  }, [])

  const removeCheck = useCallback((taskId: string) => {
    setChecks((current) => current.filter((check) => check.taskId !== taskId))
  }, [])

  const restoreCheck = useCallback((check: WalletTaskCheck) => {
    setChecks((current) => (current.some((entry) => entry.taskId === check.taskId) ? current : [...current, check]))
  }, [])

  /** Checks a task now. */
  const checkTask = useCallback(
    (task: WalletTask) => {
      setError(null)
      const optimistic: WalletTaskCheck = { taskId: task.id, task, doneAtIso: new Date().toISOString() }
      setChecks((current) => (current.some((check) => check.taskId === task.id) ? current : [...current, optimistic]))
      void writeToTable(async () => {
        const stored = await insertWalletTaskCheck(task)
        // The stored row's check time replaces the one written from this device's clock.
        setChecks((current) => current.map((check) => (check.taskId === stored.taskId ? stored : check)))
      }).catch((caught) => {
        removeCheck(task.id)
        setError(caught instanceof Error ? caught.message : 'The check could not be saved.')
      })
    },
    [removeCheck, writeToTable]
  )

  /** Unchecks a task checked today; the row is deleted and no reason is stored. */
  const uncheckTask = useCallback(
    (check: WalletTaskCheck) => {
      setError(null)
      removeCheck(check.taskId)
      void writeToTable(() => deleteWalletTaskCheck(check.taskId)).catch((caught) => {
        restoreCheck(check)
        setError(caught instanceof Error ? caught.message : 'The task could not be unchecked.')
      })
    },
    [removeCheck, restoreCheck, writeToTable]
  )

  /** Unchecks a task from the completed list; the reason is stored on the row. */
  const reopenTask = useCallback(
    (check: WalletTaskCheck, reason: string) => {
      setError(null)
      removeCheck(check.taskId)
      void writeToTable(() => reopenWalletTaskCheck(check.taskId, reason)).catch((caught) => {
        restoreCheck(check)
        setError(caught instanceof Error ? caught.message : 'The task could not be unchecked.')
      })
    },
    [removeCheck, restoreCheck, writeToTable]
  )

  return { checks, storage, error, checkTask, uncheckTask, reopenTask }
}
