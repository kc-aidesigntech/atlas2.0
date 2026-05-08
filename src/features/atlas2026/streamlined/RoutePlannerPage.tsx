import React, { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AtlasInsetCard, AtlasPanel } from '@/features/atlas2026/components/AtlasPrimitives'
import type { InstructionBomItem, JourneyPhase, Participant, RouteTemplate, RoutingStep } from '@/features/atlas2026/data/contracts'
import { SUBWAY_COLORS } from '@/features/atlas2026/streamlined/theme'

/**
 * Streamlined route-planner workspace.
 *
 * Purpose:
 * - allows Bill of Materials (BOM) composition, template authoring, preview, and assignment in one panel.
 * - keeps interactions form-driven with minimal transient local state.
 */

interface RoutePlannerPageProps {
  participants: Participant[]
  selectedParticipantId: string
  onSelectParticipant: (participantId: string) => void
  templates: RouteTemplate[]
  boms: InstructionBomItem[]
  selectedTemplateId: string
  onSelectTemplate: (templateId: string) => void
  previewStepsForBomIds: (bomItemIds: string[]) => RoutingStep[]
  addBomItem: (payload: Omit<InstructionBomItem, 'id'>) => void | Promise<void>
  buildTemplateFromBom: (input: { name: string; description: string; targetPhase: JourneyPhase; bomItemIds: string[] }) => void | Promise<void>
  assignTemplate: (participantId: string, templateId: string) => void | Promise<void>
}

export default function RoutePlannerPage({
  participants,
  selectedParticipantId,
  onSelectParticipant,
  templates,
  boms,
  selectedTemplateId,
  onSelectTemplate,
  previewStepsForBomIds,
  addBomItem,
  buildTemplateFromBom,
  assignTemplate
}: RoutePlannerPageProps) {
  const [newBomTitle, setNewBomTitle] = useState('')
  const [newBomDomain, setNewBomDomain] = useState('stabilization')
  const [newBomDescription, setNewBomDescription] = useState('')
  const [templateName, setTemplateName] = useState('custom instruction template')
  const [templateDescription, setTemplateDescription] = useState('instruction template generated from selected bom activities.')
  const [targetPhase, setTargetPhase] = useState<JourneyPhase>('readiness')
  const [selectedBomIds, setSelectedBomIds] = useState<string[]>([])
  const [notice, setNotice] = useState('')

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) || null
  // Preview is derived-only state: recompute from selected BOM ids so the strip always
  // reflects the latest repository mapping logic.
  const previewSteps = useMemo(() => previewStepsForBomIds(selectedBomIds), [previewStepsForBomIds, selectedBomIds])
  // Shared select styling keeps planner controls visually aligned as the panel grows.
  const plannerSelectClassName = 'rounded-xl border bg-black px-3 py-2 text-sm text-white'
  const plannerSelectStyle: React.CSSProperties = { borderColor: SUBWAY_COLORS.border }

  // Action handlers intentionally keep validation lightweight and synchronous so
  // parent repositories can own persistence-side constraints.
  function toggleBom(bomId: string) {
    // Treat BOM selection as a set to keep checkbox toggles idempotent.
    setSelectedBomIds((previous) => (previous.includes(bomId) ? previous.filter((id) => id !== bomId) : [...previous, bomId]))
  }

  function submitBom() {
    if (!newBomTitle.trim() || !newBomDescription.trim()) return
    addBomItem({
      title: newBomTitle.trim(),
      domain: newBomDomain.trim(),
      description: newBomDescription.trim(),
      required: false,
      defaultDurationDays: 7
    })
    setNewBomTitle('')
    setNewBomDescription('')
    setNotice('new instruction bom activity added.')
  }

  function submitTemplate() {
    // Template creation is intentionally blocked on at least one BOM activity so generated
    // templates always produce a non-empty journey.
    if (!templateName.trim() || selectedBomIds.length === 0) {
      setNotice('select at least one bom activity and provide a template name.')
      return
    }
    buildTemplateFromBom({
      name: templateName.trim(),
      description: templateDescription.trim(),
      targetPhase,
      bomItemIds: selectedBomIds
    })
    setSelectedBomIds([])
    setNotice('template saved from bom activities.')
  }

  function submitAssignment() {
    if (!selectedParticipantId || !selectedTemplateId) {
      setNotice('select participant and template before assigning.')
      return
    }
    assignTemplate(selectedParticipantId, selectedTemplateId)
    setNotice('template assigned to participant journey.')
  }

  return (
    <div className="space-y-6">
      <AtlasPanel kicker="instruction builder (pseudo bom)">
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Input
            value={newBomTitle}
            onChange={(event) => setNewBomTitle(event.target.value)}
            placeholder="activity title"
          />
          <Input
            value={newBomDomain}
            onChange={(event) => setNewBomDomain(event.target.value)}
            placeholder="domain"
          />
          <Button
            onClick={submitBom}
            className="rounded-xl border border-[color:var(--atlas-signal-orange)] bg-[var(--atlas-signal-orange)] px-3 py-2 text-xs font-black text-black hover:bg-[var(--atlas-signal-orange)]/90"
          >
            add bom activity
          </Button>
        </div>
        <Textarea
          value={newBomDescription}
          onChange={(event) => setNewBomDescription(event.target.value)}
          placeholder="activity description"
          className="mt-3 min-h-20"
        />
      </AtlasPanel>

      <AtlasPanel kicker="template construction">
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="template name"
          />
          <select
            value={targetPhase}
            onChange={(event) => setTargetPhase(event.target.value as JourneyPhase)}
            className={plannerSelectClassName}
            style={plannerSelectStyle}
          >
            <option value="regulation">regulation</option>
            <option value="readiness">readiness</option>
            <option value="renewal">renewal</option>
          </select>
        </div>
        <Textarea
          value={templateDescription}
          onChange={(event) => setTemplateDescription(event.target.value)}
          placeholder="template description"
          className="mt-3 min-h-20"
        />
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {boms.map((bom) => (
            <AtlasInsetCard key={bom.id} className="flex items-start gap-2">
              <input type="checkbox" checked={selectedBomIds.includes(bom.id)} onChange={() => toggleBom(bom.id)} className="mt-1" />
              <div>
                <small className="block text-white">{bom.title}</small>
                <small className="block text-[#a7a9ac]">{bom.description}</small>
              </div>
            </AtlasInsetCard>
          ))}
        </div>
        <Button
          onClick={submitTemplate}
          className="mt-3 rounded-xl border border-white bg-white px-4 py-2 text-xs font-black text-black hover:bg-white/90"
        >
          save route template from selection
        </Button>
      </AtlasPanel>

      <AtlasPanel kicker="route step preview">
        <div className="mt-3 space-y-2">
          {previewSteps.length === 0 ? (
            <small className="text-[#808183]">select bom activities to preview routing steps.</small>
          ) : (
            previewSteps.map((step, index) => (
              <AtlasInsetCard key={step.id}>
                <small className="block text-white">
                  {index + 1}. {step.label}
                </small>
                <small className="block text-[#a7a9ac]">
                  phase: {step.phase} | owner: {step.ownerRole}
                </small>
                <small className="block text-[#808183]">{step.exitCriteria}</small>
              </AtlasInsetCard>
            ))
          )}
        </div>
      </AtlasPanel>

      <AtlasPanel kicker="assign template to journey">
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <select
            value={selectedParticipantId}
            onChange={(event) => onSelectParticipant(event.target.value)}
            className={plannerSelectClassName}
            style={plannerSelectStyle}
          >
            {participants.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.name}
              </option>
            ))}
          </select>
          <select
            value={selectedTemplateId}
            onChange={(event) => onSelectTemplate(event.target.value)}
            className={plannerSelectClassName}
            style={plannerSelectStyle}
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <Button
            onClick={submitAssignment}
            className="rounded-xl border border-[color:var(--atlas-signal-deep-green)] bg-[var(--atlas-signal-deep-green)] px-3 py-2 text-xs font-black text-white hover:bg-[var(--atlas-signal-deep-green)]/90"
          >
            assign template
          </Button>
        </div>
        {selectedTemplate && (
          <small className="mt-3 block text-[#a7a9ac]">
            selected template: {selectedTemplate.name} | steps: {selectedTemplate.stepIds.length} | target: {selectedTemplate.targetPhase}
          </small>
        )}
        {notice && <small className="mt-2 block" style={{ color: SUBWAY_COLORS.orange }}>{notice}</small>}
      </AtlasPanel>
    </div>
  )
}
