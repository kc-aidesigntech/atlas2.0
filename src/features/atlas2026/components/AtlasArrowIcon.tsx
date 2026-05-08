import React from 'react'

const atlasArrowIconUrl = new URL(
  '../../../../assets/up-arrow-icon-symbol-sign-north-point-ahead-above-vector-47696729.png',
  import.meta.url
).href

type AtlasArrowDirection = 'up' | 'right' | 'down' | 'left'

const DIRECTION_CLASSNAME: Record<AtlasArrowDirection, string> = {
  up: 'rotate-0',
  right: 'rotate-90',
  down: 'rotate-180',
  left: '-rotate-90'
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

interface AtlasArrowIconProps {
  className?: string
  direction?: AtlasArrowDirection
  invert?: boolean
  decorative?: boolean
  style?: React.CSSProperties
}

export default function AtlasArrowIcon({
  className,
  direction = 'right',
  invert = false,
  decorative = true,
  style
}: AtlasArrowIconProps) {
  return (
    <img
      src={atlasArrowIconUrl}
      alt=""
      aria-hidden={decorative}
      className={cn('h-[1.1rem] w-[1.1rem] shrink-0 opacity-90', DIRECTION_CLASSNAME[direction], className)}
      style={invert ? { ...style, filter: 'brightness(0) saturate(100%) invert(100%)' } : style}
    />
  )
}
