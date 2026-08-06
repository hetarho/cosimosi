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
  // The scene packages are React top to bottom — layers, canvas hosts, the skin context — but none of
  // it is named `react.*`, so the globs above saw a renderer of ~40 components as pure logic. They are
  // the repo's densest hook code (every layer runs `useFrame`, `useMemo` over GPU resources and an
  // effect that disposes them), which makes them the last place a hook rule should be optional.
  'packages/3d-renderer/src/**/*.{ts,tsx}',
  'packages/universe-render/src/**/*.{ts,tsx}',
]

// The scene packages mutate preallocated objects every frame — a uniform's `.value`, a matrix, a pose
// record, a controls instance — because that IS the renderer's architecture (§3.2/§3.3: coordinates and
// per-frame values never enter React state). `react-hooks/immutability` reports every one of those
// writes: 17 findings across 9 files, all of them a `useFrame` body reaching for something the render
// allocated. The rule is not wrong about the compiler's model; it is describing a rule the compiler
// itself does not apply to loop bodies (React Compiler memoizes render code, not `useFrame`), so it
// contradicts these two packages by construction rather than catching drift in them. Off for their
// scope, on everywhere else.
const RENDERER_FRAME_MUTATION = { 'react-hooks/immutability': 'off' }

// The two compiler-model rules, off for a NAMED LIST OF FILES rather than for `packages/**`. Fresh
// count: 23 `refs` + 3 `set-state-in-effect` across the ten files below (job 133's baseline was 25
// under a narrower file scope; the addition is the native canvas host's live-config write, which the
// widened renderer scope above brought into view for the first time). Three idioms account for all of
// them, and the same three carry the app's list in `apps/web/eslint.config.js`:
//
//   latest-ref — `ref.current = latest` during render, read from a callback that must not
//     re-subscribe when an identity moves. `packages/auth/src/react.ts:29-31` is the clearest case: a
//     `useState` initializer there would run twice under StrictMode and orphan a live actor, a
//     subscription and a refresh timer with no dispose handle. The native canvas host's
//     `live.current = {...}` is the same shape and load-bearing for the same reason — the device
//     effect must not re-key on config (job 136).
//   ref-guarded lazy creation — `if (ref.current === null) ref.current = create()`.
//   commit-and-fire effects — presence/exit animation (`packages/ui`'s `usePresence`) and effects that
//     must notify and commit in one pass (`SessionScopeBoundary`, the sequence runner).
//
// A file list, not a blanket off: a NEW file reaching for either idiom fails the gate, and the list can
// only shrink. Every other rule in the set is on and the tree is green against them.
const COMPILER_MODEL_FILES = [
  'packages/3d-renderer/src/canvas/UniverseCanvas.native.tsx',
  'packages/auth/src/react.ts',
  'packages/observability/src/react.tsx',
  'packages/sequence/src/react.ts',
  'packages/ui/src/a11y/use-focus-trap.ts',
  'packages/ui/src/a11y/use-presence.ts',
  'packages/ui/src/primitives/sheet.native.tsx',
  'packages/ui/src/primitives/skeleton.native.tsx',
  'packages/ui/src/primitives/toast.native.tsx',
  'packages/ui/src/primitives/toast.tsx',
]

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
    },
  },
  {
    files: ['packages/3d-renderer/src/**/*.{ts,tsx}', 'packages/universe-render/src/**/*.{ts,tsx}'],
    rules: RENDERER_FRAME_MUTATION,
  },
  {
    files: COMPILER_MODEL_FILES,
    rules: COMPILER_MODEL_DEFERRED,
  },
  // Naming a property beside a rest element is how you OMIT that key, so the binding is unused by
  // construction — `packages/ui`'s `native-styles.ts` drops the web-only `font` group from the token
  // map exactly this way, and the omission is the point of the line. This relaxes only that idiom:
  // every other unused binding still fails, and no site needs a suppression comment to pass. Last
  // block on purpose — flat config REPLACES a rule's options per matching file, so setting this in
  // the first block alone would be undone for `packages/ui/**` by the React block above.
  {
    files: ['packages/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
])
