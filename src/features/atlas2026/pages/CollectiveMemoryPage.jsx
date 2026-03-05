import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  selectedMemoryView,
  appendMemoryEvent,
  savingMemoryEvent,
  actionError
}) {
  const canAppend = canRolePerform(selectedRole, 'appendMemoryEvent')
  const participantEvents = selectedMemoryView.events.filter((event) => event.scope === 'participant')
  const stationEvents = selectedMemoryView.events.filter((event) => event.scope === 'station')
  const regionalEvents = selectedMemoryView.events.filter((event) => event.scope === 'regional')

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Collective Memory Controls</CardTitle>
          <CardDescription>Verified milestones become shared memory at participant, station, and regional scopes.</CardDescription>
        </CardHeader>
        <CardContent>
          {canAppend ? (
            <Button
              onClick={() => appendMemoryEvent({ label: 'Milestone verified by ATLAS operator.', verified: true })}
              disabled={savingMemoryEvent}
            >
              {savingMemoryEvent ? 'Writing Event...' : 'Append Verified Milestone'}
            </Button>
          ) : (
            <small className="block text-slate-400">Your role is read-only for memory updates.</small>
          )}
          {actionError && <small className="mt-2 block text-amber-300">{actionError}</small>}
          <small className="mt-3 block text-slate-400">
            Verified: {selectedMemoryView.totals.verified} | Unverified: {selectedMemoryView.totals.unverified}
          </small>
          <small className="block text-slate-400">Events (7-day window): {selectedMemoryView.recentWindowCount}</small>
          <small className="block text-slate-400">
            Scope totals - participant: {selectedMemoryView.totals.byScope.participant || 0}, station:{' '}
            {selectedMemoryView.totals.byScope.station || 0}, regional: {selectedMemoryView.totals.byScope.regional || 0}
          </small>
          <small className="block text-slate-400">
            Event types: {Object.entries(selectedMemoryView.byType).map(([key, count]) => `${key}:${count}`).join(' | ') || 'none'}
          </small>
          <div className="mt-3 flex flex-wrap gap-2">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Memory Strip Views</CardTitle>
          <CardDescription>Scope-specific readouts of the same event stream.</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  )
}

