#!/usr/bin/env node
/**
 * Exercise real C.R.E.A.T.E. reflection generation for the pilot session.
 *
 * Does NOT invent narrative SQL. Calls the same MCP contract Atlas uses:
 *   POST /summarize-create-session → RunPod Ollama qwen2.5:3b-instruct
 *
 * Env:
 *   VITE_ATLAS_CREATE_REFLECTION_URL  (or ATLAS_CREATE_REFLECTION_URL)
 *   VITE_ATLAS_DEMO_INFERENCE_BEARER  (or ATLAS_MCP_BEARER_TOKEN)
 *
 * Exit codes:
 *   0 — MCP returned reflectionText (prints JSON + optional upsert SQL stub)
 *   2 — MCP unreachable / empty response (no DB write; fail closed)
 *
 * Usage:
 *   node verification/generate_pilot_create_reflection.mjs
 */

const SESSION_ID = 'a11ce0c7-0000-4000-8000-000000000001'

const endpoint = (
  process.env.ATLAS_CREATE_REFLECTION_URL ||
  process.env.VITE_ATLAS_CREATE_REFLECTION_URL ||
  'http://localhost:4310/summarize-create-session'
).trim()

const bearer = (
  process.env.ATLAS_MCP_BEARER_TOKEN ||
  process.env.VITE_ATLAS_DEMO_INFERENCE_BEARER ||
  ''
).trim()

// Payload mirrors the seeded pilot C.R.E.A.T.E. session notes (form data, not a reflection).
const payload = {
  navigatorName: 'Pilot Navigator',
  supervisorName: 'Pilot Supervisor',
  sessions: [
    {
      id: SESSION_ID,
      sessionAtIso: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      supervisionMode: 'in_person',
      sessionDurationMinutes: 55,
      connectFocusedListening: true,
      recognizeNotes:
        'You are building genuine warmth with Sandra and Marcus — enrollee IPSCC scores are climbing because people feel seen, not managed. I especially noticed how you named shared ground before problem-solving.',
      encourageNotes:
        'Housing follow-through and transportation friction still pull you into fixing mode under time pressure. When that happens, slow down and ask what the service user already knows before offering options.',
      acknowledgeNotes:
        'You advocated clearly in interdisciplinary updates this week and invited Marcus into the plan instead of speaking for him. That mutuality is leadership worth naming out loud.',
      trainNotes:
        'Practice one co-learning opener in every encounter this week: “What have you already tried?” Then stay with their answer for two full sentences before adding anything of yours.',
      empowerNotes:
        'You asked for clearer prep time before supervision and for a simple checklist when coordinating partner handoffs — both are fair. I will protect that prep block on our calendar and share the handoff template tomorrow.',
      createActionPlan:
        'Before next supervision: (1) use the co-learning opener with both assigned enrollees, (2) jot one reconnect moment when disconnection shows up, (3) bring one sticky encounter for us to unpack without rushing to solutions.',
      supervisorSubmission:
        'Pilot Navigator is showing strong connection and mutuality with assigned enrollees, and enrollee opinion of the work is trending upward. The growth edge is staying in learning-together when logistics get loud. We agreed on a concrete practice target and the supports I will provide so the plan is doable, not aspirational.',
      superviseeSubmission:
        'I want tighter feedback when I slip into advising, and I want help noticing disconnect earlier with Sandra when conversations go flat. The co-learning opener feels usable this week.'
    }
  ]
}

async function main() {
  console.log(`Calling ${endpoint} …`)
  const headers = { 'content-type': 'application/json' }
  if (bearer) headers.authorization = `Bearer ${bearer}`

  let response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })
  } catch (error) {
    console.error('MCP request failed (network). No reflection was written.')
    console.error(error instanceof Error ? error.message : error)
    console.error(
      'Bring up atlas-mcp-server POST /summarize-create-session (Ollama qwen2.5:3b-instruct), then re-run.'
    )
    process.exit(2)
  }

  if (!response.ok) {
    console.error(`MCP returned HTTP ${response.status}. No reflection was written.`)
    const body = await response.text().catch(() => '')
    if (body) console.error(body.slice(0, 500))
    process.exit(2)
  }

  const data = await response.json()
  const reflectionText = typeof data?.reflectionText === 'string' ? data.reflectionText.trim() : ''
  const model =
    typeof data?.model === 'string' && data.model.trim() ? data.model.trim() : 'qwen2.5:3b-instruct'

  if (!reflectionText) {
    console.error('MCP response missing reflectionText. No reflection was written.')
    process.exit(2)
  }

  const result = {
    navigatorName: 'Pilot Navigator',
    reflectionText,
    model,
    sourceSessionId: SESSION_ID,
    usedFallback: false
  }
  console.log(JSON.stringify(result, null, 2))
  console.log('\n-- Persist only after a real MCP success (paste into Supabase SQL or wire a service-role upsert):')
  console.log(`delete from atlas.navigator_create_reflections where lower(navigator_name) = 'pilot navigator';`)
  console.log(`insert into atlas.navigator_create_reflections (
  id, navigator_name, reflection_text, generated_reflection_text, source_session_ids, source_latest_session_id,
  model, generated_at, supervisor_overridden_at, supervisor_overridden_by, created_at, updated_at
) values (
  'a11ce0c7-0000-4000-8000-0000000000f1',
  'Pilot Navigator',
  ${sqlString(reflectionText)},
  ${sqlString(reflectionText)},
  jsonb_build_array('${SESSION_ID}'),
  '${SESSION_ID}',
  ${sqlString(model)},
  now(),
  null,
  '',
  now(),
  now()
);`)
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

main()
