#!/usr/bin/env node
// Every test-shaped file under an app or package is actually collected by that project's runner.
//
// A file can look like a test, typecheck like a test, be reviewed like a test, and never run. The
// runners collect by filename: Jest's defaults (which the React Native preset does not override) and
// Vitest's defaults both match `*.test.*` / `*.spec.*` and anything under `__tests__/`. A file named
// for any other convention — `*.probe.ts` being the tempting one, since the repo's gate probes use
// that word — is collected by nothing, and nothing says so.
//
//   node scripts/check-test-reachability.mjs
//   node scripts/check-test-reachability.mjs --probe   self-test that the rule fires
//
// Runs over strings only, so it writes nothing and needs no fixture workspace.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

import { fail, note, ok, repoRoot, section } from './lib.mjs'

const ROOTS = ['apps/web/src', 'apps/mobile/src', 'apps/blog/src', 'packages']

// What a runner collects. Anything a person would read as a test must land here.
const COLLECTED = /(\.|^)(test|spec)\.[cm]?[jt]sx?$|(^|\/)__tests__\//
// What reads as a test or a check but is not `test`/`spec`. `probe` is the live case: the repo's own
// gate probes are `scripts/probe-*.mjs`, invoked by name from package.json, and the convention leaked
// into an app's source tree where nothing invokes anything.
const TEST_SHAPED = /(\.|^)(probe|tests|testing|check|checks|assert|asserts)\.[cm]?[jt]sx?$/

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'gen', 'ios', 'android', '.expo'])

export function unreachableTestFiles(files) {
  return files.filter((file) => TEST_SHAPED.test(file) && !COLLECTED.test(file))
}

section('test reachability')

if (process.argv.includes('--probe')) {
  runProbe()
} else {
  runCheck()
}

function runCheck() {
  const files = []
  for (const root of ROOTS) {
    const abs = join(repoRoot, root)
    if (!existsSync(abs)) continue
    for (const file of walk(abs)) files.push(relative(repoRoot, file).replaceAll('\\', '/'))
  }
  if (files.length === 0) fail(`no source files found under ${ROOTS.join(', ')}`)

  const unreachable = unreachableTestFiles(files)
  if (unreachable.length > 0) {
    for (const file of unreachable) {
      console.error(
        `  \x1b[31m✗\x1b[0m ${file} — reads as a test or check, but no runner collects it. ` +
          `Rename it to *.test.* / *.spec.*, or move it under __tests__/.`,
      )
    }
    fail(
      `${unreachable.length} file(s) look like tests that never run. A gate nobody runs is not a gate.`,
    )
  }

  const collected = files.filter((file) => COLLECTED.test(file)).length
  note(`${collected} collected test file(s) across ${ROOTS.length} root(s)`)
  ok('no test-shaped file is invisible to its runner')
}

function runProbe() {
  const offenders = [
    'apps/mobile/src/app/providers/api-client.probe.ts',
    'apps/web/src/shared/lib/thing.check.ts',
    'packages/universe/src/thing.assert.tsx',
  ]
  const permitted = [
    'apps/mobile/src/app/providers/api-client.test.ts',
    'apps/web/src/shared/lib/thing.spec.tsx',
    'packages/universe/src/__tests__/thing.ts',
    // Helper modules a test imports. They are not tests and must not be demanded to look like ones.
    'apps/mobile/src/shared/testing/fakes.ts',
    'packages/demo/src/integrity.test.ts',
  ]

  const missed = offenders.filter((file) => unreachableTestFiles([file]).length === 0)
  if (missed.length > 0) {
    fail(`these unreachable files were not reported:\n  ${missed.join('\n  ')}`)
  }

  const wrongly = permitted.filter((file) => unreachableTestFiles([file]).length > 0)
  if (wrongly.length > 0) {
    fail(
      `these files are collected (or are plain helpers) and must not be reported:\n  ${wrongly.join('\n  ')}`,
    )
  }

  ok(
    `${offenders.length} unreachable name(s) reported; ${permitted.length} collected/helper path(s) left alone`,
  )
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) yield path
  }
}
