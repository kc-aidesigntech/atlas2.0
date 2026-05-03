/**
 * Shared avatar fallback generator for ATLAS profile surfaces.
 * Produces deterministic initials-based SVG data URLs so any screen can render
 * a stable avatar without requiring persisted image storage.
 */
export function getAvatarInitials(fullName: string) {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
  if (!parts.length) return 'A'
  return parts.map((part) => part[0]?.toUpperCase() || '').join('') || 'A'
}

export function createFallbackAvatarDataUrl(fullName: string) {
  const initials = getAvatarInitials(fullName)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
      <rect width="300" height="300" rx="56" fill="#111111" />
      <circle cx="150" cy="150" r="114" fill="#1d1d1d" stroke="#ffffff" stroke-width="6" />
      <text x="150" y="170" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="96" font-weight="700" fill="#ffffff">${initials}</text>
    </svg>
  `.trim()
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
