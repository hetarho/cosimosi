import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, test } from 'node:test'

import { findFsdLayoutProblems } from './lint-fsd-layout.mjs'

const roots = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cosimosi-fsd-'))
  roots.push(root)
  return root
}

function put(root, path, source = 'export const value = 1\n') {
  const target = join(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, source)
}

test('rejects a mobile product screen under app/navigation/screens', () => {
  const root = fixture()
  put(root, 'apps/mobile/src/app/navigation/screens/UniverseScreen.tsx')

  const problems = findFsdLayoutProblems(root)

  assert.ok(problems.some((problem) => problem.includes('product composition')))
})

test('allows the neutral mobile boot shell under app/navigation/screens', () => {
  const root = fixture()
  put(root, 'apps/mobile/src/app/navigation/screens/BootScreen.tsx')

  assert.deepEqual(findFsdLayoutProblems(root), [])
})

test('rejects a byte-identical same-relative pure module in both apps', () => {
  const root = fixture()
  put(root, 'apps/web/src/features/example/model/example-store.ts')
  put(root, 'apps/mobile/src/features/example/model/example-store.ts')

  const problems = findFsdLayoutProblems(root)

  assert.ok(problems.some((problem) => problem.includes('byte-identical pure module')))
})
