import { SP_COLORS } from '@/features/atlas2026/shared/theme'

// Keep all shell-level loading treatments together so lazy panels and the
// initial workspace bootstrap communicate progress consistently.
export function WorkspaceLoadingSpinner() {
  return (
    <div
      className="absolute inset-0 z-[40] flex items-center justify-center bg-black/35 backdrop-blur-[1px]"
      role="status"
      aria-live="polite"
      aria-label="Loading workspace"
    >
      <div className="flex flex-col items-center gap-4 rounded-[24px] border border-white/10 bg-black/55 px-9 py-8">
        <div
          className="h-12 w-12 animate-spin rounded-full border-[3px]"
          style={{
            borderColor: 'rgba(255,255,255,0.16)',
            borderTopColor: SP_COLORS.yellow,
            animationDuration: '0.7s'
          }}
        />
        <small className="atlas-overline text-[#cfcfcf]">loading your workspace…</small>
      </div>
    </div>
  )
}

export function WorkspaceLoadingShell() {
  return (
    <>
      <div
        className="flex min-h-[282px] flex-col gap-4 border-b pb-[12px] md:flex-row md:items-start"
        style={{ borderColor: '#ffffff55', borderBottomWidth: '2px' }}
      >
        <div className="flex-1 space-y-3">
          <div className="h-7 w-[240px] rounded-full bg-white/10" />
          <div className="h-4 w-[180px] rounded-full bg-white/10" />
          <div className="h-4 w-[220px] rounded-full bg-white/10" />
          <div className="flex flex-wrap gap-2 pt-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-11 w-11 rounded-full bg-white/10" />
            ))}
          </div>
        </div>
        <div className="h-[260px] w-full rounded-[30px] border border-white/15 bg-white/5 md:max-w-[360px]" />
      </div>

      <div className="flex min-h-[46px] items-center justify-center">
        <div className="h-10 w-full max-w-[520px] rounded-full border border-white/15 bg-white/5" />
      </div>

      <div className="h-[220px] rounded-[28px] border border-white/15 bg-white/5" />
    </>
  )
}

export function LazyPanelFallback() {
  return (
    <div className="absolute inset-0 z-[30] flex items-center justify-center bg-black/20">
      <small className="atlas-overline text-[#cfcfcf]">loading panel…</small>
    </div>
  )
}
