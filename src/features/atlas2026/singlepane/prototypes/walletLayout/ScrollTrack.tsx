import React from 'react'

/** Diameter of the round scroll handle, in pixels. */
const HANDLE_PX = 28

/**
 * The vertical track and round handle beside the pad. The handle's position
 * follows the page's scroll position; pressing or dragging on the track
 * writes the page's scroll position.
 */
export default function ScrollTrack({ listRef, listId, contentKey }: { listRef: React.RefObject<HTMLDivElement>; listId: string; contentKey: string }) {
  const trackRef = React.useRef<HTMLDivElement | null>(null)
  const draggingRef = React.useRef(false)
  const [progress, setProgress] = React.useState(0)
  const [canScroll, setCanScroll] = React.useState(false)

  React.useEffect(() => {
    const list = listRef.current
    if (!list) return undefined
    const measure = () => {
      const range = list.scrollHeight - list.clientHeight
      setCanScroll(range > 1)
      setProgress(range > 1 ? Math.min(1, Math.max(0, list.scrollTop / range)) : 0)
    }
    measure()
    list.addEventListener('scroll', measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    // The unmount function removes the scroll listener and stops the size observer.
    return () => {
      list.removeEventListener('scroll', measure)
      observer.disconnect()
    }
  }, [listRef, contentKey])

  function scrollListToPointer(clientY: number) {
    const list = listRef.current
    const track = trackRef.current
    if (!list || !track) return
    const rect = track.getBoundingClientRect()
    const travel = rect.height - HANDLE_PX
    if (travel <= 0) return
    const ratio = Math.min(1, Math.max(0, (clientY - rect.top - HANDLE_PX / 2) / travel))
    list.scrollTop = ratio * (list.scrollHeight - list.clientHeight)
  }

  return (
    <div
      ref={trackRef}
      role="scrollbar"
      aria-controls={listId}
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      className={`relative shrink-0 touch-none ${canScroll ? 'cursor-pointer' : 'opacity-40'}`}
      style={{ width: HANDLE_PX }}
      onPointerDown={(event) => {
        if (!canScroll) return
        draggingRef.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
        scrollListToPointer(event.clientY)
      }}
      onPointerMove={(event) => {
        if (draggingRef.current) scrollListToPointer(event.clientY)
      }}
      onPointerUp={() => {
        draggingRef.current = false
      }}
      onPointerCancel={() => {
        draggingRef.current = false
      }}
    >
      <div className="absolute inset-y-0 left-1/2 w-[10px] -translate-x-1/2 rounded-full border border-white/40" />
      <div
        className="absolute left-0 rounded-full border border-white bg-[var(--surface-panel-raised)]"
        style={{ width: HANDLE_PX, height: HANDLE_PX, top: `calc(${progress} * (100% - ${HANDLE_PX}px))` }}
      />
    </div>
  )
}
