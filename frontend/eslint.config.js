import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import boundaries from 'eslint-plugin-boundaries'
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
  // 아키텍처 경계 — model/shared 순수성(헌법 §4 / Architecture §3.4). RN 재사용을 위해
  // 순수 레이어(entities/*/model, shared/lib, shared/api, shared/config)는 three·@react-three·
  // react·react-dom을 import하면 안 된다. 렌더러 코드는 */ui 또는 shared/lib/r3f(렌더러 포트)에만.
  // (FSD 구조 규칙 — 임포트 방향·public API·세그먼트명 — 은 steiger가 별도로 강제한다.)
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['src/**/*.{ts,tsx}'],
      'boundaries/elements': [
        // 렌더러 포트 — three 허용(아래 pure 매칭보다 먼저 와야 한다).
        { type: 'renderer', mode: 'full', pattern: ['src/shared/lib/r3f/**/*'] },
        // 순수/공유 레이어 — three·React·DOM 금지.
        {
          type: 'pure',
          mode: 'full',
          pattern: [
            'src/entities/*/model/**/*',
            'src/shared/lib/**/*',
            'src/shared/api/**/*',
            'src/shared/config/**/*',
          ],
        },
        // 그 외는 플랫폼 레이어(ui/app/pages/widgets/features) — three·React OK.
        { type: 'platform', mode: 'full', pattern: ['src/**/*'] },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          checkAllOrigins: true,
          default: 'allow',
          rules: [
            {
              from: { type: 'pure' },
              disallow: {
                to: { origin: 'external' },
                dependency: { module: ['three', 'three/*', '@react-three/*', 'react', 'react-dom'] },
              },
              message:
                '순수 레이어(model/shared)는 three/@react-three/react/react-dom을 import할 수 없다(헌법 §4 / Architecture §3.4). 렌더러 코드는 */ui 또는 shared/lib/r3f로 옮길 것.',
            },
          ],
        },
      ],
    },
  },
  // 포맷 관련 규칙은 Prettier에 위임(반드시 마지막). 충돌 규칙 비활성화.
  eslintConfigPrettier,
])
