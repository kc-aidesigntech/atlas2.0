# Atlas Model Context Protocol Consumer Handshake

This Atlas runbook documents only the web application's handshake with the deployed Model Context Protocol (MCP) service. The sibling `atlas-mcp-server` repository owns MCP deployment and the Graphics Processing Unit (GPU) infrastructure behind it.

For RunPod, Ollama, Caddy, Secure Shell (SSH), ports, pod sizing, startup commands, and MCP-side Heroku configuration, use `../atlas-mcp-server/Runpod_VM.md` (the sibling repo's `Runpod_VM.md`).

## Deployed application identity

- Atlas web Heroku app: `atlas-simplified`
- MCP Heroku app: `atlas-mcp-server`
- MCP Uniform Resource Locator (URL): `https://atlas-mcp-server-1117efe08e58.herokuapp.com`

Atlas calls these MCP routes:

- `POST /infer-zcodes` for referral Z-code inference
- `POST /summarize-create-session` for Connect, Recognize, Encourage, Acknowledge, Train, and Empower (C.R.E.A.T.E.) supervisor reflection
- `POST /transcribe` for Atlas Scribe audio chunk transcription (Whisper on the RunPod Virtual Machine (VM))
- `POST /generate-soap-note` for Atlas Scribe Subjective, Objective, Assessment, Plan (SOAP) note generation (Ollama)

## Required Atlas environment variables

Set only these MCP variables on `atlas-simplified`, then redeploy so Vite embeds them:

```dotenv
VITE_ATLAS_MCP_BASE_URL=https://atlas-mcp-server-1117efe08e58.herokuapp.com
VITE_ATLAS_MCP_BEARER=<shared-long-random-token>
```

`VITE_ATLAS_MCP_BEARER` must match `ATLAS_MCP_BEARER_TOKEN` on `atlas-mcp-server`. Atlas appends the route paths above to `VITE_ATLAS_MCP_BASE_URL`.

The former `VITE_ATLAS_DEMO_INFERENCE_*` variables and `VITE_ATLAS_CREATE_REFLECTION_URL` are legacy and are no longer Atlas configuration guidance.

## Consumer contracts

The MCP app owns endpoint implementation, prompt behavior, model routing, and upstream Ollama availability. Atlas owns request construction, bearer authentication, response consumption, and user-facing fallback behavior.

For `POST /summarize-create-session`, Atlas sends `navigatorName`, `supervisorName`, and up to 10 chronological `sessions` containing the saved C.R.E.A.T.E. fields. It expects:

```json
{ "reflectionText": "3–4 sentence supervisor-to-navigator reflection…", "model": "qwen2.5:3b-instruct" }
```

If MCP or Ollama is unavailable, Atlas uses the deterministic local reflection fallback in `createReflectionService.ts`.

For `POST /transcribe` (Atlas Scribe), Atlas sends one recorded audio segment per request as JavaScript Object Notation (JSON):

```json
{ "audioBase64": "<base64 WebM/Opus or MP4 audio>", "mimeType": "audio/webm;codecs=opus", "language": "en" }
```

and expects `{ "text": "transcribed speech…", "model": "Systran/faster-whisper-small" }`. Segments are ~45 seconds so each request completes well inside Heroku's 30-second router timeout. Audio is processed in memory only on both sides; it is never persisted.

For `POST /generate-soap-note` (Atlas Scribe), Atlas sends:

```json
{ "transcript": "full assembled conversation transcript", "encounterContext": "optional label" }
```

and expects `{ "subjective": "…", "objective": "…", "assessment": "…", "plan": "…", "model": "qwen2.5:3b-instruct", "fallback": false }`. If MCP or Ollama is unavailable, Atlas uses the transcript-preserving local fallback in `generateSoapNoteService.ts` so the encounter is never lost.

The MCP app reaches Whisper via its own `WHISPER_BASE_URL` environment variable (see the sibling repo's `Runpod_VM.md` for the Whisper server deployment).

## Atlas verification

1. Confirm browser requests target `{VITE_ATLAS_MCP_BASE_URL}/infer-zcodes` and `{VITE_ATLAS_MCP_BASE_URL}/summarize-create-session`.
2. Confirm each request sends `Authorization: Bearer <VITE_ATLAS_MCP_BEARER>`.
3. Submit a referral and verify inferred Z-codes appear on the enrollee profile.
4. Save a C.R.E.A.T.E. session and verify the generated reflection appears.
5. Confirm the local reflection fallback still appears when MCP is unavailable.
6. Open `/scribe`, record a short test conversation, and verify transcript text streams in per chunk and a SOAP draft appears after stop.
7. Confirm the scribe transcript-preserving fallback note appears when MCP or Ollama is unavailable.

For MCP logs, allowed origins, bearer-token parity, RunPod connectivity, or Ollama failures, continue troubleshooting in `../atlas-mcp-server/Runpod_VM.md`.

## Security posture

- Treat `VITE_ATLAS_MCP_BEARER` as a browser-visible demo credential, not a server-side secret.
- Do not expose Supabase service keys or other privileged credentials in frontend runtime variables.
- Configure allowed Atlas origins in the MCP app as documented by the sibling repository.
