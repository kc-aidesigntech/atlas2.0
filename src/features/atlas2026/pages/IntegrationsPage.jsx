import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function IntegrationsPage({ ecosystemSnapshot }) {
  const status = ecosystemSnapshot?.ecosystem?.every((node) => node.status === 'active') ? 'connected' : 'pending'

  const contracts = [
    { id: 'cie-embed', name: 'CIE panel embed contract', status },
    { id: 'ehr-route-sync', name: 'EHR route status contract', status },
    { id: 'hie-memory-feed', name: 'HIE memory event feed', status: 'pending' },
    { id: 'funding-readonly', name: 'Read-only funder reporting endpoint', status }
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Context</CardTitle>
          <CardDescription>Current network posture across integrations and institutional ecosystem.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <small className="block text-slate-300">Public identity: {ecosystemSnapshot.publicIdentity}</small>
          <small className="block text-slate-300">Civic ethos: {ecosystemSnapshot.civicEthos}</small>
          <small className="block text-slate-400">
            Overall contract status: {status}. Resolve pending contracts before scaling cross-sector flow.
          </small>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Required Input</CardTitle>
          <CardDescription>Confirm where institutional alignment is missing and assign follow-up ownership.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <small className="block text-slate-300">1. precise mapping of shared civic conditions</small>
          <small className="block text-slate-300">2. centralization of meaning through atlas-intel</small>
          <small className="block text-slate-300">3. design of movement under pressure</small>
          <small className="block text-slate-400">Use this to decide which partner contracts must be advanced now.</small>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Primary Decision Outcome</CardTitle>
          <CardDescription>What atlas gives after integration readiness is confirmed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <small className="block text-slate-400">
            SRIG areas are visible, ecosystem status is explicit, and contract readiness is legible for alliance-level action.
          </small>
          <details className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <summary className="cursor-pointer text-slate-300">Show contracts, SRIG areas, and ecosystem nodes</summary>
            <div className="mt-3 space-y-3">
              {contracts.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                  <p className="text-slate-100">{item.name}</p>
                  <small className={item.status === 'connected' ? 'text-emerald-300' : 'text-amber-300'}>Status: {item.status}</small>
                </div>
              ))}
              {ecosystemSnapshot.srigCoordinationAreas.map((area) => (
                <small key={area} className="block text-slate-400">
                  - {area}
                </small>
              ))}
              {ecosystemSnapshot.ecosystem.map((node) => (
                <div key={node.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                  <p className="text-slate-100">{node.label}</p>
                  <small className="block text-slate-400">{node.function}</small>
                  <small className={node.status === 'active' ? 'text-emerald-300' : 'text-amber-300'}>Status: {node.status}</small>
                </div>
              ))}
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  )
}

