function escapeCsv(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function toCsv(rows) {
  if (!rows || rows.length === 0) return ''
  // Header order comes from the first row and is reused for all rows to keep column mapping stable.
  const headers = Object.keys(rows[0])
  const body = rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(','))
  return [headers.join(','), ...body].join('\n')
}

export function downloadCsv(rows, filename) {
  const csv = toCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Revoke after click so object URLs do not accumulate during repeated exports.
  URL.revokeObjectURL(link.href)
}

