import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SituationalAwarenessPage({ selectedParticipant, decisionPacket, situationalOverlay, civicBioSnapshot }) {
  const topCorridor = situationalOverlay.corridorPriorities?.[0] || null
  const primaryReadinessAlert = situationalOverlay.phaseReadinessAlerts?.[0] || null

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Context</CardTitle>
          <CardDescription>What is happening now in this participant + county context.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-slate-100">Current phase: {decisionPacket.explainability.currentPhase}</p>
            <small className="block">Average pressure: {(decisionPacket.explainability.averageDomainPressure * 100).toFixed(0)}%</small>
            <small className="block">High-pressure domains: {decisionPacket.explainability.highPressureDomains.join(', ') || 'none'}</small>
            <small className="block">Refined energy: {(civicBioSnapshot.ascentEngine.refinedEnergy * 100).toFixed(1)}%</small>
          </div>
          <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4">
            <p className="text-slate-100">Primary risk corridor</p>
            {topCorridor ? (
              <>
                <small className="block">{topCorridor.label}</small>
                <small className="block">Gap: {(topCorridor.gap * 100).toFixed(0)}% ({topCorridor.priority})</small>
              </>
            ) : (
              <small className="block">No corridor pressure gaps detected.</small>
            )}
            {primaryReadinessAlert ? (
              <small className="block text-amber-300">
                Next readiness alert: {primaryReadinessAlert.participantId} ({(primaryReadinessAlert.phaseReadiness * 100).toFixed(1)}%)
              </small>
            ) : (
              <small className="block text-emerald-300">No immediate readiness alerts.</small>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Required Input</CardTitle>
          <CardDescription>Select the first domain where intervention sequencing should start.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {situationalOverlay.corridorPriorities.slice(0, 3).map((corridor) => (
            <div key={corridor.domain} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <small className="block text-slate-100">{corridor.label}</small>
              <small className="block text-slate-400">
                Pressure {(corridor.pressure * 100).toFixed(0)}% vs capacity {(corridor.capacity * 100).toFixed(0)}%
              </small>
              <small className="block text-slate-300">Priority: {corridor.priority}</small>
            </div>
          ))}
          <small className="block text-slate-400">
            Use this screen to identify where input is needed first, then proceed to precision routing for route activation.
          </small>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Primary Decision</CardTitle>
          <CardDescription>Can we move safely to route selection now?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <small className="block text-slate-300">
              Decision signal: {(decisionPacket.explainability.averageDomainPressure * 100).toFixed(0)}% average pressure with{' '}
              {(civicBioSnapshot.ascentEngine.refinedEnergy * 100).toFixed(1)}% refined energy.
            </small>
            <small className="block text-slate-400">
              If pressure is concentrated and readiness alerts are active, prioritize stabilization-class routes next.
            </small>
          </div>
          <details className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <summary className="cursor-pointer text-slate-300">Show supporting details</summary>
            <div className="mt-3 space-y-3">
              <div>
                <small className="block text-slate-400">Ascent outputs</small>
                {civicBioSnapshot.ascentEngine.outputs.map((output) => (
                  <small key={output.id} className="block text-slate-300">
                    {output.id}: {(output.score * 100).toFixed(1)}%
                  </small>
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {situationalOverlay.hotspotMarkers.map((marker) => (
                  <small key={marker.id} className="block text-slate-400">
                    {marker.label}: {(marker.pressure * 100).toFixed(0)}% / {(marker.capacity * 100).toFixed(0)}%
                  </small>
                ))}
              </div>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  )
}

