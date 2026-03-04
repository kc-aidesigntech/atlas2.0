import React from 'react'
import { Route } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { canRolePerform } from '@/core/atlas2026/policy'

function formatFirestoreTimestamp(value) {
  if (!value) return 'No timestamp'
  const millis = typeof value?.toMillis === 'function' ? value.toMillis() : (value?.seconds || 0) * 1000
  if (!millis) return 'No timestamp'
  return new Date(millis).toLocaleString()
}

export default function PrecisionNavigationPage({
  selectedRole,
  routePlan,
  selectedRoutes,
  activateRecommendedRoute,
  savingRoute,
  actionError
}) {
  const canActivate = canRolePerform(selectedRole, 'activateRoute')

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Route Orchestration Engine</CardTitle>
          <CardDescription>Gate validation, dependency checks, and interference diagnostics are applied per route.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {routePlan.routes.map((route) => (
            <div key={route.routeId} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-slate-100">
                <Route className="mr-2 inline h-4 w-4" />
                {route.routeId} via {route.partnerId}
              </p>
              <small className="block">Composite score: {(route.score * 100).toFixed(1)}</small>
              <small className="block">Phase alignment: {(route.phaseAlignment * 100).toFixed(0)}%</small>
              <small className="block">Interference risk: {route.diagnostics.interference.risk}</small>
              <small className="block">Blocked: {route.blocked ? 'Yes' : 'No'}</small>
              {route.blockReasons.length > 0 && (
                <small className="block text-amber-300">Reasons: {route.blockReasons.join(' | ')}</small>
              )}
            </div>
          ))}

          <div className="rounded-2xl border border-slate-800 p-4">
            <p className="text-slate-100">Recommended route: {routePlan.recommendedRouteId ?? 'None available'}</p>
            {canActivate ? (
              <Button className="mt-3" onClick={activateRecommendedRoute} disabled={savingRoute || !routePlan.recommendedRouteId}>
                {savingRoute ? 'Activating...' : 'Activate Recommended Route'}
              </Button>
            ) : (
              <small className="mt-3 block text-slate-400">Your role is read-only for route activation.</small>
            )}
            {actionError && <small className="mt-2 block text-amber-300">{actionError}</small>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Persisted Active Routes</CardTitle>
          <CardDescription>Live activation ledger with actor attribution.</CardDescription>
        </CardHeader>
        <CardContent>
          {selectedRoutes.length === 0 ? (
            <small>No route activations persisted yet.</small>
          ) : (
            selectedRoutes.map((route) => (
              <div key={route.id} className="mt-2 rounded-xl border border-slate-800 bg-slate-950 p-3">
                <small className="block">
                  {route.routeId} via {route.partnerId} ({route.status})
                  {route.optimistic ? ' - syncing...' : ''}
                </small>
                <small className="block text-slate-400">
                  Activated by: {route.activatedByRole || 'unknown'} / {route.activatedByUserId || 'unknown'}
                </small>
                <small className="block text-slate-400">When: {formatFirestoreTimestamp(route.activatedAt || route.createdAt)}</small>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

