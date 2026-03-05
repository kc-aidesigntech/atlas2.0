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
  URL.revokeObjectURL(link.href)
}

