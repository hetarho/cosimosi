#!/usr/bin/env node
// Packages-lint probe: proves `eslint.config.packages.mjs` actually bites, the way the demo-isolation
// and boundary probes prove theirs. A lint rule nobody has seen fail is a rule nobody knows is wired —
// and this gate exists because `packages/**` went unlinted by any JS/TS linter while `lint:web` and
// `lint:mobile` both reported green (ARCHITECTURE §4: "a gate's scope is part of the rule").
//
// The fixtures live in a hermetic `.probe-ws-*` workspace (see probe-workspace.mjs), mirrored at the
// real package paths so the config's path-scoped React blocks apply, and are linted with the repo's
// own ESLint + the real config. No production scanner root ever contains them, so a concurrent
// `pnpm lint`/`check` cannot sweep them up (quality-gates §Probe hermeticity).
//
//   node scripts/probe-packages-lint.mjs

import { join } from 'node:path'

import { fail, ok, repoRoot, section } from './lib.mjs'
import { createProbeWorkspace, createWorkspaceLinter } from './probe-workspace.mjs'

const CONFIG = 'eslint.config.packages.mjs'

// A fixture path per scope, because the config's React block is scoped by path: a hook violation
// written outside a `react.ts` / `packages/ui` path must NOT fire, and that negative is half the
// wiring.
const PURE_DIR = 'packages/memory-logic/src'
const REACT_DIR = 'packages/ui/src'
// The scene packages are React without being named `react.*`, so their inclusion is a glob nobody
// would miss removing — hence a probe of its own.
const RENDERER_DIR = 'packages/3d-renderer/src'

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
    file: `${PURE_DIR}/unused-import.ts`,
    source: UNUSED_IMPORT,
    rule: '@typescript-eslint/no-unused-vars',
  },
  {
    file: `${REACT_DIR}/missing-dep.ts`,
    source: MISSING_HOOK_DEP,
    rule: 'react-hooks/exhaustive-deps',
  },
  {
    file: `${REACT_DIR}/conditional-hook.ts`,
    source: HOOK_IN_CONDITION,
    rule: 'react-hooks/rules-of-hooks',
  },
  // Positive renderer-scope probe: an ordinary layer file, not a `react.*` one. Before the scope
  // widened, a missing dependency here was reported by nothing at all.
  {
    file: `${RENDERER_DIR}/missing-dep-layer.tsx`,
    source: MISSING_HOOK_DEP,
    rule: 'react-hooks/exhaustive-deps',
  },
]

// The React block is path-scoped, so the same hook violation in a pure package must stay unreported —
// otherwise the scoping in the config is decoration.
const outOfScope = { file: `${PURE_DIR}/missing-dep-out-of-scope.ts`, source: MISSING_HOOK_DEP }

section('packages lint probe')

const workspace = createProbeWorkspace(repoRoot)
let failure = ''
try {
  for (const probe of [...cases, outOfScope]) workspace.write(probe.file, probe.source)

  const linter = await createWorkspaceLinter(workspace, repoRoot, join(repoRoot, CONFIG))
  const reports = await linter.lintFiles(['packages/**/*.{ts,tsx}'])

  const missed = cases
    .filter(
      (probe) => !(reports.get(probe.file) ?? []).some((message) => message.ruleId === probe.rule),
    )
    .map((probe) => `${probe.file} — ${probe.rule} did not fire`)
  const leaked = (reports.get(outOfScope.file) ?? []).some((message) =>
    message.ruleId?.startsWith('react-hooks/'),
  )

  if (missed.length) {
    failure = `the packages config let these through:\n  ${missed.join('\n  ')}`
  } else if (leaked) {
    failure = 'react-hooks rules reported outside the React file scope; the config scoping is wrong'
  } else {
    ok(`${cases.length} violation(s) reported; react-hooks stays inside its file scope`)
  }
} catch (error) {
  failure = `eslint failed to run on the probe:\n${error.stack ?? error}`
} finally {
  workspace.dispose()
}

if (failure) fail(failure)
