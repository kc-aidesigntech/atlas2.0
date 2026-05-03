import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { canRolePerform } from '@/core/atlas2026/policy'

// Governance settings are global scoring controls; edits here affect all subsequent
// route recommendations and readiness alerts in Atlas decisioning.
const WEIGHT_FIELDS = [
  'coverageWeight',
  'phaseAlignmentWeight',
  'specializationWeight',
  'reversibilityWeight',
  'transferCostPenalty',
  'interferencePenalty',
  'civicDiplomacyBoost'
]

function formatFirestoreTimestamp(value) {
  if (!value) return 'No timestamp'
  const millis = typeof value?.toMillis === 'function' ? value.toMillis() : (value?.seconds || 0) * 1000
  if (!millis) return 'No timestamp'
  return new Date(millis).toLocaleString()
}

export default function GovernancePage({ selectedRole, ontologyWeights, ontologyAudit, saveOntologyWeights, actionError }) {
  const [localWeights, setLocalWeights] = useState(ontologyWeights)
  const [slaThresholdHours, setSlaThresholdHours] = useState(ontologyWeights.slaThresholdHours ?? 48)
  const [interferenceMediumThreshold, setInterferenceMediumThreshold] = useState(
    ontologyWeights.interferenceMediumThreshold ?? 0.35
  )
  const [interferenceHighThreshold, setInterferenceHighThreshold] = useState(ontologyWeights.interferenceHighThreshold ?? 0.6)
  const [phaseReadinessAlertThreshold, setPhaseReadinessAlertThreshold] = useState(
    ontologyWeights.phaseReadinessAlertThreshold ?? 0.45
  )
  const [pcfRefinementWeight, setPcfRefinementWeight] = useState(ontologyWeights.pcfRefinementWeight ?? 0.6)
  const [reciprocityActivationThreshold, setReciprocityActivationThreshold] = useState(
    ontologyWeights.reciprocityActivationThreshold ?? 0.6
  )
  const canManage = canRolePerform(selectedRole, 'manageOntology')

  useEffect(() => {
    setLocalWeights(ontologyWeights)
    setSlaThresholdHours(ontologyWeights.slaThresholdHours ?? 48)
    setInterferenceMediumThreshold(ontologyWeights.interferenceMediumThreshold ?? 0.35)
    setInterferenceHighThreshold(ontologyWeights.interferenceHighThreshold ?? 0.6)
    setPhaseReadinessAlertThreshold(ontologyWeights.phaseReadinessAlertThreshold ?? 0.45)
    setPcfRefinementWeight(ontologyWeights.pcfRefinementWeight ?? 0.6)
    setReciprocityActivationThreshold(ontologyWeights.reciprocityActivationThreshold ?? 0.6)
  }, [ontologyWeights])

  const onFieldChange = (field, value) => {
    // Numeric coercion keeps persisted ontology weights consistent with downstream
    // scoring math that assumes numbers rather than string form inputs.
    setLocalWeights((current) => ({
      ...current,
      [field]: Number(value)
    }))
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Context</CardTitle>
          <CardDescription>Current governance posture and who can act.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <small className="block text-slate-400">Role: {selectedRole}</small>
          <small className="block text-slate-400">
            Governance rights: {canManage ? 'can modify ontology settings' : 'read-only governance access'}
          </small>
          <small className="block text-slate-400">
            Focus: maintain safe transitions, interference controls, and reciprocity-aligned activation thresholds.
          </small>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Required Input</CardTitle>
          <CardDescription>Adjust weights or thresholds only when field evidence indicates routing drift.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {WEIGHT_FIELDS.map((field) => (
            <div key={field} className="grid gap-1">
              <small className="uppercase tracking-[0.12em] text-slate-400">{field}</small>
              <Input
                type="number"
                value={localWeights[field]}
                step="0.01"
                min="0"
                max="1"
                disabled={!canManage}
                onChange={(event) => onFieldChange(field, event.target.value)}
              />
            </div>
          ))}
          <div className="grid gap-1">
            <small className="uppercase tracking-[0.12em] text-slate-400">slaThresholdHours</small>
            <Input
              type="number"
              value={slaThresholdHours}
              min="1"
              max="720"
              disabled={!canManage}
              onChange={(event) => setSlaThresholdHours(Number(event.target.value))}
            />
          </div>
          <div className="grid gap-1">
            <small className="uppercase tracking-[0.12em] text-slate-400">interferenceMediumThreshold</small>
            <Input
              type="number"
              value={interferenceMediumThreshold}
              step="0.01"
              min="0"
              max="1"
              disabled={!canManage}
              onChange={(event) => setInterferenceMediumThreshold(Number(event.target.value))}
            />
          </div>
          <div className="grid gap-1">
            <small className="uppercase tracking-[0.12em] text-slate-400">interferenceHighThreshold</small>
            <Input
              type="number"
              value={interferenceHighThreshold}
              step="0.01"
              min="0"
              max="1"
              disabled={!canManage}
              onChange={(event) => setInterferenceHighThreshold(Number(event.target.value))}
            />
          </div>
          <div className="grid gap-1">
            <small className="uppercase tracking-[0.12em] text-slate-400">phaseReadinessAlertThreshold</small>
            <Input
              type="number"
              value={phaseReadinessAlertThreshold}
              step="0.01"
              min="0"
              max="1"
              disabled={!canManage}
              onChange={(event) => setPhaseReadinessAlertThreshold(Number(event.target.value))}
            />
          </div>
          <div className="grid gap-1">
            <small className="uppercase tracking-[0.12em] text-slate-400">pcfRefinementWeight</small>
            <Input
              type="number"
              value={pcfRefinementWeight}
              step="0.01"
              min="0"
              max="1"
              disabled={!canManage}
              onChange={(event) => setPcfRefinementWeight(Number(event.target.value))}
            />
          </div>
          <div className="grid gap-1">
            <small className="uppercase tracking-[0.12em] text-slate-400">reciprocityActivationThreshold</small>
            <Input
              type="number"
              value={reciprocityActivationThreshold}
              step="0.01"
              min="0"
              max="1"
              disabled={!canManage}
              onChange={(event) => setReciprocityActivationThreshold(Number(event.target.value))}
            />
          </div>
          {canManage ? (
            <Button
              onClick={() =>
                saveOntologyWeights({
                  ...localWeights,
                  slaThresholdHours,
                  interferenceMediumThreshold,
                  // High threshold cannot be lower than medium threshold, otherwise
                  // "high risk" detections would become unreachable or contradictory.
                  interferenceHighThreshold: Math.max(interferenceHighThreshold, interferenceMediumThreshold),
                  phaseReadinessAlertThreshold,
                  pcfRefinementWeight,
                  reciprocityActivationThreshold
                })
              }
            >
              Save Ontology Weights
            </Button>
          ) : (
            <small className="block text-slate-400">Current role cannot modify governance settings.</small>
          )}
          {actionError && <small className="block text-amber-300">{actionError}</small>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Primary Decision Outcome</CardTitle>
          <CardDescription>What atlas gives after governance changes are applied.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <small className="block text-slate-400">
            Changes are applied globally and captured in immutable audit entries for accountability.
          </small>
          <details className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <summary className="cursor-pointer text-slate-300">Show governance audit trail</summary>
            <div className="mt-3 space-y-2">
              {ontologyAudit.length === 0 ? (
                <small>No governance updates recorded yet.</small>
              ) : (
                ontologyAudit.slice(0, 10).map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                    <small className="block">Kind: {entry.kind || 'unknown'}</small>
                    <small className="block text-slate-400">
                      Actor: {entry.updatedByRole || 'unknown'} / {entry.updatedByUserId || 'unknown'}
                    </small>
                    <small className="block text-slate-400">When: {formatFirestoreTimestamp(entry.updatedAt)}</small>
                  </div>
                ))
              )}
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  )
}

