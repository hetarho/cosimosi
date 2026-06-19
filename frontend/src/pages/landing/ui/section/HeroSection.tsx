import { motion, useReducedMotion } from 'motion/react'
import { ArrowDown, LogIn } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { startDemoSession, exitDemoMode, resetDemo } from '@/shared/lib/demo'
import { useScrollToSection } from '../../lib/scroll'

export function HeroSection() {
  const reduced = useReducedMotion()
  const scrollTo = useScrollToSection()
  const navigate = useNavigate()
  // 히어로 엠블럼 별은 페이지 전역 우주 씬(LandingPage의 CosmosScene)이 배경에 띄운다 — 여기선 워드마크만.

  // 1차 CTA: 가장 강한 의도의 클릭을 이메일 폼이 아니라 체험 우주로 바로 보낸다.
  // (로그인/DB 없이 루트 우주 `/` 진입 — 매 진입을 온보딩부터 시작하도록 흐름·더미 우주를 리셋한다.)
  const tryDemo = () => {
    startDemoSession()
    void navigate({ to: '/' })
  }

  // 로그인: 사인인 페이지로. 데모 플래그가 남아 있으면 보호 라우트(`/`)를 그냥 통과해 더미 우주가
  // 떠 버리므로, 플래그와 더미 별을 비우고 `/sign-in`으로 이동한다.
  const goSignIn = () => {
    exitDemoMode()
    resetDemo()
    void navigate({ to: '/sign-in' })
  }

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: reduced ? 0 : 0.16, delayChildren: 0.1 } },
  }
  const item = {
    hidden: { opacity: 0, y: reduced ? 0 : 26 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
  }

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* 페이지 최상단 로그인 진입 — 우하단 고정인 AppearanceSwitcher와 겹치지 않게 우상단에 둔다. */}
      <button
        type="button"
        onClick={goSignIn}
        className="glass absolute right-5 top-5 z-20 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-white/70 transition hover:scale-[1.03] hover:text-white active:scale-95 sm:right-6 sm:top-6 sm:text-sm"
      >
        <LogIn size={15} aria-hidden />
        로그인하기
      </button>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 flex max-w-3xl flex-col items-center gap-7"
      >
        {/* cosimosi 워드마크 — 별 엠블럼은 페이지 배경 우주 씬이 이 위치(앵커)에 띄운다. */}
        <motion.div variants={item} className="relative flex items-center justify-center">
          <span
            className="relative text-xs uppercase tracking-[0.35em]"
            style={{ color: 'var(--ld-accent-soft)' }}
          >
            cosimosi
          </span>
        </motion.div>

        <motion.h1
          variants={item}
          className="ld-hero-grad mt-10 font-display text-4xl leading-tight sm:mt-14 sm:text-6xl md:text-7xl"
        >
          내 일기는, 기억의 우주.
        </motion.h1>

        <motion.p
          variants={item}
          className="max-w-2xl text-base leading-relaxed text-white/65 sm:text-lg"
        >
          기억은 별이 되고, 함께 떠올린 기억끼리 빛으로 이어져요. 그리고 그 별은 — 진짜 기억이
          그렇듯 — 떠올릴 때마다 조금씩 다시 빚어져요.
        </motion.p>

        <motion.div variants={item} className="flex flex-col items-center gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <button
              type="button"
              onClick={tryDemo}
              className="rounded-full px-7 py-3 text-sm font-medium text-white transition hover:scale-[1.03] hover:brightness-110 active:scale-95"
              style={{
                backgroundColor: 'var(--ld-accent)',
                boxShadow: '0 16px 46px -18px var(--ld-accent)',
              }}
            >
              체험 우주 시작하기
            </button>
            <button
              type="button"
              onClick={() => scrollTo('concept')}
              className="glass rounded-full px-7 py-3 text-sm font-medium text-white/80 transition hover:scale-[1.03] hover:text-white active:scale-95"
            >
              천천히 둘러보기
            </button>
          </div>
          <span className="text-xs text-white/45">로그인 없이 체험 우주를 둘러볼 수 있어요</span>
        </motion.div>
      </motion.div>

      {/* 스크롤 힌트 — 다음 섹션(컨셉)으로 */}
      <motion.button
        type="button"
        onClick={() => scrollTo('concept')}
        aria-label="아래로 스크롤"
        className="absolute bottom-8 z-10 text-white/40 transition hover:text-white/70"
        animate={reduced ? undefined : { y: [0, 8, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ArrowDown className="h-6 w-6" />
      </motion.button>
    </section>
  )
}
