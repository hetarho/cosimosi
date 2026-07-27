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
// Each rule may carry a `scope`: `roots` limits it to those path prefixes, `exclude` carves holes
// out. A rule with no scope keeps scanning everything, so the rendering-term and memory-edge checks
// above are unaffected. The set must be inert against the current tree — a gate that fails on
// shipped code is a gate nobody keeps — so every rule here is verified by --probe.
const DOMAIN_SOURCE_ROOTS = [
  'apps/api/internal',
  'apps/web/src',
  'apps/mobile/src',
  'packages',
  'proto',
]
// The two places the PERSISTED `basic*`/`additional` column spelling is correct: the schema itself
// and the one bilingual row↔domain mapper (ARCHITECTURE §2.4). Everywhere else the retired tier
// vocabulary is drift.
const PERSISTED_TIER_SPELLING = ['apps/api/db', 'apps/api/internal/twinkle/pg']
const APP_AND_PACKAGE_SOURCE = ['apps/web/src', 'apps/mobile/src', 'apps/blog/src', 'packages']

const forbiddenSynonyms = [
  // The modeled memory concept is EpisodicMemory (the diary scene) or SemanticMemory (the risen
  // gist) — never a bare `Memory`, and never `MemoryCell`/`MemoryRecord`, which name nothing.
  {
    pattern: /\bMemoryCell\b/,
    message: 'use EpisodicMemory (the stored scene) or Neuron (its component)',
  },
  {
    pattern: /\bMemoryRecord\b/,
    message: 'use EpisodicMemory, or Record when the DB row itself is meant',
  },
  {
    pattern: /\b(?:AMemory|MemoryEntity|MemoryModel|MemoryObject)\b/,
    message: 'use EpisodicMemory or SemanticMemory — say which layer',
  },
  // The two tiers are SMALL and GENERAL by purpose, not basic/additional by provenance ([G2a]).
  {
    pattern: /\bBasicBalance\b/,
    message: 'the tier is Balance.Small — SMALL, not "basic"',
    scope: { roots: DOMAIN_SOURCE_ROOTS, exclude: PERSISTED_TIER_SPELLING },
  },
  {
    pattern: /\bAdditionalBalance\b/,
    message: 'the tier is Balance.General — GENERAL, not "additional"',
    scope: { roots: DOMAIN_SOURCE_ROOTS, exclude: PERSISTED_TIER_SPELLING },
  },
  {
    pattern: /\bbasicRemaining\b/i,
    message: 'use SmallRemaining / smallRemaining',
    scope: { roots: DOMAIN_SOURCE_ROOTS, exclude: PERSISTED_TIER_SPELLING },
  },
  // Case-insensitive on purpose, but the underscored `from_basic` / `from_additional` COLUMN names
  // do not match: `_` is a word character, so \b keeps the two spellings apart.
  {
    pattern: /\bFromBasic\b/i,
    message: 'the domain field is FromSmall / fromSmall (the column stays from_basic)',
    scope: { roots: DOMAIN_SOURCE_ROOTS, exclude: PERSISTED_TIER_SPELLING },
  },
  {
    pattern: /\bFromAdditional\b/i,
    message: 'the domain field is FromGeneral / fromGeneral (the column stays from_additional)',
    scope: { roots: DOMAIN_SOURCE_ROOTS, exclude: PERSISTED_TIER_SPELLING },
  },
  {
    pattern: /basic Twinkle/i,
    message: 'say SMALL Twinkle — the kinds are named by purpose, not provenance',
    scope: { roots: DOMAIN_SOURCE_ROOTS, exclude: PERSISTED_TIER_SPELLING },
  },
  {
    pattern: /additional Twinkle/i,
    message: 'say GENERAL Twinkle — the kinds are named by purpose, not provenance',
    scope: { roots: DOMAIN_SOURCE_ROOTS, exclude: PERSISTED_TIER_SPELLING },
  },
  {
    pattern: /기본 별가루/,
    message: 'the user-facing name is 작은 별가루',
    scope: { roots: DOMAIN_SOURCE_ROOTS, exclude: PERSISTED_TIER_SPELLING },
  },
  {
    pattern: /추가 별가루/,
    message: 'the user-facing name is 별가루',
    scope: { roots: DOMAIN_SOURCE_ROOTS, exclude: PERSISTED_TIER_SPELLING },
  },
  // [P7]: ownership is internal bookkeeping and 꾸미기 is a save, not an equip. This is the only
  // mechanical enforcement that MUST-NOT will ever get, so it is scoped to the surfaces that could
  // name it — the apps and the shared packages.
  //
  // `equip` is caught bare (the word appears nowhere in the tree, so the rule has teeth without
  // false positives), while `inventory` is caught only in the game-inventory SENSE: the plain
  // English "a list of things" is legitimate and in use (USER_STATE_RESET_INVENTORY, the generated
  // API service inventory), so a bare /inventory/ rule would fire on shipped code and be deleted.
  {
    pattern: /\bequip/i,
    message: 'no equip verb — 꾸미기 is Decorate (a save), and there is no equipped state',
    scope: { roots: APP_AND_PACKAGE_SOURCE },
  },
  {
    pattern: /\b(?:list|ornament|item|store)[_-]?inventor(?:y|ies)\b/i,
    message: 'no inventory model — ownership is internal bookkeeping, never a surfaced 보관함',
    scope: { roots: APP_AND_PACKAGE_SOURCE },
  },
  {
    pattern: /\binventor(?:y|ies)[_-]?(?:screen|page|view|tab|modal|panel)\b/i,
    message: 'no inventory surface — ownership is internal bookkeeping, never a screen',
    scope: { roots: APP_AND_PACKAGE_SOURCE },
  },
  {
    pattern: /장착|보관함/,
    message: 'no 장착/보관함 vocabulary — 꾸미기 저장, and ownership is never surfaced',
    scope: { roots: APP_AND_PACKAGE_SOURCE },
  },
]

// A rule applies when the file sits under one of its roots and under none of its exclusions.
const synonymApplies = (rule, path) => {
  const scope = rule.scope
  if (!scope) return true
  const normalized = path.split(sep).join('/')
  const under = (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  if (scope.roots && !scope.roots.some(under)) return false
  if (scope.exclude && scope.exclude.some(under)) return false
  return true
}

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
// notice), the dev-only surfaces (`pages/test`, `pages/design`) render demo panels and design
// specimens for them, and generated config carries the values.yaml group names verbatim. Scoped to
// route/navigation so app/providers, app/model, and the domain-mirror slices all stay scanned.
const isCompositionPath = (segments) =>
  segments[0] === 'apps' &&
  segments[2] === 'src' &&
  segments[3] === 'app' &&
  (segments[4] === 'routes' || segments[4] === 'navigation')
const DEV_SURFACE_PAGES = new Set(['test', 'design'])
const isDevSurfacePath = (segments) => {
  const pagesAt = segments.indexOf('pages')
  return pagesAt >= 0 && DEV_SURFACE_PAGES.has(segments[pagesAt + 1])
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

// Each probe injects a synthetic file that MUST trip a rule, so a rule can never rot into a
// no-op unnoticed. `synonyms` covers the whole scoped set at once — including the negative
// control: the persisted column spelling in its two sanctioned homes must NOT trip.
const SYNONYM_PROBE_FILES = [
  {
    path: 'apps/api/internal/twinkle/probe.go',
    text: 'package twinkle\n\ntype BasicBalance struct{}\n',
  },
  {
    path: 'apps/api/internal/twinkle/probe2.go',
    text: 'package twinkle\n\ntype AdditionalBalance struct{}\n',
  },
  {
    path: 'apps/api/internal/twinkle/probe3.go',
    text: 'package twinkle\n\nfunc basicRemaining() {}\n',
  },
  {
    path: 'apps/api/internal/twinkle/probe4.go',
    text: 'package twinkle\n\ntype E struct{ FromBasic int }\n',
  },
  {
    path: 'apps/api/internal/twinkle/probe5.go',
    text: 'package twinkle\n\ntype E struct{ FromAdditional int }\n',
  },
  {
    path: 'apps/api/internal/twinkle/probe6.go',
    text: 'package twinkle\n\n// the basic Twinkle grant\n',
  },
  {
    path: 'apps/api/internal/twinkle/probe7.go',
    text: 'package twinkle\n\n// the additional Twinkle reserve\n',
  },
  { path: 'apps/web/src/probe.ts', text: "export const label = '기본 별가루'\n" },
  { path: 'apps/web/src/probe2.ts', text: "export const label = '추가 별가루'\n" },
  { path: 'apps/web/src/probe3.ts', text: 'export function listInventory() {}\n' },
  { path: 'apps/web/src/probe3b.ts', text: 'export const OrnamentInventory = []\n' },
  { path: 'apps/web/src/probe3c.ts', text: 'export function InventoryScreen() {}\n' },
  { path: 'apps/web/src/probe4.ts', text: 'export function equip() {}\n' },
  { path: 'apps/web/src/probe5.ts', text: "export const label = '장착'\n" },
  { path: 'apps/web/src/probe6.ts', text: "export const label = '보관함'\n" },
  {
    path: 'apps/api/internal/memory/probe.go',
    text: 'package memory\n\ntype MemoryCell struct{}\n',
  },
  {
    path: 'apps/api/internal/memory/probe2.go',
    text: 'package memory\n\ntype MemoryRecord struct{}\n',
  },
  {
    path: 'apps/api/internal/memory/probe3.go',
    text: 'package memory\n\ntype MemoryEntity struct{}\n',
  },
]
// The negative control for the scoped tier rules: the persisted spelling in the schema and in the
// one bilingual mapper. A probe run must report these as clean, or the scoping is broken.
const SYNONYM_PROBE_ALLOWED = [
  {
    path: 'apps/api/db/queries/twinkle/probe.sql',
    text: 'SELECT from_basic, from_additional FROM twinkle_ledger_entries;\n',
  },
  {
    path: 'apps/api/internal/twinkle/pg/probe.go',
    text: 'package pg\n\ntype R struct{ FromBasic int }\n',
  },
]

// A probe run INVERTS the gate: success means the injected violation was detected. That is what
// makes the probes runnable in CI (`pnpm lint:language:probe`) rather than being manual one-offs
// whose rules can silently rot into no-ops.
const PROBE_PATH = 'apps/api/internal/engram/domain/probe.go'
if (probe === 'visual') {
  files.length = 0
  files.push({ path: PROBE_PATH, text: 'package domain\n\ntype StarProjection struct{}\n' })
} else if (probe === 'edge') {
  files.length = 0
  files.push({ path: PROBE_PATH, text: 'package domain\n\ntype EngramEdge struct{}\n' })
} else if (probe === 'synonyms') {
  files.length = 0
  files.push(...SYNONYM_PROBE_FILES, ...SYNONYM_PROBE_ALLOWED)
} else if (probe) {
  fail(`unknown ubiquitous-language probe "${probe}"`)
}

const violations = []
const synonymHits = new Map(forbiddenSynonyms.map((rule) => [rule, []]))

for (const file of files) {
  const segments = file.path.split(sep)
  const visualAllowed =
    isVisualPath(file.path) ||
    isVisualEntityPath(file.path) ||
    isCompositionPath(segments) ||
    isDevSurfacePath(segments) ||
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
    if (!synonymApplies(synonym, file.path)) continue
    if (synonym.pattern.test(file.text)) {
      violations.push(`${file.path}: forbidden domain synonym (${synonym.message})`)
      synonymHits.get(synonym).push(file.path)
    }
  }
}

section('ubiquitous-language lint')

if (probe === 'visual' || probe === 'edge') {
  if (!violations.length) fail(`the ${probe} rule never fired — it has rotted into a no-op`)
  ok(`${probe} probe: the rule fires (${violations.length} detected on the injected file)`)
} else if (probe === 'synonyms') {
  const allowedPaths = new Set(SYNONYM_PROBE_ALLOWED.map((file) => file.path))
  const problems = []
  for (const [rule, hits] of synonymHits) {
    if (!hits.length) problems.push(`rule ${rule.pattern} never fired — it has rotted into a no-op`)
    const leaked = hits.filter((path) => allowedPaths.has(path))
    if (leaked.length)
      problems.push(`rule ${rule.pattern} fired on the persisted spelling: ${leaked.join(', ')}`)
  }
  if (problems.length) {
    for (const problem of problems) console.error(`- ${problem}`)
    fail('ubiquitous-language synonym probe failed')
  }
  ok(
    `synonym probe: all ${forbiddenSynonyms.length} rules fire, and the persisted basic*/additional spelling stays clean`,
  )
} else if (violations.length) {
  for (const violation of violations) console.error(`- ${violation}`)
  fail('ubiquitous-language drift detected')
} else {
  ok(`scanned ${files.length} active source files against ${renderingTerms.length} rendering terms`)
}
