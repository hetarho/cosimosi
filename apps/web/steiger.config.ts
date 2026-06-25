import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

// Feature-Sliced Design 구조 린터 — 임포트 방향, public API(슬라이스는 index.ts로만),
// 교차참조(@x), 세그먼트/슬라이스 네이밍을 강제한다. (model/shared 순수성은 ESLint
// boundaries가 별도로 본다.) `pnpm lint:fsd`로 실행, pre-commit 훅이 게이트한다.
export default defineConfig([
  ...fsd.configs.recommended,
  {
    // 생성물·테스트는 FSD 규칙 대상이 아니다.
    ignores: ['**/shared/api/gen/**', '**/*.test.{ts,tsx}', '**/__mocks__/**'],
  },
  {
    rules: {
      // 프로젝트 정책이 steiger 기본값보다 우선(우리 권위는 spec/tech/architecture.md):
      // recall·record-memory는 §2.2가 명시한 핵심 feature라 단일 참조여도 유지한다.
      'fsd/insignificant-slice': 'off',
      // app/ui(SessionGate·SignInScreen)는 앱 셸 UI로 의도적으로 둔다(아키텍처 검토에서도 위반 아님).
      'fsd/no-ui-in-app': 'off',
    },
  },
])
