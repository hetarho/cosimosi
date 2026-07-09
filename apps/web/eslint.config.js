import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import boundaries from 'eslint-plugin-boundaries'
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
    // three.js / R3F live only inside the @cosimosi/3d-renderer package (plan/14);
    // slices consume that package boundary, never three/R3F directly.
    files: [
      'src/main.tsx',
      'src/app/**/*.{ts,tsx}',
      'src/pages/**/*.{ts,tsx}',
      'src/widgets/**/*.{ts,tsx}',
      'src/features/**/*.{ts,tsx}',
      'src/entities/**/*.{ts,tsx}',
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
          ],
        },
      ],
    },
  },
])
