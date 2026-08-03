const DEBUG_WORKSPACE_LOAD_METRICS =
  typeof window !== 'undefined' &&
  (window as { __ATLAS_DEBUG_WORKSPACE_LOAD__?: boolean }).__ATLAS_DEBUG_WORKSPACE_LOAD__ === true

const START_KEY = 'workspace-open:start'

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

function mark(name: string) {
  if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
    performance.mark(name)
  }
}

function measure(name: string, startMark: string, endMark: string) {
  if (typeof performance !== 'undefined' && typeof performance.measure === 'function') {
    try {
      performance.measure(name, startMark, endMark)
    } catch {
      // Ignore duplicate/missing marks so instrumentation never affects runtime behavior.
    }
  }
}

/**
 * Workspace-open timing markers for optimization work. This is intentionally tiny:
 * marks are always cheap, while console output is opt-in via
 * `window.__ATLAS_DEBUG_WORKSPACE_LOAD__ = true`.
 *
 * Practical baseline method:
 * - Cold: open a new private window, load `/app`, record these marks once auth is complete.
 * - Warm: refresh the same `/app` tab after the first open, then compare the same marks.
 * - Repeat 3 times each and compare medians, not single runs.
 */
export const workspaceLoadMetrics = {
  markRouteOpen(pathname: string) {
    mark(START_KEY)
    mark('workspace-open:route-open')
    if (DEBUG_WORKSPACE_LOAD_METRICS && pathname.startsWith('/app')) {
      console.info('[workspace-load]', 'route-open', pathname)
    }
  },
  // Auth session resolved (signed in or not). Compare against chunk-ready to see
  // whether cold open is waiting on getSession vs downloading SinglePaneApp.
  markAuthReady(hasSession: boolean) {
    mark('workspace-open:auth-ready')
    measure('workspace-open:time-to-auth-ready', START_KEY, 'workspace-open:auth-ready')
    if (DEBUG_WORKSPACE_LOAD_METRICS) {
      console.info('[workspace-load]', 'auth-ready', {
        hasSession,
        timeToAuthReadyMs: readMeasureDuration('workspace-open:time-to-auth-ready')
      })
    }
  },
  // Workspace JS chunk finished loading (prefetch or Suspense). Useful when
  // overlapping download with the auth gate.
  markWorkspaceChunkReady() {
    mark('workspace-open:workspace-chunk-ready')
    measure('workspace-open:time-to-workspace-chunk', START_KEY, 'workspace-open:workspace-chunk-ready')
    if (DEBUG_WORKSPACE_LOAD_METRICS) {
      console.info('[workspace-load]', 'workspace-chunk-ready', {
        timeToWorkspaceChunkMs: readMeasureDuration('workspace-open:time-to-workspace-chunk')
      })
    }
  },
  markBootstrapStart(role: string) {
    mark('workspace-open:bootstrap-start')
    if (DEBUG_WORKSPACE_LOAD_METRICS) {
      console.info('[workspace-load]', 'bootstrap-start', role)
    }
  },
  markBootstrapEnd(role: string) {
    mark('workspace-open:bootstrap-end')
    measure('workspace-open:bootstrap-duration', 'workspace-open:bootstrap-start', 'workspace-open:bootstrap-end')
    if (DEBUG_WORKSPACE_LOAD_METRICS) {
      console.info('[workspace-load]', 'bootstrap-end', role)
    }
  },
  markFirstUsable(role: string) {
    mark('workspace-open:first-usable')
    measure('workspace-open:time-to-first-usable', START_KEY, 'workspace-open:first-usable')
    if (!DEBUG_WORKSPACE_LOAD_METRICS) return
    const bootstrap = readMeasureDuration('workspace-open:bootstrap-duration')
    const firstUsable = readMeasureDuration('workspace-open:time-to-first-usable')
    const authReady = readMeasureDuration('workspace-open:time-to-auth-ready')
    const workspaceChunk = readMeasureDuration('workspace-open:time-to-workspace-chunk')
    console.info('[workspace-load]', 'first-usable', role, {
      bootstrapMs: bootstrap,
      timeToFirstUsableMs: firstUsable,
      timeToAuthReadyMs: authReady,
      timeToWorkspaceChunkMs: workspaceChunk
    })
  }
}

function readMeasureDuration(name: string) {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByName !== 'function') {
    return Math.round(nowMs())
  }
  const entries = performance.getEntriesByName(name, 'measure')
  const latest = entries[entries.length - 1]
  return latest ? Math.round(latest.duration) : null
}
