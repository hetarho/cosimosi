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

const SRC_GLOBS = ['apps/web/src', 'apps/mobile/src', 'apps/api', 'packages']
// tests/stories/fixtures and generated Go (sqlc/proto/values) are exempt.
const SKIP_FILE =
  /(\.(test|spec|stories|probe)\.[jt]sx?$|_test\.go$|_gen\.go$|\.sql\.go$|\.pb\.go$|_connect\.go$)/
const CODE_EXT = /\.(go|[jt]sx?)$/
// only lines that carry a comment marker are inspected (so string literals aren't flagged);
// Go and TS/JS share the // and /* */ markers.
const COMMENT = /(\/\/|\/\*|^\s*\*|\{\s*\/\*|<!--)/
// high-confidence process/history markers (verified zero false-positives on the current tree).
// Plan/job/finding numbers and epic names are ticket-like references the timeless-comment rule
// forbids. Two things are deliberately NOT flagged: requirement-ID anchors that *name a rule*
// (e.g. [I2], [E7a]) and architecture-section pointers (§3.4) — both explain why the code must
// be this way (design rationale), not when it was written, and § refs are an established
// house convention across the tree.
const NARRATION = [
  /\bused to be\b/i,
  /\brenamed from\b/i,
  /\bformerly\b/i,
  /\bartistic overhaul\b/i,
  /\bchanged from\b/i,
  /\bpreviously was\b/i,
  /\bbumped (from|to)\b/i,
  /\bEpic [A-Z]\b/,
  /\bplan[-\s]?\d/i,
  /\bjob[-\s]?\d/i,
  /\bR0\d\d\b/,
  /\bfoundation shell\b/i,
  /\bmid-flight\b/i,
  /\boriginal journey\b/i,
  /\bas discussed\b/i,
]

const narrates = (line) => COMMENT.test(line) && NARRATION.find((re) => re.test(line))

// `--probe` self-test: proves the guard catches the process/plan forms and leaves the
// allowed design-rationale anchors (requirement IDs, § section pointers) untouched.
if (process.argv.includes('--probe')) {
  section('Comment-history probe — catch process/plan refs, allow rule/section anchors')
  const mustCatch = [
    '// this mirrors plan 20 exactly',
    '\t// Link (plan 21) runs last', // Go comment
    '// Job 27 provides the implementation',
    '// the R001 regression',
    '// during Epic B the clock advances',
  ]
  const mustAllow = [
    '// keeps the Diary immutable [I2]',
    '// surfaced for the awaken animation ([E7a])',
    '// atomically with the launch (§2.6)',
    '// bump the counter', // no marker of any kind
  ]
  const missed = mustCatch.filter((l) => !narrates(l))
  const falsePos = mustAllow.filter((l) => narrates(l))
  if (missed.length || falsePos.length) {
    for (const l of missed) console.error(`  \x1b[31m✗\x1b[0m should catch: ${l}`)
    for (const l of falsePos) console.error(`  \x1b[31m✗\x1b[0m should allow: ${l}`)
    fail('comment-history probe failed')
  }
  ok('probe caught every process/plan ref and allowed every rule/section anchor')
  process.exit(0)
}

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
      problems.push(
        `${file.replace(repoRoot + '/', '')}:${i + 1} — comment narrates process/history (\`${hit.source}\`); comments explain current code only (spec/principle/code-comments.md).`,
      )
    }
  })
}

section('Comment-history — comments explain current code, not process/history (R006)')
note(`scanned ${files.length} source files (tests/stories/fixtures exempt)`)
if (problems.length) {
  for (const p of problems) console.error(`  \x1b[31m✗\x1b[0m ${p}`)
  fail(
    `${problems.length} process/history comment(s). Rewrite as a timeless "why", or delete (git remembers history).`,
  )
}
ok('no process/history narration in source comments')
