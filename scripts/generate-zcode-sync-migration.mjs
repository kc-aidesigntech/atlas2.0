import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const csvPath = path.resolve(repoRoot, 'references', 'z_codes_rows (edited by dr. greg on 4.18.26 @1108p).csv');
const migrationPath = path.resolve(repoRoot, 'supabase/migrations/20260420_sync_partner_survey_zcodes_from_csv.sql');

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

function parseCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const header = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const row = {};
    for (let i = 0; i < header.length; i += 1) {
      row[header[i]] = cols[i] ?? '';
    }
    return row;
  });
}

function sqlEscape(value) {
  return String(value).replace(/'/g, "''");
}

function buildSourceRows(rows) {
  return rows.map((row) => ({
    id: row.id.trim(),
    z_code: row.z_code.trim().toUpperCase(),
    z_group: Number(row.z_group.trim()),
    title: row.title.trim(),
    description: row.description.trim(),
    is_active: row.is_active.trim().toLowerCase() === 'true',
  }));
}

function buildValuesSql(rows) {
  return rows
    .map(
      (row) =>
        `('${sqlEscape(row.id)}'::uuid, '${sqlEscape(row.z_code)}', ${row.z_group}, '${sqlEscape(row.title)}', '${sqlEscape(row.description)}', ${row.is_active ? 'true' : 'false'})`,
    )
    .join(',\n    ');
}

function buildMigrationSql(rows) {
  const sourceRows = buildSourceRows(rows);
  const valuesSql = buildValuesSql(sourceRows);
  const allCodesCsv = sourceRows.map((row) => `'${sqlEscape(row.z_code)}'`).join(', ');

  return `with source(id, z_code, z_group, title, description, is_active) as (
    values
    ${valuesSql}
  ),
  upserted as (
    insert into atlas.z_codes (id, z_code, z_group, title, description, is_active)
    select id, z_code, z_group, title, description, is_active
    from source
    on conflict (z_code) do update
      set z_group = excluded.z_group,
          title = excluded.title,
          description = excluded.description,
          is_active = excluded.is_active
    returning z_code
  ),
  deactivated as (
    update atlas.z_codes
    set is_active = false
    where z_code not in (${allCodesCsv})
    returning z_code
  ),
  header_map as (
    select
      coalesce(z_group, z_code_key)::integer as z_group,
      max(z_code_hdr_desc)::text as z_code_hdr_desc
    from atlas.z_code_headers
    group by coalesce(z_group, z_code_key)
  ),
  section_rows as (
    select
      z.z_group as z_group,
      format('Z%s', lpad(z.z_group::text, 2, '0')) as parent_code,
      coalesce(nullif(trim(h.z_code_hdr_desc), ''), format('Z%s', lpad(z.z_group::text, 2, '0'))) as parent_theme,
      jsonb_agg(
        jsonb_build_object(
          'id', lower(replace(z.z_code, '.', '-')),
          'parentCode', format('Z%s', lpad(z.z_group::text, 2, '0')),
          'parentTheme', coalesce(nullif(trim(h.z_code_hdr_desc), ''), format('Z%s', lpad(z.z_group::text, 2, '0'))),
          'zCode', z.z_code,
          'normalizedZCode', z.z_code,
          'title', z.z_code,
          'description', z.title
        )
        order by z.z_code
      ) as prompts
    from atlas.z_codes z
    left join header_map h
      on h.z_group = z.z_group
    where z.is_active = true
      and z.z_code in (select z_code from source)
    group by z.z_group, h.z_code_hdr_desc
  ),
  section_payload as (
    select jsonb_agg(
      jsonb_build_object(
        'parentCode', parent_code,
        'theme', parent_theme,
        'prompts', prompts
      )
      order by z_group
    ) as sections
    from section_rows
  ),
  latest_scale as (
    select payload->'scale' as scale
    from atlas.app_config_documents
    where surface = 'singlepane'
      and config_key = 'service_capacity_survey'
      and version = '2026-z-burden-v2'
    order by created_at desc
    limit 1
  )
  insert into atlas.app_config_documents (surface, config_key, version, payload)
  select
    'singlepane',
    'service_capacity_survey',
    '2026-z-burden-v2',
    jsonb_build_object(
      'scale',
      coalesce(
        (select scale from latest_scale),
        '[{"value":1,"label":"major burden","description":"We do not handle this and it creates major burden."},{"value":2,"label":"rarely handled","description":"We rarely handle this and it creates burden."},{"value":3,"label":"poor fit","description":"We are not a good fit for this."},{"value":4,"label":"inconsistent fit","description":"We sometimes handle this, but inconsistently."},{"value":5,"label":"mixed fit","description":"Mixed fit and depends on the situation."},{"value":6,"label":"case by case","description":"We can handle this in some cases."},{"value":7,"label":"handles well","description":"We handle this well."},{"value":8,"label":"reliable fit","description":"We handle this reliably."},{"value":9,"label":"specialty area","description":"This is a strong area of specialty for us."}]'::jsonb
      ),
      'sections',
      coalesce((select sections from section_payload), '[]'::jsonb)
    );`;
}

async function main() {
  const csvContent = await readFile(csvPath, 'utf8');
  const rows = parseCsv(csvContent);
  const sql = buildMigrationSql(rows);
  await writeFile(migrationPath, `${sql}\n`, 'utf8');
  console.log(`Generated migration: ${migrationPath}`);
  console.log(`Rows: ${rows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
