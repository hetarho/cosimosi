import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from '@tanstack/react-router'
import { LandingPage } from '@/pages/landing'
import { HomePage } from '@/pages/home'
import { InvitePage } from '@/pages/invite'
import { RootLayout } from './RootLayout'
import { NotFoundScreen, RouteErrorScreen } from './ui/ErrorScreens'
import { SessionGate } from './ui/SessionGate'
import { MembershipGate } from './ui/MembershipGate'
import { SignInRoute } from './ui/SignInRoute'

const rootRoute = createRootRoute({ component: RootLayout })

// `?redirect=` 검증: **내부 경로만** 통과(오픈 리다이렉트 방지 — `/`로 시작, `//`·`/\` 프로토콜 상대 아님).
// 추가로, 게이트/인증 라우트 자신(`reject` 접두)으로 향하는 redirect는 버린다 — 그러지 않으면 SessionGate가
// 전환 중 in-flight `/sign-in?...` 위치를 다시 캡처해 `/sign-in?redirect=/sign-in?redirect=…`로 무한 중첩된다.
// 자기 라우트를 redirect 대상에서 빼면 그 재귀가 끊긴다(중첩 값은 undefined로 접혀 깨끗한 경로만 남는다).
function safeRedirect(r: unknown, reject: readonly string[]): string | undefined {
  if (typeof r !== 'string' || !r.startsWith('/') || r.startsWith('//') || r.startsWith('/\\')) return undefined
  if (reject.some((p) => r === p || r.startsWith(p + '?') || r.startsWith(p + '/'))) return undefined
  return r
}

// 코드 기반 라우팅. 라우트는 app 레이어가 소유하고, 화면 UI는 pages 레이어에 위임한다(FSD).

// `/` = 우주 셸(보호 라우트). 게이트는 라우트가 소유한다 — 미인증이면 SessionGate가 `/sign-in`으로
// 리다이렉트하고, 마케팅 랜딩은 게이트 없는 `/landing` 공개 표면에 둔다 (01).
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
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
    // 인증(SessionGate) → 멤버십(MembershipGate, spec 41) → 우주. 비멤버는 /invite로.
    return (
      <SessionGate>
        <MembershipGate>
          <HomePage />
        </MembershipGate>
      </SessionGate>
    )
  },
})

// /landing = 공개 마케팅 랜딩(인증 게이트 없음, spec 15). 루트가 우주로 옮겨가며 랜딩은 직접
// 진입 전용 표면이 됐다.
const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/landing',
  component: LandingPage,
})

// /sign-in = 독립 공개 사인인 페이지(01). 보호 라우트의 SessionGate가 미인증을 여기로 보내며,
// ?redirect=<내부 경로>로 인증 후 복귀 대상을 싣는다. redirect는 내부 경로만 통과시킨다(오픈
// 리다이렉트 방지) — `/`로 시작하고 `//`·`/\`(프로토콜 상대) 가 아닌 값만. 그 외엔 비운다(→ `/` 폴백).
const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-in',
  // redirect가 `/sign-in`을 가리키면 버린다(자기 자신 재귀 = 무한 중첩 루프 차단).
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: safeRedirect(search.redirect, ['/sign-in']),
  }),
  component: SignInRoute,
})

// /invite = 초대 코드 입력(spec 41). SessionGate **안**(인증 필요 — redeem은 인증 호출)이되
// MembershipGate **밖** — 비멤버가 코드를 redeem하는 유일한 표면이라 멤버십으로 막으면 안 된다.
// 최초 로그인(비멤버) → MembershipGate가 여기로 보내고, redeem 성공 시 ?redirect로 복귀한다.
// 정적 import다(lazy 아님): MembershipGate가 메인 번들에서 같은 슬라이스의 멤버십 쿼리를 쓰므로
// lazy로 갈라도 슬라이스가 메인에 끌려와 무의미하다(INEFFECTIVE_DYNAMIC_IMPORT 회피).
// redirect는 내부 경로만 통과시킨다(오픈 리다이렉트 방지).
const inviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invite',
  // redirect가 `/invite`·`/sign-in`(게이트/인증 라우트)을 가리키면 버린다(재귀 루프 차단).
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: safeRedirect(search.redirect, ['/invite', '/sign-in']),
  }),
  component: function InviteRoute() {
    return (
      <SessionGate>
        <InvitePage />
      </SessionGate>
    )
  },
})

// /admin = 관리자 콘솔(spec 34). lazy 코드 스플릿 — 관리자 1인용 화면이 메인 번들에
// 실리지 않게 한다. SessionGate는 인증만 막고, 관리자 여부는 서버 게이트가 판정한다:
// 비관리자는 첫 RPC의 PermissionDenied → 페이지가 NotFound 화면을 렌더(표면 비노출).
// (멤버십 게이트는 admin에 얹지 않는다 — 부트스트랩 관리자가 첫 코드를 발행해야 하므로.)
const LazyAdminPage = lazyRouteComponent(() => import('@/pages/admin'), 'AdminPage')
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  // ?tab=llm|invite — 콘솔 탭 딥링크(spec 41). 알 수 없는 값은 비워 셸이 기본(llm)으로 떨어진다.
  validateSearch: (search: Record<string, unknown>): { tab?: 'llm' | 'invite' } => ({
    tab: search.tab === 'invite' ? 'invite' : search.tab === 'llm' ? 'llm' : undefined,
  }),
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
    // 별 수락도 멤버여야 한다(spec 41) — 비멤버는 /invite로(redeem 후 같은 링크로 복귀).
    return (
      <SessionGate>
        <MembershipGate>
          <LazyGiftPage />
        </MembershipGate>
      </SessionGate>
    )
  },
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  landingRoute,
  signInRoute,
  inviteRoute,
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
