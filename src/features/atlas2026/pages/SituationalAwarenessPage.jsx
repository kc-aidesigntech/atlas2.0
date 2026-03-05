import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SituationalAwarenessPage({ selectedParticipant, decisionPacket, situationalOverlay }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>System Pressure Snapshot</CardTitle>
          <CardDescription>Domain pressure is modeled for stabilization sequencing, never person scoring.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {selectedParticipant.pressureVectors.map((vector) => (
            <div key={vector.domain} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-slate-100">{vector.domain}</p>
              <small>Severity: {(vector.severity * 100).toFixed(0)}%</small>
              <small className="block">Reversibility: {(vector.reversibility * 100).toFixed(0)}%</small>
              <small className="block">Trajectory: {vector.trajectory}</small>
            </div>
          ))}
          <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4 md:col-span-2">
            <p className="text-slate-100">Explainability Summary</p>
            <small>Current phase: {decisionPacket.explainability.currentPhase}</small>
            <small className="block">
              Average domain pressure: {(decisionPacket.explainability.averageDomainPressure * 100).toFixed(0)}%
            </small>
            <small className="block">Dominant factors: {decisionPacket.explainability.dominantFactors.join(', ')}</small>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regional Corridor Priorities</CardTitle>
          <CardDescription>Pressure-capacity deltas identify where coordination should intensify first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {situationalOverlay.corridorPriorities.map((corridor) => (
            <div key={corridor.domain} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <p className="text-slate-100">{corridor.label}</p>
              <small className="block">Pressure: {(corridor.pressure * 100).toFixed(0)}%</small>
              <small className="block">Capacity: {(corridor.capacity * 100).toFixed(0)}%</small>
              <small className="block">Gap: {(corridor.gap * 100).toFixed(0)}% ({corridor.priority})</small>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regional Hotspot Grid</CardTitle>
          <CardDescription>Geo-style hotspot markers for county operations triage.</CardDescription>
        </CardHeader>
        <CardContent className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
          <svg viewBox="0 0 500 240" className="h-56 w-full rounded-xl border border-slate-800 bg-black">
            <rect x="0" y="0" width="500" height="240" fill="#020617" />
            {situationalOverlay.hotspotMarkers.map((marker, index) => {
              const x = 70 + index * 90
              const y = 60 + ((index % 3) * 52)
              const intensity = Math.max(12, Math.round(marker.pressure * 32))
              const fill = marker.priority === 'critical' ? '#ef4444' : marker.priority === 'watch' ? '#f59e0b' : '#22c55e'
              return (
                <g key={`map-${marker.id}`}>
                  <circle cx={x} cy={y} r={intensity} fill={fill} fillOpacity="0.28" stroke={fill} />
                  <circle cx={x} cy={y} r="4" fill={fill} />
                  <text x={x + 10} y={y - 8} fill="#e2e8f0" fontSize="10">
                    {marker.label}
                  </text>
                </g>
              )
            })}
          </svg>
        </CardContent>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {situationalOverlay.hotspotMarkers.map((marker) => (
            <div key={marker.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <p className="text-slate-100">{marker.label}</p>
              <small className="block">Priority: {marker.priority}</small>
              <small className="block">Coordinates: {marker.lat}, {marker.lng}</small>
              <small className="block">Pressure/Capacity: {(marker.pressure * 100).toFixed(0)}% / {(marker.capacity * 100).toFixed(0)}%</small>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

