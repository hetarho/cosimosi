import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
  },
  {
    // The domain-mirror entities, the rendering entities (plan 24 star/cell-star/filament),
    // and the universe widget are the read model/scene scaffold that later presentation units
    // consume (plans 23–27) — they land before their other consumers, so a single reference
    // (today the universe widget) is by design, not a slice to merge away. Scoped to exactly
    // these slices so a genuinely insignificant future slice still gets flagged.
    files: [
      './src/entities/episodic-memory/**',
      './src/entities/neuron/**',
      './src/entities/synapse/**',
      './src/entities/star/**',
      './src/entities/cell-star/**',
      './src/entities/filament/**',
      './src/widgets/universe-canvas/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
])
