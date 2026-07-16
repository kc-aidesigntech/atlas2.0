import { readdirSync, statSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const ALLOWED_ROOT_MARKDOWN = new Set([
  'README.md',
  'PILOT.md',
  'DB_RLS.md',
  'NAVIGATOR_MY_PROFILE.md',
  'PARTNER_MY_STATION.md',
  'Power_BI_adaptation.md',
  'Runpod_VM.md'
])

const ALLOWED_LEGACY_ROOT_ASSETS = new Set([
  '1.svg',
  '2.svg',
  '3.svg',
  '4.svg',
  'ATLAS_LOGO_final_white_bkg.png',
  'CONCEPT.svg',
  'Ellipse 1.svg',
  'Ellipse 2.svg',
  'Ellipse 3.svg',
  'Ellipse 4.svg',
  'Kolbi Christianson-lt.png',
  'Line 1.svg',
  'Line 2.svg',
  'Line 3.svg',
  'Line 4.svg',
  'Line 5.svg',
  'Line 6.svg',
  'Line 7.svg',
  'Line 8.svg',
  'portraits/elena-rodriguez.jpeg'
])

const GENERIC_ASSET_NAME = /^(?:\d+|line \d+|ellipse \d+)\.(?:svg|png|jpe?g|webp)$/i

function walkFiles(directory) {
  const results = []
  if (!pathExists(directory)) return results

  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) {
      results.push(...walkFiles(fullPath))
    } else {
      results.push(fullPath)
    }
  }
  return results
}

function pathExists(targetPath) {
  try {
    statSync(targetPath)
    return true
  } catch {
    return false
  }
}

function checkRootMarkdown(violations) {
  const rootFiles = readdirSync(repoRoot)
  for (const fileName of rootFiles) {
    if (!fileName.endsWith('.md')) continue
    if (!ALLOWED_ROOT_MARKDOWN.has(fileName)) {
      violations.push(`Root markdown file is not allowed: ${fileName}`)
    }
  }
}

function checkLegacyRootAssets(violations) {
  const rootAssetsDir = path.join(repoRoot, 'assets')
  const files = walkFiles(rootAssetsDir)
  for (const filePath of files) {
    const relativePath = path.relative(rootAssetsDir, filePath).replaceAll(path.sep, '/')
    if (relativePath.startsWith('.')) continue
    if (!ALLOWED_LEGACY_ROOT_ASSETS.has(relativePath)) {
      violations.push(`New root asset detected outside canonical product paths: assets/${relativePath}`)
    }
  }
}

function checkGenericAssetNames(violations) {
  const candidateDirs = [
    path.join(repoRoot, 'src/features/atlas2026/assets'),
    path.join(repoRoot, 'src/features/atlas2026/singlepane/assets')
  ]
  for (const directory of candidateDirs) {
    const files = walkFiles(directory)
    for (const filePath of files) {
      const fileName = path.basename(filePath)
      if (GENERIC_ASSET_NAME.test(fileName)) {
        const relativePath = path.relative(repoRoot, filePath).replaceAll(path.sep, '/')
        violations.push(`Generic asset filename is blocked: ${relativePath}`)
      }
    }
  }
}

function checkSharedImportBoundaries(violations) {
  const srcDir = path.join(repoRoot, 'src')
  const files = walkFiles(srcDir)
  const blockedImports = [
    "@/features/atlas2026/singlepane/theme",
    "@/features/atlas2026/singlepane/types",
    "@/features/atlas2026/singlepane/roleCapabilityPolicy"
  ]
  const compatibilityFiles = new Set([
    'src/features/atlas2026/singlepane/theme.ts',
    'src/features/atlas2026/singlepane/types.ts',
    'src/features/atlas2026/singlepane/roleCapabilityPolicy.ts'
  ])

  for (const filePath of files) {
    if (!/\.(?:ts|tsx|js|jsx)$/.test(filePath)) continue
    const relativePath = path.relative(repoRoot, filePath).replaceAll(path.sep, '/')
    if (compatibilityFiles.has(relativePath)) continue
    const content = readFileSync(filePath, 'utf8')
    for (const blockedImport of blockedImports) {
      if (content.includes(blockedImport)) {
        // Keep imports aligned with product-level shared modules so cross-surface
        // boundaries remain explicit as contracts evolve.
        violations.push(`Blocked shared import in ${relativePath}: ${blockedImport}`)
      }
    }
  }
}

function main() {
  const violations = []

  checkRootMarkdown(violations)
  checkLegacyRootAssets(violations)
  checkGenericAssetNames(violations)
  checkSharedImportBoundaries(violations)

  if (!violations.length) {
    console.log('Repository organization validation passed.')
    return
  }

  console.error('Repository organization validation failed:')
  for (const violation of violations) {
    console.error(`- ${violation}`)
  }
  process.exitCode = 1
}

main()
