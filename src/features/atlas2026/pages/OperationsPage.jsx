import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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

export default function OperationsPage({ operationsSnapshot }) {
  const { totals, participantByPhase, routesByStatus, stepsByStatus, risk, activity } = operationsSnapshot

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
        </CardContent>
      </Card>
    </div>
  )
}

