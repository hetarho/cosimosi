import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
} from '@tanstack/react-router'
import { LandingPage } from '@/pages/landing'
import { HomePage } from '@/pages/home'
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
  // ?panel=dormant|diary — 우주 셸 위 탐색/리스트 오버레이 딥링크(spec 31). 라우트를 늘리지 않고
  // (별도 /dormant·/diary 없음) 셸 패널 상태를 search param으로만 동기화한다(딥링크·뒤로가기).
  // 알 수 없는 값은 무시. (변천사는 별 id가 필요해 URL 딥링크 대상이 아님 — 회상에서 열린다.)
  // ?fly=<memoryId> — 별 수락(spec 36) 후 내 우주로 돌아오며 새 별로 fly-to할 대상.
  validateSearch: (
    search: Record<string, unknown>,
  ): { sim?: string; panel?: 'dormant' | 'diary'; fly?: string } => ({
    sim: typeof search.sim === 'string' ? search.sim : undefined,
    panel: search.panel === 'dormant' || search.panel === 'diary' ? search.panel : undefined,
    fly: typeof search.fly === 'string' ? search.fly : undefined,
  }),
  component: function UniverseRoute() {
    return (
      <SessionGate>
        <HomePage />
      </SessionGate>
    )
  },
})

// /dormant — 잠든 별 탐색은 더 이상 별도 풀페이지가 아니라 우주 셸 위 오버레이다(spec 31).
// 옛 링크/북마크 보존을 위해 `/universe?panel=dormant`로 영구 리다이렉트한다(라우트 비증가;
// 인증 게이트는 목적지 /universe의 SessionGate가 건다).
const dormantRedirectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dormant',
  beforeLoad: () => {
    throw redirect({ to: '/universe', search: { panel: 'dormant' } })
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

// /u/$slug = 공개 우주 방문(spec 35). SessionGate **밖**의 무인증 공개 라우트 — 누구나 링크로
// 읽기 전용 우주를 거닌다. lazy 코드 스플릿(방문 전용 화면이 메인 번들에 실리지 않게). 일기 내용은
// 어떤 경로로도 나가지 않고(전용 VisitService·SharedStar DTO), 페이지는 풍경만 렌더한다.
const LazyVisitPage = lazyRouteComponent(() => import('@/pages/visit'), 'VisitPage')
const visitRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/u/$slug',
  component: LazyVisitPage,
})

// /gift/$token = 받은 별 수락/거절(spec 36). SessionGate **안** — 양쪽이 cosimosi 사용자여야 한다
// (비로그인은 사인인으로 막고, 사인인 후 같은 링크로 돌아온다). lazy 코드 스플릿(수신 전용 화면이
// 메인 번들에 실리지 않게).
const LazyGiftPage = lazyRouteComponent(() => import('@/pages/gift'), 'GiftPage')
const giftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gift/$token',
  component: function GiftRoute() {
    return (
      <SessionGate>
        <LazyGiftPage />
      </SessionGate>
    )
  },
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  universeRoute,
  dormantRedirectRoute,
  adminRoute,
  visitRoute,
  giftRoute,
])

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
