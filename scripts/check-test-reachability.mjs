#!/usr/bin/env node
// Filename reachability for the repository's Vitest and mobile Jest runners. Vitest collects
// test/spec filenames; mobile Jest collects js/jsx/ts/tsx test/spec names and __tests__ children.
// The UI package's explicit include narrows its Vitest files to src/**/*.test.{ts,tsx}.
// Ordinary imported helpers need not be independent test files.
//
//   node scripts/check-test-reachability.mjs
//   node scripts/check-test-reachability.mjs --probe

import { readdirSync, existsSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fail, note, ok, repoRoot, section } from './lib.mjs'

const ROOTS = ['apps/web/src', 'apps/mobile/src', 'apps/blog/src', 'packages']
const CODE_FILE = /\.[cm]?[jt]sx?$/
const MOBILE_CODE_FILE = /\.[jt]sx?$/
const TEST_NAME = /(^|[/.])(test|spec)\.[cm]?[jt]sx?$/
const VITEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/
const UI_FILE = /^packages\/ui\/src\/.+\.test\.(ts|tsx)$/
const TEST_DIRECTORY = /(^|\/)__tests__\//
// Assertion-like suffixes are candidates, while an ordinary testing.ts or helper.ts module remains
// free to be imported by a collected suite. A test/spec filename is checked even if a local include
// excludes that convention.
const TEST_SHAPED = /(\.|^)(probe|tests|testing|check|checks|assert|asserts)\.[cm]?[jt]sx?$/
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'gen', 'ios', 'android', '.expo'])
const portable = (file) => file.replaceAll('\\', '/')

export function isCollectedTestFile(file) {
  const path = portable(file)
  if (path.startsWith('apps/mobile/'))
    return MOBILE_CODE_FILE.test(path) && (TEST_NAME.test(path) || TEST_DIRECTORY.test(path))
  if (path.startsWith('packages/ui/')) return UI_FILE.test(path)
  return VITEST_FILE.test(path)
}

export function unreachableTestFiles(files) {
  return files.filter((file) => {
    const path = portable(file)
    return (TEST_NAME.test(path) || TEST_SHAPED.test(path)) && !isCollectedTestFile(path)
  })
}

function advice(file) {
  if (file.startsWith('packages/ui/'))
    return 'Use a src/**/*.test.ts or src/**/*.test.tsx filename in packages/ui.'
  if (file.startsWith('apps/mobile/'))
    return 'Use a js/jsx/ts/tsx Jest test/spec filename or __tests__/ assertion file.'
  return 'Use a *.test.* or *.spec.* filename; __tests__/ alone does not collect Vitest assertions.'
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
    for (const file of unreachable)
      console.error(
        `  \x1b[31m✗\x1b[0m ${file} — reads as a test or check, but its runner excludes it. ${advice(file)}`,
      )
    fail(
      `${unreachable.length} file(s) look like tests that never run. A gate nobody runs is not a gate.`,
    )
  }

  const collected = files.filter(isCollectedTestFile).length
  note(`${collected} collected test filename(s) across ${ROOTS.length} root(s)`)
  ok('test-shaped files match their runner collection rules')
}

function runProbe() {
  const offenders = [
    'apps/mobile/src/app/providers/api-client.probe.ts',
    'apps/mobile/src/invisible.test.mjs',
    'apps/mobile/src/invisible.test.mts',
    'apps/mobile/src/__tests__/hidden.check.mjs',
    'apps/web/src/shared/lib/thing.check.ts',
    'packages/universe/src/thing.assert.tsx',
    'packages/universe/src/__tests__/invisible.assert.ts',
    'packages/ui/src/invisible.spec.ts',
    'packages/ui/src/__tests__/hidden.check.ts',
  ]
  const collected = [
    'apps/mobile/src/app/providers/api-client.test.ts',
    'apps/mobile/src/__tests__/assertion.check.ts',
    'apps/web/src/shared/lib/thing.spec.tsx',
    'packages/ui/src/primitive.test.tsx',
    'packages/demo/src/integrity.test.ts',
  ]
  const helpers = [
    'apps/mobile/src/shared/testing/fakes.ts',
    'packages/universe/src/testing.ts',
    'packages/universe/src/__tests__/helper.ts',
  ]
  const missed = offenders.filter((file) => unreachableTestFiles([file]).length === 0)
  if (missed.length) fail(`these unreachable files were not reported:\n  ${missed.join('\n  ')}`)
  const wrongly = [...collected, ...helpers].filter((file) => unreachableTestFiles([file]).length)
  if (wrongly.length)
    fail(`these collected files or helpers were reported:\n  ${wrongly.join('\n  ')}`)
  if (collected.some((file) => !isCollectedTestFile(file)) || helpers.some(isCollectedTestFile))
    fail('collected-file counts must distinguish runner matches from imported helpers')
  ok(
    `${offenders.length} unreachable names reported; ${collected.length} collected controls and ${helpers.length} helpers preserved`,
  )
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else if (CODE_FILE.test(entry.name)) yield path
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  section('test reachability')
  if (process.argv.includes('--probe')) runProbe()
  else runCheck()
}
