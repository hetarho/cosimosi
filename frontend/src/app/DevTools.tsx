import { lazy, Suspense } from 'react'

// 개발 빌드에서만 lazy 로드 → 프로덕션 번들에 포함되지 않는다.
const RouterDevtools = lazy(() =>
  import('@tanstack/react-router-devtools').then((m) => ({ default: m.TanStackRouterDevtools })),
)
const QueryDevtools = lazy(() =>
  import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })),
)

export function DevTools() {
  if (!import.meta.env.DEV) return null
  return (
    <Suspense fallback={null}>
      {/* 우하단은 제품 UI(랜딩 테마 스위처 FAB) 자리 → devtools 토글은 좌측으로 비킨다. */}
      <RouterDevtools position="bottom-left" />
      <QueryDevtools initialIsOpen={false} buttonPosition="top-left" />
    </Suspense>
  )
}
