import { useMemo } from 'react'
import { createActorContext } from '@xstate/react'
import { supabase } from '@/shared/api'
import { sessionMachine } from '../model/session.machine'

// 세션 머신의 React 바인딩(ui 레이어 — createActorContext는 React라 model이 아닌 여기). 머신은
// app/model/session.machine.ts(순수). Provider는 App이 RouterProvider 바깥에 마운트한다.
export const SessionContext = createActorContext(sessionMachine)

/** 현재 인증된 사용자 id(없으면 null) — 첫 별 튜토리얼 per-user 완료 상태 키(change 34). 셸이 HomePage로
 *  내려준다(pages는 session-context를 직접 import하지 않는다 — FSD 단방향). */
export function useSessionUserId(): string | null {
  return SessionContext.useSelector((s) => s.context.session?.user?.id ?? null)
}

// Google OAuth 복귀 주소 — 우주는 이제 루트(`/`)다. 풀페이지 라운드트립이라 `/sign-in`의
// redirect param은 여기로 못 실린다(복귀는 항상 `/`; 인증 후 SessionGate가 우주 셸을 띄운다).
const oauthRedirectTo = () => `${window.location.origin}/`

/**
 * 사인인 액션 — supabase 직접 호출. 성공은 onAuthStateChange 구독이 머신에 반영하므로
 * 여기선 await만(SignInScreen의 pending/error 표시용). signOut 실패만 머신에 FORCE_ANON을
 * 보낸다(SIGNED_OUT 이벤트 미수신 시 authed 갇힘 방지).
 */
export function useAuthActions() {
  const actorRef = SessionContext.useActorRef()
  return useMemo(
    () => ({
      // 이메일 OTP 코드 발송(1.2b). 6자리 코드라 emailRedirectTo 불필요.
      signInWithOtp: async (email: string) => {
        const { error } = await supabase.auth.signInWithOtp({ email })
        if (error) throw error
      },
      // 받은 코드를 같은 탭에서 세션으로 교환(1.2). 성공 시 onAuthStateChange가 authed로.
      verifyOtp: async (email: string, token: string) => {
        const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
        if (error) throw error
      },
      // Google OAuth(1.8). 동의 화면으로 redirect → `/` 복귀 시 세션 수립.
      signInWithGoogle: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: oauthRedirectTo() },
        })
        if (error) throw error
      },
      // 세션 삭제(1.4). 성공 시 onAuthStateChange가 anon으로 전환. 실패 시 강제 강하.
      signOut: async () => {
        const { error } = await supabase.auth.signOut()
        if (error) {
          console.error('[auth.signOut]', error)
          actorRef.send({ type: 'FORCE_ANON' })
        }
      },
    }),
    [actorRef],
  )
}
