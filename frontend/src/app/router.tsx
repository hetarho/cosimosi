import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { LandingPage } from '@/pages/landing'
import { HomePage } from '@/pages/home'
import { SpecPreviewPage } from '@/pages/spec-preview'
import { RootLayout } from './RootLayout'
import { SessionGate } from './ui/SessionGate'

const rootRoute = createRootRoute({ component: RootLayout })

// 코드 기반 라우팅. 라우트는 app 레이어가 소유하고, 화면 UI는 pages 레이어에 위임한다(FSD).
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage,
})

// /universe = 우주 셸(보호 라우트). 게이트는 라우트가 소유한다 — 미인증이면 SessionGate가
// 사인인 화면으로 막고, `/` 랜딩은 게이트 없이 공개로 둔다 (01).
const universeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/universe',
  component: function UniverseRoute() {
    return (
      <SessionGate>
        <HomePage />
      </SessionGate>
    )
  },
})

// /spec-preview = dev 전용 스펙 프리뷰 샌드박스(프로덕션 빌드엔 라우트 미등록).
const specPreviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/spec-preview',
  component: SpecPreviewPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  universeRoute,
  ...(import.meta.env.DEV ? [specPreviewRoute] : []),
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
