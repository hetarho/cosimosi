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
      <RouterDevtools position="bottom-left" />
      <QueryDevtools initialIsOpen={false} />
    </Suspense>
  )
}
