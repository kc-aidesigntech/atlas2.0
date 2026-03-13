import React, { useMemo, useState } from 'react'
import type { InstructionBomItem, JourneyPhase, Participant, RouteTemplate, RoutingStep } from '@/features/atlas2026/data/contracts'
import { SUBWAY_COLORS } from '@/features/atlas2026/streamlined/theme'

interface RoutePlannerPageProps {
  participants: Participant[]
  selectedParticipantId: string
  onSelectParticipant: (participantId: string) => void
  templates: RouteTemplate[]
  boms: InstructionBomItem[]
  selectedTemplateId: string
  onSelectTemplate: (templateId: string) => void
  previewStepsForBomIds: (bomItemIds: string[]) => RoutingStep[]
  addBomItem: (payload: Omit<InstructionBomItem, 'id'>) => void
  buildTemplateFromBom: (input: { name: string; description: string; targetPhase: JourneyPhase; bomItemIds: string[] }) => void
  assignTemplate: (participantId: string, templateId: string) => void
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
  const previewSteps = useMemo(() => previewStepsForBomIds(selectedBomIds), [previewStepsForBomIds, selectedBomIds])

  function toggleBom(bomId: string) {
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
      <section className="rounded-2xl border bg-[#0d0d0d] p-6" style={{ borderColor: SUBWAY_COLORS.border }}>
        <small className="block text-xs font-black tracking-[0.12em] text-[#a7a9ac]">instruction builder (pseudo bom)</small>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input
            value={newBomTitle}
            onChange={(event) => setNewBomTitle(event.target.value)}
            placeholder="activity title"
            className="rounded-xl border bg-black px-3 py-2 text-sm text-white"
            style={{ borderColor: SUBWAY_COLORS.border }}
          />
          <input
            value={newBomDomain}
            onChange={(event) => setNewBomDomain(event.target.value)}
            placeholder="domain"
            className="rounded-xl border bg-black px-3 py-2 text-sm text-white"
            style={{ borderColor: SUBWAY_COLORS.border }}
          />
          <button
            onClick={submitBom}
            className="rounded-xl border bg-black px-3 py-2 text-xs font-black text-white"
            style={{ borderColor: SUBWAY_COLORS.orange, backgroundColor: SUBWAY_COLORS.orange }}
          >
            add bom activity
          </button>
        </div>
        <textarea
          value={newBomDescription}
          onChange={(event) => setNewBomDescription(event.target.value)}
          placeholder="activity description"
          className="mt-3 min-h-20 w-full rounded-xl border bg-black px-3 py-2 text-sm text-white"
          style={{ borderColor: SUBWAY_COLORS.border }}
        />
      </section>

      <section className="rounded-2xl border bg-[#0d0d0d] p-6" style={{ borderColor: SUBWAY_COLORS.border }}>
        <small className="block text-xs font-black tracking-[0.12em] text-[#a7a9ac]">template construction</small>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="template name"
            className="rounded-xl border bg-black px-3 py-2 text-sm text-white"
            style={{ borderColor: SUBWAY_COLORS.border }}
          />
          <select
            value={targetPhase}
            onChange={(event) => setTargetPhase(event.target.value as JourneyPhase)}
            className="rounded-xl border bg-black px-3 py-2 text-sm text-white"
            style={{ borderColor: SUBWAY_COLORS.border }}
          >
            <option value="regulation">regulation</option>
            <option value="readiness">readiness</option>
            <option value="renewal">renewal</option>
          </select>
        </div>
        <textarea
          value={templateDescription}
          onChange={(event) => setTemplateDescription(event.target.value)}
          placeholder="template description"
          className="mt-3 min-h-20 w-full rounded-xl border bg-black px-3 py-2 text-sm text-white"
          style={{ borderColor: SUBWAY_COLORS.border }}
        />
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {boms.map((bom) => (
            <label key={bom.id} className="flex items-start gap-2 rounded-xl border bg-black p-3" style={{ borderColor: SUBWAY_COLORS.border }}>
              <input type="checkbox" checked={selectedBomIds.includes(bom.id)} onChange={() => toggleBom(bom.id)} className="mt-1" />
              <div>
                <small className="block text-white">{bom.title}</small>
                <small className="block text-[#a7a9ac]">{bom.description}</small>
              </div>
            </label>
          ))}
        </div>
        <button
          onClick={submitTemplate}
          className="mt-3 rounded-xl border px-4 py-2 text-xs font-black text-black"
          style={{ borderColor: SUBWAY_COLORS.yellow, backgroundColor: SUBWAY_COLORS.yellow }}
        >
          save route template from selection
        </button>
      </section>

      <section className="rounded-2xl border bg-[#0d0d0d] p-6" style={{ borderColor: SUBWAY_COLORS.border }}>
        <small className="block text-xs font-black tracking-[0.12em] text-[#a7a9ac]">route step preview</small>
        <div className="mt-3 space-y-2">
          {previewSteps.length === 0 ? (
            <small className="text-[#808183]">select bom activities to preview routing steps.</small>
          ) : (
            previewSteps.map((step, index) => (
              <div key={step.id} className="rounded-xl border bg-black p-3" style={{ borderColor: SUBWAY_COLORS.border }}>
                <small className="block text-white">
                  {index + 1}. {step.label}
                </small>
                <small className="block text-[#a7a9ac]">
                  phase: {step.phase} | owner: {step.ownerRole}
                </small>
                <small className="block text-[#808183]">{step.exitCriteria}</small>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-[#0d0d0d] p-6" style={{ borderColor: SUBWAY_COLORS.border }}>
        <small className="block text-xs font-black tracking-[0.12em] text-[#a7a9ac]">assign template to journey</small>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <select
            value={selectedParticipantId}
            onChange={(event) => onSelectParticipant(event.target.value)}
            className="rounded-xl border bg-black px-3 py-2 text-sm text-white"
            style={{ borderColor: SUBWAY_COLORS.border }}
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
            className="rounded-xl border bg-black px-3 py-2 text-sm text-white"
            style={{ borderColor: SUBWAY_COLORS.border }}
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <button
            onClick={submitAssignment}
            className="rounded-xl border px-3 py-2 text-xs font-black text-white"
            style={{ borderColor: SUBWAY_COLORS.deepGreen, backgroundColor: SUBWAY_COLORS.deepGreen }}
          >
            assign template
          </button>
        </div>
        {selectedTemplate && (
          <small className="mt-3 block text-[#a7a9ac]">
            selected template: {selectedTemplate.name} | steps: {selectedTemplate.stepIds.length} | target: {selectedTemplate.targetPhase}
          </small>
        )}
        {notice && <small className="mt-2 block" style={{ color: SUBWAY_COLORS.orange }}>{notice}</small>}
      </section>
    </div>
  )
}
