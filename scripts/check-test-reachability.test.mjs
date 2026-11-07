import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { afterEach, test } from 'node:test'
import { pathToFileURL } from 'node:url'

import * as guard from './check-test-reachability.mjs'
import { repoRoot } from './lib.mjs'

const defaultNegative = 'packages/universe/src/__tests__/invisible.assert.ts'
const uiNegative = 'packages/ui/src/invisible.spec.ts'

test('Vitest does not collect an assertion merely because it is under __tests__', () => {
  assert.deepEqual(guard.unreachableTestFiles([defaultNegative]), [defaultNegative])
})

test('the UI package rejects spec filenames excluded by its actual include', () => {
  assert.deepEqual(guard.unreachableTestFiles([uiNegative]), [uiNegative])
})

test('collected controls and ordinary imported helpers remain permitted', () => {
  const controls = [
    'apps/web/src/feature.spec.tsx',
    'packages/universe/src/feature.test.mts',
    'packages/ui/src/primitive.test.tsx',
    'apps/mobile/src/feature.spec.ts',
    'apps/mobile/src/__tests__/assertion.check.ts',
    'apps/mobile/src/shared/testing/fakes.ts',
    'packages/universe/src/testing.ts',
    'packages/universe/src/__tests__/helper.ts',
    'packages/ui/src/testing/helper.ts',
  ]
  assert.deepEqual(guard.unreachableTestFiles(controls), [])
})

const fixtures = []
afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true })
})

// Use the UI package's declared Vitest dependency, without adding a root dependency.
const uiRequire = createRequire(join(repoRoot, 'packages/ui/package.json'))
const { createVitest } = await import(pathToFileURL(uiRequire.resolve('vitest/node')).href)

for (const ui of [false, true]) {
  test(`actual ${ui ? 'UI configuration' : 'Vitest defaults'} collection agrees with reachability without executing fixtures`, async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'cosimosi-collection-')))
    fixtures.push(root)
    const marker = join(root, 'assertion-executed')
    const files = ui
      ? [
          'src/control.test.ts',
          'src/control.test.tsx',
          'src/invisible.spec.ts',
          'src/__tests__/hidden.check.ts',
          'src/__tests__/helper.ts',
        ]
      : [
          'src/control.test.ts',
          'src/control.spec.tsx',
          'src/__tests__/invisible.assert.ts',
          'src/__tests__/helper.ts',
        ]
    for (const file of files) {
      mkdirSync(dirname(join(root, file)), { recursive: true })
      writeFileSync(
        join(root, file),
        `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'executed'); throw new Error('collection-only fixture must never execute');\n`,
      )
    }
    const context = await createVitest(
      'test',
      {
        root,
        config: ui ? join(repoRoot, 'packages/ui/vitest.config.ts') : false,
        configLoader: 'runner',
        watch: false,
        cache: false,
      },
      { cacheDir: join(root, '.cache'), envDir: root, server: { watch: null } },
    )
    try {
      const selected = (await context.globTestSpecifications())
        .map((spec) => relative(root, spec.moduleId).replaceAll('\\', '/'))
        .sort()
      assert.deepEqual(
        selected,
        ui
          ? ['src/control.test.ts', 'src/control.test.tsx']
          : ['src/control.spec.tsx', 'src/control.test.ts'],
      )
      const owner = ui ? 'packages/ui/' : 'packages/universe/'
      assert.deepEqual(
        files.filter((file) => guard.isCollectedTestFile(owner + file)).sort(),
        selected,
      )
      assert.equal(
        existsSync(marker),
        false,
        'collection must not evaluate even a positive fixture body',
      )
      const assertionPaths = files.filter((file) => !file.endsWith('/helper.ts'))
      const excluded = assertionPaths
        .filter((file) => !selected.includes(file))
        .map((file) => owner + file)
      assert.deepEqual(
        guard.unreachableTestFiles(assertionPaths.map((file) => owner + file)),
        excluded,
      )
    } finally {
      await context.close()
    }
  })
}
