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
  {
    // The universe-time vertical (plan 31): three single-surface features composed by one widget,
    // mounted by the universe page — the same one-action grain as writing-flow above. Epic C adds
    // the second reference (recall-flow-ui opens confirm-time-sync); merging them away would undo
    // the plan's slice shape. The clock entity is the vertical's pure domain mirror (substance in
    // @cosimosi/universe); every consumer (the canvas read, the HUD, the overlay) sits in a slice
    // this config already exempts, so the rule counts no references for it. Scoped so a genuinely
    // insignificant future slice still gets flagged.
    files: [
      './src/entities/universe-clock/**',
      './src/features/universe-clock-hud/**',
      './src/features/accelerate-time/**',
      './src/features/confirm-time-sync/**',
      './src/widgets/universe-time/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The star-detail vertical (plan 35): three single-surface read features composed by one panel
    // widget, mounted by the universe page — the same one-action grain as writing-flow. A feature
    // is one user surface (§3.1), not a slice to merge away; later references arrive as the panel's
    // hand-offs light up (the recall flow it opens, the gist view a gist selection routes to).
    // Scoped so a genuinely insignificant future slice still gets flagged.
    files: [
      './src/features/star-meta/**',
      './src/features/current-memory-text/**',
      './src/features/star-provenance/**',
      './src/widgets/star-detail/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The recall-flow vertical (plan 36): one feature slice composed by one flow widget, opened by
    // the star-detail panel — the same one-action grain as writing-flow. A single reference is the
    // FSD grain here, not a slice to merge away. Scoped so a genuinely insignificant future slice
    // still gets flagged.
    files: ['./src/features/recall-star/**', './src/widgets/recall-flow/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // The stardust economy vertical (plan 45): a pure balance mirror (substance in
    // @cosimosi/universe), a persistent balance-HUD feature + a charge feature composed by the
    // stardust overlay widget (mounted by the universe page), and a REUSABLE cost-display feature
    // the recall-flow and star-detail (gist) widgets compose before a spend. Low/single references
    // are the FSD grain here — a feature is one user surface (§3.1), not a slice to merge away.
    // Scoped so a genuinely insignificant future slice still gets flagged.
    files: [
      './src/entities/twinkle/**',
      './src/features/twinkle-balance-hud/**',
      './src/features/spend-cost-display/**',
      './src/features/charge-twinkle/**',
      './src/widgets/stardust/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
])
