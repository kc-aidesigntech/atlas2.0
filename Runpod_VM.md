# RunPod Virtual Machine Integration for Atlas

This guide explains how Atlas consumes the deployed `atlas-mcp-server` stack where the Model Context Protocol (MCP) service runs on Heroku and Ollama runs on a RunPod Virtual Machine (VM) behind Caddy.

## System Topology

1. Atlas web frontend calls MCP endpoint:
   - `POST /infer-zcodes`
2. MCP service runs on Heroku.
3. MCP service calls Ollama through:
   - `OLLAMA_BASE_URL=https://ollama.<your-domain>`
4. Caddy reverse-proxies `https://ollama.<your-domain>` to `127.0.0.1:11434` on the RunPod VM.
5. Ollama serves `qwen2.5:3b-instruct`.

## Known-good RunPod profile

For reliable deployment and startup, use:

- NVIDIA GeForce RTX 4090
- Template `runpod-torch-v240`
- Image: template-managed image from `runpod-torch-v240` (as shown in RunPod pod details)
- 20 gigabytes (GB) volume mounted at `/workspace`
- 20 GB container disk
- 16 virtual central processing unit (vCPU), 62 GB memory
- Exposed ports in current working setup:
  - HTTP `8888`
  - TCP `22` (through RunPod mapped external port)
- Container start args `bash -lc "while true; do sleep 3600; done"`

This profile avoids the CUDA driver mismatch failures seen with newer `runpod/pytorch` CUDA 12.8/12.9 images on some hosts.

## Deployment Ownership

- **Atlas repo**
  - frontend environment variables
  - referral flow integration and consumption of inference response
- **atlas-mcp-server repo**
  - MCP endpoint deployment on Heroku
  - Ollama host routing and security configuration

Use the detailed infrastructure runbook in `atlas-mcp-server/Runpod_VM.md` for:

- Secure Shell (SSH) bring-up sequence
- Apt package manager (APT) repository cleanup for flaky `deadsnakes` entries
- Ollama installation and model pull commands
- Caddy reverse proxy setup and HyperText Transfer Protocol Secure (HTTPS) validation
- Heroku environment variable wiring for MCP

Current pricing snapshot from the active pod:

- compute `$0.69/hr`
- container storage `$0.003/hr` (20 GB)
- volume storage `$0.003/hr` (20 GB)
- total `$0.70/hr`

## Required Atlas environment variables

Set in the Atlas deployment environment:

- `VITE_ATLAS_DEMO_INFERENCE_URL=https://<mcp-heroku-app>.herokuapp.com/infer-zcodes`
- `VITE_ATLAS_DEMO_INFERENCE_BEARER=<shared-long-random-token>`

The bearer token must match `ATLAS_MCP_BEARER_TOKEN` in MCP Heroku config.

## Atlas smoke test after MCP deploy

1. Open demo flow in Atlas.
2. Submit a referral through partner referral form.
3. Claim pickup queue item as navigator.
4. Confirm inferred Z-codes appear on enrollee profile.
5. Confirm partner view reflects progress and unresolved burden categories.

## Failure triage

If Atlas inference does not appear:

1. Check browser network call to `VITE_ATLAS_DEMO_INFERENCE_URL`.
2. Check MCP Heroku logs:
   - request received
   - Ollama upstream response status
3. Check RunPod Caddy endpoint:
   - `curl https://ollama.<your-domain>/api/tags`
4. Confirm bearer token parity between Atlas and MCP.

## Security posture

- Keep service secrets out of `VITE_*` values except the MCP bearer token explicitly intended for frontend-to-MCP access in this demo architecture.
- Do not expose Supabase service keys in frontend runtime.
- Restrict `ATLAS_MCP_ALLOWED_ORIGINS` to Atlas web origin(s).
