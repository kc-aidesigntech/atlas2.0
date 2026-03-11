import React, { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { canRolePerform } from '@/core/atlas2026/policy'
import { downloadCsv } from '@/services/atlas2026/export-service'

function formatFirestoreTimestamp(value) {
  if (!value) return 'No timestamp'
  const millis = typeof value?.toMillis === 'function' ? value.toMillis() : (value?.seconds || 0) * 1000
  if (!millis) return 'No timestamp'
  return new Date(millis).toLocaleString()
}

function EventList({ events }) {
  if (events.length === 0) return <small>No events available for this scope.</small>
  return events.map((event) => (
    <div
      key={event.id}
      className={`rounded-2xl border p-4 ${event.verified ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-slate-800 bg-slate-900'}`}
    >
      <p className="text-slate-100">{event.label ?? event.eventType}</p>
      <small className="block">Phase: {event.phase}</small>
      <small className="block">Verified: {event.verified ? 'Yes' : 'No'}</small>
      <small className="block text-slate-400">
        Actor: {event.createdByRole || 'unknown'} / {event.createdByUserId || 'unknown'}
      </small>
      <small className="block text-slate-400">
        Time: {formatFirestoreTimestamp(event.createdAt)}
        {event.optimistic ? ' (syncing...)' : ''}
      </small>
    </div>
  ))
}

export default function CollectiveMemoryPage({
  selectedRole,
  selectedParticipant,
  selectedMemoryView,
  selectedRenewalRoleRecord,
  civicBioSnapshot,
  appendMemoryEvent,
  assignRenewalRole,
  savingMemoryEvent,
  assigningRenewalRole,
  actionError
}) {
  const canAppend = canRolePerform(selectedRole, 'appendMemoryEvent')
  const canAssignRenewalRole = canRolePerform(selectedRole, 'assignRenewalRole')
  const [renewalRoleName, setRenewalRoleName] = useState(selectedRenewalRoleRecord?.roleName || 'peer-mentor')
  const [contributionDomain, setContributionDomain] = useState(selectedRenewalRoleRecord?.contributionDomain || 'community-care')
  const [assignmentNotes, setAssignmentNotes] = useState(selectedRenewalRoleRecord?.notes || '')
  const renewalActivationOpen = civicBioSnapshot.renewal.reciprocityIndex >= civicBioSnapshot.renewal.threshold
  const renewalRoles = useMemo(
    () => ['peer-mentor', 'community-steward', 'youth-guide', 'policy-advocate', 'stabilization-ambassador'],
    []
  )
  const participantEvents = selectedMemoryView.events.filter((event) => event.scope === 'participant')
  const stationEvents = selectedMemoryView.events.filter((event) => event.scope === 'station')
  const regionalEvents = selectedMemoryView.events.filter((event) => event.scope === 'regional')

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Context</CardTitle>
          <CardDescription>What has already been verified and what reciprocity state we are in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <small className="block text-slate-400">
            Verified: {selectedMemoryView.totals.verified} | Unverified: {selectedMemoryView.totals.unverified}
          </small>
          <small className="block text-slate-400">
            Reciprocity index: {(civicBioSnapshot.renewal.reciprocityIndex * 100).toFixed(1)}% / threshold{' '}
            {(civicBioSnapshot.renewal.threshold * 100).toFixed(1)}%
          </small>
          <small className={`block ${renewalActivationOpen ? 'text-emerald-300' : 'text-amber-300'}`}>
            {renewalActivationOpen ? 'Renewal gate open.' : 'Renewal gate not yet open.'}
          </small>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Required Input</CardTitle>
          <CardDescription>Capture one verified event or assign one renewal role.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {canAppend ? (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => appendMemoryEvent({ label: 'Milestone verified by ATLAS operator.', verified: true })}
                disabled={savingMemoryEvent}
              >
                {savingMemoryEvent ? 'Writing Event...' : 'Append Verified Milestone'}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  appendMemoryEvent({
                    label: 'Civic contribution receipt verified: participant contributed to community care action.',
                    verified: true
                  })
                }
                disabled={savingMemoryEvent}
              >
                Append Civic Contribution Receipt
              </Button>
            </div>
          ) : (
            <small className="block text-slate-400">Your role is read-only for memory updates.</small>
          )}
          {canAssignRenewalRole ? (
            <Button
              onClick={() =>
                assignRenewalRole({
                  roleName: renewalRoleName,
                  contributionDomain,
                  notes: assignmentNotes
                })
              }
              disabled={assigningRenewalRole}
            >
              {assigningRenewalRole ? 'assigning renewal role...' : 'assign renewal role'}
            </Button>
          ) : (
            <small className="block text-slate-400">Current role is read-only for renewal assignments.</small>
          )}
          <details className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <summary className="cursor-pointer text-slate-300">Show assignment fields</summary>
            <div className="mt-3 space-y-3">
              <small className="block text-slate-400">
                Participant: {selectedParticipant?.displayName || selectedParticipant?.participantId || 'unknown'}
              </small>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-1">
                  <small className="text-slate-400">Renewal role</small>
                  <Select value={renewalRoleName} onValueChange={setRenewalRoleName}>
                    <SelectTrigger>
                      <SelectValue placeholder="select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {renewalRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <small className="text-slate-400">Contribution domain</small>
                  <Input value={contributionDomain} onChange={(event) => setContributionDomain(event.target.value)} />
                </div>
              </div>
              <div className="grid gap-1">
                <small className="text-slate-400">Notes</small>
                <Input value={assignmentNotes} onChange={(event) => setAssignmentNotes(event.target.value)} />
              </div>
            </div>
          </details>
          <small className="block text-slate-400">{civicBioSnapshot.renewal.reciprocityEthos}</small>
          {actionError && <small className="mt-2 block text-amber-300">{actionError}</small>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Primary Decision Outcome</CardTitle>
          <CardDescription>What atlas gives back after verification and assignment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedRenewalRoleRecord ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <small className="block text-slate-100">Active assignment: {selectedRenewalRoleRecord.roleName}</small>
              <small className="block text-slate-400">Domain: {selectedRenewalRoleRecord.contributionDomain}</small>
              <small className="block text-slate-400">Status: {selectedRenewalRoleRecord.status}</small>
              <small className="block text-slate-400">Updated: {formatFirestoreTimestamp(selectedRenewalRoleRecord.updatedAt)}</small>
            </div>
          ) : (
            <small>No renewal role assignment recorded yet.</small>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => downloadCsv(selectedMemoryView.events, 'atlas-memory-events.csv')}>
              Export Memory Events CSV
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  [
                    {
                      verified: selectedMemoryView.totals.verified,
                      unverified: selectedMemoryView.totals.unverified,
                      recentWindowCount: selectedMemoryView.recentWindowCount,
                      byScope: JSON.stringify(selectedMemoryView.totals.byScope),
                      byType: JSON.stringify(selectedMemoryView.byType)
                    }
                  ],
                  'atlas-memory-rollup.csv'
                )
              }
            >
              Export Memory Rollup CSV
            </Button>
          </div>
          <details className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <summary className="cursor-pointer text-slate-300">Show receipts and strip views</summary>
            <div className="mt-3 space-y-3">
              {civicBioSnapshot.renewal.receipts.length === 0 ? (
                <small>No renewal receipts verified yet.</small>
              ) : (
                civicBioSnapshot.renewal.receipts.map((receipt) => (
                  <div key={receipt.id} className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                    <small className="block text-slate-100">{receipt.label}</small>
                    <small className="block text-slate-400">Phase: {receipt.phase}</small>
                    <small className="block text-slate-400">Time: {formatFirestoreTimestamp(receipt.createdAt)}</small>
                  </div>
                ))
              )}
              <Tabs defaultValue="participant" className="w-full">
                <TabsList>
                  <TabsTrigger value="participant">Participant</TabsTrigger>
                  <TabsTrigger value="station">Station</TabsTrigger>
                  <TabsTrigger value="regional">Regional</TabsTrigger>
                </TabsList>
                <TabsContent value="participant" className="mt-3 space-y-3">
                  <EventList events={participantEvents} />
                </TabsContent>
                <TabsContent value="station" className="mt-3 space-y-3">
                  <EventList events={stationEvents} />
                </TabsContent>
                <TabsContent value="regional" className="mt-3 space-y-3">
                  <EventList events={regionalEvents} />
                </TabsContent>
              </Tabs>
            </div>
          </details>
          <small className="block text-slate-400">
            Events (7-day): {selectedMemoryView.recentWindowCount} | Types:{' '}
            {Object.entries(selectedMemoryView.byType)
              .map(([key, count]) => `${key}:${count}`)
              .join(' | ') || 'none'}
          </small>
          <small className="block text-slate-400">
            Scope totals - participant: {selectedMemoryView.totals.byScope.participant || 0}, station:{' '}
            {selectedMemoryView.totals.byScope.station || 0}, regional: {selectedMemoryView.totals.byScope.regional || 0}
          </small>
        </CardContent>
      </Card>
    </div>
  )
}

