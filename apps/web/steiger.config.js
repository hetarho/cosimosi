import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

export default defineConfig([
  ...fsd.configs.recommended,
  {
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
  },
  {
    // The domain-mirror entities and the universe widget are the read model/scene scaffold
    // that later presentation units consume (plan 23) — they land before their other
    // consumers, so a single reference is by design, not a slice to merge away. Scoped to
    // exactly these slices so a genuinely insignificant future slice still gets flagged.
    files: [
      './src/entities/episodic-memory/**',
      './src/entities/neuron/**',
      './src/entities/synapse/**',
      './src/widgets/universe-canvas/**',
    ],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
])
