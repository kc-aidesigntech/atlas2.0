import React, { useMemo, useState } from 'react'
import { Activity, Globe, Layout, Lock, Menu } from 'lucide-react'
import ConceptRailOverlay from '@/features/atlas2026/streamlined/ConceptRailOverlay'
import IntelligencePage from '@/features/atlas2026/streamlined/IntelligencePage'
import NavigationPage from '@/features/atlas2026/streamlined/NavigationPage'
import RoutePlannerPage from '@/features/atlas2026/streamlined/RoutePlannerPage'
import { SUBWAY_COLORS } from '@/features/atlas2026/streamlined/theme'
import { useRoutingBuilderData } from '@/features/atlas2026/streamlined/useRoutingBuilderData'

type StreamlinedView = 'navigation' | 'intelligence' | 'route-planner'

const VIEWS: StreamlinedView[] = ['navigation', 'intelligence', 'route-planner']

export default function StreamlinedAtlasShell() {
  const [view, setView] = useState<StreamlinedView>('navigation')
  const {
    dataset,
    selectedParticipantId,
    setSelectedParticipantId,
    selectedParticipant,
    selectedTemplateId,
    setSelectedTemplateId,
    selectedJourney,
    selectedJourneySteps,
    metrics,
    addBomItem,
    previewStepsForBomIds,
    buildTemplateFromBom,
    assignTemplate
  } = useRoutingBuilderData()

  const currentYield = useMemo(() => Math.round(metrics.averageReadiness * 100), [metrics.averageReadiness])

  return (
    <div
      className="min-h-screen bg-black text-white"
      style={{ backgroundColor: SUBWAY_COLORS.black, color: SUBWAY_COLORS.white, fontFamily: 'Helvetica, Arial, sans-serif' }}
    >
      <header className="fixed left-0 right-0 top-0 z-50 border-b bg-black">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-white text-black">
              <span className="text-xl font-black">a</span>
            </div>
            <div>
              <small className="block text-xs font-black tracking-[0.18em] text-white">atlas-intel</small>
              <small className="block text-[11px] font-bold tracking-[0.1em]" style={{ color: SUBWAY_COLORS.muted }}>
                routing instruction builder
              </small>
            </div>
          </div>

          <nav className="flex items-center gap-3">
            {VIEWS.map((item) => (
              <button
                key={item}
                onClick={() => setView(item)}
                className={`rounded border px-3 py-1.5 text-xs font-black tracking-[0.12em] ${view === item ? 'text-white' : ''}`}
                style={{
                  borderColor: view === item ? SUBWAY_COLORS.orange : SUBWAY_COLORS.border,
                  color: view === item ? SUBWAY_COLORS.white : SUBWAY_COLORS.steel
                }}
              >
                {item.replace('-', ' ')}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2" style={{ color: SUBWAY_COLORS.steel }}>
            <small className="hidden text-xs font-bold tracking-[0.1em] lg:block">node: {selectedParticipantId.slice(0, 10) || 'none'}</small>
            <Menu size={16} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-24 pt-24">
        <ConceptRailOverlay />
        {view === 'navigation' && (
          <NavigationPage
            participants={dataset.participants}
            selectedParticipantId={selectedParticipantId}
            onSelectParticipant={setSelectedParticipantId}
            selectedParticipant={selectedParticipant}
            selectedJourney={selectedJourney}
            selectedJourneySteps={selectedJourneySteps}
          />
        )}

        {view === 'intelligence' && (
          <IntelligencePage
            participants={dataset.participants}
            templates={dataset.routeTemplates}
            journeys={dataset.journeyAssignments}
            metrics={metrics}
          />
        )}

        {view === 'route-planner' && (
          <RoutePlannerPage
            participants={dataset.participants}
            selectedParticipantId={selectedParticipantId}
            onSelectParticipant={setSelectedParticipantId}
            templates={dataset.routeTemplates}
            boms={dataset.instructionBoms}
            selectedTemplateId={selectedTemplateId}
            onSelectTemplate={setSelectedTemplateId}
            previewStepsForBomIds={previewStepsForBomIds}
            addBomItem={addBomItem}
            buildTemplateFromBom={buildTemplateFromBom}
            assignTemplate={assignTemplate}
          />
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-40 flex h-12 items-center overflow-hidden border-t bg-black" style={{ borderColor: SUBWAY_COLORS.border }}>
        <div className="atlas-ticker flex min-w-max items-center gap-10 px-6">
          <small className="flex items-center gap-2 text-xs font-black tracking-[0.1em]" style={{ color: SUBWAY_COLORS.steel }}>
            <Activity size={14} style={{ color: SUBWAY_COLORS.orange }} /> system load: focused
          </small>
          <small className="flex items-center gap-2 text-xs font-black tracking-[0.1em]" style={{ color: SUBWAY_COLORS.steel }}>
            <Globe size={14} style={{ color: SUBWAY_COLORS.blue }} /> supabase contracts active
          </small>
          <small className="flex items-center gap-2 text-xs font-black tracking-[0.1em]" style={{ color: SUBWAY_COLORS.steel }}>
            <Lock size={14} style={{ color: SUBWAY_COLORS.steel }} /> shared atlas schema linked
          </small>
          <small className="flex items-center gap-2 text-xs font-black tracking-[0.1em]" style={{ color: SUBWAY_COLORS.steel }}>
            <Layout size={14} style={{ color: SUBWAY_COLORS.deepGreen }} /> regional yield: {currentYield}%
          </small>
        </div>
      </footer>
    </div>
  )
}
