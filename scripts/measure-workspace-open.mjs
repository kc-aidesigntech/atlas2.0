import { chromium } from 'playwright'

const base = process.env.ATLAS_PREVIEW_URL || 'http://localhost:4173'
const email = process.env.ATLAS_TEST_EMAIL || 'pilot.navigator@atlas.test'
const password = process.env.ATLAS_TEST_PASSWORD || 'AtlasPilot2026!'

async function measureRun(label, { freshContext }) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  if (freshContext) {
    await context.clearCookies()
  }

  const navStart = Date.now()
  await page.goto(`${base}/app`, { waitUntil: 'domcontentloaded' })

  // If we land on auth, sign in so bootstrap can complete.
  const needsAuth = await page
    .locator('input[type="email"]')
    .isVisible({ timeout: 8000 })
    .catch(() => false)

  if (needsAuth) {
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(password)
    await page.getByRole('button', { name: /sign in with email/i }).click()
  }

  await page.waitForFunction(
    () => {
      const text = document.body?.innerText?.toLowerCase() || ''
      const hasFirstUsable = performance.getEntriesByName('workspace-open:first-usable', 'mark').length > 0
      const hasBootstrapEnd = performance.getEntriesByName('workspace-open:bootstrap-end', 'mark').length > 0
      const hasWorkspaceChrome =
        text.includes('my profile') ||
        text.includes('assignment') ||
        text.includes('route planning') ||
        text.includes('enrollee') ||
        text.includes('navigator')
      const authFailed = text.includes('invalid login credentials') || text.includes('email not confirmed')
      return hasFirstUsable || hasBootstrapEnd || hasWorkspaceChrome || authFailed
    },
    { timeout: 45000 }
  )

  const metrics = await page.evaluate(() => {
    const measures = performance
      .getEntriesByType('measure')
      .filter((entry) => entry.name.startsWith('workspace-open:'))
      .map(({ name, duration }) => ({ name, duration: Math.round(duration) }))
    const nav = performance.getEntriesByType('navigation')[0]
    const text = (document.body?.innerText || '').toLowerCase()
    return {
      measures,
      domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      loadEventEndMs: nav ? Math.round(nav.loadEventEnd) : null,
      authFailed: text.includes('invalid login credentials') || text.includes('email not confirmed'),
      reachedFirstUsable: performance.getEntriesByName('workspace-open:first-usable', 'mark').length > 0,
      reachedBootstrapEnd: performance.getEntriesByName('workspace-open:bootstrap-end', 'mark').length > 0
    }
  })

  const elapsed = Date.now() - navStart
  await browser.close()
  return { label, elapsed, ...metrics }
}

function median(nums) {
  const sorted = [...nums].filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (!sorted.length) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

function pickMeasure(runs, name) {
  return runs.map((run) => run.measures.find((measure) => measure.name === name)?.duration).filter((v) => v != null)
}

const coldRuns = []
for (let i = 1; i <= 3; i++) {
  coldRuns.push(await measureRun(`cold-${i}`, { freshContext: true }))
}

const warmRuns = []
for (let i = 1; i <= 3; i++) {
  warmRuns.push(await measureRun(`warm-${i}`, { freshContext: false }))
}

const summary = {
  cold: {
    medians: {
      timeToFirstUsableMs: median(pickMeasure(coldRuns, 'workspace-open:time-to-first-usable')),
      bootstrapDurationMs: median(pickMeasure(coldRuns, 'workspace-open:bootstrap-duration')),
      authReadyMs: median(pickMeasure(coldRuns, 'workspace-open:time-to-auth-ready')),
      workspaceChunkMs: median(pickMeasure(coldRuns, 'workspace-open:time-to-workspace-chunk')),
      domContentLoadedMs: median(coldRuns.map((run) => run.domContentLoadedMs)),
      elapsedMs: median(coldRuns.map((run) => run.elapsed))
    },
    runs: coldRuns
  },
  warm: {
    medians: {
      timeToFirstUsableMs: median(pickMeasure(warmRuns, 'workspace-open:time-to-first-usable')),
      bootstrapDurationMs: median(pickMeasure(warmRuns, 'workspace-open:bootstrap-duration')),
      authReadyMs: median(pickMeasure(warmRuns, 'workspace-open:time-to-auth-ready')),
      workspaceChunkMs: median(pickMeasure(warmRuns, 'workspace-open:time-to-workspace-chunk')),
      domContentLoadedMs: median(warmRuns.map((run) => run.domContentLoadedMs)),
      elapsedMs: median(warmRuns.map((run) => run.elapsed))
    },
    runs: warmRuns
  }
}

console.log(JSON.stringify(summary, null, 2))
