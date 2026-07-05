import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
  },
  {
    // The domain-mirror entities, the rendering entities (plan 24 star/cell-star/filament,
    // plan 25 latent-star), the awaken feature (plan 25), and the universe widget are the read
    // model/scene scaffold that later presentation units consume (plans 23–27) — they land
    // before their other consumers (the launch flow is plan 27 / job 32), so a single reference
    // (today the universe widget) is by design, not a slice to merge away. Scoped to exactly
    // these slices so a genuinely insignificant future slice still gets flagged.
    files: [
      './src/entities/episodic-memory/**',
      './src/entities/neuron/**',
      './src/entities/synapse/**',
      './src/entities/star/**',
      './src/entities/cell-star/**',
      './src/entities/filament/**',
      './src/entities/latent-star/**',
      './src/features/awaken-neuron/**',
      './src/widgets/universe-canvas/**',
    ],
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
