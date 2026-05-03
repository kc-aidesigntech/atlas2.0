import React, { Suspense, lazy, useMemo, useState } from 'react'
import { Activity, Compass, ScrollText, Settings, Plug, BarChart3, Workflow, Globe, Lock, Layout, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ATLAS_ROLES } from '@/core/atlas2026/policy'
import { useAtlasDecisioning } from './useAtlasDecisioning'

// Atlas shell coordinates role-scoped workspaces that all share one decisioning data contract.
// Each workspace consumes the same snapshots but surfaces different operator actions.
const SituationalAwarenessPage = lazy(() => import('./pages/SituationalAwarenessPage'))
const PrecisionNavigationPage = lazy(() => import('./pages/PrecisionNavigationPage'))
const CollectiveMemoryPage = lazy(() => import('./pages/CollectiveMemoryPage'))
const GovernancePage = lazy(() => import('./pages/GovernancePage'))
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage'))
const OperationsPage = lazy(() => import('./pages/OperationsPage'))
const ExecutionTimelinePage = lazy(() => import('./pages/ExecutionTimelinePage'))

const WORKSPACES = {
  situationalAwareness: 'situationalAwareness',
  precisionNavigation: 'precisionNavigation',
  executionTimeline: 'executionTimeline',
  collectiveMemory: 'collectiveMemory',
  operations: 'operations',
  governance: 'governance',
  integrations: 'integrations'
}

const TICKER_ITEMS = [
  { icon: Activity, color: 'orange', label: 'system load' },
  { icon: Globe, color: 'blue', label: 'watershed weights calibrated' },
  { icon: Lock, color: 'steel', label: 'sovereign interpretation locked' },
  { icon: Layout, color: 'green', label: 'regional yield' }
]

function RoleAndParticipantControls({
  selectedRole,
  setSelectedRole,
  selectedCountyId,
  setSelectedCountyId,
  countyOptions,
  participants,
  selectedParticipantId,
  setSelectedParticipantId
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-2">
        <small className="uppercase tracking-[0.2em] text-slate-400">Role Context</small>
        <Select value={selectedRole} onValueChange={setSelectedRole}>
          <SelectTrigger className="w-full md:w-[250px]">
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
        <small className="uppercase tracking-[0.2em] text-slate-400">County Scope</small>
        <Select value={selectedCountyId} onValueChange={setSelectedCountyId}>
          <SelectTrigger className="w-full md:w-[220px]">
            <SelectValue placeholder="Select county" />
          </SelectTrigger>
          <SelectContent>
            {countyOptions.map((countyId) => (
              <SelectItem key={countyId} value={countyId}>
                {countyId === 'all' ? 'All Counties' : countyId}
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
    { id: WORKSPACES.situationalAwareness, label: 'situational awareness', icon: Activity },
    { id: WORKSPACES.precisionNavigation, label: 'precision navigation', icon: Compass },
    { id: WORKSPACES.executionTimeline, label: 'execution timeline', icon: Workflow },
    { id: WORKSPACES.collectiveMemory, label: 'collective memory', icon: ScrollText },
    { id: WORKSPACES.operations, label: 'operations', icon: BarChart3 },
    { id: WORKSPACES.governance, label: 'governance', icon: Settings },
    { id: WORKSPACES.integrations, label: 'integrations', icon: Plug }
  ]

  return (
    <div className="flex flex-wrap items-center gap-4">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.id}
            onClick={() => setSurface(item.id)}
            className={`flex items-center gap-1 border-b-2 pb-1 text-[10px] font-black tracking-[0.13em] transition-colors ${
              surface === item.id ? 'border-orange-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon size={14} />
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

export default function AtlasShell() {
  const [surface, setSurface] = useState(WORKSPACES.situationalAwareness)
  const [runningPrimaryAction, setRunningPrimaryAction] = useState(false)
  const {
    selectedRole,
    setSelectedRole,
    selectedCountyId,
    setSelectedCountyId,
    countyOptions,
    selectedParticipant,
    selectedParticipantId,
    setSelectedParticipantId,
    participants,
    decisionPacket,
    civicBioSnapshot,
    routePlan,
    selectedRoutes,
    selectedRouteSteps,
    selectedMemoryView,
    selectedRenewalRoleRecord,
    situationalOverlay,
    operationsSnapshot,
    countyComparisons,
    executionSnapshot,
    ontologyWeights,
    ontologyAudit,
    activateRecommendedRoute,
    transitionRouteStatus,
    transitionRouteStepStatus,
    appendMemoryEvent,
    assignRenewalRole,
    saveOntologyWeights,
    actionError,
    savingRoute,
    updatingRoute,
    updatingStep,
    savingMemoryEvent,
    assigningRenewalRole,
    isLiveData,
    loadingLiveData,
    loadError
  } = useAtlasDecisioning()

  const screenContract = useMemo(() => {
    // The CTA contract intentionally centralizes stage intent so top-banner guidance
    // and action behavior stay in sync across workspace switches.
    if (surface === WORKSPACES.situationalAwareness) {
      return {
        title: 'stage 1 - situational awareness',
        input: 'confirm where pressure is rising and choose the first relief domain.',
        output: 'atlas returns a legible pressure map, readiness alerts, and highest-risk corridors.',
        ctaLabel: 'continue to precision navigation',
        cta: async () => setSurface(WORKSPACES.precisionNavigation)
      }
    }
    if (surface === WORKSPACES.precisionNavigation) {
      return {
        title: 'stage 2 - precision navigation',
        input: 'approve the next safe route or hold for an alternate class.',
        output: 'atlas returns dependency-aware sequence, interference diagnostics, and mitigation steps.',
        ctaLabel: 'activate recommended route',
        cta: async () => {
          const ok = await activateRecommendedRoute()
          if (ok) setSurface(WORKSPACES.executionTimeline)
        },
        disabled: !routePlan?.recommendedRouteId || savingRoute
      }
    }
    if (surface === WORKSPACES.executionTimeline) {
      return {
        title: 'stage 3 - execution timeline',
        input: 'resolve blockers and move one critical step forward safely.',
        output: 'atlas returns blocker triage, step dependencies, and continuity timeline.',
        ctaLabel: 'capture verified memory',
        cta: async () => setSurface(WORKSPACES.collectiveMemory)
      }
    }
    if (surface === WORKSPACES.collectiveMemory) {
      return {
        title: 'stage 4 - collective memory',
        input: 'append verified milestones and assign renewal role when gate is open.',
        output: 'atlas returns trusted receipts showing what worked and who contributed.',
        ctaLabel: 'append verified milestone',
        cta: async () => appendMemoryEvent({ label: 'milestone verified by atlas operator.', verified: true }),
        disabled: savingMemoryEvent
      }
    }
    if (surface === WORKSPACES.operations) {
      return {
        title: 'stage 5 - operations',
        input: 'review county flow health and target blocker/readiness interventions.',
        output: 'atlas returns triage priorities, reciprocity trend, and export package.',
        ctaLabel: 'review governance controls',
        cta: async () => setSurface(WORKSPACES.governance)
      }
    }
    if (surface === WORKSPACES.governance) {
      return {
        title: 'stage 6 - governance',
        input: 'tune thresholds only when evidence shows routing drift.',
        output: 'atlas returns policy-calibrated behavior with auditable governance trail.',
        ctaLabel: 'review ecosystem contracts',
        cta: async () => setSurface(WORKSPACES.integrations)
      }
    }
    return {
      title: 'stage 7 - integrations',
      input: 'confirm institutional alignment and contract readiness.',
      output: 'atlas returns network posture for shared action across partners.',
      ctaLabel: 'start next cycle',
      cta: async () => setSurface(WORKSPACES.situationalAwareness)
    }
  }, [surface, activateRecommendedRoute, appendMemoryEvent, routePlan?.recommendedRouteId, savingRoute, savingMemoryEvent])

  const systemLoad = useMemo(() => {
    const pressure = decisionPacket?.explainability?.averageDomainPressure ?? 0
    if (pressure >= 0.67) return 'high'
    if (pressure >= 0.42) return 'moderate'
    return 'stable'
  }, [decisionPacket])

  const currentYield = useMemo(() => Math.round((operationsSnapshot?.reciprocity?.reciprocityIndex ?? 0) * 100), [operationsSnapshot])

  async function runPrimaryAction() {
    if (!screenContract?.cta || runningPrimaryAction) return
    try {
      setRunningPrimaryAction(true)
      await screenContract.cta()
    } finally {
      setRunningPrimaryAction(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="fixed left-0 right-0 top-0 z-40 border-b border-slate-800 bg-black/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-white text-black">
              <span className="text-xl font-black">a</span>
            </div>
            <div>
              <small className="block text-[10px] font-black tracking-[0.2em] text-white">atlas-intel</small>
              <small className="block text-[8px] font-bold tracking-[0.12em] text-slate-500">sovereign civic navigation</small>
            </div>
          </div>
          <SurfaceNavigation surface={surface} setSurface={setSurface} />
          <div className="flex items-center gap-2 text-slate-500">
            <small className="hidden text-[9px] font-bold tracking-[0.12em] lg:block">
              node: {(selectedParticipant?.participantId || 'none').slice(0, 8)}
            </small>
            <Menu size={16} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-24 pt-24">
        <Card>
          <CardContent className="space-y-4 p-4">
            <RoleAndParticipantControls
              selectedRole={selectedRole}
              setSelectedRole={setSelectedRole}
              selectedCountyId={selectedCountyId}
              setSelectedCountyId={setSelectedCountyId}
              countyOptions={countyOptions}
              participants={participants}
              selectedParticipantId={selectedParticipantId}
              setSelectedParticipantId={setSelectedParticipantId}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <small className="block text-[10px] font-black tracking-[0.14em] text-slate-400">{screenContract.title}</small>
                <small className="block text-slate-300">{screenContract.input}</small>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <small className="block text-[10px] font-black tracking-[0.14em] text-slate-400">atlas gives you</small>
                <small className="block text-slate-300">{screenContract.output}</small>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={runPrimaryAction} disabled={runningPrimaryAction || screenContract.disabled}>
                {runningPrimaryAction ? 'running action...' : screenContract.ctaLabel}
              </Button>
              <small className="text-slate-400">
                source:{' '}
                <span className={isLiveData ? 'text-emerald-300' : 'text-amber-300'}>
                  {loadingLiveData ? 'connecting...' : isLiveData ? 'live firestore atlas2026' : 'demo fallback'}
                </span>
              </small>
            </div>
            {loadError && <small className="block text-amber-300">{loadError}</small>}
          </CardContent>
        </Card>

        <Suspense fallback={<small className="block text-slate-400">Loading workspace...</small>}>
          {surface === WORKSPACES.situationalAwareness && (
            <SituationalAwarenessPage
              selectedParticipant={selectedParticipant}
              decisionPacket={decisionPacket}
              situationalOverlay={situationalOverlay}
              civicBioSnapshot={civicBioSnapshot}
            />
          )}
          {surface === WORKSPACES.precisionNavigation && (
            <PrecisionNavigationPage
              selectedRole={selectedRole}
              routePlan={routePlan}
              ontologyWeights={ontologyWeights}
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
              selectedParticipant={selectedParticipant}
              selectedMemoryView={selectedMemoryView}
              selectedRenewalRoleRecord={selectedRenewalRoleRecord}
              civicBioSnapshot={civicBioSnapshot}
              appendMemoryEvent={appendMemoryEvent}
              assignRenewalRole={assignRenewalRole}
              savingMemoryEvent={savingMemoryEvent}
              assigningRenewalRole={assigningRenewalRole}
              actionError={actionError}
            />
          )}
          {surface === WORKSPACES.executionTimeline && (
            <ExecutionTimelinePage
              executionSnapshot={executionSnapshot}
              civicBioSnapshot={civicBioSnapshot}
              selectedRouteSteps={selectedRouteSteps}
              transitionRouteStepStatus={transitionRouteStepStatus}
              updatingStep={updatingStep}
            />
          )}
          {surface === WORKSPACES.operations && (
            <OperationsPage
              operationsSnapshot={operationsSnapshot}
              countyComparisons={countyComparisons}
              selectedCountyId={selectedCountyId}
            />
          )}
          {surface === WORKSPACES.governance && (
            <GovernancePage
              selectedRole={selectedRole}
              ontologyWeights={ontologyWeights}
              ontologyAudit={ontologyAudit}
              saveOntologyWeights={saveOntologyWeights}
              actionError={actionError}
            />
          )}
          {surface === WORKSPACES.integrations && <IntegrationsPage ecosystemSnapshot={civicBioSnapshot.ecosystem} />}
        </Suspense>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-40 flex h-12 items-center overflow-hidden border-t border-slate-800 bg-black">
        <div className="atlas-ticker flex min-w-max items-center gap-10 px-6">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, index) => {
            const Icon = item.icon
            const value = item.label === 'system load' ? `: ${systemLoad}` : item.label === 'regional yield' ? `: ${currentYield}%` : ''
            const colorClass =
              item.color === 'orange' ? 'text-orange-500' : item.color === 'blue' ? 'text-blue-500' : item.color === 'green' ? 'text-emerald-500' : 'text-slate-400'
            return (
              <small key={`${item.label}-${index}`} className="flex items-center gap-2 text-[10px] font-black tracking-[0.14em] text-slate-500">
                <Icon size={14} className={colorClass} /> {item.label}
                {value}
              </small>
            )
          })}
        </div>
      </footer>
    </div>
  )
}

