import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
  },
  {
    // The universe scene scaffold. The domain-mirror stores, rendering-projection logic, and the
    // R3F rendering entities were promoted to packages (@cosimosi/universe, @cosimosi/universe-render)
    // so both apps share one source. What stays app-local is thin, single-reference by design and
    // must not be merged away: the universe widget (mounts the shared canvas + composes the package
    // layers; referenced only by the universe page) and the nebula notice (a forked DOM/RN affordance
    // shown over the canvas; referenced only by the universe page — its RENDERING half is the package
    // NebulaField). Scoped so a genuinely insignificant future slice still gets flagged.
    files: ['./src/entities/nebula/**', './src/widgets/universe-canvas/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The writing-flow vertical: four single-action feature slices composed by one widget, and that
    // widget mounted by the universe page. A single reference is the FSD grain here — a feature is
    // one user action (§3.1), not a slice to merge away. Scoped to these slices so a genuinely
    // insignificant future slice still gets flagged.
    files: [
      './src/features/write-diary/**',
      './src/features/split-diary/**',
      './src/features/revise-split/**',
      './src/features/launch-stars/**',
      './src/widgets/writing-flow/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
])
