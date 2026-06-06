import { motion, useReducedMotion } from 'motion/react'
import { ArrowDown } from 'lucide-react'
import { blobPath } from '@/shared/lib'
import { useScrollToSection } from '../../lib/scroll'

/** 장식용 floating 블롭(생성 별). 시드 고정 → 항상 같은 모양. 색은 테마 액센트(currentColor). */
function FloatingStar({
  seed,
  color,
  className,
  size,
  drift,
  reduced,
}: {
  seed: number
  color: string
  className: string
  size: number
  drift: number
  reduced: boolean
}) {
  return (
    <motion.svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden
      className={className}
      style={{ color, filter: 'drop-shadow(0 0 26px currentColor)', opacity: 0.55 }}
      animate={reduced ? undefined : { y: [0, -drift, 0], rotate: [0, drift * 0.4, 0] }}
      transition={{ duration: 9 + seed * 0.7, repeat: Infinity, ease: 'easeInOut' }}
    >
      <path d={blobPath(seed, { points: 7, variance: 0.4 })} fill="currentColor" fillOpacity={0.4} />
      <path
        d={blobPath(seed, { points: 7, variance: 0.4, radius: 22 })}
        fill="currentColor"
        fillOpacity={0.85}
      />
    </motion.svg>
  )
}

export function HeroSection() {
  const reduced = useReducedMotion()
  const scrollTo = useScrollToSection()

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
      {/* 장식용 생성 별(floating) — 테마 액센트로 물든다 */}
      <FloatingStar
        seed={7}
        color="var(--ld-accent-soft)"
        size={150}
        drift={22}
        reduced={!!reduced}
        className="pointer-events-none absolute left-[8%] top-[18%] hidden sm:block"
      />
      <FloatingStar
        seed={23}
        color="var(--ld-accent)"
        size={110}
        drift={16}
        reduced={!!reduced}
        className="pointer-events-none absolute right-[10%] bottom-[20%] hidden sm:block"
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 flex max-w-3xl flex-col items-center gap-7"
      >
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
          내 일기는 기억의 우주.
        </motion.h1>

        <motion.p
          variants={item}
          className="max-w-2xl text-base leading-relaxed text-white/65 sm:text-lg"
        >
          기억은 별, 함께 떠올린 기억끼리는 빛으로 이어진다. 그리고 그 별은 — 진짜 기억처럼 — 떠올릴
          때마다 다시 빚어진다.
        </motion.p>

        <motion.div variants={item} className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <button
            type="button"
            onClick={() => scrollTo('cta')}
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
            더 알아보기
          </button>
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
