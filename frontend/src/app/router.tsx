import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from '@tanstack/react-router'
import { LandingPage } from '@/pages/landing'
import { HomePage } from '@/pages/home'
import { DormantPage } from '@/pages/dormant'
import { RootLayout } from './RootLayout'
import { NotFoundScreen, RouteErrorScreen } from './ui/ErrorScreens'
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
  // ?sim=<id> — 데모 시뮬레이션 패널의 진입 포커스(spec 19, 랜딩 카드 "이 카드 체험하기").
  // 문자열만 통과시키고, 레지스트리에 없는 id는 패널이 무시한다.
  validateSearch: (search: Record<string, unknown>): { sim?: string } => ({
    sim: typeof search.sim === 'string' ? search.sim : undefined,
  }),
  component: function UniverseRoute() {
    return (
      <SessionGate>
        <HomePage />
      </SessionGate>
    )
  },
})

// /dormant = 잠든 별 탐색(보호 라우트, 12). 항목 클릭 → focusStar → /universe 로 이동 →
// 카메라 fly-to → 회상 재점화.
const dormantRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dormant',
  component: function DormantRoute() {
    return (
      <SessionGate>
        <DormantPage />
      </SessionGate>
    )
  },
})

// /admin = 관리자 콘솔(spec 34). lazy 코드 스플릿 — 관리자 1인용 화면이 메인 번들에
// 실리지 않게 한다. SessionGate는 인증만 막고, 관리자 여부는 서버 게이트가 판정한다:
// 비관리자는 첫 RPC의 PermissionDenied → 페이지가 NotFound 화면을 렌더(표면 비노출).
const LazyAdminPage = lazyRouteComponent(() => import('@/pages/admin'), 'AdminPage')
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: function AdminRoute() {
    return (
      <SessionGate>
        <LazyAdminPage />
      </SessionGate>
    )
  },
})

const routeTree = rootRoute.addChildren([indexRoute, universeRoute, dormantRoute, adminRoute])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  // 라우트 로드/렌더 실패·없는 경로의 설계된 폴백(17, 2.3) — 흰 화면 금지.
  defaultErrorComponent: RouteErrorScreen,
  defaultNotFoundComponent: NotFoundScreen,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
