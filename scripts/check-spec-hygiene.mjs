#!/usr/bin/env node
// Spec & workflow hygiene keeps executable documentation internally consistent.
//
//   A  Workflow-skill links resolve. Anchor fragments and {{placeholders}} are skipped; only the file part of a
//      relative link is checked.
//   B  spec/ holds only the haeram-spec-creator layout (spec/FORMAT.md owns it). A second documentation system
//      next to ssot/ — a revived plan/, policy/ or tech/ tree, a loose top-level doc — is a second source of truth,
//      so anything outside the layout fails. `--probe` runs B's self-check alone and proves it bites.
//
// The FORMAT invariants inside the layout (IDs, revs, skeletons, references) are checked by
// `npx haeram-spec-creator lint`, not here.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { repoRoot, section, ok, note, fail } from './lib.mjs'

const problems = []
const probeMode = process.argv.includes('--probe')

section(
  probeMode
    ? 'Spec & workflow hygiene — spec layout probe'
    : 'Spec & workflow hygiene — skill links + spec layout',
)

// ---- B) spec/ layout (defined first; the probe dispatches off it) ----
// `values.yaml` is not a FORMAT doc: it is the build-time config source `pnpm gen:values` reads.
const LAYOUT_FILES = new Set(['STATE.md', 'FORMAT.md', 'NARRATIVE.md', 'values.yaml'])
const LAYOUT_DIRS = new Set(['ssot', 'tasks', 'review', 'ideation', 'reports', 'work'])

function layoutProblems(entries) {
  const found = []
  for (const { name, dir } of entries) {
    if (dir ? LAYOUT_DIRS.has(name) : LAYOUT_FILES.has(name) || name === '.DS_Store') continue
    found.push(
      `spec/${name}${dir ? '/' : ''} is outside the spec layout — rules belong in spec/ssot/, work in spec/tasks/ (spec/FORMAT.md).`,
    )
  }
  return found
}

// The probe is the whole run when asked for: it proves B bites, and has nothing to say about A.
if (probeMode) probeLayout()

// ---- A) workflow-skill links resolve ----
const SKILL_ROOTS = ['.claude/skills', '.codex/skills']
const skillFiles = (absDir) => {
  const out = []
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name === 'SKILL.md') out.push(p) // the workflow instruction docs (not vendored READMEs)
    }
  }
  if (existsSync(absDir)) walk(absDir)
  return out
}
// Skills installed by haeram-spec-creator are owned by that package (its `check` verifies them), not by this repo.
const VENDOR_LOCK = join(repoRoot, '.haeram-spec-creator-lock.json')
const vendored = new Set(
  existsSync(VENDOR_LOCK) ? Object.keys(JSON.parse(readFileSync(VENDOR_LOCK, 'utf8')).files) : [],
)
const LINK = /\]\(([^)]+)\)/g
let checkedLinks = 0
for (const root of SKILL_ROOTS) {
  for (const file of skillFiles(join(repoRoot, root))) {
    if (vendored.has(file.replace(repoRoot + '/', ''))) continue
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(LINK)) {
      let target = m[1].trim()
      if (!target || target.includes('{{')) continue // template placeholder
      if (/^(https?:|mailto:|#)/.test(target)) continue // external / pure anchor
      target = target.split('#')[0] // drop anchor fragment
      if (!target) continue
      checkedLinks++
      const resolved = resolve(dirname(file), target)
      if (!existsSync(resolved)) {
        problems.push(
          `${file.replace(repoRoot + '/', '')} → broken link \`${m[1]}\` (resolves to a path that doesn't exist).`,
        )
      }
    }
  }
}
note(`checked ${checkedLinks} relative links across ${SKILL_ROOTS.join(', ')} (SKILL.md only)`)

// ---- B) run it ----
const specDir = join(repoRoot, 'spec')
const entries = existsSync(specDir)
  ? readdirSync(specDir, { withFileTypes: true }).map((e) => ({
      name: e.name,
      dir: e.isDirectory(),
    }))
  : []
problems.push(...layoutProblems(entries))
note(
  `checked ${entries.length} top-level spec/ entr${entries.length === 1 ? 'y' : 'ies'} against the layout`,
)

if (problems.length) {
  for (const p of problems) console.error(`  \x1b[31m✗\x1b[0m ${p}`)
  fail(`${problems.length} spec-hygiene issue(s).`)
}
ok('workflow-doc links resolve; spec/ holds only the spec layout')

// Proves B fails on the shapes it exists to catch, using in-memory listings — a guard is only worth
// having once someone has watched it bite. It also asserts the real layout passes, so the check
// cannot earn its green by rejecting everything.
function probeLayout() {
  const layout = [
    ...[...LAYOUT_FILES].map((name) => ({ name, dir: false })),
    ...[...LAYOUT_DIRS].map((name) => ({ name, dir: true })),
  ]
  const cases = [
    { what: 'a revived plan/ tree', entries: [...layout, { name: 'plan', dir: true }] },
    { what: 'a loose top-level doc', entries: [...layout, { name: 'PRD.md', dir: false }] },
    { what: 'a file named like a layout dir', entries: [...layout, { name: 'ssot', dir: false }] },
  ]
  const missed = cases.filter((c) => layoutProblems(c.entries).length === 0)
  if (missed.length) {
    for (const c of missed) console.error(`  \x1b[31m✗\x1b[0m not caught: ${c.what}`)
    fail(`${missed.length} layout violation shape(s) slipped past the check.`)
  }
  if (layoutProblems(layout).length > 0) {
    fail('the real spec layout is reported as broken — the check is too strict.')
  }
  ok(`layout check catches ${cases.length} violation shape(s) and passes the real layout`)
  process.exit(0)
}
