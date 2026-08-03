#!/usr/bin/env node
// Packages-lint probe: proves `eslint.config.packages.mjs` actually bites, the way the demo-isolation
// and boundary probes prove theirs. A lint rule nobody has seen fail is a rule nobody knows is wired —
// and this gate exists because `packages/**` went unlinted by any JS/TS linter while `lint:web` and
// `lint:mobile` both reported green (ARCHITECTURE §4: "a gate's scope is part of the rule").
//
// It writes throwaway files under packages/, runs ESLint on them with the real config, and asserts the
// expected rule fires. The files are removed either way.
//
//   node scripts/probe-packages-lint.mjs

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { execFileSync } from 'node:child_process'

import { fail, ok, repoRoot, section } from './lib.mjs'

const CONFIG = 'eslint.config.packages.mjs'

// A probe dir per scope, because the config's React block is scoped by path: a hook violation written
// outside a `react.ts` / `packages/ui` path must NOT fire, and that negative is half the wiring.
const pureDir = mkdtempSync(join(repoRoot, 'packages/memory-logic/src/.probe-'))
const reactDir = mkdtempSync(join(repoRoot, 'packages/ui/src/.probe-'))

const UNUSED_IMPORT = `import { createEmotion } from '@cosimosi/emotion'\nexport const value = 1\n`

// The rule the finding named as the concrete risk: this batch shipped four useEffects and a nine-entry
// dependency array with nothing checking them.
const MISSING_HOOK_DEP = `import { useEffect } from 'react'

export function useProbe(token: string) {
  useEffect(() => {
    console.log(token)
  }, [])
}
`

const HOOK_IN_CONDITION = `import { useState } from 'react'

export function useProbe(on: boolean) {
  if (on) {
    const [value] = useState(0)
    return value
  }
  return 0
}
`

// Each case: where it is written, what it is called, which rule must report it.
const cases = [
  {
    dir: pureDir,
    name: 'unused-import.ts',
    source: UNUSED_IMPORT,
    rule: '@typescript-eslint/no-unused-vars',
  },
  {
    dir: reactDir,
    name: 'missing-dep.ts',
    source: MISSING_HOOK_DEP,
    rule: 'react-hooks/exhaustive-deps',
  },
  {
    dir: reactDir,
    name: 'conditional-hook.ts',
    source: HOOK_IN_CONDITION,
    rule: 'react-hooks/rules-of-hooks',
  },
]

// The React block is path-scoped, so the same hook violation in a pure package must stay unreported —
// otherwise the scoping in the config is decoration.
const outOfScope = { dir: pureDir, name: 'missing-dep-out-of-scope.ts', source: MISSING_HOOK_DEP }

function lint({ dir, name, source }) {
  const file = join(dir, name)
  writeFileSync(file, source)
  try {
    execFileSync(
      'npx',
      ['eslint', '--config', CONFIG, '--no-ignore', '--format', 'json', relative(repoRoot, file)],
      { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
    return []
  } catch (error) {
    const stdout = error.stdout ?? ''
    if (!stdout.trim().startsWith('['))
      fail(`eslint failed to run on the probe:\n${stdout}\n${error.stderr ?? ''}`)
    const [result] = JSON.parse(stdout)
    return result?.messages ?? []
  }
}

section('packages lint probe')
try {
  const missed = []
  for (const probe of cases) {
    const reported = lint(probe).some((message) => message.ruleId === probe.rule)
    if (!reported) missed.push(`${probe.name} — ${probe.rule} did not fire`)
  }

  const leaked = lint(outOfScope).some((message) => message.ruleId?.startsWith('react-hooks/'))

  if (missed.length) fail(`the packages config let these through:\n  ${missed.join('\n  ')}`)
  if (leaked)
    fail('react-hooks rules reported outside the React file scope; the config scoping is wrong')

  ok(`${cases.length} violation(s) reported; react-hooks stays inside its file scope`)
} finally {
  rmSync(pureDir, { recursive: true, force: true })
  rmSync(reactDir, { recursive: true, force: true })
}
