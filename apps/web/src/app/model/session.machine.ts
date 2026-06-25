import { setup, assign, fromPromise, fromCallback, enqueueActions } from 'xstate'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/shared/api'
import { capture, EVENTS, identifyUser, resetAnalyticsIdentity } from '@/shared/lib'
import { resetUniverseData } from './reset-universe-data'

// 세션 수명주기 머신(app/model) — 순수 TS, three/React/DOM 직접 의존 없음(헌법4).
// React 바인딩(Provider·hooks)은 ui 레이어(`app/ui/session-context.tsx`)가 소유한다.
// supabase/분석/리셋 import는 구 auth-store와 동일(플랫폼 신호 아님 — RN 재사용 가능).

interface Ctx {
  session: Session | null
  // 마지막으로 데이터를 그린 사용자 id. undefined = 부팅 첫 이벤트(기준 미설정), null = 익명.
  // id가 바뀌는 순간(로그아웃·계정 전환) 캐시·렌더 스토어를 리셋해 이전 계정의 우주·일기
  // 본문이 다음 계정에 새지 않게 한다(16). 모듈 가변 대신 context에 둔다(액터 단위 자기완결).
  lastUserId: string | null | undefined
}

type Ev = { type: 'AUTH_CHANGED'; session: Session | null } | { type: 'FORCE_ANON' }

const has = (s: Session | null) => s != null

export const sessionMachine = setup({
  types: {
    context: {} as Ctx,
    events: {} as Ev,
  },
  actors: {
    // 저장된 세션 복원(부팅 1회). 해소 전 status='loading' → 사인인 화면 깜빡임 방지(1.7), 복원(1.5).
    getSession: fromPromise<Session | null>(async () => {
      const { data } = await supabase.auth.getSession()
      return data.session
    }),
    // 인증 변경 구독(머신 수명 내내). 액터가 멈추면 cleanup이 구독 해제(StrictMode 안전).
    authChanges: fromCallback(({ sendBack }) => {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        sendBack({ type: 'AUTH_CHANGED', session })
      })
      return () => subscription.unsubscribe()
    }),
  },
  actions: {
    // 세션 반영 + 출처 경계 리셋 + 분석 식별 동기화. (구 auth-store.syncIdentity의 머신 이식.)
    syncSession: enqueueActions(({ context, enqueue }, params: { session: Session | null }) => {
      const session = params.session
      const uid = session?.user?.id ?? null
      const last = context.lastUserId
      // 출처 경계: 기준이 잡힌 뒤 uid가 바뀌면 캐시·스토어를 비운다(렌더 전 이벤트 시점이라 무누수).
      if (last !== undefined && uid !== last) enqueue(() => resetUniverseData())
      // 분석 식별(18): uid가 새로 확인되는 순간이 sign_in 1회. 같은 uid 이벤트(TOKEN_REFRESHED)는 통과.
      if (uid && uid !== last) {
        if (last) enqueue(() => resetAnalyticsIdentity())
        enqueue(() => identifyUser(uid))
        enqueue(() => capture(EVENTS.signIn, {}))
      } else if (!uid && last) {
        enqueue(() => resetAnalyticsIdentity())
      }
      enqueue.assign({ session, lastUserId: uid })
    }),
  },
}).createMachine({
  id: 'session',
  context: { session: null, lastUserId: undefined },
  // 인증 변경 구독은 모든 상태에서 동작(부팅·로그인·로그아웃·토큰 갱신).
  invoke: { src: 'authChanges' },
  initial: 'loading',
  on: {
    // Supabase는 구독 직후 INITIAL_SESSION을 쏘므로 loading 중에도 들어올 수 있다 — 그땐
    // getSession invoke가 취소되고 이 전이가 상태를 정한다(말단 상태 동일·단일 경로).
    AUTH_CHANGED: [
      {
        guard: ({ event }) => has(event.session),
        target: '.authed',
        actions: { type: 'syncSession', params: ({ event }) => ({ session: event.session }) },
      },
      {
        target: '.anon',
        actions: { type: 'syncSession', params: ({ event }) => ({ session: event.session }) },
      },
    ],
    // signOut 실패 시 SIGNED_OUT 이벤트가 안 올 수 있어 authed에 갇힘 → 로컬에서 강제 강하.
    // syncSession(null)으로 보내 출처 경계 리셋(resetUniverseData)·분석 식별 해제·lastUserId 갱신까지
    // 수행한다 — 구 auth-store.signOut 에러 분기(syncIdentity(null))와 동일. 단순 assign이면 이전
    // 계정의 캐시·분석 식별이 남아 다음 사용자에게 샌다(16 경계).
    FORCE_ANON: { target: '.anon', actions: { type: 'syncSession', params: () => ({ session: null }) } },
  },
  states: {
    loading: {
      invoke: {
        src: 'getSession',
        onDone: [
          {
            guard: ({ event }) => has(event.output),
            target: 'authed',
            actions: { type: 'syncSession', params: ({ event }) => ({ session: event.output }) },
          },
          {
            target: 'anon',
            actions: { type: 'syncSession', params: ({ event }) => ({ session: event.output }) },
          },
        ],
        // 조회 reject 시 'loading'에 갇히지 않게 anon으로(무한 스플래시 방지, 1.7). 구 auth-store와
        // 동일하게 syncSession은 호출하지 않는다 — 기준(lastUserId) 미설정 유지(다음 이벤트가 베이스라인).
        onError: { target: 'anon', actions: assign({ session: null }) },
      },
    },
    authed: {},
    anon: {},
  },
})
