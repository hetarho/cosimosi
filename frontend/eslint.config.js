import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // src/shared/api/gen is protoc-gen-es output (generated transport types,
  // constitution §5) — infrastructure, not linted/hand-edited.
  globalIgnores(['dist', 'coverage', 'src/shared/api/gen']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  // 포맷 관련 규칙은 Prettier에 위임(반드시 마지막). 충돌 규칙 비활성화.
  eslintConfigPrettier,
])
