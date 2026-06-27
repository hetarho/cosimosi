import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import boundaries from 'eslint-plugin-boundaries'
import tseslint from 'typescript-eslint'

const layers = ['app', 'pages', 'widgets', 'features', 'entities', 'shared']
const lowerLayers = {
  app: layers,
  pages: ['widgets', 'features', 'entities', 'shared'],
  widgets: ['features', 'entities', 'shared'],
  features: ['entities', 'shared'],
  entities: ['shared'],
  shared: [],
}

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
        { type: 'app', pattern: 'src/main.tsx' },
        { type: 'app', pattern: 'src/app/**' },
        { type: 'pages', pattern: 'src/pages/*/**' },
        { type: 'widgets', pattern: 'src/widgets/*/**' },
        { type: 'features', pattern: 'src/features/*/**' },
        { type: 'entities', pattern: 'src/entities/*/**' },
        { type: 'shared', pattern: 'src/shared/**' },
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
          rules: Object.entries(lowerLayers).map(([from, allow]) => ({
            from: { type: from },
            allow: { to: { type: allow } },
          })),
        },
      ],
    },
  },
])
