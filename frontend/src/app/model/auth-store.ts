import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/shared/api'
import { capture, EVENTS, identifyUser, resetAnalyticsIdentity } from '@/shared/lib'
import { resetUniverseData } from './reset-universe-data'

// 순수 상태·로직 레이어. three/React/DOM 을 직접 import 하지 않는다(모바일 RN 재사용 — 원칙 4).
// 구독 시작은 플랫폼 레이어(App의 useEffect)가 init() 호출로 트리거한다.

type AuthStatus = 'loading' | 'authed' | 'anon'

// 마지막으로 데이터를 그린 사용자 id. undefined = 아직 기준 미설정(부팅 첫 이벤트), null =
// 익명. id가 바뀌는 순간(로그아웃·다른 계정 사인인) 쿼리 캐시·렌더 스토어를 리셋해 이전
// 계정의 우주·일기 본문이 다음 계정에 보이지 않게 한다(16 — 캐시 키가 사용자를 모름).
// 이벤트 시점(렌더 전)에 비우므로 한 프레임도 새지 않는다. TOKEN_REFRESHED 등 같은 id
// 이벤트는 통과한다.
let lastUserId: string | null | undefined = undefined

function syncIdentity(session: Session | null): void {
  const uid = session?.user?.id ?? null
  if (lastUserId !== undefined && uid !== lastUserId) resetUniverseData()
  // 분석 식별 동기화(18): uid가 새로 확인되는 순간(신규 사인인·세션 복원·계정 전환)이
  // sign_in 1회 = "가입/재방문" 단위다. TOKEN_REFRESHED 등 같은 uid 이벤트는 통과.
  // 식별자는 Supabase uid만 보낸다(이메일 등 PII 금지).
  if (uid && uid !== lastUserId) {
    // 중간 null 없이 A→B로 바로 전환돼도 이전 계정의 세션/디바이스 컨텍스트가 새
    // 계정에 이어지지 않게 먼저 끊는다.
    if (lastUserId) resetAnalyticsIdentity()
    identifyUser(uid)
    capture(EVENTS.signIn, {})
  } else if (!uid && lastUserId) {
    resetAnalyticsIdentity()
  }
  lastUserId = uid
}

interface AuthState {
  session: Session | null
  status: AuthStatus
  /** 부팅 시 1회. 저장된 세션을 복원하고 변경을 구독한다. 구독 해제 함수를 반환(StrictMode 안전). */
  init: () => () => void
  signInWithOtp: (email: string) => Promise<void>
  verifyOtp: (email: string, token: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const universeRedirect = () => `${window.location.origin}/universe`

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  status: 'loading',

  init: () => {
    // getSession 해소 전까지 status는 'loading' → 사인인 화면 깜빡임 방지 (1.7), 세션 복원 (1.5).
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        syncIdentity(data.session)
        set({ session: data.session, status: data.session ? 'authed' : 'anon' })
      })
      .catch((err) => {
        // 조회가 reject돼도 'loading'에 갇히지 않게 anon으로 떨어뜨린다 (1.7 무한 스플래시 방지).
        console.error('[auth.getSession]', err)
        set({ session: null, status: 'anon' })
      })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncIdentity(session)
      set({ session, status: session ? 'authed' : 'anon' })
    })
    return () => subscription.unsubscribe()
  },

  // 이메일 OTP 코드 발송 (1.2b). 매직링크가 아니라 6자리 코드라 emailRedirectTo 불필요.
  signInWithOtp: async (email) => {
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) throw error
  },

  // 받은 6자리 코드를 같은 탭에서 세션으로 교환 (1.2). 성공 시 onAuthStateChange가 authed로 전환.
  verifyOtp: async (email, token) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    if (error) throw error
  },

  // Google OAuth (1급). signInWithOAuth가 동의 화면으로 redirect → /universe 복귀 시
  // detectSessionInUrl이 세션 수립. 대시보드 Providers→Google 설정이 전제(1.8).
  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: universeRedirect() },
    })
    if (error) throw error
  },

  // 세션 삭제 (1.4). 성공 시 onAuthStateChange가 status를 'anon'으로 전환한다.
  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    // 실패하면 SIGNED_OUT 이벤트가 안 올 수 있어 'authed'에 갇힌다 → 로컬 상태를 직접 내린다
    // (syncIdentity가 캐시·스토어 리셋까지 수행).
    if (error) {
      console.error('[auth.signOut]', error)
      syncIdentity(null)
      set({ session: null, status: 'anon' })
    }
  },
}))
