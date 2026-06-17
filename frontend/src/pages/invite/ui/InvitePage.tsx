import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CosmosBackdrop } from '@/shared/ui'
import { BrandMark } from '@/widgets/star3d'
import { InviteReason, supabase } from '@/shared/api'
import { VALUES } from '@/shared/config'
import { useRedeemInviteCode, validateInviteCode } from '../api/invite-queries'

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

/**
 * 초대 코드 입력 페이지(spec 41). 최초 로그인(비멤버)이 MembershipGate에 의해 이곳으로 리다이렉트된다.
 * 랜딩과 같은 결: 우주 백드롭 위에 3D 별 로고와 코드 셀·버튼이 카드 없이 그대로 떠 있다. 한 글자씩
 * 채워지는 셀 + redeem 성공 시 환영 연출 → 원래 가려던 곳(redirect, 없으면 `/`)으로 입장. 인증된
 * 호출이라 redeem이 곧 멤버십 부여다. 계정을 잘못 골랐다면 로그아웃해 다른 계정으로 들어갈 수 있다.
 */
export function InvitePage() {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const { redirect } = useSearch({ from: '/invite' })
  const target = redirect ?? '/'

  const [code, setCode] = useState('')
  const [reason, setReason] = useState<InviteReason | null>(null) // 사전 검증/redeem 실패 사유
  const [shakeKey, setShakeKey] = useState(0) // bump → 흔들림 리트리거
  const [celebrating, setCelebrating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const celebrateTimer = useRef<number | undefined>(undefined)
  const redeem = useRedeemInviteCode()

  const full = code.length === CODE_LEN
  const pending = redeem.isPending || celebrating

  // 입력이 다 차면 디바운스 후 비소비 검증(사전 피드백). 권위는 confirm의 redeem.
  // (full이 아닐 때 reason은 onChange가 이미 비운다 — 효과에서 동기 setState 금지 규칙.)
  useEffect(() => {
    if (!full) return
    let alive = true
    const id = window.setTimeout(() => {
      validateInviteCode(code)
        .then((res) => {
          if (alive && !res.valid) setReason(res.reason)
        })
        .catch(() => {
          /* 사전 검증 실패는 조용히 — confirm 시 redeem이 권위로 판정한다. */
        })
    }, DEBOUNCE_MS)
    return () => {
      alive = false
      window.clearTimeout(id)
    }
  }, [code, full])

  // 환영 연출 타이머는 언마운트 시 정리한다 — 연출 도중 이탈해도 죽은 컴포넌트가 navigate하지 않게.
  useEffect(() => () => window.clearTimeout(celebrateTimer.current), [])

  function onChange(raw: string) {
    // 대문자 영숫자만(BE가 정규화·판정의 권위 — 모호문자는 매칭 안 됨). 길이 상한.
    const next = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN)
    setCode(next)
    setReason(null)
  }

  async function confirm() {
    if (!full || pending) return
    setReason(null)
    try {
      const res = await redeem.mutateAsync(code)
      if (res.ok) {
        setCelebrating(true)
        celebrateTimer.current = window.setTimeout(() => void navigate({ to: target }), CELEBRATE_MS)
      } else {
        setReason(res.reason)
        setShakeKey((k) => k + 1)
      }
    } catch {
      setReason(InviteReason.UNSPECIFIED)
      setShakeKey((k) => k + 1)
    }
  }

  const cells = Array.from({ length: CODE_LEN }, (_, i) => code[i] ?? '')

  return (
    <>
      <CosmosBackdrop starCount={110} />
      <div className="relative grid min-h-dvh w-full place-items-center px-6 py-12">
        <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
          <BrandMark size={200} />

          <div className="w-full">
            <motion.h1
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-lg font-light tracking-[0.12em] text-white/90"
            >
              초대 코드를 입력해 주세요
            </motion.h1>
            <p className="mt-1.5 text-sm text-white/45">코드를 redeem하면 우주가 열려요.</p>

            {/* 코드 셀: 숨은 입력이 포커스를 쥐고, 셀을 누르면 입력으로 위임. 카드 없이 배경 위에. */}
            <motion.div
              key={shakeKey}
              animate={shakeKey > 0 && !reduce ? { x: [0, -8, 8, -6, 6, 0] } : undefined}
              transition={{ duration: 0.4 }}
              className="mt-7 flex justify-center gap-2"
              onClick={() => inputRef.current?.focus()}
            >
              {cells.map((ch, i) => {
                const filled = ch !== ''
                const active = i === code.length // 다음 입력 위치
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
              value={code}
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

            {/* 갇히지 않게: 계정을 잘못 골랐으면 로그아웃해 다른 계정으로. signOut → 세션 anon →
                SessionGate가 /sign-in으로 보낸다(스펙 41 — 멤버십 전에는 '진짜 입장'이 아니다). */}
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              className="mt-4 text-xs text-white/40 transition hover:text-white/70"
            >
              다른 계정으로 로그인
            </button>
          </div>
        </div>
      </div>

      {/* redeem 성공 환영 연출 — 잠깐의 빛 폭발 후 입장. */}
      <AnimatePresence>
        {celebrating && (
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
        )}
      </AnimatePresence>
    </>
  )
}
