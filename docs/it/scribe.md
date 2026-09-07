# Atlas Scribe Runbook

Atlas Scribe is the point-of-care listening subapp: record an encounter,
transcribe the conversation, and draft a Subjective, Objective, Assessment,
Plan (SOAP) note for clinician review. This runbook documents the deployed
state, configuration, and the tabled follow-up work.

## Current launch state (since 2026-09-07, release v51)

Scribe is live in **manual mode**. The transcription and note-generation
backends are intentionally tabled (see "Tabled follow-up work" below), so:

- The record button, timer, and chunk pipeline run, but every audio chunk
  reports "failed" because no transcription backend is configured.
- Clinicians type or paste into the transcript and SOAP sections directly.
- Saving, draft/final status, encounter history, and owner-only privacy work
  fully against Supabase.
- Audio is never persisted anywhere in any mode; recording segments live in
  browser memory only and are discarded after the transcription attempt.

## Access

- Path route: `https://<atlas-host>/scribe` (Supabase session required).
- Workspace menu: a "scribe" top-menu entry is seeded for navigator,
  supervisor, and administrator roles in `atlas.app_role_navigation`
  (partner role intentionally excluded).
- Optional subdomain: set `VITE_ATLAS_SCRIBE_HOSTNAME` (e.g.
  `scribe.example.org`), add the custom domain to the Heroku app, and create a
  Domain Name System (DNS) CNAME. Without it, the path route is canonical.

## Data and security

- Table: `atlas.scribe_encounters`
  (migration `20260808120000_atlas_scribe_encounters.sql`).
- Row-Level Security (RLS): owner-only select/insert/update/delete via
  `created_by = auth.uid()`. No cross-user read path exists. See
  [rls-inventory.md](./rls-inventory.md).
- Only transcript text and note sections are stored — never audio.

## Code map

- Page: `src/features/atlas2026/scribe/StandaloneScribePage.tsx`
- Recorder: `src/features/atlas2026/scribe/useScribeRecorder.ts` (rotates
  MediaRecorder every ~45 seconds so each segment is an independently
  decodable file; avoids Heroku's 30-second router timeout per request).
- Persistence: `src/features/atlas2026/scribe/data-access/scribeEncountersRepository.ts`
- Model Context Protocol (MCP) clients:
  `src/services/atlas2026/transcribeAudioService.ts`,
  `src/services/atlas2026/generateSoapNoteService.ts` (both fall back
  gracefully when the backend is absent).
- Routing/host detection: `src/RootApp.jsx`.
- Menu handoff: `handleMenuSelect` in
  `src/features/atlas2026/singlepane/shell/SinglePaneWorkspace.tsx`.

## Tabled follow-up work (not critical for launch, decided 2026-09-07)

Enabling the full record → transcribe → SOAP pipeline requires, in order:

1. RunPod Graphics Processing Unit (GPU) pod running Ollama
   (`qwen2.5:3b-instruct`) and a Whisper server (speaches) — see the sibling
   repo's `atlas-mcp-server/Runpod_VM.md`.
2. Deploy the sibling `atlas-mcp-server` with its `/transcribe` and
   `/generate-soap-note` endpoints (implemented in `src/server.mjs`, currently
   uncommitted there) and set `OLLAMA_BASE_URL`, `WHISPER_BASE_URL`,
   `WHISPER_MODEL` on that Heroku app.
3. Set `VITE_ATLAS_MCP_BASE_URL` and `VITE_ATLAS_MCP_BEARER` on
   `atlas-simplified` and redeploy so Vite embeds them.

No frontend code changes are needed — the services light up when the
environment variables exist. Contracts are documented in
[mcp-consumer.md](./mcp-consumer.md).

## Verification checklist

1. Open `/scribe`, sign in, and confirm the page renders with the record
   panel and empty history.
2. Record a few seconds, stop, and confirm the fallback note appears and can
   be edited and saved as draft/final.
3. Reload and confirm the encounter appears in history; confirm a second
   account cannot see it.
4. From the workspace, confirm the "scribe" menu entry navigates to the
   subapp for navigator/supervisor/administrator roles.

## Troubleshooting

- `404` on `rest/v1/scribe_encounters`: migration not applied to the target
  Supabase project.
- All transcription chunks fail: expected in manual mode; otherwise check
  `VITE_ATLAS_MCP_BASE_URL`, bearer parity, and MCP `/health`.
- History empty after saving: confirm the user has an authenticated session;
  anonymous sessions are denied by RLS by design.
- Supabase hostname returns NXDOMAIN and queries time out: the project is
  paused (observed 2026-09-06 after ~3 weeks idle); restore it in the
  Supabase dashboard.
