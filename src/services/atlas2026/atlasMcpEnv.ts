/**
 * Atlas → Heroku Model Context Protocol (MCP) client env.
 * Prefer VITE_ATLAS_MCP_*; fall back to legacy demo/reflection names.
 */

const LOCAL_MCP_BASE = 'http://localhost:4310'

function trimEnv(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '')
}

/** Shared bearer; must match ATLAS_MCP_BEARER_TOKEN on atlas-mcp-server. */
export function getAtlasMcpBearer(): string {
  return (
    trimEnv(import.meta.env.VITE_ATLAS_MCP_BEARER) ||
    trimEnv(import.meta.env.VITE_ATLAS_DEMO_INFERENCE_BEARER)
  )
}

/** MCP origin, e.g. https://atlas-mcp-server-….herokuapp.com */
export function getAtlasMcpBaseUrl(): string {
  const base = stripTrailingSlash(trimEnv(import.meta.env.VITE_ATLAS_MCP_BASE_URL))
  if (base) return base
  return LOCAL_MCP_BASE
}

export function getInferZcodesUrl(): string {
  const fromBase = trimEnv(import.meta.env.VITE_ATLAS_MCP_BASE_URL)
  if (fromBase) return `${stripTrailingSlash(fromBase)}/infer-zcodes`
  // Legacy: full path to /infer-zcodes
  const legacy = trimEnv(import.meta.env.VITE_ATLAS_DEMO_INFERENCE_URL)
  if (legacy) return legacy
  return `${LOCAL_MCP_BASE}/infer-zcodes`
}

export function getSummarizeCreateSessionUrl(): string {
  const fromBase = trimEnv(import.meta.env.VITE_ATLAS_MCP_BASE_URL)
  if (fromBase) return `${stripTrailingSlash(fromBase)}/summarize-create-session`
  // Legacy: full path to /summarize-create-session
  const legacy = trimEnv(import.meta.env.VITE_ATLAS_CREATE_REFLECTION_URL)
  if (legacy) return legacy
  return `${LOCAL_MCP_BASE}/summarize-create-session`
}
