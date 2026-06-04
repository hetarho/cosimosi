import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/shared/api'

// 순수 상태·로직 레이어. three/React/DOM 을 직접 import 하지 않는다(모바일 RN 재사용 — 원칙 4).
// 구독 시작은 플랫폼 레이어(App의 useEffect)가 init() 호출로 트리거한다.

type AuthStatus = 'loading' | 'authed' | 'anon'

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
    // 실패하면 SIGNED_OUT 이벤트가 안 올 수 있어 'authed'에 갇힌다 → 로컬 상태를 직접 내린다.
    if (error) {
      console.error('[auth.signOut]', error)
      set({ session: null, status: 'anon' })
    }
  },
}))
