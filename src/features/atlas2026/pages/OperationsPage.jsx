import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { downloadCsv } from '@/services/atlas2026/export-service'

// Operations page summarizes county-level pressure signals into one operator-facing
// decision contract: triage now, then export evidence for leadership review.
function StatBlock({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
      <small className="block uppercase tracking-[0.12em] text-slate-400">{label}</small>
      <p className="text-slate-100">{value}</p>
      {hint ? <small className="block text-slate-400">{hint}</small> : null}
    </div>
  )
}

function renderKeyValueRows(data = {}) {
  return Object.entries(data).map(([key, value]) => (
    <small key={key} className="block">
      {key}: {value}
    </small>
  ))
}

function buildWeeklyReportRows({ selectedCountyId, totals, risk, activity, sla, reciprocity, countyComparisons }) {
  // Export rows intentionally flatten nested snapshot objects so downstream CSV consumers
  // (email, BI tools, spreadsheets) do not need Atlas-specific parsing logic.
  return [
    {
      rowType: 'summary',
      scope: selectedCountyId,
      participants: totals.participants,
      routes: totals.routes,
      steps: totals.steps,
      memoryEvents: totals.memoryEvents,
      blockedRoutes: risk.blockedRoutes,
      blockedRate: risk.blockedRate,
      completedRoutes: risk.completedRoutes,
      weeklyEvents: activity.weeklyEvents,
      averageReadiness: activity.averageReadiness,
      overdueSteps: sla.overdueSteps,
      averageStepAgeHours: sla.averageStepAgeHours,
      slaThresholdHours: sla.thresholdHours,
      reciprocityIndex: reciprocity?.reciprocityIndex ?? 0,
      reciprocityThreshold: reciprocity?.threshold ?? 0.6,
      reciprocityActive: reciprocity?.active ?? false
    },
    ...countyComparisons.map((county) => ({
      rowType: 'county',
      scope: county.countyId,
      participants: county.participants,
      routes: county.routes,
      steps: county.steps,
      memoryEvents: county.memoryEvents,
      blockedRoutes: county.blockedRoutes,
      blockedRate: county.routes ? Number((county.blockedRoutes / county.routes).toFixed(3)) : 0,
      completedRoutes: county.completedRoutes,
      weeklyEvents: '',
      averageReadiness: county.averageReadiness,
      overdueSteps: county.overdueSteps,
      averageStepAgeHours: '',
      slaThresholdHours: sla.thresholdHours
    }))
  ]
}

export default function OperationsPage({ operationsSnapshot, countyComparisons, selectedCountyId }) {
  const { totals, participantByPhase, routesByStatus, stepsByStatus, risk, activity, sla, blockerQueue, readinessAlerts } =
    operationsSnapshot
  const reciprocity = operationsSnapshot.reciprocity

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Context</CardTitle>
          <CardDescription>Current county-level operating posture and reciprocity signal.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <StatBlock label="Participants" value={totals.participants} />
          <StatBlock label="Routes" value={totals.routes} />
          <StatBlock label="Blocked Routes" value={risk.blockedRoutes} hint={`rate ${(risk.blockedRate * 100).toFixed(1)}%`} />
          <StatBlock label="Reciprocity" value={`${((reciprocity?.reciprocityIndex ?? 0) * 100).toFixed(1)}%`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Required Input</CardTitle>
          <CardDescription>Choose the next intervention focus: blockers, readiness alerts, or governance escalation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <StatBlock label="Overdue Steps" value={sla.overdueSteps} hint={`avg age ${sla.averageStepAgeHours}h`} />
            <StatBlock label="Ready for Renewal" value={reciprocity?.active ? 'yes' : 'not yet'} />
          </div>
          <div className="space-y-2">
            {blockerQueue.slice(0, 3).map((blocker) => (
              <div key={`ops-blocker-${blocker.id}`} className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
                <small className="block text-slate-100">{blocker.stepId}: {blocker.label}</small>
                <small className="block text-slate-400">
                  County: {blocker.countyId} | Participant: {blocker.participantId}
                </small>
                <small className="block text-slate-300">Recommended action: {blocker.recommendedAction}</small>
              </div>
            ))}
            {blockerQueue.length === 0 && <small className="block text-emerald-300">No blockers in current scope.</small>}
          </div>
          <small className="block text-slate-400">
            Scope: {selectedCountyId === 'all' ? 'all counties' : selectedCountyId}. This is where operator attention is needed now.
          </small>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Primary Decision Outcome</CardTitle>
          <CardDescription>What atlas gives leadership once operations decisions are made.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <StatBlock label="Completed Routes" value={risk.completedRoutes} hint={`events (7d): ${activity.weeklyEvents}`} />
          <StatBlock
            label="Average Readiness"
            value={`${(activity.averageReadiness * 100).toFixed(1)}%`}
            hint="participant phase readiness"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  [
                    {
                      participants: totals.participants,
                      routes: totals.routes,
                      steps: totals.steps,
                      memoryEvents: totals.memoryEvents,
                      blockedRoutes: risk.blockedRoutes,
                      blockedRate: risk.blockedRate,
                      completedRoutes: risk.completedRoutes,
                      weeklyEvents: activity.weeklyEvents,
                      averageReadiness: activity.averageReadiness,
                      overdueSteps: sla.overdueSteps,
                      averageStepAgeHours: sla.averageStepAgeHours
                    }
                  ],
                  'atlas-operations-snapshot.csv'
                )
              }
            >
              Export Snapshot CSV
            </Button>
            <Button variant="outline" onClick={() => downloadCsv(countyComparisons, 'atlas-county-comparisons.csv')}>
              Export County Comparisons CSV
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  buildWeeklyReportRows({
                    selectedCountyId,
                    totals,
                    risk,
                    activity,
                    sla,
                    reciprocity,
                    countyComparisons
                  }),
                  'atlas-weekly-ops-report.csv'
                )
              }
            >
              Export Weekly Ops Report
            </Button>
          </div>
          <details className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <summary className="cursor-pointer text-slate-300">Show county comparisons and supporting metrics</summary>
            <div className="mt-3 space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <p className="text-slate-100">Participants by phase</p>
                  {renderKeyValueRows(participantByPhase)}
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <p className="text-slate-100">Routes by status</p>
                  {renderKeyValueRows(routesByStatus)}
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <p className="text-slate-100">Steps by status</p>
                  {renderKeyValueRows(stepsByStatus)}
                </div>
              </div>
              {countyComparisons.map((county) => (
                <div key={county.countyId} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <p className="text-slate-100">{county.countyId}</p>
                  <small className="block">Participants: {county.participants} | Routes: {county.routes} | Steps: {county.steps}</small>
                  <small className="block">Blocked routes: {county.blockedRoutes} | Completed routes: {county.completedRoutes}</small>
                  <small className="block">
                    Completed steps: {county.completedSteps} | Avg readiness: {(county.averageReadiness * 100).toFixed(1)}%
                  </small>
                </div>
              ))}
              {readinessAlerts.map((alert) => (
                <div key={`ops-readiness-${alert.participantId}`} className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
                  <small className="block text-slate-100">{alert.participantId}</small>
                  <small className="block text-slate-400">County: {alert.countyId}</small>
                  <small className="block text-slate-400">Current phase: {alert.currentPhase}</small>
                  <small className="block text-slate-300">Readiness: {(alert.phaseReadiness * 100).toFixed(1)}%</small>
                </div>
              ))}
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  )
}

