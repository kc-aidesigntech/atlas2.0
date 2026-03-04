import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function IntegrationsPage({ isLiveData }) {
  const status = isLiveData ? 'connected' : 'pending'

  const contracts = [
    { id: 'cie-embed', name: 'CIE panel embed contract', status },
    { id: 'ehr-route-sync', name: 'EHR route status contract', status },
    { id: 'hie-memory-feed', name: 'HIE memory event feed', status: 'pending' },
    { id: 'funding-readonly', name: 'Read-only funder reporting endpoint', status }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integration Contracts</CardTitle>
        <CardDescription>Upstream contract visibility for CIE/HIE/EHR external surfaces.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {contracts.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <p className="text-slate-100">{item.name}</p>
            <small className={item.status === 'connected' ? 'text-emerald-300' : 'text-amber-300'}>
              Status: {item.status}
            </small>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

