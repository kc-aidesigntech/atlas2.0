import React from 'react'
import { Route } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTE_LIFECYCLE } from '@/core/atlas2026/data-model'
import { STEP_STATUS } from '@/services/atlas2026/step-graph'
import { downloadCsv } from '@/services/atlas2026/export-service'
import { getInterferenceMitigations } from '@/services/atlas2026/route-engine'
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
  ontologyWeights,
  selectedRoutes,
  selectedRouteSteps,
  activateRecommendedRoute,
  transitionRouteStatus,
  transitionRouteStepStatus,
  savingRoute,
  updatingRoute,
  updatingStep,
  actionError
}) {
  const canActivate = canRolePerform(selectedRole, 'activateRoute')
  const canTransition = canRolePerform(selectedRole, 'transitionRoute')

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
          <CardTitle>Precision Exports</CardTitle>
          <CardDescription>Download route scoring and interference diagnostics.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadCsv(routePlan.routes, 'atlas-route-plan.csv')}>
            Export Route Plan CSV
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                routePlan.routes.map((route) => ({
                  routeId: route.routeId,
                  partnerId: route.partnerId,
                  interferenceRisk: route.diagnostics.interference.risk,
                  interferenceReason: route.diagnostics.interference.reason,
                  mediumThreshold: ontologyWeights?.interferenceMediumThreshold ?? 0.35,
                  highThreshold: Math.max(
                    ontologyWeights?.interferenceHighThreshold ?? 0.6,
                    ontologyWeights?.interferenceMediumThreshold ?? 0.35
                  ),
                  blockReasons: route.blockReasons.join(' | '),
                  mitigations: getInterferenceMitigations(route).join(' | ')
                })),
                'atlas-interference-diagnostics.csv'
              )
            }
          >
            Export Diagnostics CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interference Diagnostics</CardTitle>
          <CardDescription>High and medium risk routes with governance-managed cutoffs and mitigation actions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <small className="block text-slate-400">
              Medium threshold: {((ontologyWeights?.interferenceMediumThreshold ?? 0.35) * 100).toFixed(0)}%
            </small>
            <small className="block text-slate-400">
              High threshold:{' '}
              {(
                Math.max(
                  ontologyWeights?.interferenceHighThreshold ?? 0.6,
                  ontologyWeights?.interferenceMediumThreshold ?? 0.35
                ) * 100
              ).toFixed(0)}
              %
            </small>
          </div>
          {routePlan.routes.filter((route) => ['high', 'medium'].includes(route.diagnostics.interference.risk)).length === 0 ? (
            <small>No medium/high interference routes detected.</small>
          ) : (
            routePlan.routes
              .filter((route) => ['high', 'medium'].includes(route.diagnostics.interference.risk))
              .map((route) => (
                <div key={`diag-${route.routeId}`} className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
                  <small className="block text-slate-100">
                    {route.routeId} ({route.diagnostics.interference.risk})
                  </small>
                  <small className="block text-slate-400">Reason: {route.diagnostics.interference.reason}</small>
                  {getInterferenceMitigations(route).map((mitigation, index) => (
                    <small key={`${route.routeId}-mitigation-${index}`} className="block text-slate-300">
                      - {mitigation}
                    </small>
                  ))}
                </div>
              ))
          )}
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
                {canTransition && route.status === ROUTE_LIFECYCLE.active && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updatingRoute}
                      onClick={() =>
                        transitionRouteStatus({
                          routeDocId: route.id,
                          nextStatus: ROUTE_LIFECYCLE.completed,
                          reason: 'Completion confirmed by operator'
                        })
                      }
                    >
                      Complete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updatingRoute}
                      onClick={() =>
                        transitionRouteStatus({
                          routeDocId: route.id,
                          nextStatus: ROUTE_LIFECYCLE.blocked,
                          reason: 'Blocked by dependency or capacity'
                        })
                      }
                    >
                      Block
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Route Step Graph</CardTitle>
          <CardDescription>Dependency-aware execution steps for active routes.</CardDescription>
        </CardHeader>
        <CardContent>
          {selectedRouteSteps.length === 0 ? (
            <small>No step graph records persisted yet. Activate a route first.</small>
          ) : (
            selectedRouteSteps.map((step) => (
              <div key={step.id} className="mt-2 rounded-xl border border-slate-800 bg-slate-950 p-3">
                <small className="block">
                  {step.stepId}: {step.label}
                </small>
                <small className="block text-slate-400">
                  Status: {step.status}
                  {step.optimistic ? ' - syncing...' : ''}
                </small>
                <small className="block text-slate-400">
                  Dependencies: {Array.isArray(step.dependencies) && step.dependencies.length > 0 ? step.dependencies.join(', ') : 'None'}
                </small>
                {canTransition && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {step.status === STEP_STATUS.pending && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updatingStep}
                        onClick={() => transitionRouteStepStatus({ stepDocId: step.id, nextStatus: STEP_STATUS.inProgress })}
                      >
                        Start Step
                      </Button>
                    )}
                    {step.status === STEP_STATUS.inProgress && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingStep}
                          onClick={() => transitionRouteStepStatus({ stepDocId: step.id, nextStatus: STEP_STATUS.completed })}
                        >
                          Complete Step
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingStep}
                          onClick={() => transitionRouteStepStatus({ stepDocId: step.id, nextStatus: STEP_STATUS.blocked })}
                        >
                          Block Step
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

