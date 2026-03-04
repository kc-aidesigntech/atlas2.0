import React, { useState } from 'react'
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

export default function GovernancePage({ selectedRole, ontologyWeights, saveOntologyWeights, actionError }) {
  const [localWeights, setLocalWeights] = useState(ontologyWeights)
  const canManage = canRolePerform(selectedRole, 'manageOntology')

  const onFieldChange = (field, value) => {
    setLocalWeights((current) => ({
      ...current,
      [field]: Number(value)
    }))
  }

  return (
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
  )
}

