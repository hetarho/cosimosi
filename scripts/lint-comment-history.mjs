#!/usr/bin/env node
// A comment explains current code only — never process or history. This lightweight guard covers active source and
// executable configuration, flagging a small set of high-confidence narration markers on comment lines.
// Tests/stories/fixtures are exempt because their narration can be intentional. Keep the pattern set tight: a false
// positive breaks the whole `pnpm lint` gate.

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { repoRoot, section, ok, note, fail } from './lib.mjs'

// `proto` is in scope because it is the ONE transport contract the Go server and both TS clients
// share (§2.7): its comments propagate verbatim into generated code the guard below deliberately
// exempts, so narration left here reaches three languages while staying invisible everywhere else.
const SOURCE_ROOTS = ['apps/web/src', 'apps/mobile/src', 'apps/api', 'packages', 'proto', 'scripts']
// tests/stories/fixtures and generated Go (sqlc/proto/values) are exempt.
const SKIP_FILE =
  /(\.(test|spec|stories|probe)\.(?:[mc]?[jt]sx?)$|_test\.go$|_gen\.go$|\.sql\.go$|\.pb\.go$|_connect\.go$)/
const CODE_EXT = /\.(go|[mc]?[jt]sx?|sql|proto)$/
const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  'gen',
  'generated',
  'vendor',
])
const ignoredDir = (name) =>
  IGNORED_DIRS.has(name) || name.startsWith('.probe-') || name.startsWith('__boundary_probe_')
// The guard necessarily contains its own negative fixtures and pattern documentation. The job
// scaffolder has one narrower line exemption for the public CLI example that contains a source kind.
const EXEMPT_FILES = new Set(['scripts/lint-comment-history.mjs'])
const EXEMPT_LINES = new Map([
  ['scripts/new-job.mjs', /^\s*\/\/\s+pnpm spec:job (?:plan|change|refactor) \d+\b/],
])
// Only lines that carry a comment marker are inspected. SQL uses -- while the other scanned
// languages use their own markers; keeping them separate avoids treating a JS decrement as SQL.
// proto uses // and /* */, so COMMENT already covers it.
const COMMENT = /(\/\/|\/\*|^\s*\*|\{\s*\/\*|<!--)/
const SQL_COMMENT = /(--|\/\*|^\s*\*)/
const hasComment = (line, file = '') => (file.endsWith('.sql') ? SQL_COMMENT : COMMENT).test(line)
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
  /\b(?:change|refactor|review)[-\s]?\d/i,
  /\bcode-review\/\d/i,
  /\bR\d{3}\b/,
  /\[\d{2}\]/,
  /\bT0\d{2,}\b/,
  /\bfoundation shell\b/i,
  /\bmid-flight\b/i,
  /\boriginal journey\b/i,
  /\bas discussed\b/i,
  /\b(?:scheduled|slated) for (?:retirement|removal|deprecation)\b/i,
]

// Path-scoped rules apply only under the listed path fragments. The bare acceptance-criteria
// form (`A5`, `(A7)`) is forbidden everywhere by the principle, but the memory epic + the
// frontend carry ~200 such refs from earlier batches; enforcing them tree-wide is a dedicated
// cleanup, not this guard. Here we hold the two contexts that were cleaned (the AI + admin
// backend) Ax-free. Bracketed requirement anchors ([A11]) stay allow-listed via the lookbehind.
const SCOPED_NARRATION = [
  { re: /(?<!\[)\bA\d+\b/, paths: ['apps/api/internal/ai/', 'apps/api/internal/admin/'] },
]

const scopedHit = (line, file) =>
  SCOPED_NARRATION.find((rule) => rule.paths.some((p) => file.includes(p)) && rule.re.test(line))

const narrates = (line, file = '') =>
  hasComment(line, file) && (NARRATION.find((re) => re.test(line)) || scopedHit(line, file))

const filesUnder = (root) => {
  const files = new Set()
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (ignoredDir(entry.name)) continue
        walk(path)
      } else if (CODE_EXT.test(entry.name) && !SKIP_FILE.test(entry.name)) {
        files.add(path)
      }
    }
  }
  const addTopLevelCode = (dir) => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && CODE_EXT.test(entry.name) && !SKIP_FILE.test(entry.name)) {
        files.add(join(dir, entry.name))
      }
    }
  }

  for (const sourceRoot of SOURCE_ROOTS) {
    const path = join(root, sourceRoot)
    if (existsSync(path)) walk(path)
  }

  // Build/lint/test configuration executes from the repository or an app root, outside src/.
  addTopLevelCode(root)
  const appsRoot = join(root, 'apps')
  if (existsSync(appsRoot)) {
    for (const app of readdirSync(appsRoot, { withFileTypes: true })) {
      if (app.isDirectory()) addTopLevelCode(join(appsRoot, app.name))
    }
  }

  return [...files]
}

const findProblems = (files, root) => {
  const problems = []
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n')
    const repoRelative = relative(root, file)
    if (EXEMPT_FILES.has(repoRelative)) continue
    lines.forEach((line, index) => {
      if (EXEMPT_LINES.get(repoRelative)?.test(line)) return
      if (!hasComment(line, repoRelative)) return
      const hit = NARRATION.find((re) => re.test(line)) || scopedHit(line, repoRelative)?.re
      if (hit) {
        problems.push(
          `${repoRelative}:${index + 1} — comment narrates process/history (\`${hit.source}\`); comments explain current code only (spec/principle/code-comments.md).`,
        )
      }
    })
  }
  return problems
}

// `--probe` self-test: proves the guard catches the process/plan forms and leaves the
// allowed design-rationale anchors (requirement IDs, § section pointers) untouched.
if (process.argv.includes('--probe')) {
  section('Comment-history probe — catch process/plan refs, allow rule/section anchors')
  // Each case is [line, file]; file is only meaningful for the path-scoped Ax rule.
  const mustCatch = [
    ['// this mirrors plan 20 exactly', ''],
    ['-- this SQL follows plan 20 exactly', 'apps/api/db/queries/memory/probe.sql'],
    ['// the write contract plan 20 shipped', 'proto/cosimosi/memory/v1/probe.proto'],
    ['\t// Link (plan 21) runs last', ''], // Go comment
    ['// Job 27 provides the implementation', ''],
    ['// change 03 established this seam', ''],
    ['// change-04 widened this list', ''],
    ['// refactor 17 moved the adapter', ''],
    ['// review 14 found this edge', ''],
    ['// follow code-review/12 here', ''],
    ['// the R001 regression', ''],
    ['// account rows stay together ([64])', ''],
    ['// the AI config reader (T010)', ''],
    ['// during Epic B the clock advances', ''],
    ['// this alias is scheduled for retirement next quarter', ''],
    ['// this shim is slated for removal after rollout', ''],
    ['// this endpoint is scheduled for deprecation', ''],
    // the acceptance-criteria form, scoped to the AI/admin backend contexts
    ['// fails here, never at row-insert time (A7)', 'apps/api/internal/ai/voyage/client.go'],
    ['// no vendor error escapes (A5)', 'apps/api/internal/admin/service.go'],
  ]
  const mustAllow = [
    ['// keeps the Diary immutable [I2]', ''],
    ['// preserves the privacy boundary [P4] and product value [V3]', ''],
    ['// surfaced for the awaken animation ([E7a])', ''],
    ['// atomically with the launch (§2.6)', ''],
    ['// bump the counter', ''], // no marker of any kind
    ['// a past-dated diary leaves the universe clock unchanged', ''],
    // the same Ax form OUTSIDE the scoped contexts is left to the earlier-epic convention
    ['// exactly-once over the interval (A4/A10)', 'apps/api/internal/memory/consolidate.go'],
    [
      '// non-dismissible while recalling (A4)',
      'apps/web/src/widgets/recall-flow/ui/RecallFlowSheet.tsx',
    ],
    // a bracketed requirement anchor is a rule reference, allowed even in the scoped contexts
    ['// Link only strengthens [A11]', 'apps/api/internal/admin/service.go'],
  ]
  const missed = mustCatch.filter(([l, f]) => !narrates(l, f))
  const falsePos = mustAllow.filter(([l, f]) => narrates(l, f))
  const probeRoot = mkdtempSync(join(tmpdir(), 'cosimosi-comment-history-'))
  let rootFailures = []
  try {
    mkdirSync(join(probeRoot, 'apps/web'), { recursive: true })
    writeFileSync(join(probeRoot, 'eslint.config.mjs'), '// change 03 established this rule\n')
    writeFileSync(join(probeRoot, 'apps/web/vite.config.ts'), '// account layout follows [64]\n')
    const ignoredFiles = [
      'apps/api/node_modules/ignored.go',
      'apps/api/vendor/ignored.go',
      'apps/api/generated/ignored.go',
      'apps/api/dist/ignored.go',
      'apps/api/build/ignored.go',
      'apps/api/coverage/ignored.go',
      'apps/api/gen/ignored.go',
      'apps/api/.probe-stale/ignored.go',
      'apps/api/internal/__boundary_probe_stale/ignored.go',
    ]
    for (const file of ignoredFiles) {
      const path = join(probeRoot, file)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, '// review 14 should stay outside the scan\n')
    }
    const discovered = filesUnder(probeRoot).map((file) => relative(probeRoot, file))
    const expectedConfigFiles = ['eslint.config.mjs', 'apps/web/vite.config.ts']
    const missingRoots = expectedConfigFiles.filter((file) => !discovered.includes(file))
    const configProblems = findProblems(filesUnder(probeRoot), probeRoot)
    const missingDetections = expectedConfigFiles.filter(
      (file) => !configProblems.some((problem) => problem.startsWith(`${file}:`)),
    )
    const scannedIgnoredFiles = ignoredFiles.filter((file) => discovered.includes(file))
    rootFailures = [...missingRoots, ...missingDetections, ...scannedIgnoredFiles]
  } finally {
    rmSync(probeRoot, { recursive: true, force: true })
  }
  if (missed.length || falsePos.length || rootFailures.length) {
    for (const [l] of missed) console.error(`  \x1b[31m✗\x1b[0m should catch: ${l}`)
    for (const [l] of falsePos) console.error(`  \x1b[31m✗\x1b[0m should allow: ${l}`)
    for (const failure of rootFailures)
      console.error(`  \x1b[31m✗\x1b[0m config-root probe: ${failure}`)
    fail('comment-history probe failed')
  }
  ok(
    'probe caught every process/plan ref and both config roots; rule/section anchors stayed allowed',
  )
  process.exit(0)
}

const files = filesUnder(repoRoot)
const problems = findProblems(files, repoRoot)

section('Comment-history — comments explain current code, not process/history')
note(`scanned ${files.length} source/config files (tests/stories/fixtures exempt)`)
if (problems.length) {
  for (const p of problems) console.error(`  \x1b[31m✗\x1b[0m ${p}`)
  fail(
    `${problems.length} process/history comment(s). Rewrite as a timeless "why", or delete (git remembers history).`,
  )
}
ok('no process/history narration in source comments')
