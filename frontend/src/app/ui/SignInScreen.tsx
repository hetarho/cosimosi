import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { CosmosScene, type StarVisual } from '@/widgets/cosmos-scene'
import { paletteForTheme } from '@/shared/ui'
import { themeAccent, useAppearance } from '@/entities/appearance'
import { AppearanceSwitcher } from '@/features/switch-appearance'
import { useAuthActions } from './session-context'

/**
 * 사인인 화면 — `/sign-in` 라우트(미인증)의 폼 본체 (1.1). 두 방식:
 *  ① 이메일 OTP 코드 — 2단계(이메일 → 코드), 같은 탭에서 검증·세션 (1.2/1.2b)
 *  ② Google OAuth — redirect 후 `/` 복귀 시 세션 수립 (1.8)
 * 랜딩(spec 15)과 같은 결: 우주 백드롭 위에 3D 별 로고(BrandMark)와 입력·버튼이 카드 없이 그대로
 * 떠 있다(spec 41 — 카드형 폐지). 로그인 로직(OTP·Google)은 01 그대로다.
 */
export function SignInScreen() {
  const { signInWithOtp, verifyOtp, signInWithGoogle } = useAuthActions()

  // 브랜드 별 — 형태는 선택된 오브제, 색은 테마 accent(BrandMark가 하던 것). 배경 씬(CosmosScene)에
  // 띄워 배경·트윙클·bloom과 한 캔버스로 합친다(이전: 배경 캔버스 + 별 캔버스 분리). 앵커·크기는 폼
  // 상단 엠블럼 자리에 맞춘 기본값 — 정밀 정렬은 육안 1회 튜닝 대상.
  const object = useAppearance((s) => s.object)
  const theme = useAppearance((s) => s.theme)
  const accent = themeAccent(theme)
  // 코어는 작게(size), 글로우는 halo가 — 예전 또렷한 구슬 느낌. 앵커는 폼 상단 엠블럼 자리(육안 튜닝 대상).
  const stars: StarVisual[] = [{ concept: object, color: accent, anchor: [0.5, 0.37], size: 0.13, seed: 7 }]

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
    <>
      {/* 한 캔버스 우주 씬(dim nebula + 트윙클 + 브랜드 별·halo + 어두운 구름). 풀스크린 고정 배경. */}
      <div className="fixed inset-0 -z-10">
        <CosmosScene stars={stars} palette={paletteForTheme(theme)} />
      </div>
      {/* 좌상단 "cosimosi란?" — 게이트 없는 마케팅 랜딩(/landing)으로. 처음 온 사람이 로그인 전 우리가 뭔지
          볼 수 있게(우하단 외형 스위처와 대칭, 같은 반투명 블러 톤). */}
      <Link
        to="/landing"
        className="fixed left-4 top-4 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-white/60 backdrop-blur-md transition hover:-translate-y-px hover:bg-white/10 hover:text-white/90 sm:left-6 sm:top-6"
      >
        <span
          aria-hidden
          className="grid size-4 place-items-center rounded-full border border-white/25 text-[10px] leading-none"
        >
          ?
        </span>
        cosimosi란?
      </Link>
      <div className="relative grid min-h-dvh w-full place-items-center px-6 py-12">
        <div className="flex w-full max-w-sm flex-col items-center gap-14 text-center">
          {/* 별은 배경 씬에 떠 있다 — 여기선 그 자리(엠블럼 footprint)를 비워두고 워드마크만 얹는다. */}
          <div className="pointer-events-none relative flex h-55 w-55 max-w-[88vw] items-end justify-center">
            <span className="text-sm uppercase tracking-[0.4em] text-white/85">cosimosi</span>
          </div>

          {step === 'email' ? (
            <div className="w-full">
              <form onSubmit={sendCode} className="flex flex-col gap-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="cosmic-field rounded-xl px-4 py-2.5 text-center text-sm text-white/90"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-xl bg-white/90 px-4 py-2.5 text-sm font-medium text-black shadow-[0_8px_30px_-10px_rgba(180,180,255,0.5)] transition hover:-translate-y-px hover:bg-white hover:shadow-[0_12px_40px_-10px_rgba(180,180,255,0.7)] disabled:opacity-50 disabled:shadow-none"
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
                className="btn-sheen flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white/90 backdrop-blur-md transition hover:bg-white/10 disabled:opacity-50"
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
            </div>
          ) : (
            <form onSubmit={confirmCode} className="flex w-full flex-col gap-3">
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
                className="cosmic-field rounded-xl px-4 py-2.5 text-center text-lg tracking-[0.3em] text-white/90 placeholder:tracking-normal"
              />
              <button
                type="submit"
                disabled={pending}
                className="rounded-xl bg-white/90 px-4 py-2.5 text-sm font-medium text-black shadow-[0_8px_30px_-10px_rgba(180,180,255,0.5)] transition hover:-translate-y-px hover:bg-white hover:shadow-[0_12px_40px_-10px_rgba(180,180,255,0.7)] disabled:opacity-50 disabled:shadow-none"
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
        </div>
      </div>
      {/* 테마·외형 플로팅 스위처(우하단) — 미인증이라 로컬 선호만 바뀐다(테마 색·별 형태가 즉시 반영). */}
      <AppearanceSwitcher />
    </>
  )
}
