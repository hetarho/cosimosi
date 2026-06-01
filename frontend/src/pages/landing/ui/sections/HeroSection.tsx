import { motion, useReducedMotion } from 'motion/react'
import { ArrowDown } from 'lucide-react'
import { blobPath } from '@/shared/lib'
import { MOOD } from '@/shared/config'

/** 페이지 어디로든 부드럽게 스크롤. */
function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** 장식용 floating 블롭(생성 별). 시드 고정 → 항상 같은 모양. */
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
      style={{ filter: `drop-shadow(0 0 24px ${color}88)` }}
      animate={reduced ? undefined : { y: [0, -drift, 0], rotate: [0, drift * 0.4, 0] }}
      transition={{ duration: 9 + seed * 0.7, repeat: Infinity, ease: 'easeInOut' }}
    >
      <path d={blobPath(seed, { points: 7, variance: 0.4 })} fill={color} fillOpacity={0.32} />
      <path
        d={blobPath(seed, { points: 7, variance: 0.4, radius: 22 })}
        fill={color}
        fillOpacity={0.7}
      />
    </motion.svg>
  )
}

export function HeroSection() {
  const reduced = useReducedMotion()

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
      {/* 장식용 생성 별(floating) */}
      <FloatingStar
        seed={7}
        color={MOOD.violet}
        size={150}
        drift={22}
        reduced={!!reduced}
        className="pointer-events-none absolute left-[8%] top-[18%] hidden sm:block"
      />
      <FloatingStar
        seed={23}
        color={MOOD.teal}
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
          className="text-xs uppercase tracking-[0.35em] text-mood-violet/80"
        >
          cosimosi
        </motion.span>

        <motion.h1
          variants={item}
          className="font-display text-4xl leading-tight text-white sm:text-6xl md:text-7xl"
        >
          내 일기는 기억의 우주.
        </motion.h1>

        <motion.p
          variants={item}
          className="max-w-2xl text-base leading-relaxed text-white/60 sm:text-lg"
        >
          기억은 별, 함께 떠올린 기억은 빛으로 이어진다. 그리고 그 별은 — 진짜 기억처럼 — 떠올릴
          때마다 다시 빚어진다.
        </motion.p>

        <motion.div variants={item} className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <button
            type="button"
            onClick={() => scrollToId('cta')}
            className="rounded-full bg-mood-violet px-7 py-3 text-sm font-medium text-white shadow-lg shadow-mood-violet/30 transition hover:scale-[1.03] hover:bg-mood-violet/90 active:scale-95"
          >
            우주 만들어보기
          </button>
          <button
            type="button"
            onClick={() => scrollToId('science')}
            className="glass rounded-full border border-white/15 px-7 py-3 text-sm font-medium text-white/80 transition hover:scale-[1.03] hover:text-white active:scale-95"
          >
            더 알아보기
          </button>
        </motion.div>
      </motion.div>

      {/* 스크롤 힌트 */}
      <motion.button
        type="button"
        onClick={() => scrollToId('science')}
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
