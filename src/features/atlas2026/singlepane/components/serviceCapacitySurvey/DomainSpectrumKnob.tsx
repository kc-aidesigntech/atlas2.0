import React, { useRef } from 'react'
import CircularSlider from '@fseehawer/react-circular-slider'

interface DomainSpectrumKnobProps {
  value: number
  min: number
  max: number
  disabled: boolean
  onChange: (value: number) => void
}

/**
 * Renders the circular domain-spectrum control separately from shared survey chrome.
 * Pointer geometry stays local so the parent card only coordinates survey state.
 */
export default function DomainSpectrumKnob({
  value,
  min,
  max,
  disabled,
  onChange
}: DomainSpectrumKnobProps) {
  const knobRootRef = useRef<HTMLDivElement | null>(null)
  const span = Math.max(1, max - min)
  const toPercent = (score: number) => ((score - min) / span) * 100
  const habitatColor = '#ff9a3c'
  const socialNetworksColor = '#4ea5ff'
  const workColor = '#f6cb3f'
  const domainSpectrumBackground = `conic-gradient(from -103deg, ${habitatColor} ${toPercent(1).toFixed(3)}%, ${socialNetworksColor} ${toPercent(33).toFixed(3)}%, ${workColor} ${toPercent(66).toFixed(3)}%, ${habitatColor} ${toPercent(99).toFixed(3)}%)`
  const majorLabels = ['habitat', 'social networks', 'work']
  const majorTicks = majorLabels.map((label, index) => ({
    angle: index * 120,
    label,
    value: index === 0 ? 0 : index === 1 ? 33 : 66
  }))
  const minorTicks = majorTicks.flatMap((current, index) => {
    const nextAngle = ((index + 1) % majorTicks.length) * 120
    const segmentEnd = nextAngle <= current.angle ? nextAngle + 360 : nextAngle
    // Six graduations split each domain segment into equal pointer targets.
    return [1, 2, 3, 4, 5, 6].map((step) => ({
      angle: current.angle + ((segmentEnd - current.angle) * step) / 7
    }))
  })

  function handleRingPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return
    const target = event.target as HTMLElement
    if (target.closest('button,input,a')) return
    const node = knobRootRef.current
    if (!node) return
    const bounds = node.getBoundingClientRect()
    const dx = event.clientX - (bounds.left + bounds.width / 2)
    const dy = event.clientY - (bounds.top + bounds.height / 2)
    const radius = Math.hypot(dx, dy)
    // Ignore center and outside taps so only the visible ring changes the score.
    if (radius < 78 || radius > 124) return
    const angleFromTopClockwise = (Math.atan2(dy, dx) * (180 / Math.PI) + 450) % 360
    const inferredValue = min + (angleFromTopClockwise / 360) * (max - min)
    onChange(Math.max(min, Math.min(max, Math.round(inferredValue))))
  }

  return (
    <div
      ref={knobRootRef}
      className={`relative h-[280px] w-[280px] ${disabled ? 'opacity-60' : ''}`}
      style={{ filter: disabled ? 'grayscale(0.35)' : 'none' }}
      onPointerDown={handleRingPointerDown}
    >
      {majorTicks.map((tick) => (
        <TickMark key={`major-${tick.angle}`} angle={tick.angle} radius={132} length={14} thickness={2} color="#ffffffb5" />
      ))}
      {minorTicks.map((tick) => (
        <TickMark key={`minor-${tick.angle}`} angle={tick.angle} radius={132} length={8} thickness={1.5} color="#ffffff60" />
      ))}
      {majorTicks.map((tick) => (
        <DomainLabelButton
          key={`label-${tick.angle}`}
          angle={tick.angle}
          radius={164}
          label={tick.label}
          disabled={disabled}
          onClick={() => onChange(Math.max(min, Math.min(max, tick.value)))}
        />
      ))}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="h-[210px] w-[210px] rounded-full"
          style={{
            background: domainSpectrumBackground,
            WebkitMask: 'radial-gradient(circle, transparent 0 90px, #000 91px)',
            mask: 'radial-gradient(circle, transparent 0 90px, #000 91px)'
          }}
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <CircularSlider
          width={210}
          min={min}
          max={max}
          data={Array.from({ length: max - min + 1 }, (_, index) => min + index)}
          dataIndex={Math.max(0, Math.min(max - min, value - min))}
          knobPosition="top"
          knobSize={34}
          knobColor="#111111"
          progressSize={14}
          trackSize={14}
          label=""
          hideLabelValue
          progressLineCap="round"
          progressColorFrom="rgba(0,0,0,0)"
          progressColorTo="rgba(0,0,0,0)"
          trackColor="rgba(0,0,0,0)"
          onChange={(nextValue) => {
            if (disabled) return
            const parsed = typeof nextValue === 'number' ? nextValue : Number(nextValue)
            if (Number.isFinite(parsed)) onChange(Math.max(min, Math.min(max, Math.round(parsed))))
          }}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[92px] w-[92px] rounded-full border border-white/15 bg-[#070707]/95 shadow-[inset_0_2px_10px_rgba(255,255,255,0.06),0_8px_20px_rgba(0,0,0,0.45)]" />
      </div>
    </div>
  )
}

function TickMark({
  angle,
  radius,
  length,
  thickness,
  color
}: {
  angle: number
  radius: number
  length: number
  thickness: number
  color: string
}) {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 origin-center"
      style={{ transform: `translate(-50%, -50%) rotate(${angle}deg)` }}
      aria-hidden="true"
    >
      <div
        style={{
          transform: `translateY(-${radius}px)`,
          width: `${thickness}px`,
          height: `${length}px`,
          borderRadius: '999px',
          backgroundColor: color
        }}
      />
    </div>
  )
}

function DomainLabelButton({
  angle,
  radius,
  label,
  disabled,
  onClick
}: {
  angle: number
  radius: number
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <div
      className="absolute left-1/2 top-1/2 origin-center"
      style={{ transform: `translate(-50%, -50%) rotate(${angle}deg)` }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        style={{ transform: `translateY(-${radius}px) rotate(${-angle}deg)` }}
        className="rounded-full border border-white/45 px-2 py-[2px] text-center text-[10px] uppercase tracking-[0.08em] text-white transition-colors duration-150 hover:border-white/70 hover:bg-white/10"
      >
        {label}
      </button>
    </div>
  )
}
