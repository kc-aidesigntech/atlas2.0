import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { downloadCsv } from '@/services/atlas2026/export-service'

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

export default function OperationsPage({ operationsSnapshot, countyComparisons, selectedCountyId }) {
  const { totals, participantByPhase, routesByStatus, stepsByStatus, risk, activity, sla, blockerQueue, readinessAlerts } =
    operationsSnapshot
  const buildWeeklyReportRows = () => [
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
      slaThresholdHours: sla.thresholdHours
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Operational Totals</CardTitle>
          <CardDescription>Live system volume across participant and orchestration entities.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <StatBlock label="Participants" value={totals.participants} />
          <StatBlock label="Routes" value={totals.routes} />
          <StatBlock label="Steps" value={totals.steps} />
          <StatBlock label="Memory Events" value={totals.memoryEvents} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Operations Export</CardTitle>
          <CardDescription>Download current operations and county comparison snapshot.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
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
          <Button variant="outline" onClick={() => downloadCsv(buildWeeklyReportRows(), 'atlas-weekly-ops-report.csv')}>
            Export Weekly Ops Report
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Flow Health</CardTitle>
          <CardDescription>Phase distribution and route-step execution posture.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk and Activity</CardTitle>
          <CardDescription>Leadership snapshot for weekly operations review.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <StatBlock label="Blocked Routes" value={risk.blockedRoutes} hint={`Blocked rate: ${(risk.blockedRate * 100).toFixed(1)}%`} />
          <StatBlock label="Completed Routes" value={risk.completedRoutes} hint={`Events (7d): ${activity.weeklyEvents}`} />
          <StatBlock
            label="Average Readiness"
            value={`${(activity.averageReadiness * 100).toFixed(1)}%`}
            hint="Average participant phase readiness score"
          />
          <StatBlock label="Overdue Steps" value={sla.overdueSteps} hint={`Avg step age: ${sla.averageStepAgeHours} hours`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>County Comparisons</CardTitle>
          <CardDescription>
            Cross-county view for leadership calibration.
            {selectedCountyId !== 'all' ? ` Current scope: ${selectedCountyId}` : ' Current scope: all counties.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {countyComparisons.length === 0 ? (
            <small>No county comparison data available.</small>
          ) : (
            countyComparisons.map((county) => (
              <div key={county.countyId} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="text-slate-100">{county.countyId}</p>
                <small className="block">Participants: {county.participants} | Routes: {county.routes} | Steps: {county.steps}</small>
                <small className="block">Blocked routes: {county.blockedRoutes} | Completed routes: {county.completedRoutes}</small>
                <small className="block">
                  Completed steps: {county.completedSteps} | Avg readiness: {(county.averageReadiness * 100).toFixed(1)}%
                </small>
                <small className="block">Overdue steps: {county.overdueSteps}</small>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>County Blocker Triage Queue</CardTitle>
          <CardDescription>Oldest blocked steps in scope with county attribution and operator guidance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {blockerQueue.length === 0 ? (
            <small>No blocked steps in current scope.</small>
          ) : (
            blockerQueue.map((blocker) => (
              <div key={`ops-blocker-${blocker.id}`} className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
                <small className="block text-slate-100">{blocker.stepId}: {blocker.label}</small>
                <small className="block text-slate-400">
                  County: {blocker.countyId} | Participant: {blocker.participantId}
                </small>
                <small className="block text-slate-400">Route: {blocker.routeId}</small>
                <small className="block text-slate-300">Age: {blocker.ageHours}h</small>
                <small className="block text-slate-300">Recommended action: {blocker.recommendedAction}</small>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Phase Readiness Alerts</CardTitle>
          <CardDescription>County-level readiness exceptions that need pre-transition intervention.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {readinessAlerts.length === 0 ? (
            <small>No readiness alerts in current scope.</small>
          ) : (
            readinessAlerts.map((alert) => (
              <div key={`ops-readiness-${alert.participantId}`} className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
                <small className="block text-slate-100">{alert.participantId}</small>
                <small className="block text-slate-400">County: {alert.countyId}</small>
                <small className="block text-slate-400">Current phase: {alert.currentPhase}</small>
                <small className="block text-slate-300">Readiness: {(alert.phaseReadiness * 100).toFixed(1)}%</small>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

