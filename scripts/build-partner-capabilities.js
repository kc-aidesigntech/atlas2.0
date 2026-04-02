#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const inputPath = path.resolve(
  process.cwd(),
  'sample-data/ATLASDB-excel/ATLAS V2 DB - Z-Code_Partner_Survey_2026-01-03_19_56_27_unpivoted (1) (2).csv'
)
const outputPath = path.resolve(process.cwd(), 'sample-data/ATLASDB-excel/partner-capabilities.seed.json')

const ORG_CANONICAL_MAP = new Map([
  ['department of assigned counsel', 'Pierce County Department of Assigned Counsel'],
  ['pierce county department of assigned counsel', 'Pierce County Department of Assigned Counsel'],
  ['dac', 'Pierce County Department of Assigned Counsel'],
  ['dept of assigned counsel', 'Pierce County Department of Assigned Counsel'],
  ['pierce county dac', 'Pierce County Department of Assigned Counsel'],
  ['assigned counsel', 'Pierce County Department of Assigned Counsel'],
  ['pc dept of assigned counsel', 'Pierce County Department of Assigned Counsel']
])

function normalizeOrgName(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function canonicalOrgName(value) {
  const normalized = normalizeOrgName(value)
  return ORG_CANONICAL_MAP.get(normalized) || value
}

function parseCsvRows(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''))
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }

  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''))
    rows.push(row)
  }

  return rows
}

function main() {
  const raw = fs.readFileSync(inputPath, 'utf8')
  const rows = parseCsvRows(raw)
  const [header, ...body] = rows

  const idx = {
    org: header.indexOf('The Name of Your Organization'),
    relation: header.indexOf('z_code_relation_type'),
    code: header.indexOf('z_code'),
    submissionDate: header.indexOf('Submission Date'),
    normalizedSpecialties: header.indexOf('NORMALIZED COUNT SPECIALTIES'),
    normalizedInterferences: header.indexOf('NORMALIZED COUNT INTERFERENCES')
  }

  const grouped = new Map()

  for (const line of body) {
    const orgName = canonicalOrgName(line[idx.org] || '')
    const relationType = (line[idx.relation] || '').trim()
    const zCode = (line[idx.code] || '').trim()
    if (!orgName || !zCode || !relationType) continue

    const key = `${orgName}::${zCode}::${relationType}`
    if (!grouped.has(key)) {
      const strengthRaw =
        relationType === 'specialize' ? line[idx.normalizedSpecialties] : line[idx.normalizedInterferences]
      grouped.set(key, {
        organization_name: orgName,
        organization_name_normalized: normalizeOrgName(orgName),
        z_code: zCode,
        relation_type: relationType,
        source: 'partner_survey_2026_01_03',
        source_submitted_at: line[idx.submissionDate] || null,
        strength: Number.parseFloat(strengthRaw || '1') || 1
      })
    }
  }

  const output = {
    generated_at: new Date().toISOString(),
    source_file: path.relative(process.cwd(), inputPath),
    records: Array.from(grouped.values()).sort((a, b) => {
      if (a.organization_name !== b.organization_name) return a.organization_name.localeCompare(b.organization_name)
      if (a.z_code !== b.z_code) return a.z_code.localeCompare(b.z_code)
      return a.relation_type.localeCompare(b.relation_type)
    })
  }

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))
  process.stdout.write(`wrote ${output.records.length} partner capability records\n`)
  process.stdout.write(`output: ${outputPath}\n`)
}

main()
