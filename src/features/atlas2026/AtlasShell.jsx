import React, { Suspense, lazy, useState } from 'react'
import { Activity, Compass, ScrollText, Settings, Plug, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ATLAS_ROLES } from '@/core/atlas2026/policy'
import { useAtlasDecisioning } from './useAtlasDecisioning'

const SituationalAwarenessPage = lazy(() => import('./pages/SituationalAwarenessPage'))
const PrecisionNavigationPage = lazy(() => import('./pages/PrecisionNavigationPage'))
const CollectiveMemoryPage = lazy(() => import('./pages/CollectiveMemoryPage'))
const GovernancePage = lazy(() => import('./pages/GovernancePage'))
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage'))
const OperationsPage = lazy(() => import('./pages/OperationsPage'))

const WORKSPACES = {
  situationalAwareness: 'situationalAwareness',
  precisionNavigation: 'precisionNavigation',
  collectiveMemory: 'collectiveMemory',
  operations: 'operations',
  governance: 'governance',
  integrations: 'integrations'
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
    { id: WORKSPACES.situationalAwareness, label: 'Situational Awareness', icon: Activity },
    { id: WORKSPACES.precisionNavigation, label: 'Precision Navigation', icon: Compass },
    { id: WORKSPACES.collectiveMemory, label: 'Collective Memory', icon: ScrollText },
    { id: WORKSPACES.operations, label: 'Operations', icon: BarChart3 },
    { id: WORKSPACES.governance, label: 'Governance', icon: Settings },
    { id: WORKSPACES.integrations, label: 'Integrations', icon: Plug }
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

export default function AtlasShell() {
  const [surface, setSurface] = useState(WORKSPACES.situationalAwareness)
  const {
    selectedRole,
    setSelectedRole,
    selectedParticipant,
    selectedParticipantId,
    setSelectedParticipantId,
    participants,
    decisionPacket,
    routePlan,
    selectedRoutes,
    selectedRouteSteps,
    selectedMemoryView,
    situationalOverlay,
    operationsSnapshot,
    ontologyWeights,
    ontologyAudit,
    activateRecommendedRoute,
    transitionRouteStatus,
    transitionRouteStepStatus,
    appendMemoryEvent,
    saveOntologyWeights,
    actionError,
    savingRoute,
    updatingRoute,
    updatingStep,
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

      <Suspense fallback={<small className="block text-slate-400">Loading workspace...</small>}>
        {surface === WORKSPACES.situationalAwareness && (
          <SituationalAwarenessPage
            selectedParticipant={selectedParticipant}
            decisionPacket={decisionPacket}
            situationalOverlay={situationalOverlay}
          />
        )}
        {surface === WORKSPACES.precisionNavigation && (
          <PrecisionNavigationPage
            selectedRole={selectedRole}
            routePlan={routePlan}
            selectedRoutes={selectedRoutes}
            selectedRouteSteps={selectedRouteSteps}
            activateRecommendedRoute={activateRecommendedRoute}
            transitionRouteStatus={transitionRouteStatus}
            transitionRouteStepStatus={transitionRouteStepStatus}
            savingRoute={savingRoute}
            updatingRoute={updatingRoute}
            updatingStep={updatingStep}
            actionError={actionError}
          />
        )}
        {surface === WORKSPACES.collectiveMemory && (
          <CollectiveMemoryPage
            selectedRole={selectedRole}
            selectedMemoryView={selectedMemoryView}
            appendMemoryEvent={appendMemoryEvent}
            savingMemoryEvent={savingMemoryEvent}
            actionError={actionError}
          />
        )}
        {surface === WORKSPACES.operations && <OperationsPage operationsSnapshot={operationsSnapshot} />}
        {surface === WORKSPACES.governance && (
          <GovernancePage
            selectedRole={selectedRole}
            ontologyWeights={ontologyWeights}
            ontologyAudit={ontologyAudit}
            saveOntologyWeights={saveOntologyWeights}
            actionError={actionError}
          />
        )}
        {surface === WORKSPACES.integrations && <IntegrationsPage isLiveData={isLiveData} />}
      </Suspense>
    </div>
  )
}

