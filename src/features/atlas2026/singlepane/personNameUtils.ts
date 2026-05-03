/**
 * Shared person-name helpers used by both hook orchestration and repository
 * adapters so fallback-contact mapping stays consistent across surfaces.
 */
export function splitFullName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1]
  }
}
