import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from '@tanstack/react-router'
import { LandingPage } from '@/pages/landing'
import { DiaryPage } from '@/pages/diary'
import { EmotionColorPage } from '@/pages/emotion-colors'
import { RootLayout } from './RootLayout'
import { NotFoundScreen, RouteErrorScreen } from './ui/ErrorScreens'
import { SessionGate } from './ui/SessionGate'
import { MembershipGate } from './ui/MembershipGate'
import { EmotionColorGate } from './ui/EmotionColorGate'
import { InviteRoute } from './ui/InviteRoute'
import { SignInRoute } from './ui/SignInRoute'
import { UniverseShell } from './ui/UniverseShell'
import { MyPageRoute } from './ui/MyPageRoute'

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

// `/` = 메인 우주 셸(보호 라우트). 체험 우주도 같은 셸을 demo 데이터로 연다.
// 게이트는 라우트가 소유한다 — 미인증이면 SessionGate가 `/sign-in`으로 리다이렉트하고,
// 마케팅 랜딩은 게이트 없는 `/landing` 공개 표면에 둔다 (01).
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  // ?sim=<id> — 체험 우주의 이론 진입 포커스(spec 19, 랜딩 카드 "체험 우주에서 해보기").
  // ?panel=dormant|diary — 구 셸 딥링크(change 09 이전). 신규 UI는 망원경 탐색 시트로 흡수하므로,
  //   호환을 위해 값만 통과시키고 HomePage가 진입 시 1회 소비해 탐색 시트(일기/별 탭)를 연 뒤 비운다
  //   (legacy redirect — dormant는 별 탭으로). 알 수 없는 값은 무시.
  // ?record=<recordId> — 독립 일기 페이지 "우주에서 보기" 핸드오프(change 09): 그 record의 별을 frame-all.
  //   HomePage가 1회 소비해 제거한다(?fly와 같은 일회성 패턴).
  // ?fly=<memoryId> — 별 수락(spec 36) 후 내 우주로 돌아오며 새 별로 fly-to할 대상.
  validateSearch: (
    search: Record<string, unknown>,
  ): { sim?: string; panel?: 'dormant' | 'diary'; record?: string; fly?: string } => ({
    sim: typeof search.sim === 'string' ? search.sim : undefined,
    panel: search.panel === 'dormant' || search.panel === 'diary' ? search.panel : undefined,
    record: typeof search.record === 'string' ? search.record : undefined,
    fly: typeof search.fly === 'string' ? search.fly : undefined,
  }),
  component: function UniverseRoute() {
    // 인증(SessionGate) → 멤버십(MembershipGate, spec 41) → 감정색 완료(EmotionColorGate, spec 45) → 우주.
    // 비멤버는 /invite로, 감정색 미완료는 /emotion-colors로. UniverseShell은 셋 다 통과해야 마운트된다.
    // change 09: 우주 셸은 사이드바에 로그아웃을 수렴 → SessionGate chrome(우상단 로그아웃 핀)을 끈다.
    return (
      <SessionGate showChrome={false}>
        <MembershipGate>
          <EmotionColorGate>
            <UniverseShell />
          </EmotionColorGate>
        </MembershipGate>
      </SessionGate>
    )
  },
})

// /diary = 독립 보호 일기 페이지(change 09, A10). 우주 셸과 같은 게이트 체인(인증·멤버십·감정색) 안에
// 두되 자체 헤더(우주로)에 chrome을 둔다 → SessionGate 로그아웃 핀은 끈다. 정적 import(diary 슬라이스가
// recordsQueryOptions를 우주 셸과 공유 — lazy로 갈라도 메인에 끌려와 무의미).
const diaryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/diary',
  component: function DiaryRoute() {
    return (
      <SessionGate showChrome={false}>
        <MembershipGate>
          <EmotionColorGate>
            <DiaryPage />
          </EmotionColorGate>
        </MembershipGate>
      </SessionGate>
    )
  },
})

// /my-page = 최소 마이페이지(change 09). 인증·멤버십만 요구(감정색 게이트 없음 — 계정 표면이라 우주
// 진입 전제와 무관). 자체 헤더/로그아웃이 chrome을 가지므로 SessionGate 핀은 끈다. MyPageRoute(앱 래퍼)가
// session-context의 이메일·signOut을 resolve해 MyPage에 내려준다(FSD — pages는 session-context 미import).
const myPageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/my-page',
  component: function MyPageRouteComponent() {
    return (
      <SessionGate showChrome={false}>
        <MembershipGate>
          <MyPageRoute />
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
  // ?code=<초대코드> — 초대 URL 진입(change 05): 미인증도 이 코드가 있으면 초대장 화면을 먼저 본다(InviteRoute가
  // 세션으로 분기). redirect가 `/invite`·`/sign-in`(게이트/인증 라우트)을 가리키면 버린다(재귀 루프 차단).
  validateSearch: (search: Record<string, unknown>): { code?: string; redirect?: string } => ({
    // 코드는 영숫자만 통과(초대 코드 alphabet) — `&`/`/` 섞인 값으로 redirect param을 주입하지 못하게(이중 방어).
    code:
      typeof search.code === 'string' && /^[A-Za-z0-9]+$/.test(search.code) ? search.code : undefined,
    redirect: safeRedirect(search.redirect, ['/invite', '/sign-in']),
  }),
  component: InviteRoute,
})

// /emotion-colors = 감정색 필수 설정/편집(spec 45). SessionGate·MembershipGate 안이되 EmotionColorGate
// **밖** — 미완료 사용자가 루프 없이 13색을 저장할 수 있어야 한다(A3). 정적 import(appearance 슬라이스가
// 이미 메인 번들). redirect는 내부 경로만 통과하고, 게이트/인증 라우트 자신(`/emotion-colors`·`/invite`·
// `/sign-in`)을 가리키면 버려 루프를 막는다.
const emotionColorsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/emotion-colors',
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: safeRedirect(search.redirect, ['/emotion-colors', '/invite', '/sign-in']),
  }),
  component: function EmotionColorsRoute() {
    return (
      <SessionGate>
        <MembershipGate>
          <EmotionColorPage />
        </MembershipGate>
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
  // ?tab=llm|invite|users — 콘솔 탭 딥링크(spec 41·46). 알 수 없는 값은 비워 셸이 기본(llm)으로 떨어진다.
  validateSearch: (search: Record<string, unknown>): { tab?: 'llm' | 'invite' | 'users' } => ({
    tab:
      search.tab === 'invite'
        ? 'invite'
        : search.tab === 'users'
          ? 'users'
          : search.tab === 'llm'
            ? 'llm'
            : undefined,
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
    // 별 수락도 멤버여야 한다(spec 41) — 비멤버는 /invite로(redeem 후 같은 링크로 복귀). 받은 별을 내 우주에
    // 띄우는 경로라 감정색도 확정돼 있어야 한다(spec 45) — 미완료면 /emotion-colors로.
    return (
      <SessionGate>
        <MembershipGate>
          <EmotionColorGate>
            <LazyGiftPage />
          </EmotionColorGate>
        </MembershipGate>
      </SessionGate>
    )
  },
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  diaryRoute,
  myPageRoute,
  landingRoute,
  signInRoute,
  inviteRoute,
  emotionColorsRoute,
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
