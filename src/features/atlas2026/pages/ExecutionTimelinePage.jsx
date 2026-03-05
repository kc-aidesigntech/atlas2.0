import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function formatTime(millis) {
  if (!millis) return 'No timestamp'
  return new Date(millis).toLocaleString()
}

export default function ExecutionTimelinePage({ executionSnapshot, selectedRouteSteps }) {
  const laneY = { route: 36, step: 80, memory: 124 }
  const latest = executionSnapshot.timeline[0]?.at || 0
  const oldest = executionSnapshot.timeline[executionSnapshot.timeline.length - 1]?.at || 0
  const spread = Math.max(1, latest - oldest)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Execution Progress</CardTitle>
          <CardDescription>Route-step progress and blocker load for the selected participant context.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <small className="block uppercase tracking-[0.12em] text-slate-400">Routes</small>
            <p className="text-slate-100">{executionSnapshot.progress.routes}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <small className="block uppercase tracking-[0.12em] text-slate-400">Steps</small>
            <p className="text-slate-100">{executionSnapshot.progress.steps}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <small className="block uppercase tracking-[0.12em] text-slate-400">Completion Ratio</small>
            <p className="text-slate-100">{(executionSnapshot.progress.completionRatio * 100).toFixed(1)}%</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step Dependency Graph</CardTitle>
          <CardDescription>Lane-style dependency chain for the selected participant route steps.</CardDescription>
        </CardHeader>
        <CardContent className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
          {selectedRouteSteps.length === 0 ? (
            <small>No step records to render dependency graph.</small>
          ) : (
            <svg viewBox="0 0 640 180" className="h-56 w-full">
              <rect x="0" y="0" width="640" height="180" fill="#020617" />
              {selectedRouteSteps.map((step, index) => {
                const x = 60 + index * 185
                const y = 90
                return (
                  <g key={`dep-node-${step.id}`}>
                    <rect x={x - 44} y={y - 26} width="88" height="52" rx="10" fill="#0f172a" stroke="#334155" />
                    <text x={x} y={y - 2} textAnchor="middle" fill="#e2e8f0" fontSize="10">
                      {step.stepId}
                    </text>
                    <text x={x} y={y + 12} textAnchor="middle" fill="#94a3b8" fontSize="9">
                      {step.status}
                    </text>
                  </g>
                )
              })}
              {selectedRouteSteps.map((step, index) =>
                (step.dependencies || []).map((dependency) => {
                  const fromIndex = selectedRouteSteps.findIndex((candidate) => candidate.stepId === dependency)
                  if (fromIndex < 0) return null
                  const x1 = 60 + fromIndex * 185 + 44
                  const y1 = 90
                  const x2 = 60 + index * 185 - 44
                  const y2 = 90
                  return <line key={`dep-edge-${step.id}-${dependency}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#38bdf8" />
                })
              )}
            </svg>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lane Timeline</CardTitle>
          <CardDescription>Visual execution lanes for route, step, and memory activity.</CardDescription>
        </CardHeader>
        <CardContent className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
          <svg viewBox="0 0 540 160" className="h-48 w-full">
            <rect x="0" y="0" width="540" height="160" fill="#020617" />
            <text x="10" y="38" fill="#94a3b8" fontSize="11">Route</text>
            <text x="10" y="82" fill="#94a3b8" fontSize="11">Step</text>
            <text x="10" y="126" fill="#94a3b8" fontSize="11">Memory</text>
            <line x1="60" y1="36" x2="520" y2="36" stroke="#334155" />
            <line x1="60" y1="80" x2="520" y2="80" stroke="#334155" />
            <line x1="60" y1="124" x2="520" y2="124" stroke="#334155" />
            {executionSnapshot.timeline.map((entry) => {
              const y = laneY[entry.type] || 124
              const x = 60 + ((entry.at - oldest) / spread) * 460
              const color = entry.type === 'route' ? '#22c55e' : entry.type === 'step' ? '#38bdf8' : '#f59e0b'
              return <circle key={`lane-${entry.type}-${entry.id}`} cx={x} cy={y} r="4" fill={color} />
            })}
          </svg>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Blocker Queue</CardTitle>
          <CardDescription>Steps currently blocked and waiting for intervention.</CardDescription>
        </CardHeader>
        <CardContent>
          {executionSnapshot.blockerQueue.length === 0 ? (
            <small>No active blockers.</small>
          ) : (
            executionSnapshot.blockerQueue.map((blocker) => (
              <div key={blocker.id} className="mt-2 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
                <small className="block text-slate-100">{blocker.stepId}: {blocker.label}</small>
                <small className="block text-slate-400">Route: {blocker.routeId}</small>
                <small className="block text-slate-400">
                  Dependencies: {blocker.dependencies.length > 0 ? blocker.dependencies.join(', ') : 'None'}
                </small>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Execution Timeline</CardTitle>
          <CardDescription>Recent route, step, and memory events in temporal order.</CardDescription>
        </CardHeader>
        <CardContent>
          {executionSnapshot.timeline.length === 0 ? (
            <small>No execution timeline events yet.</small>
          ) : (
            executionSnapshot.timeline.map((entry) => (
              <div key={`${entry.type}-${entry.id}`} className="mt-2 rounded-xl border border-slate-800 bg-slate-950 p-3">
                <small className="block text-slate-100">{entry.label}</small>
                <small className="block text-slate-400">Type: {entry.type}</small>
                <small className="block text-slate-400">At: {formatTime(entry.at)}</small>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

