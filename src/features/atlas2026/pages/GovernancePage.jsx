import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { canRolePerform } from '@/core/atlas2026/policy'

const WEIGHT_FIELDS = [
  'coverageWeight',
  'phaseAlignmentWeight',
  'specializationWeight',
  'reversibilityWeight',
  'transferCostPenalty',
  'interferencePenalty'
]

function formatFirestoreTimestamp(value) {
  if (!value) return 'No timestamp'
  const millis = typeof value?.toMillis === 'function' ? value.toMillis() : (value?.seconds || 0) * 1000
  if (!millis) return 'No timestamp'
  return new Date(millis).toLocaleString()
}

export default function GovernancePage({ selectedRole, ontologyWeights, ontologyAudit, saveOntologyWeights, actionError }) {
  const [localWeights, setLocalWeights] = useState(ontologyWeights)
  const canManage = canRolePerform(selectedRole, 'manageOntology')

  useEffect(() => {
    setLocalWeights(ontologyWeights)
  }, [ontologyWeights])

  const onFieldChange = (field, value) => {
    setLocalWeights((current) => ({
      ...current,
      [field]: Number(value)
    }))
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Governance and Ontology Controls</CardTitle>
          <CardDescription>SRIG-aligned controls for routing weight calibration and policy boundaries.</CardDescription>
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
          {canManage ? (
            <Button onClick={() => saveOntologyWeights(localWeights)}>Save Ontology Weights</Button>
          ) : (
            <small className="block text-slate-400">Current role cannot modify governance settings.</small>
          )}
          {actionError && <small className="block text-amber-300">{actionError}</small>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Governance Audit Trail</CardTitle>
          <CardDescription>Recent ontology changes with actor attribution.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {ontologyAudit.length === 0 ? (
            <small>No governance updates recorded yet.</small>
          ) : (
            ontologyAudit.slice(0, 10).map((entry) => (
              <div key={entry.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <small className="block">Kind: {entry.kind || 'unknown'}</small>
                <small className="block text-slate-400">
                  Actor: {entry.updatedByRole || 'unknown'} / {entry.updatedByUserId || 'unknown'}
                </small>
                <small className="block text-slate-400">When: {formatFirestoreTimestamp(entry.updatedAt)}</small>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

