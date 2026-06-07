import { motion, useReducedMotion } from 'motion/react'
import { ArrowDown } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { enterDemoMode } from '@/shared/demo'
import { MOOD } from '@/shared/config'
import { useScrollToSection } from '../../lib/scroll'
import { useLandingTheme } from '../../model/theme'
import { ThemedStar } from '../star3d'

export function HeroSection() {
  const reduced = useReducedMotion()
  const scrollTo = useScrollToSection()
  const navigate = useNavigate()
  const theme = useLandingTheme((s) => s.theme)

  // 1차 CTA: 가장 강한 의도의 클릭을 이메일 폼이 아니라 데모 우주로 바로 보낸다.
  // (로그인/DB 없이 더미 우주 진입 — CtaFooterSection의 tryDemo와 동일 경로.)
  const tryDemo = () => {
    enterDemoMode()
    void navigate({ to: '/universe' })
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
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 flex max-w-3xl flex-col items-center gap-7"
      >
        {/* 테마별로 완전히 다른 오브제로 변신하는 WebGL 별 엠블럼(크리스털·성운·액체·잉걸불). */}
        <motion.div variants={item}>
          <ThemedStar concept={theme} color={MOOD.violet} seed={7} size={220} className="mx-auto" />
        </motion.div>

        <motion.span
          variants={item}
          className="text-xs uppercase tracking-[0.35em]"
          style={{ color: 'var(--ld-accent-soft)' }}
        >
          cosimosi
        </motion.span>

        <motion.h1
          variants={item}
          className="ld-hero-grad font-display text-4xl leading-tight sm:text-6xl md:text-7xl"
        >
          내 일기는, 기억의 우주.
        </motion.h1>

        <motion.p
          variants={item}
          className="max-w-2xl text-base leading-relaxed text-white/65 sm:text-lg"
        >
          기억은 별이 되고, 함께 떠올린 기억끼리 빛으로 이어진다. 그리고 그 별은 — 진짜 기억이
          그렇듯 — 떠올릴 때마다 조금씩 다시 빚어진다.
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
              우주 만들어보기
            </button>
            <button
              type="button"
              onClick={() => scrollTo('concept')}
              className="glass rounded-full px-7 py-3 text-sm font-medium text-white/80 transition hover:scale-[1.03] hover:text-white active:scale-95"
            >
              천천히 둘러보기
            </button>
          </div>
          <span className="text-xs text-white/45">로그인 없이 바로 둘러볼 수 있어요</span>
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
