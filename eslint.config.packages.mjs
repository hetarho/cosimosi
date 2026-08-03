import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

// The JS/TS linter for `packages/**` — the third of the three, beside `lint:web` (oxlint, cwd
// apps/web) and `lint:mobile` (eslint, cwd apps/mobile). Neither of those can see `packages/`, which
// left the cross-app core — the highest-leverage code in the repo — the least checked code in it.
// ARCHITECTURE §4: "a gate's scope is part of the rule."
//
// It lives at the repo root rather than per package because 23 packages sharing one rule set is the
// point; a per-package `lint` script would also duplicate the root pass (and none exists — see the
// `lint:packages` script).
//
// ESLint flat config **replaces** rule options per matching file rather than merging them, so every
// scoped `files` block below restates the shared `extends`. Dropping that line is how a block silently
// loses the base rules for exactly the files it was meant to tighten — the same trap
// `apps/web/eslint.config.js` documents.

// Generated output is owned by its generator, so linting it produces findings nobody can act on — the
// principle `.prettierignore` already states. Keep this list in step with `scripts/check-generated.mjs`.
const GENERATED = [
  '**/gen/**',
  '**/*.gen.ts',
  '**/*.gen.tsx',
  '**/*.gen.css',
  'packages/config/src/values.gen.ts',
]

// Where a React seam actually lives. Package roots are deliberately React-free (a `packages/*` index
// exports pure logic; the React mirror is a separate `./react` export), so a blanket React config
// would report hook rules against files that have no hooks and can never grow any.
const REACT_FILES = [
  'packages/**/react.ts',
  'packages/**/react.tsx',
  'packages/**/react/**/*.{ts,tsx}',
  'packages/ui/**/*.{ts,tsx}',
]

// Two rules from `react-hooks`' recommended-latest set are OFF, deliberately and with the whole tree
// measured: they encode the React Compiler's stricter model, and the seams here use two idioms that
// model rejects but that are correct for hand-written React 19 — every instance already carrying a
// prose comment explaining itself.
//
//   `refs` (22 findings) — the latest-ref idiom (`ref.current = latest` during render, read from a
//     callback) and ref-guarded lazy creation. `packages/auth/src/react.ts:29-31` is the clearest
//     case: a `useState` initializer there would run twice under StrictMode and orphan a live actor,
//     a subscription and a refresh timer with no dispose handle.
//   `set-state-in-effect` (3 findings) — presence/exit-animation state (`packages/ui`'s
//     `usePresence`), and effects that must fire a callback and commit in the same pass
//     (`SessionScopeBoundary`).
//
// Turning them on today would mean 25 inline suppressions to land a green gate, which is the thing
// §4 forbids ("no gate uses suppression to stay green"). Reviewing those two idioms against the
// compiler model is its own change with its own reasoning — not a lint-wiring job. Every OTHER rule in
// the set is on and the tree is green against them, so this is a named exclusion, not a ratchet.
const COMPILER_MODEL_DEFERRED = {
  'react-hooks/refs': 'off',
  'react-hooks/set-state-in-effect': 'off',
}

export default defineConfig([
  { ignores: ['**/node_modules/**', '**/dist/**', ...GENERATED] },
  {
    files: ['packages/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
  {
    files: REACT_FILES,
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
    ],
    rules: {
      // An error, not recommended-latest's `warn`: this is the rule whose absence made the gate hole
      // worth a job, and a warning is a finding the next green run scrolls past.
      'react-hooks/exhaustive-deps': 'error',
      ...COMPILER_MODEL_DEFERRED,
    },
  },
])
