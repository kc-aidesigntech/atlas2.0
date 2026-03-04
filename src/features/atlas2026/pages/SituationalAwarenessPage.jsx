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
    </div>
  )
}

