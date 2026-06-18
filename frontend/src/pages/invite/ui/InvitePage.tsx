import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useQuery } from '@tanstack/react-query'
import { CosmosScene, type StarVisual } from '@/widgets/cosmos-scene'
import { themeAccent, paletteForBackground, useAppearance } from '@/entities/appearance'
import { AppearanceSwitcher, usePlaygroundExtras } from '@/features/switch-appearance'
import { InviteReason, supabase } from '@/shared/api'
import { VALUES } from '@/shared/config'
import { useRedeemInviteCode, validateInviteCode, membershipStatusQueryOptions } from '../api/invite-queries'
import { stashInvite, readInviteStash, clearInviteStash } from '../api/invite-stash'

const CODE_LEN = VALUES.invite.codeLength
const STAGGER_S = VALUES.invite.charStaggerMs / 1000
const CELEBRATE_MS = VALUES.invite.celebrateMs
const DEBOUNCE_MS = VALUES.invite.validateDebounceMs

// 사유별 카피(error-feedback·voice-tone — 장식 이모지 없이 담백하게).
function reasonCopy(reason: InviteReason): string {
  switch (reason) {
    case InviteReason.NOT_FOUND:
      return '그런 초대 코드를 찾지 못했어요.'
    case InviteReason.EXPIRED:
      return '만료된 초대 코드예요.'
    case InviteReason.EXHAUSTED:
      return '이미 다 쓰인 초대 코드예요.'
    case InviteReason.REVOKED:
      return '사용할 수 없는 초대 코드예요.'
    default:
      return '초대 코드를 확인하지 못했어요. 다시 시도해 주세요.'
  }
}

/** 우주 백드롭 + 워드마크 셸 — 초대장(미인증)·redeem(인증) 두 화면이 공유한다(랜딩과 같은 결). */
function InviteShell({ children }: { children: React.ReactNode }) {
  const object = useAppearance((s) => s.object)
  const theme = useAppearance((s) => s.theme)
  const accent = themeAccent(theme)
  const stars: StarVisual[] = [{ concept: object, color: accent, anchor: [0.5, 0.3], size: 0.12, seed: 7 }]
  const extras = usePlaygroundExtras()
  return (
    <>
      <div className="fixed inset-0 -z-10">
        <CosmosScene
          stars={stars}
          self={extras.self}
          synapses={extras.synapses}
          texture={extras.texture}
          palette={paletteForBackground(theme)}
          twinkle={110}
        />
      </div>
      <div className="relative grid min-h-dvh w-full place-items-center px-6 py-12">
        <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
          <div className="pointer-events-none relative flex h-50 w-50 max-w-[88vw] items-end justify-center">
            <span className="text-sm uppercase tracking-[0.4em] text-white/85">cosimosi</span>
          </div>
          {children}
        </div>
      </div>
      <AppearanceSwitcher />
    </>
  )
}

/**
 * 초대 진입(spec 41 + change 05). 두 모드를 한 화면 결로 그린다:
 *  - **미인증 + 코드(`/invite?code=`)**: 사인인으로 곧장 튕기지 않고 초대장 카피 + `회원가입하기`를 먼저 보여준다.
 *    가입을 시작할 때 코드를 sessionStorage에 stash해 OTP·Google OAuth 어느 경로로도 코드가 보존된다.
 *  - **인증**: 멤버면 무소비로 복귀(A8), 비멤버면 코드(URL 또는 stash)를 자동 redeem하고(성공 시 환영 연출→복귀),
 *    실패하거나 코드가 없으면 기존 수동 입력으로 내려앉는다. redeem 성공은 멤버십 캐시를 제거해 게이트가 통과로
 *    재평가된다(기존 흐름 재사용). 인증 여부는 라우트(app)가 판정해 `authed`로 내린다(pages는 SessionContext 미import).
 */
export function InvitePage({
  authed,
  code,
  redirect,
}: {
  authed: boolean
  code?: string
  redirect?: string
}) {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  // URL 코드 우선, 없으면 stash(OAuth 복귀 보존). 복귀 경로도 URL > stash > `/`.
  const stash = useMemo(() => readInviteStash(), [])
  const effectiveCode = code ?? stash?.code
  const target = redirect ?? stash?.redirect ?? '/'

  // 인증일 때만 멤버십을 읽어 "이미 멤버면 무소비 통과"(A8)를 판정한다.
  const { data: membership, isPending: membershipPending } = useQuery({
    ...membershipStatusQueryOptions(),
    enabled: authed,
  })
  const redeem = useRedeemInviteCode()

  const [codeInput, setCodeInput] = useState(effectiveCode ?? '')
  const [reason, setReason] = useState<InviteReason | null>(null)
  const [shakeKey, setShakeKey] = useState(0)
  const [celebrating, setCelebrating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const celebrateTimer = useRef<number | undefined>(undefined)
  const didResolve = useRef(false) // 멤버 통과/자동 redeem을 1회만

  const full = codeInput.length === CODE_LEN
  const pending = redeem.isPending || celebrating

  const goCelebrate = () => {
    setCelebrating(true)
    celebrateTimer.current = window.setTimeout(() => void navigate({ to: target }), CELEBRATE_MS)
  }

  async function runRedeem(raw: string): Promise<void> {
    setReason(null)
    try {
      const res = await redeem.mutateAsync(raw)
      if (res.ok) {
        clearInviteStash()
        goCelebrate()
      } else {
        clearInviteStash()
        setReason(res.reason)
        setShakeKey((k) => k + 1)
      }
    } catch {
      clearInviteStash()
      setReason(InviteReason.UNSPECIFIED)
      setShakeKey((k) => k + 1)
    }
  }

  // 인증 도착 처리(1회): 이미 멤버면 코드 무소비로 복귀(A8); 비멤버 + 코드면 자동 redeem(A6).
  useEffect(() => {
    if (!authed || didResolve.current || membershipPending || !membership) return
    if (membership.isMember) {
      didResolve.current = true
      clearInviteStash()
      void navigate({ to: target })
      return
    }
    if (effectiveCode) {
      // 도착 시 1회 자동 redeem(외부 RPC 동기화 — 정당한 effect 용도). didResolve로 1회만.
      didResolve.current = true
      // eslint-disable-next-line react-hooks/set-state-in-effect -- runRedeem은 RPC 발사이지 렌더 파생 state가 아니다
      void runRedeem(effectiveCode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, membership, membershipPending, effectiveCode])

  // 사전 검증(비소비) — 수동 입력이 다 찼을 때 사유 피드백. 권위는 confirm의 redeem.
  useEffect(() => {
    if (!full) return
    let alive = true
    const id = window.setTimeout(() => {
      validateInviteCode(codeInput)
        .then((res) => {
          if (alive && !res.valid) setReason(res.reason)
        })
        .catch(() => {})
    }, DEBOUNCE_MS)
    return () => {
      alive = false
      window.clearTimeout(id)
    }
  }, [codeInput, full])

  useEffect(() => () => window.clearTimeout(celebrateTimer.current), [])

  // ── 미인증 + 코드: 초대장 환영 화면 → 회원가입하기(코드 stash 후 사인인). ──────────────────────────
  if (!authed) {
    const onSignUp = () => {
      if (effectiveCode) stashInvite(effectiveCode, redirect)
      void navigate({
        to: '/sign-in',
        // 코드를 인코딩해 redirect param에 넣는다 — 미인코딩이면 `&`/`/`가 섞인 코드가 추가 search(예: redirect)를
        // 주입할 수 있다(동일 출처 redirect 주입). 라우트 validateSearch도 code를 영숫자로 제한한다(이중 방어).
        search: { redirect: effectiveCode ? `/invite?code=${encodeURIComponent(effectiveCode)}` : '/invite' },
      })
    }
    return (
      <InviteShell>
        <div className="w-full">
          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg font-light tracking-[0.12em] text-white/90"
          >
            초대장을 받았어요
          </motion.h1>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            나만의 우주를 만들어볼까요? 가입하면 이 초대가 바로 이어져요.
          </p>
          <button
            type="button"
            onClick={onSignUp}
            className="mt-7 w-full rounded-xl bg-white/90 px-4 py-2.5 text-sm font-medium text-black shadow-[0_8px_30px_-10px_rgba(180,180,255,0.5)] transition hover:-translate-y-px hover:bg-white hover:shadow-[0_12px_40px_-10px_rgba(180,180,255,0.7)]"
          >
            회원가입하기
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: '/sign-in', search: { redirect: '/invite' } })}
            className="mt-4 text-xs text-white/40 transition hover:text-white/70"
          >
            이미 계정이 있어요 · 로그인
          </button>
        </div>
      </InviteShell>
    )
  }

  // ── 인증: 멤버 통과/자동 redeem 대기 중엔 스플래시(깜빡임·이중 UI 방지). 단 환영 연출 중엔 스플래시를
  //    비킨다 — redeem 성공이 멤버십 쿼리를 removeQueries해 이 관측자가 pending으로 되돌아가도(splash) 환영
  //    연출(<Celebrate/>, 아래 return에만 있음)이 가려지지 않게. ──────────────────────────────────────
  if ((membershipPending || membership?.isMember) && !celebrating) {
    return (
      <InviteShell>
        <p className="text-sm tracking-wide text-white/40">우주를 여는 중…</p>
      </InviteShell>
    )
  }

  // ── 인증 + 비멤버: 수동 입력 UI. 코드(URL/stash)가 있으면 위 effect가 자동 redeem을 걸어 셀이 채워진
  //    채로 "여는 중…"이 뜨고, 실패하면 사유와 함께 수동 편집으로 남는다(코드 없으면 빈 셀 수동 입력). ──
  function onChange(raw: string) {
    const next = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN)
    setCodeInput(next)
    setReason(null)
  }
  async function confirm() {
    if (!full || pending) return
    await runRedeem(codeInput)
  }
  const cells = Array.from({ length: CODE_LEN }, (_, i) => codeInput[i] ?? '')

  return (
    <InviteShell>
      <div className="w-full">
        <motion.h1
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-lg font-light tracking-[0.12em] text-white/90"
        >
          초대 코드를 입력해 주세요
        </motion.h1>
        <p className="mt-1.5 text-sm text-white/45">코드를 redeem하면 우주가 열려요.</p>

        <motion.div
          key={shakeKey}
          animate={shakeKey > 0 && !reduce ? { x: [0, -8, 8, -6, 6, 0] } : undefined}
          transition={{ duration: 0.4 }}
          className="mt-7 flex justify-center gap-2"
          onClick={() => inputRef.current?.focus()}
        >
          {cells.map((ch, i) => {
            const filled = ch !== ''
            const active = i === codeInput.length
            return (
              <motion.div
                key={i}
                initial={reduce ? false : { opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: reduce ? 0 : i * STAGGER_S }}
                className={[
                  'flex h-12 w-9 items-center justify-center rounded-lg border text-xl font-light text-white/90 backdrop-blur-md transition-colors',
                  filled
                    ? 'border-indigo-300/50 bg-indigo-400/10 shadow-[0_0_18px_-4px_rgba(129,140,248,0.7)]'
                    : active
                      ? 'border-white/30 bg-white/5'
                      : 'border-white/10 bg-white/3',
                ].join(' ')}
              >
                <motion.span
                  key={ch + i}
                  initial={filled && !reduce ? { scale: 0.5, opacity: 0 } : false}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                >
                  {ch}
                </motion.span>
              </motion.div>
            )
          })}
        </motion.div>

        <input
          ref={inputRef}
          value={codeInput}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void confirm()
          }}
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label="초대 코드"
          maxLength={CODE_LEN}
          className="sr-only"
        />

        <div className="mt-3 min-h-5 text-xs">
          {reason !== null ? (
            <span className="text-red-300/80">{reasonCopy(reason)}</span>
          ) : full ? (
            <span className="text-emerald-300/70">확인했어요 · redeem하면 입장해요</span>
          ) : (
            <span className="text-white/30">{CODE_LEN}자리 코드</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => void confirm()}
          disabled={!full || pending}
          className="mt-5 w-full rounded-xl bg-white/90 px-4 py-2.5 text-sm font-medium text-black shadow-[0_8px_30px_-10px_rgba(180,180,255,0.5)] transition hover:-translate-y-px hover:bg-white hover:shadow-[0_12px_40px_-10px_rgba(180,180,255,0.7)] disabled:opacity-40 disabled:shadow-none"
        >
          {pending ? '여는 중…' : '우주 열기'}
        </button>

        <button
          type="button"
          onClick={() => void supabase.auth.signOut()}
          className="mt-4 text-xs text-white/40 transition hover:text-white/70"
        >
          다른 계정으로 로그인
        </button>
      </div>
      {celebrating && <Celebrate reduce={!!reduce} />}
    </InviteShell>
  )
}

/** redeem 성공 환영 연출 — 잠깐의 빛 폭발 후 입장. */
function Celebrate({ reduce }: { reduce: boolean }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="pointer-events-none fixed inset-0 z-50 grid place-items-center"
      >
        <motion.div
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: reduce ? 1 : [0.2, 1.4, 1], opacity: [0, 1, 1] }}
          transition={{ duration: CELEBRATE_MS / 1000, ease: 'easeOut' }}
          className="h-40 w-40 rounded-full bg-indigo-300/30 blur-2xl"
        />
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="absolute text-lg font-light tracking-[0.2em] text-white/90"
        >
          우주가 열렸어요
        </motion.p>
      </motion.div>
    </AnimatePresence>
  )
}
