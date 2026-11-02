// Negative probes for the package entry lint (ARCH-43): each rule fires on a planted violation in a
// throwaway workspace, and its allowances spare only what they name.

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, test } from 'node:test'

import {
  compareDeadExports,
  findDeadExports,
  findEntryProblems,
  findManifestProblems,
} from './check-package-entries.mjs'

const roots = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'cosimosi-entries-'))
  roots.push(root)
  return root
}

function put(root, path, content) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), content)
}

function pkg(root, name, exportsMap) {
  put(
    root,
    `packages/${name}/package.json`,
    JSON.stringify({ name: `@cosimosi/${name}`, exports: exportsMap }),
  )
}

test('a non-rendering root that reaches React fails; zustand, types and rendering packages pass', () => {
  const root = workspace()
  pkg(root, 'leaky', { '.': './src/index.ts' })
  put(root, 'packages/leaky/src/index.ts', "export { useThing } from './thing.ts'\n")
  put(
    root,
    'packages/leaky/src/thing.ts',
    "import { useState } from 'react'\nexport const useThing = () => useState(0)\n",
  )
  pkg(root, 'pure', { '.': './src/index.ts', './react': './src/react.ts' })
  put(
    root,
    'packages/pure/src/index.ts',
    "import { create } from 'zustand'\nimport type { ReactNode } from 'react'\nexport type Slot = ReactNode\nexport const useStore = create(() => ({}))\n",
  )
  put(root, 'packages/pure/src/react.ts', "export { useState } from 'react'\n")
  pkg(root, 'ui', { '.': './src/index.ts' })
  put(root, 'packages/ui/src/index.ts', "export { useState } from 'react'\n")
  pkg(root, 'through', { '.': './src/index.ts' })
  put(root, 'packages/through/src/index.ts', "export { useThing } from '@cosimosi/leaky'\n")

  const problems = findEntryProblems(root)
  assert.deepEqual(
    problems.map((problem) => problem.split(' — ')[0]),
    ['@cosimosi/leaky', '@cosimosi/through'],
  )
  assert.match(problems[0], /reaches react via packages\/leaky\/src\/index\.ts → \.\/thing\.ts/)
})

test('an entry using export * fails, and a native entry may not drift from the default it re-exports', () => {
  const root = workspace()
  pkg(root, 'starry', { '.': './src/index.ts' })
  put(root, 'packages/starry/src/index.ts', "export * from './all.ts'\n")
  put(root, 'packages/starry/src/all.ts', 'export const a = 1\n')
  pkg(root, 'forked', {
    '.': { 'react-native': './src/index.native.ts', default: './src/index.ts' },
  })
  put(root, 'packages/forked/src/index.ts', 'export const shared = 1\nexport const Host = 2\n')
  put(
    root,
    'packages/forked/src/index.native.ts',
    "export { Host } from './host.native.ts'\nexport { other } from './index.ts'\n",
  )
  put(root, 'packages/forked/src/host.native.ts', 'export const Host = 3\n')

  const problems = findEntryProblems(root)
  assert.ok(
    problems.some((problem) => /starry\/src\/index\.ts — entry uses `export \*`/.test(problem)),
  )
  assert.ok(
    problems.some((problem) =>
      problem.includes(
        '@cosimosi/forked — the react-native entry differs from the default (web only: shared; native only: other)',
      ),
    ),
    problems.join('\n'),
  )
})

test('an exported value nothing outside imports is dead, and a new one fails against the baseline', () => {
  const root = workspace()
  pkg(root, 'lib', { '.': './src/index.ts' })
  put(
    root,
    'packages/lib/src/index.ts',
    'export const used = 1\nexport const unused = 2\nexport type OnlyAType = number\nexport function alsoUnused() {}\n',
  )
  put(
    root,
    'packages/lib/src/inside.test.ts',
    "import { unused } from '@cosimosi/lib'\nvoid unused\n",
  )
  put(root, 'apps/web/src/main.ts', "import { used } from '@cosimosi/lib'\nvoid used\n")

  const dead = findDeadExports(root)
  assert.deepEqual(dead, { '@cosimosi/lib': ['alsoUnused', 'unused'] })
  assert.deepEqual(compareDeadExports(dead, { '@cosimosi/lib': ['unused'] }), {
    added: ['@cosimosi/lib: alsoUnused'],
    removed: [],
  })
  assert.deepEqual(compareDeadExports({}, { '@cosimosi/lib': ['unused'] }), {
    added: [],
    removed: ['@cosimosi/lib: unused'],
  })
})

test('a manifest must declare what non-test source imports, and import what it declares', () => {
  const root = workspace()
  put(
    root,
    'packages/drifty/package.json',
    JSON.stringify({
      name: '@cosimosi/drifty',
      exports: { '.': './src/index.ts' },
      dependencies: { zod: '^1', 'unused-lib': '^1', 'font-pack': '^1' },
      devDependencies: { vitest: '^4', xstate: '^5' },
    }),
  )
  put(
    root,
    'packages/drifty/src/index.ts',
    "import { z } from 'zod'\nimport { readFileSync } from 'node:fs'\nimport type { ActorRef } from 'xstate'\nimport { nanoid } from 'nanoid'\nexport const parse = [z, readFileSync, nanoid]\nexport type Ref = ActorRef<never, never>\n",
  )
  put(root, 'packages/drifty/src/fonts.css', "@import 'font-pack/variable.css';\n")
  put(
    root,
    'packages/drifty/src/index.test.ts',
    "import { it } from 'vitest'\nimport 'test-only-lib'\nit('x', () => {})\n",
  )
  put(root, 'packages/drifty/src/flow-test-harness.ts', "import 'harness-only-lib'\n")

  assert.deepEqual(findManifestProblems(root), [
    '@cosimosi/drifty — packages/drifty/src/index.ts imports nanoid, which is not in dependencies or peerDependencies',
    '@cosimosi/drifty — packages/drifty/src/index.ts imports types from xstate, which is not in dependencies or peerDependencies',
    '@cosimosi/drifty — depends on unused-lib, which no non-test source file imports',
  ])
})
