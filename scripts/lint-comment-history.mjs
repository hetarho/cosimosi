#!/usr/bin/env node
// Comment-history lint (code-review 03, R006). spec/principle/code-comments.md says a comment explains *current* code
// only — "never record process or history". /implement-job asks for a comment pass, but nothing executable enforces it,
// so change-history ("used to be 280") and roadmap/process narration ("Epic A", "foundation shell") keep creeping into
// source and turn the code into a project diary. This is a lightweight guard over active source roots: it flags a small
// set of high-confidence narration markers found on comment lines. Tests/stories/fixtures are exempt (their narration
// can be intentional). Keep the pattern set tight — a false positive breaks the whole `pnpm lint` gate.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repoRoot, section, ok, note, fail } from './lib.mjs'

const SRC_GLOBS = ['apps/web/src', 'apps/mobile/src', 'packages']
const SKIP_FILE = /\.(test|spec|stories|probe)\.[jt]sx?$/
const CODE_EXT = /\.[jt]sx?$/
// only lines that carry a comment marker are inspected (so string literals aren't flagged)
const COMMENT = /(\/\/|\/\*|^\s*\*|\{\s*\/\*|<!--)/
// high-confidence process/history markers (verified zero false-positives on the current tree)
const NARRATION = [
  /\bused to be\b/i,
  /\brenamed from\b/i,
  /\bformerly\b/i,
  /\bartistic overhaul\b/i,
  /\bchanged from\b/i,
  /\bpreviously was\b/i,
  /\bbumped (from|to)\b/i,
  /\bEpic [A-Z]\b/,
  /\bfoundation shell\b/i,
  /\bmid-flight\b/i,
  /\boriginal journey\b/i,
  /\bas discussed\b/i,
]

const files = []
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('gen')) continue
      walk(p)
    } else if (CODE_EXT.test(e.name) && !SKIP_FILE.test(e.name)) {
      files.push(p)
    }
  }
}
for (const g of SRC_GLOBS) {
  const abs = join(repoRoot, g)
  if (existsSync(abs)) walk(abs)
}

const problems = []
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (!COMMENT.test(line)) return
    const hit = NARRATION.find((re) => re.test(line))
    if (hit) {
      problems.push(`${file.replace(repoRoot + '/', '')}:${i + 1} — comment narrates process/history (\`${hit.source}\`); comments explain current code only (spec/principle/code-comments.md).`)
    }
  })
}

section('Comment-history — comments explain current code, not process/history (R006)')
note(`scanned ${files.length} source files (tests/stories/fixtures exempt)`)
if (problems.length) {
  for (const p of problems) console.error(`  \x1b[31m✗\x1b[0m ${p}`)
  fail(`${problems.length} process/history comment(s). Rewrite as a timeless "why", or delete (git remembers history).`)
}
ok('no process/history narration in source comments')
