import React, { useMemo, useState } from 'react'
import { Activity, Compass, Route, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PRESSURE_DOMAINS, STABILIZATION_PHASES } from '@/core/atlas2026/canonical-spec'
import { ROUTE_LIFECYCLE } from '@/core/atlas2026/data-model'
import { ATLAS_ROLES, canRolePerform } from '@/core/atlas2026/policy'
import { useAtlasDecisioning } from './useAtlasDecisioning'

const SURFACES = {
  situationalAwareness: 'situationalAwareness',
  precisionNavigation: 'precisionNavigation',
  collectiveMemory: 'collectiveMemory'
}

function RoleAndParticipantControls({
  selectedRole,
  setSelectedRole,
  participants,
  selectedParticipantId,
  setSelectedParticipantId
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-2">
        <small className="uppercase tracking-[0.2em] text-slate-400">Role Context</small>
        <Select value={selectedRole} onValueChange={setSelectedRole}>
          <SelectTrigger className="w-full md:w-[260px]">
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(ATLAS_ROLES).map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <small className="uppercase tracking-[0.2em] text-slate-400">Participant Context</small>
        <Select value={selectedParticipantId} onValueChange={setSelectedParticipantId}>
          <SelectTrigger className="w-full md:w-[300px]">
            <SelectValue placeholder="Select participant" />
          </SelectTrigger>
          <SelectContent>
            {participants.map((participant) => (
              <SelectItem key={participant.participantId} value={participant.participantId}>
                {participant.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function SurfaceNavigation({ surface, setSurface }) {
  const items = [
    { id: SURFACES.situationalAwareness, label: 'Situational Awareness', icon: Activity },
    { id: SURFACES.precisionNavigation, label: 'Precision Navigation', icon: Compass },
    { id: SURFACES.collectiveMemory, label: 'Collective Memory', icon: ScrollText }
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Button
            key={item.id}
            variant={surface === item.id ? 'default' : 'outline'}
            onClick={() => setSurface(item.id)}
            className="gap-2"
          >
            <Icon size={16} />
            {item.label}
          </Button>
        )
      })}
    </div>
  )
}

function SituationalAwarenessSurface({ selectedParticipant, decisionPacket }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System Pressure Snapshot</CardTitle>
        <CardDescription>Domain pressure is shown for action sequencing, not person scoring.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {selectedParticipant.pressureVectors.map((vector) => {
          const domain = PRESSURE_DOMAINS.find((item) => item.id === vector.domain)
          return (
            <div key={vector.domain} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-slate-100">{domain?.label ?? vector.domain}</p>
              <small>Severity: {(vector.severity * 100).toFixed(0)}%</small>
              <small className="block">Reversibility: {(vector.reversibility * 100).toFixed(0)}%</small>
              <small className="block">Trajectory: {vector.trajectory}</small>
            </div>
          )
        })}
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
  )
}

function PrecisionNavigationSurface({
  decisionPacket,
  selectedRole,
  selectedRoutes,
  activateRecommendedRoute,
  savingRoute,
  actionError
}) {
  const canActivate = canRolePerform(selectedRole, 'activateRoute')
  return (
    <Card>
      <CardHeader>
        <CardTitle>Route Sequencing</CardTitle>
        <CardDescription>Safest next actions with interference and transfer cost controls.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {decisionPacket.routeOptions.map((route) => (
          <div key={route.routeId} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-slate-100">
                <Route className="mr-2 inline h-4 w-4" />
                {route.routeId} via {route.partnerId}
              </p>
              <small className="rounded-full border border-slate-700 px-3 py-1 uppercase tracking-[0.12em]">
                {ROUTE_LIFECYCLE.pending}
              </small>
            </div>
            <small className="block">Score: {(route.score * 100).toFixed(1)}</small>
            <small className="block">Interference risk: {(route.interferenceRisk * 100).toFixed(0)}%</small>
            <small className="block">Transfer cost: {(route.transferCost * 100).toFixed(0)}%</small>
            <small className="block">Targets phase: {route.phaseTarget}</small>
          </div>
        ))}
        <div className="rounded-2xl border border-slate-800 p-4">
          <p className="text-slate-100">Recommended route: {decisionPacket.recommendedRouteId ?? 'None available'}</p>
          <small className="block">
            Activation policy: {canActivate ? 'Allowed for selected role' : 'Blocked for selected role'}
          </small>
          <Button
            className="mt-3"
            onClick={activateRecommendedRoute}
            disabled={!canActivate || savingRoute || !decisionPacket.recommendedRouteId}
          >
            {savingRoute ? 'Activating...' : 'Activate Recommended Route'}
          </Button>
          {actionError && <small className="mt-2 block text-amber-300">{actionError}</small>}
        </div>
        <div className="rounded-2xl border border-slate-800 p-4">
          <p className="text-slate-100">Persisted Active Routes</p>
          {selectedRoutes.length === 0 ? (
            <small className="block">No route activations persisted yet.</small>
          ) : (
            selectedRoutes.map((route) => (
              <small key={route.id} className="block">
                {route.routeId} via {route.partnerId} ({route.status})
              </small>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function CollectiveMemorySurface({ selectedParticipant, selectedMemoryEvents, appendMemoryEvent, savingMemoryEvent, actionError }) {
  const memoryTrack = useMemo(
    () =>
      selectedMemoryEvents.length > 0
        ? selectedMemoryEvents.map((event) => ({
            id: event.id,
            phase: event.phase ?? selectedParticipant.currentPhase,
            label: event.label ?? event.eventType ?? 'Memory event',
            verified: Boolean(event.verified)
          }))
        : [
            {
              id: 'evt-fallback-1',
              phase: selectedParticipant.currentPhase,
              label: 'Pressure assessment verified',
              verified: true
            },
            {
              id: 'evt-fallback-2',
              phase: STABILIZATION_PHASES[Math.min(2, STABILIZATION_PHASES.indexOf(selectedParticipant.currentPhase) + 1)],
              label: 'Route milestone pending verification',
              verified: false
            }
          ],
    [selectedMemoryEvents, selectedParticipant]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collective Memory Strip</CardTitle>
        <CardDescription>Only verified events enter shared memory.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-2xl border border-slate-800 p-4">
          <Button
            onClick={() =>
              appendMemoryEvent({
                label: 'Milestone verified by ATLAS operator.',
                verified: true
              })
            }
            disabled={savingMemoryEvent}
          >
            {savingMemoryEvent ? 'Writing Event...' : 'Append Verified Milestone'}
          </Button>
          {actionError && <small className="mt-2 block text-amber-300">{actionError}</small>}
        </div>
        {memoryTrack.map((event) => (
          <div
            key={event.id}
            className={`rounded-2xl border p-4 ${event.verified ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-slate-800 bg-slate-900'}`}
          >
            <p className="text-slate-100">{event.label}</p>
            <small className="block">Phase: {event.phase}</small>
            <small className="block">Verified: {event.verified ? 'Yes' : 'No'}</small>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function AtlasShell() {
  const [surface, setSurface] = useState(SURFACES.situationalAwareness)
  const {
    selectedRole,
    setSelectedRole,
    selectedParticipant,
    selectedParticipantId,
    setSelectedParticipantId,
    participants,
    decisionPacket,
    selectedRoutes,
    selectedMemoryEvents,
    activateRecommendedRoute,
    appendMemoryEvent,
    actionError,
    savingRoute,
    savingMemoryEvent,
    isLiveData,
    loadingLiveData,
    loadError
  } = useAtlasDecisioning()

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header className="space-y-2">
        <small className="uppercase tracking-[0.26em] text-slate-400">ATLAS 2026 Command Center</small>
        <h2>Regulation to Readiness to Renewal Navigation</h2>
        <p className="max-w-3xl text-slate-400">
          The legacy case-management surfaces are retired. This interface is now purpose-built for pressure legibility,
          route sequencing, and verified collective memory.
        </p>
        <small className="block text-slate-400">
          Data source:{' '}
          <span className={isLiveData ? 'text-emerald-300' : 'text-amber-300'}>
            {loadingLiveData ? 'Connecting...' : isLiveData ? 'Live Firestore atlas2026' : 'Demo fallback'}
          </span>
        </small>
        {loadError && <small className="block text-amber-300">{loadError}</small>}
      </header>

      <RoleAndParticipantControls
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
        participants={participants}
        selectedParticipantId={selectedParticipantId}
        setSelectedParticipantId={setSelectedParticipantId}
      />

      <SurfaceNavigation surface={surface} setSurface={setSurface} />

      {surface === SURFACES.situationalAwareness && (
        <SituationalAwarenessSurface selectedParticipant={selectedParticipant} decisionPacket={decisionPacket} />
      )}
      {surface === SURFACES.precisionNavigation && (
        <PrecisionNavigationSurface
          decisionPacket={decisionPacket}
          selectedRole={selectedRole}
          selectedRoutes={selectedRoutes}
          activateRecommendedRoute={activateRecommendedRoute}
          savingRoute={savingRoute}
          actionError={actionError}
        />
      )}
      {surface === SURFACES.collectiveMemory && (
        <CollectiveMemorySurface
          selectedParticipant={selectedParticipant}
          selectedMemoryEvents={selectedMemoryEvents}
          appendMemoryEvent={appendMemoryEvent}
          savingMemoryEvent={savingMemoryEvent}
          actionError={actionError}
        />
      )}
    </div>
  )
}

