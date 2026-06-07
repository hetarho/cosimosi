import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/shared/lib'

interface JourneyActProps {
  id: string
  /** 챕터 번호(로마자) — 마커에 새긴다. */
  chapter?: string
  /** 작은 과학 앵커 라벨. 예: "엔그램 · ENGRAM". 계층의 맨 윗단. */
  eyebrow: string
  /** 문학적 챕터 제목. */
  heading: ReactNode
  /** 한두 문장의 리드. */
  lead?: ReactNode
  /** 마커 글로우 + eyebrow 색. hex 또는 css 변수. 기본 테마 액센트. */
  accent?: string
  /** 'stacked'(기본): 리드 위, viz 아래 / 'split': 좌우 2열(텍스트·미디어). */
  layout?: 'stacked' | 'split'
  /** split에서 미디어를 왼쪽으로(번갈아 배치해 리듬). */
  flip?: boolean
  children: ReactNode
  className?: string
}

/**
 * 여정의 한 장(章). 한 줄기로 흐르는 랜딩의 계층 단위 — 왼쪽 스파인(빛의 실)에 챕터 마커(별)가
 * 맺히고, 그 아래로 eyebrow(과학 앵커) → 문학적 제목 → 리드 → 인터랙티브 viz가 흐른다.
 * 스크롤로 들어오면 위에서부터 차례로 떠오른다(reduced-motion이면 정지).
 */
export function JourneyAct({
  id,
  chapter,
  eyebrow,
  heading,
  lead,
  accent = 'var(--ld-accent-soft)',
  layout = 'stacked',
  flip = false,
  children,
  className,
}: JourneyActProps) {
  const reduce = useReducedMotion()
  // flip된 split 장은 미디어가 왼쪽으로 가므로, 챕터 마커가 늘 스파인 곁에 맺히도록
  // 스파인과 콘텐츠 패딩을 오른쪽 거터로 미러링한다.
  const flipped = layout === 'split' && flip

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.08, delayChildren: reduce ? 0 : 0.04 } },
  }
  const rise = {
    hidden: { opacity: 0, y: reduce ? 0 : 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const } },
  }

  const intro = (
    <>
      <motion.div variants={rise} className="flex items-center gap-3">
        {/* 챕터 마커 — 스파인 위에 맺힌 작은 별(글로우). */}
        <span className="relative flex size-2.5 shrink-0 items-center justify-center" aria-hidden>
          <span
            className="absolute size-2.5 rounded-full"
            style={{ backgroundColor: accent, boxShadow: `0 0 14px 2px ${accent}` }}
          />
        </span>
        <span className="text-xs uppercase tracking-[0.2em]" style={{ color: accent }}>
          {chapter ? `${chapter} · ` : ''}
          {eyebrow}
        </span>
      </motion.div>

      <motion.h2 variants={rise} className="mt-4 font-display text-3xl leading-tight text-white/90 sm:text-4xl">
        {heading}
      </motion.h2>

      {lead && (
        <motion.p variants={rise} className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
          {lead}
        </motion.p>
      )}
    </>
  )

  return (
    <motion.section
      id={id}
      className={cn('relative mx-auto w-full max-w-5xl px-6 py-20 sm:py-28', className)}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-90px' }}
    >
      {/* 빛의 실(스파인) — 마커에서 아래로 흘러내려 다음 장으로 이어지는 느낌. 작은 화면에선 숨김. */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-[5.5rem] hidden w-px sm:block sm:top-32',
          flipped ? 'right-6' : 'left-6',
        )}
        style={{
          height: 'calc(100% - 7rem)',
          background: `linear-gradient(to bottom, ${accent}, transparent 85%)`,
          opacity: 0.22,
        }}
      />

      <div className={flipped ? 'sm:pr-10' : 'sm:pl-10'}>
        {layout === 'split' ? (
          <div
            className={cn(
              'grid items-center gap-8 lg:grid-cols-2 lg:gap-12',
              flip && 'lg:[&>*:first-child]:order-2',
            )}
          >
            <div>{intro}</div>
            <motion.div variants={rise} className="min-w-0">
              {children}
            </motion.div>
          </div>
        ) : (
          <>
            {intro}
            <motion.div variants={rise} className="mt-10">
              {children}
            </motion.div>
          </>
        )}
      </div>
    </motion.section>
  )
}
