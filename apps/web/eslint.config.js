import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import boundaries from 'eslint-plugin-boundaries'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

const layers = ['app', 'pages', 'widgets', 'features', 'entities', 'shared']
const slicedLayers = ['pages', 'widgets', 'features', 'entities', 'shared']
const lowerLayers = {
  app: layers,
  pages: ['widgets', 'features', 'entities', 'shared'],
  widgets: ['features', 'entities', 'shared'],
  features: ['entities', 'shared'],
  entities: ['shared'],
  shared: [],
}
const sameSliceRules = slicedLayers.map((layer) => ({
  from: { type: layer, captured: { slice: '*' } },
  allow: { to: { type: layer, captured: { slice: '{{ from.captured.slice }}' } } },
}))

// The ONLY sanctioned same-layer cross-import (§3.1): an entity reaches another entity via its
// `@x` public API. `entities-x` is the `@x` folder as its own element (owner slice captured),
// so a rendering entity may import any `entities/*/@x/*` while the mirror's own internals stay
// private, and the `@x` file itself may reach only its owner slice's modules.
const crossImportRules = [
  { from: { type: 'entities' }, allow: { to: { type: 'entities-x' } } },
  {
    from: { type: 'entities-x', captured: { slice: '*' } },
    allow: { to: { type: 'entities', captured: { slice: '{{ from.captured.slice }}' } } },
  },
]

export default defineConfig([
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    // React's own rules, including the React Compiler diagnostics — the compiler surfaces them
    // through this plugin, so they run whether or not the transform is enabled. oxlint carries
    // `react/rules-of-hooks` alone and cannot express the rest, and the root
    // `eslint.config.packages.mjs` never sees `apps/web`, so without this block the app was the
    // one React tree in the repo nothing checked against the compiler model.
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest']],
    rules: {
      // An error, not recommended-latest's `warn` — the packages config's reasoning, applied to the
      // app: a warning is a finding the next green run scrolls past.
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    // The two compiler-model rules, off for a NAMED LIST OF FILES rather than for the app.
    //
    // Both flag idioms that are correct hand-written React 19 and that the compiler answers by
    // skipping the component rather than by miscompiling it — measured by running the real plugin
    // over every source. Three idioms account for every entry:
    //
    //   latest-ref — `ref.current = latestProps` during render, read from a timer/observer callback
    //     that must not re-subscribe when a callback identity changes (`AccelerateTime`,
    //     `DemoTimePassing`, `UniverseTimeOverlay`).
    //   ref-guarded lazy creation — `if (ref.current === null) ref.current = create()`, where a
    //     `useState` initializer would run twice under StrictMode and orphan a live paid-action
    //     session or a query client (`RecallFlowSheet`, `GistViewSheet`, `DiaryReaderBlock`,
    //     `query-provider`). This is the `packages/auth` case, in the app.
    //   commit-and-fire effects — presence/exit-animation state and effects that must both notify and
    //     commit in one pass (`DetailPanel`'s held content, the sheets' reset-on-retarget, the
    //     bootstrap gates, the deep-link consumption).
    //
    // A file list, not a blanket off, is the whole point: a NEW file that reaches for either idiom
    // fails the gate, and this list can only shrink. Removing an entry is a behavior-carrying
    // refactor of that surface, which is why it is not this job's work.
    files: [
      'src/app/providers/decoration-bootstrap.tsx',
      'src/app/providers/query-provider.tsx',
      'src/features/accelerate-time/ui/AccelerateTime.tsx',
      'src/features/account-profile/ui/AccountProfile.tsx',
      'src/pages/demo/ui/DemoPage.tsx',
      'src/pages/demo/ui/DemoTimePassing.tsx',
      'src/pages/landing/ui/LandingReveal.tsx',
      'src/pages/test/lib/platform-panel-components.tsx',
      'src/widgets/deletion-flow/ui/DeletionFlowSheet.tsx',
      'src/widgets/diary-reader/ui/DiaryReaderBlock.tsx',
      'src/widgets/recall-flow/ui/RecallFlowSheet.tsx',
      'src/widgets/star-detail/ui/DetailPanel.tsx',
      'src/widgets/star-detail/ui/GistViewSheet.tsx',
      'src/widgets/stardust/ui/StardustOverlay.tsx',
      'src/widgets/universe-time/ui/UniverseTimeOverlay.tsx',
    ],
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: {
      boundaries,
    },
    settings: {
      'boundaries/elements': [
        { type: 'app', pattern: 'src/main.tsx', mode: 'full' },
        { type: 'app', pattern: 'src/app/**/*', mode: 'full' },
        { type: 'pages', pattern: 'src/pages/(*)/**/*', mode: 'full', capture: ['slice'] },
        { type: 'widgets', pattern: 'src/widgets/(*)/**/*', mode: 'full', capture: ['slice'] },
        { type: 'features', pattern: 'src/features/(*)/**/*', mode: 'full', capture: ['slice'] },
        // The `@x` public API is its own element, matched before the general entities pattern.
        {
          type: 'entities-x',
          pattern: 'src/entities/(*)/@x/**/*',
          mode: 'full',
          capture: ['slice'],
        },
        { type: 'entities', pattern: 'src/entities/(*)/**/*', mode: 'full', capture: ['slice'] },
        { type: 'shared', pattern: 'src/shared/(*)/**/*', mode: 'full', capture: ['slice'] },
      ],
    },
    rules: {
      ...boundaries.configs.recommended.rules,
      'boundaries/entry-point': 'off',
      'boundaries/no-private': 'off',
      'boundaries/no-unknown-files': 'off',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: [
            ...sameSliceRules,
            ...crossImportRules,
            ...Object.entries(lowerLayers).map(([from, allow]) => ({
              from: { type: from },
              allow: { to: { type: allow } },
            })),
          ],
        },
      ],
    },
  },
  {
    // Product code consumes renderer and i18n packages through their owned seams.
    // The i18n barrel and locale-storage adapter are the only direct package imports.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/shared/i18n/**', 'src/shared/lib/locale-storage.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['three', 'three/*', '@react-three/fiber'],
              message:
                'Import three/R3F only via the @cosimosi/3d-renderer package, not directly in a slice.',
            },
            {
              group: ['@cosimosi/i18n', '@cosimosi/i18n/*'],
              message:
                'Import i18n through src/shared/i18n/index.ts; only the seam and locale-storage adapter import the package directly.',
            },
          ],
        },
      ],
    },
  },
  {
    // No product slice learns that a guided sequence exists. Anchors are registered by wrapping an
    // existing child at a COMPOSITION SITE — a page or a widget — so `features/write-diary`,
    // `features/launch-stars`, `features/recall-star` and every other shipped slice stay unaware, and
    // the demo's exemptions can never travel into them through a shared import.
    //
    // Four slices are exempt because they ARE the sequence's own surface rather than product it points
    // at: the three chrome slices, and the onboarding replay row, whose single user action is asking for
    // a run. A slice that exists only because the tour does cannot "learn" something it is — and pushing
    // its one call up to the page would move an action into a composition site to satisfy the letter of
    // a rule aimed at `write-diary` and `recall-star`.
    //
    // ESLint flat config REPLACES rule options per matching file rather than merging them, so the
    // three/R3F and i18n bans above have to be restated here or they would be silently lost for every
    // file in the two largest layers.
    files: ['src/features/**/*.{ts,tsx}', 'src/entities/**/*.{ts,tsx}'],
    ignores: [
      'src/features/highlight-next-control/**',
      'src/features/show-sequence-caption/**',
      'src/features/skip-sequence/**',
      'src/features/replay-onboarding/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['three', 'three/*', '@react-three/fiber'],
              message:
                'Import three/R3F only via the @cosimosi/3d-renderer package, not directly in a slice.',
            },
            {
              group: ['@cosimosi/i18n', '@cosimosi/i18n/*'],
              message:
                'Import i18n through src/shared/i18n/index.ts; only the seam and locale-storage adapter import the package directly.',
            },
            {
              group: [
                '@cosimosi/sequence',
                '@cosimosi/sequence/*',
                '@cosimosi/onboarding',
                '@cosimosi/onboarding/*',
              ],
              message:
                'A product slice must not learn that a guided sequence exists. Anchors are registered by wrapping an existing child at a composition site (a page or a widget); the sequence chrome slices are the only exemption.',
            },
          ],
        },
      ],
    },
  },
  {
    // The public-page import closure, second surface. The landing is the origin root, so a stranger with
    // no session is its entire audience — and the same closure argument covers it: every function in
    // packages/* that issues an RPC takes an ApiTransport as its first argument, and every hook that hides
    // one calls useTransport(). A page starved of both cannot call the server by accident, whatever barrel
    // export drifts into scope later.
    //
    // Narrower than the demo's block on purpose. The landing is not rule-exempt: it has no sandbox and no
    // free time travel, so it needs no ban on prices, balances or the AccountService colour writes — it
    // simply never reaches for them. What it does need is the transport ban, because the one thing the
    // front door must be unable to do is read somebody's universe.
    //
    // ESLint flat config REPLACES rule options per matching file rather than merging them, so the
    // three/R3F and i18n bans from the general block are restated here.
    files: ['src/pages/landing/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['three', 'three/*', '@react-three/fiber'],
              message:
                'Import three/R3F only via the @cosimosi/3d-renderer package, not directly in a slice.',
            },
            {
              group: ['@cosimosi/i18n', '@cosimosi/i18n/*'],
              message:
                'Import i18n through src/shared/i18n/index.ts; only the seam and locale-storage adapter import the package directly.',
            },
            {
              group: ['@connectrpc/*'],
              message:
                'The only source of useTransport(). The landing page is the public origin root: it issues no RPC and reads no product data.',
            },
            {
              group: ['@cosimosi/api-client', '@cosimosi/api-client/*', '@cosimosi/client-cache'],
              message:
                'The generated clients and the query/cache seam. A visitor has no session, so the front door has nothing to read.',
            },
            {
              group: [
                '@cosimosi/universe/react',
                '@cosimosi/twinkle/react',
                '@cosimosi/memory/react',
                '@cosimosi/store/react',
                '@cosimosi/achievement/react',
              ],
              message:
                'Server-backed read mirrors. useUniverse() throws without a session, and the landing has none.',
            },
            {
              group: ['@cosimosi/demo', '@cosimosi/demo/*'],
              message:
                'The demo owns its fixtures and its beats. The landing links to /demo by route path and imports nothing of it.',
            },
          ],
        },
      ],
    },
  },
  {
    // The demo isolation closure. Read it as a CLOSURE, not an allowlist: every function in
    // packages/* that issues an RPC takes an ApiTransport as its first argument, and every hook that
    // hides one calls useTransport() from @connectrpc/connect-query. A page starved of both cannot
    // issue a server call by accident, whatever barrel export drifts into scope later — which is what
    // makes the demo's rule exemption harmless without a maintained list of forbidden symbols.
    //
    // Two mechanical traps this block has to answer. ESLint flat config REPLACES rule options per
    // matching file rather than merging them, so the three/R3F and i18n bans above must be RESTATED
    // here or they would be silently lost for exactly the files that mount the renderer. And the
    // positive half of the boundary — no isDemo flag, prop or branch in packages/*, features/* or
    // entities/* — is discharged by the demo adding none; lint:fsd:layout R4 catches a copy-pasted
    // mirror, and there is no field on the fixtures a demo-only value could be written into.
    files: ['src/pages/demo/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@cosimosi/emotion/react',
              importNames: [
                'writeMoodColor',
                'readMoodColors',
                'readMoodColorRecommendations',
                'useMoodColorEditor',
              ],
              message:
                'These reach AccountService. The demo may only call applyMoodColors, which stamps the module-level palette and touches no server.',
            },
            {
              // A `paths` entry rather than a pattern, because the pattern grammar is
              // gitignore-style: excluding the package name excludes every subpath with no way to
              // re-include one. The barrel is what carries ornamentCost/unownedTotal/Decorate;
              // `@cosimosi/store/react` is banned with the mirrors below, and `@cosimosi/store/i18n`
              // — the id→name map and group titles, nothing price-shaped — stays importable, which
              // is how the demo's decoration sheet shows the product's catalog names.
              name: '@cosimosi/store',
              message:
                'The store barrel carries prices, ownership and Decorate. No currency, cost, purchase or payment surface may render on /demo. Only the names subpath (@cosimosi/store/i18n) is open.',
            },
          ],
          patterns: [
            {
              group: ['three', 'three/*', '@react-three/fiber'],
              message:
                'Import three/R3F only via the @cosimosi/3d-renderer package, not directly in a slice.',
            },
            {
              group: ['@cosimosi/i18n', '@cosimosi/i18n/*'],
              message:
                'Import i18n through src/shared/i18n/index.ts; only the seam and locale-storage adapter import the package directly.',
            },
            {
              group: ['@connectrpc/*'],
              message:
                'The only source of useTransport(). The demo is frontend-only: no RPC, no DB write, no LLM call.',
            },
            {
              group: ['@cosimosi/api-client', '@cosimosi/api-client/*', '@cosimosi/client-cache'],
              message:
                'The generated clients and the query/cache seam. The demo writes domain shapes straight into the stores and needs neither.',
            },
            {
              group: [
                '@cosimosi/universe/react',
                '@cosimosi/twinkle/react',
                '@cosimosi/memory/react',
                '@cosimosi/store/react',
                '@cosimosi/achievement/react',
              ],
              message:
                'Server-backed read mirrors. The demo has no session — useUniverse() would throw — and its data is shipped fixtures.',
            },
            {
              // The store barrel moved to `paths` above so its i18n subpath can stay open.
              group: ['@cosimosi/twinkle', '@cosimosi/twinkle-logic'],
              message:
                'These carry balances and cost formulas. No currency, cost, purchase or payment surface may render on /demo, and the absence of a path to one is what makes that structural.',
            },
            {
              // Narrows the normally-legal pages -> widgets edge: the demo composes packages/*
              // directly, the way pages/test does. The two negations are the sequence chrome, which
              // MUST come from the app layer because each app hand-writes its own `ui` — and which is
              // safe to reach because @cosimosi/sequence depends on xstate + zustand only.
              group: [
                '**/widgets/*',
                '!**/widgets/sequence-guide',
                '!**/widgets/sequence-guide/**',
                '**/features/*',
                '!**/features/highlight-next-control',
                '!**/features/highlight-next-control/**',
                '**/entities/*',
              ],
              message:
                'The demo composes packages/* directly (the pages/test precedent). Only the sequence chrome (widgets/sequence-guide, features/highlight-next-control) may be reached from the app layer.',
            },
          ],
        },
      ],
    },
  },
])
