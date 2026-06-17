import { useState, type FormEvent } from 'react'
import { GlassCard } from '@/shared/ui'
import { useAuthActions } from './session-context'

/**
 * 사인인 화면 — `/sign-in` 라우트(미인증)의 폼 본체 (1.1). 두 방식:
 *  ① 이메일 OTP 코드 — 2단계(이메일 → 코드), 같은 탭에서 검증·세션 (1.2/1.2b)
 *  ② Google OAuth — redirect 후 `/` 복귀 시 세션 수립 (1.8)
 */
export function SignInScreen() {
  const { signInWithOtp, verifyOtp, signInWithGoogle } = useAuthActions()

  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      await signInWithOtp(email)
      setStep('code')
    } catch (err) {
      // 개발 중에는 실제 원인(rate limit·signup 비활성 등)을 그대로 노출해 진단을 빠르게.
      console.error('[signInWithOtp]', err)
      setError(err instanceof Error ? err.message : '코드 발송에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setPending(false)
    }
  }

  async function confirmCode(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      // 성공 시 onAuthStateChange가 세션을 반영 → SessionGate가 우주 셸로 전환(여기서 추가 처리 불필요).
      await verifyOtp(email, code.trim())
    } catch (err) {
      console.error('[verifyOtp]', err)
      setError(err instanceof Error ? err.message : '코드가 올바르지 않거나 만료됐어요.')
    } finally {
      setPending(false)
    }
  }

  async function continueWithGoogle() {
    setPending(true)
    setError(null)
    try {
      // 성공 시 Google로 풀페이지 redirect → 이후 코드는 실행되지 않는다(복귀는 `/`).
      await signInWithGoogle()
    } catch (err) {
      console.error('[signInWithGoogle]', err)
      setError(err instanceof Error ? err.message : 'Google 로그인에 실패했어요.')
      setPending(false)
    }
  }

  return (
    <div className="grid h-full w-full place-items-center p-6">
      <GlassCard className="w-full max-w-sm p-8 text-center">
        <h1 className="text-2xl font-light tracking-wide text-white/90">cosimosi</h1>
        <p className="mt-1 text-sm text-white/40">내 마음 태양계</p>

        {step === 'email' ? (
          <>
            <form onSubmit={sendCode} className="mt-8 flex flex-col gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/90 placeholder:text-white/30 focus:border-white/30 focus:outline-none"
              />
              <button
                type="submit"
                disabled={pending}
                className="rounded-xl bg-white/90 px-4 py-2.5 text-sm font-medium text-black transition hover:bg-white disabled:opacity-50"
              >
                {pending ? '처리 중…' : '코드 받기'}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-white/30">또는</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={continueWithGoogle}
              disabled={pending}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white/90 transition hover:bg-white/10 disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path
                  fill="#FFC107"
                  d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
                />
                <path
                  fill="#4CAF50"
                  d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
                />
                <path
                  fill="#1976D2"
                  d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
                />
              </svg>
              Google로 계속하기
            </button>

            {error && <p className="mt-3 text-xs text-red-300/80">{error}</p>}
          </>
        ) : (
          <form onSubmit={confirmCode} className="mt-8 flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-white/60">
              <span className="text-white/80">{email}</span> 으로 보낸
              <br />
              인증 코드를 입력해 주세요.
            </p>
            {/* OTP 길이는 Supabase 설정값(6~10) — 고정하지 않고 숫자만 추려 받는다. */}
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="인증 코드"
              maxLength={10}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-center text-lg tracking-[0.3em] text-white/90 placeholder:tracking-normal placeholder:text-white/25 focus:border-white/30 focus:outline-none"
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-white/90 px-4 py-2.5 text-sm font-medium text-black transition hover:bg-white disabled:opacity-50"
            >
              {pending ? '확인 중…' : '확인'}
            </button>
            {error && <p className="text-xs text-red-300/80">{error}</p>}
            <button
              type="button"
              onClick={() => {
                setStep('email')
                setCode('')
                setError(null)
              }}
              className="mt-1 text-xs text-white/40 transition hover:text-white/70"
            >
              이메일 다시 입력 · 코드 재전송
            </button>
          </form>
        )}
      </GlassCard>
    </div>
  )
}
