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

const ROUTE_CLASS_STYLES = {
  stabilization: {
    rail: '#fdcc09',
    chip: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
    card: 'border-amber-400/35 bg-amber-500/10'
  },
  readiness: {
    rail: '#0039a5',
    chip: 'bg-blue-500/20 text-blue-200 border-blue-400/40',
    card: 'border-blue-400/35 bg-blue-500/10'
  },
  civicDiplomacy: {
    rail: '#ee352e',
    chip: 'bg-red-500/20 text-red-200 border-red-400/40',
    card: 'border-red-400/35 bg-red-500/10'
  }
}

function resolveRouteClass(routeClass) {
  return routeClass || 'stabilization'
}

function PrecisionSubwayOverlay() {
  return (
    <div className="pointer-events-none fixed bottom-12 right-[35px] top-16 z-[45] w-[6vw] min-w-[72px] max-w-[96px] overflow-visible opacity-95">
      <svg
        className="h-full w-full"
        viewBox="108 0 132 1080"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <line y1="30" x2="38" transform="translate(134.5 924.5)" fill="none" stroke="#ee352e" strokeLinecap="round" strokeWidth="5" />
        <line x1="38" y1="38" transform="translate(175.5 201.5)" fill="none" stroke="#000aff" strokeLinecap="round" strokeWidth="5" />
        <line y1="410" transform="translate(213.5 239.5)" fill="none" stroke="#0039a5" strokeLinecap="round" strokeWidth="5" />
        <line x2="38" y2="38" transform="translate(134.5 161.5)" fill="none" stroke="#ee352e" strokeLinecap="round" strokeWidth="5" />
        <line y1="30" x2="38" transform="translate(175.5 649.5)" fill="none" stroke="#0039a6" strokeLinecap="round" strokeWidth="5" />
        <line y1="1080" transform="translate(134.5 0.5)" fill="none" stroke="#fccc0a" strokeWidth="5" />
        <line y1="725" transform="translate(172.5 199.5)" fill="none" stroke="#ee352e" strokeLinecap="round" strokeWidth="5" />
        <ellipse cx="18.5" cy="18" rx="18.5" ry="18" transform="translate(116 995)" fill="#fdcc09" />
        <text transform="translate(127 1022)" fontSize="26" fontFamily="Helvetica-Bold, Helvetica" fontWeight="700">
          <tspan x="0" y="0">
            1
          </tspan>
        </text>
        <ellipse cx="18.5" cy="18" rx="18.5" ry="18" transform="translate(154 850)" fill="#ee352e" />
        <text transform="translate(165 876)" fill="#fff" fontSize="26" fontFamily="Helvetica-Bold, Helvetica" fontWeight="700">
          <tspan x="0" y="0">
            2
          </tspan>
        </text>
        <ellipse cx="18.5" cy="18" rx="18.5" ry="18" transform="translate(153 726)" fill="#ee352e" />
        <text transform="translate(165 753)" fill="#fff" fontSize="26" fontFamily="Helvetica-Bold, Helvetica" fontWeight="700">
          <tspan x="0" y="0">
            3
          </tspan>
        </text>
        <line x2="38" y2="38" transform="translate(134.5 498.5)" fill="none" stroke="#ee352e" strokeLinecap="round" strokeWidth="5" />
        <ellipse cx="18.5" cy="18" rx="18.5" ry="18" transform="translate(195 534)" fill="#0039a5" />
        <text transform="translate(205 561)" fill="#fff" fontSize="26" fontFamily="Helvetica-Bold, Helvetica" fontWeight="700">
          <tspan x="0" y="0">
            4
          </tspan>
        </text>
      </svg>
    </div>
  )
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
  const recommendedRoute = routePlan.routes.find((route) => route.routeId === routePlan.recommendedRouteId) || null
  const highestInterference = routePlan.routes.find((route) => ['high', 'medium'].includes(route.diagnostics.interference.risk)) || null
  const orderedPreviewRoutes = routePlan.routes.slice(0, 4)

  return (
    <div className="space-y-4">
      <PrecisionSubwayOverlay />
      <Card>
        <CardHeader>
          <CardTitle>Context</CardTitle>
          <CardDescription>What route posture atlas currently sees for this participant.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recommendedRoute ? (
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-black p-4">
              <p className="text-slate-100">
                <Route className="mr-2 inline h-4 w-4" />
                Recommended: {recommendedRoute.routeId} via {recommendedRoute.partnerId}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <small
                  className={`rounded-full border px-2 py-1 ${
                    ROUTE_CLASS_STYLES[resolveRouteClass(recommendedRoute.routeClass)]?.chip || ROUTE_CLASS_STYLES.stabilization.chip
                  }`}
                >
                  class: {resolveRouteClass(recommendedRoute.routeClass)}
                </small>
                <small className="rounded-full border border-slate-700 bg-slate-900/80 px-2 py-1 text-slate-200">
                  score: {(recommendedRoute.score * 100).toFixed(1)}
                </small>
                <small className="rounded-full border border-slate-700 bg-slate-900/80 px-2 py-1 text-slate-200">
                  alignment: {(recommendedRoute.phaseAlignment * 100).toFixed(0)}%
                </small>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {orderedPreviewRoutes.map((route, index) => (
                  <small
                    key={`route-stop-${route.routeId}`}
                    className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/85 px-2 py-1 text-slate-200"
                  >
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-black"
                      style={{
                        backgroundColor:
                          ROUTE_CLASS_STYLES[resolveRouteClass(route.routeClass)]?.rail || ROUTE_CLASS_STYLES.stabilization.rail
                      }}
                    >
                      {index + 1}
                    </span>
                    {route.routeId}
                  </small>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
              <small className="block text-amber-300">No safe recommended route right now.</small>
            </div>
          )}
          {highestInterference ? (
            <small className="block text-slate-400">
              Highest interference route: {highestInterference.routeId} ({highestInterference.diagnostics.interference.risk})
            </small>
          ) : (
            <small className="block text-emerald-300">No medium/high interference routes detected.</small>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Required Input</CardTitle>
          <CardDescription>Choose the next route decision now: activate, hold, or redirect.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-2xl border border-slate-800 p-4">
            <p className="text-slate-100">Primary input: approve and activate recommended route.</p>
            {canActivate ? (
              <Button className="mt-3" onClick={activateRecommendedRoute} disabled={savingRoute || !routePlan.recommendedRouteId}>
                {savingRoute ? 'Activating...' : 'Activate Recommended Route'}
              </Button>
            ) : (
              <small className="mt-3 block text-slate-400">Your role is read-only for route activation.</small>
            )}
            {actionError && <small className="mt-2 block text-amber-300">{actionError}</small>}
          </div>
          <details className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <summary className="cursor-pointer text-slate-300">Show route options</summary>
            <div className="mt-3 space-y-2">
              {routePlan.routes.map((route) => (
                <div
                  key={route.routeId}
                  className={`rounded-xl border p-3 ${
                    ROUTE_CLASS_STYLES[resolveRouteClass(route.routeClass)]?.card || ROUTE_CLASS_STYLES.stabilization.card
                  }`}
                >
                  <small className="block text-slate-100">
                    {route.routeId} via {route.partnerId}
                  </small>
                  <small className="block text-slate-400">
                    class {route.routeClass || 'stabilization'} | score {(route.score * 100).toFixed(1)}% | blocked:{' '}
                    {route.blocked ? 'yes' : 'no'}
                  </small>
                  {route.blockReasons.length > 0 && <small className="block text-amber-300">{route.blockReasons.join(' | ')}</small>}
                </div>
              ))}
            </div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Primary Decision Outcome</CardTitle>
          <CardDescription>What atlas gives back once the route decision is made.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-slate-800 bg-black p-3">
            <div className="flex flex-wrap items-center gap-3">
              <small className="inline-flex items-center gap-2 text-slate-300">
                <span className="inline-block h-2 w-8 rounded-full bg-[#0039a5]" />
                medium threshold: {((ontologyWeights?.interferenceMediumThreshold ?? 0.35) * 100).toFixed(0)}%
              </small>
              <small className="inline-flex items-center gap-2 text-slate-300">
                <span className="inline-block h-2 w-8 rounded-full bg-[#ee352e]" />
                high threshold:{' '}
                {(
                  Math.max(
                    ontologyWeights?.interferenceHighThreshold ?? 0.6,
                    ontologyWeights?.interferenceMediumThreshold ?? 0.35
                  ) * 100
                ).toFixed(0)}
                %
              </small>
            </div>
          </div>
          <small className="block text-slate-300">
            Atlas returns a dependency-aware step graph, persisted route status, and interference mitigations for execution handoff.
          </small>
          <details className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <summary className="cursor-pointer text-slate-300">Show diagnostics, active routes, and step graph</summary>
            <div className="mt-3 space-y-3">
              <div className="space-y-2">
                {routePlan.routes
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
                  ))}
              </div>
              <div className="space-y-2">
                {selectedRoutes.length === 0 ? (
                  <small>No route activations persisted yet.</small>
                ) : (
                  selectedRoutes.map((route) => (
                    <div key={route.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <small className="block">
                        {route.routeId} via {route.partnerId} ({route.status})
                      </small>
                      <small className="block text-slate-400">Route class: {route.routeClass || 'stabilization'}</small>
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
                {selectedRouteSteps.map((step) => (
                  <div key={step.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <small className="block">
                      {step.stepId}: {step.label} ({step.status})
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
                ))}
              </div>
            </div>
          </details>
          <div className="flex flex-wrap gap-2">
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
                    routeClass: route.routeClass || 'stabilization',
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
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

