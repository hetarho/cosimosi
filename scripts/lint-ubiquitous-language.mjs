#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, sep } from 'node:path'
import { fail, ok, repoRoot, section } from './lib.mjs'

const glossaryPath = join(repoRoot, 'spec', 'ubiquitous-language.md')
const glossary = readFileSync(glossaryPath, 'utf8')
const probe = process.argv.find((arg) => arg.startsWith('--probe='))?.slice('--probe='.length)

const renderingSection = glossary.split('## 4. 렌더링 어휘')[1]?.split('## 5.')[0]
if (!renderingSection)
  fail('could not find the rendering vocabulary section in spec/ubiquitous-language.md')

const renderingTerms = renderingSection
  .split('\n')
  .map((line) => line.match(/^\|\s*`([^`]+)`/)?.[1])
  .filter(Boolean)
if (!renderingTerms.length)
  fail('could not extract rendering terms from spec/ubiquitous-language.md')

const roots = ['apps/api', 'apps/web/src', 'apps/mobile/src', 'apps/blog/src', 'packages', 'proto']
const extensions = new Set(['.go', '.sql', '.proto', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const ignoredSegments = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  'gen',
  'generated',
  '.astro',
  '.vite',
])
// `3d-renderer`/`universe`/`universe-render` = the scene/rendering packages. They ARE the
// rendering layer, so rendering vocabulary (star/nebula/filament…) is its native language
// throughout: @cosimosi/universe holds the scene's graph projection + read-model + domain→visual
// channel mappers, and @cosimosi/universe-render holds the R3F bindings. The domain-mirror boundary
// that must stay visual-free is @cosimosi/memory + apps/api (still scanned); the memory-edge and
// synonym checks below still run on these packages regardless.
const visualSegments = new Set([
  'ui',
  'visual',
  'visuals',
  'render',
  'renderer',
  'rendering',
  'canvas',
  'shader',
  'shaders',
  '3d-renderer',
  'universe',
  'universe-render',
])
const forbiddenEdgePatterns = [
  /\bEngram(?:Edge|Link|Relation|Relationship)\b/,
  /\bMemory(?:Edge|Link|Relation|Relationship)\b/,
  /\bengram_(?:edge|link|relation|relationship)s?\b/i,
  /\bmemory_(?:edge|link|relation|relationship)s?\b/i,
  /\bengram_to_engram\b/i,
  /\bmemory_to_memory\b/i,
]
const forbiddenSynonyms = [
  { pattern: /\bMemoryCell\b/, message: 'use EngramCell' },
  { pattern: /\bMemoryRecord\b/, message: 'use Record or Engram, depending on layer meaning' },
  { pattern: /\bMemory\b/, message: 'use Engram for the modeled memory concept' },
]

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const pascal = (value) =>
  value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
const renderingPatterns = (term) => [
  new RegExp(`(^|[^A-Za-z0-9_-])${escapeRegExp(term)}([^A-Za-z0-9_-]|$)`, 'i'),
  new RegExp(`\\b${escapeRegExp(term.replace(/-/g, '_'))}\\b`, 'i'),
  new RegExp(`\\b${escapeRegExp(pascal(term))}[A-Za-z0-9_]*\\b`),
]

const files = []

const renderingTermSet = new Set(renderingTerms)
const isIgnoredPath = (path) => path.split(sep).some((segment) => ignoredSegments.has(segment))
const isVisualPath = (path) => path.split(sep).some((segment) => visualSegments.has(segment))
// A rendering entity slice — `entities/<visual-noun>` where the slice IS a rendering term
// (star/cell-star/filament/…) — is the FE rendering layer (ARCHITECTURE §3.4): visual
// vocabulary is native there, including its `model`/`index` segments. The lint's job is to
// keep those words OUT of the domain-mirror slices (episodic-memory/neuron/synapse) and their
// api mappers, which never carry a rendering-term slice name.
const isVisualEntityPath = (path) => {
  const segments = path.split(sep)
  const entitiesAt = segments.indexOf('entities')
  return entitiesAt >= 0 && renderingTermSet.has(segments[entitiesAt + 1])
}
// Surfaces that legitimately name rendering vocabulary yet are NOT the domain-mirror slices this
// lint protects (episodic-memory/neuron/synapse + their api mappers + domain Go): the app-layer
// route/navigation composition mounts visual slices (a screen mounting the universe widget + a HUD
// notice), the `/test` harness renders demo panels for them, and generated config carries the
// values.yaml group names verbatim. Scoped to route/navigation so app/providers, app/model, and the
// domain-mirror slices all stay scanned.
const isCompositionPath = (segments) =>
  segments[0] === 'apps' &&
  segments[2] === 'src' &&
  segments[3] === 'app' &&
  (segments[4] === 'routes' || segments[4] === 'navigation')
const isTestHarnessPath = (segments) => {
  const pagesAt = segments.indexOf('pages')
  return pagesAt >= 0 && segments[pagesAt + 1] === 'test'
}
// The stardust economy overlay (별가루/Twinkle) is spec-named `widgets/stardust`, so its barrel
// export `StardustOverlay` unavoidably matches the rendering term "star" — yet it is the economy
// surface, not a rendering slice, and imports no visual entity (§3.4). Scoped to the slice so a
// real rendering-term leak elsewhere still trips the gate.
const isStardustEconomyPath = (segments) =>
  segments[0] === 'apps' &&
  segments[2] === 'src' &&
  segments[3] === 'widgets' &&
  segments[4] === 'stardust'
const isGeneratedFile = (text) => /\bDO NOT EDIT\b/i.test(text.slice(0, 400))

const walk = (dir) => {
  if (!existsSync(dir) || isIgnoredPath(relative(repoRoot, dir))) return
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const rel = relative(repoRoot, full)
    if (isIgnoredPath(rel)) continue
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full)
    } else if (stat.isFile() && extensions.has(extname(full))) {
      files.push({ path: rel, text: readFileSync(full, 'utf8') })
    }
  }
}

for (const root of roots) walk(join(repoRoot, root))

if (probe === 'visual') {
  files.push({
    path: 'apps/api/internal/engram/domain/probe.go',
    text: 'package domain\n\ntype StarProjection struct{}\n',
  })
} else if (probe === 'edge') {
  files.push({
    path: 'apps/api/internal/engram/domain/probe.go',
    text: 'package domain\n\ntype EngramEdge struct{}\n',
  })
} else if (probe) {
  fail(`unknown ubiquitous-language probe "${probe}"`)
}

const violations = []

for (const file of files) {
  const segments = file.path.split(sep)
  const visualAllowed =
    isVisualPath(file.path) ||
    isVisualEntityPath(file.path) ||
    isCompositionPath(segments) ||
    isTestHarnessPath(segments) ||
    isStardustEconomyPath(segments) ||
    isGeneratedFile(file.text)

  if (!visualAllowed) {
    for (const term of renderingTerms) {
      if (renderingPatterns(term).some((pattern) => pattern.test(file.text))) {
        violations.push(`${file.path}: rendering term "${term}" is outside a visual/UI path`)
      }
    }
  }

  for (const pattern of forbiddenEdgePatterns) {
    if (pattern.test(file.text)) {
      violations.push(`${file.path}: modeled memory-to-memory edge/relation is forbidden`)
      break
    }
  }

  for (const synonym of forbiddenSynonyms) {
    if (synonym.pattern.test(file.text)) {
      violations.push(`${file.path}: forbidden domain synonym (${synonym.message})`)
    }
  }
}

section('ubiquitous-language lint')

if (violations.length) {
  for (const violation of violations) console.error(`- ${violation}`)
  fail('ubiquitous-language drift detected')
}

ok(`scanned ${files.length} active source files against ${renderingTerms.length} rendering terms`)
