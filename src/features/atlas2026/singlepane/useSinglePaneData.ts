import { useMemo, useState } from 'react'
import domainLoadsSeed from '@/features/atlas2026/singlepane/data/domain-loads.json'
import enrolleesSeed from '@/features/atlas2026/singlepane/data/enrollees.json'
import rolesSeed from '@/features/atlas2026/singlepane/data/roles.json'
import routeLogsSeed from '@/features/atlas2026/singlepane/data/route-logs.json'
import type { AtlasRole, DomainLoad, EnrolleeProfile, RoleMenuConfig, RouteLogEvent } from '@/features/atlas2026/singlepane/types'

const STORAGE_KEY = 'atlas2026.singlepane.logs.v1'

function loadLogs(): RouteLogEvent[] {
  if (typeof window === 'undefined') return routeLogsSeed as RouteLogEvent[]
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return routeLogsSeed as RouteLogEvent[]
  try {
    return JSON.parse(raw) as RouteLogEvent[]
  } catch {
    return routeLogsSeed as RouteLogEvent[]
  }
}

function persistLogs(logs: RouteLogEvent[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs))
}

export function useSinglePaneData() {
  const [role, setRole] = useState<AtlasRole>('navigator')
  const [selectedEnrolleeId, setSelectedEnrolleeId] = useState<string>((enrolleesSeed as EnrolleeProfile[])[0]?.id || '')
  const [logs, setLogs] = useState<RouteLogEvent[]>(() => loadLogs())

  const enrollees = enrolleesSeed as EnrolleeProfile[]
  const loads = domainLoadsSeed as DomainLoad[]
  const roleConfigs = rolesSeed as RoleMenuConfig[]

  const selectedEnrollee = useMemo(
    () => enrollees.find((item) => item.id === selectedEnrolleeId) || enrollees[0] || null,
    [enrollees, selectedEnrolleeId]
  )

  const selectedLoad = useMemo(
    () => loads.find((item) => item.enrolleeId === selectedEnrollee?.id) || loads[0] || null,
    [loads, selectedEnrollee]
  )

  const selectedRoleConfig = useMemo(
    () => roleConfigs.find((item) => item.role === role) || roleConfigs[0],
    [role, roleConfigs]
  )

  const selectedLogs = useMemo(
    () =>
      logs
        .filter((item) => item.enrolleeId === selectedEnrollee?.id)
        .slice()
        .sort((a, b) => new Date(a.timestampIso).getTime() - new Date(b.timestampIso).getTime()),
    [logs, selectedEnrollee]
  )

  function appendRouteLog(label: string) {
    if (!selectedEnrollee || !label.trim()) return
    const last = selectedLogs[selectedLogs.length - 1]
    if (last && last.status === 'active') {
      const updatedLogs = logs.map((item) => (item.id === last.id ? { ...item, status: 'completed' } : item))
      const next: RouteLogEvent = {
        id: `log-${Date.now().toString(36)}`,
        enrolleeId: selectedEnrollee.id,
        label: label.trim(),
        timestampIso: new Date().toISOString(),
        status: 'active'
      }
      const finalLogs = [...updatedLogs, next]
      setLogs(finalLogs)
      persistLogs(finalLogs)
      return
    }
    const next: RouteLogEvent = {
      id: `log-${Date.now().toString(36)}`,
      enrolleeId: selectedEnrollee.id,
      label: label.trim(),
      timestampIso: new Date().toISOString(),
      status: 'active'
    }
    const finalLogs = [...logs, next]
    setLogs(finalLogs)
    persistLogs(finalLogs)
  }

  return {
    role,
    setRole,
    selectedEnrolleeId,
    setSelectedEnrolleeId,
    enrollees,
    selectedEnrollee,
    selectedLoad,
    selectedLogs,
    selectedRoleConfig,
    appendRouteLog
  }
}
