#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, sep } from 'node:path'
import { fail, ok, repoRoot, section } from './lib.mjs'

const glossaryPath = join(repoRoot, 'spec', 'ubiquitous-language.md')
const glossary = readFileSync(glossaryPath, 'utf8')
const probe = process.argv.find((arg) => arg.startsWith('--probe='))?.slice('--probe='.length)

const renderingSection = glossary.split('## 4. 렌더링 어휘')[1]?.split('## 5.')[0]
if (!renderingSection) fail('could not find the rendering vocabulary section in spec/ubiquitous-language.md')

const renderingTerms = renderingSection
  .split('\n')
  .map((line) => line.match(/^\|\s*`([^`]+)`/)?.[1])
  .filter(Boolean)
if (!renderingTerms.length) fail('could not extract rendering terms from spec/ubiquitous-language.md')

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
// `3d-renderer` = the @cosimosi/3d-renderer package: it IS the rendering layer, so
// rendering vocabulary (star/nebula/filament…) is its native language throughout.
const visualSegments = new Set(['ui', 'visual', 'visuals', 'render', 'renderer', 'rendering', 'canvas', 'shader', 'shaders', '3d-renderer'])
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
const pascal = (value) => value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('')
const renderingPatterns = (term) => [
  new RegExp(`(^|[^A-Za-z0-9_-])${escapeRegExp(term)}([^A-Za-z0-9_-]|$)`, 'i'),
  new RegExp(`\\b${escapeRegExp(term.replace(/-/g, '_'))}\\b`, 'i'),
  new RegExp(`\\b${escapeRegExp(pascal(term))}[A-Za-z0-9_]*\\b`),
]

const files = []

const isIgnoredPath = (path) => path.split(sep).some((segment) => ignoredSegments.has(segment))
const isVisualPath = (path) => path.split(sep).some((segment) => visualSegments.has(segment))

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
  const visualAllowed = isVisualPath(file.path)

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
