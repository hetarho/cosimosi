import { useRef, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/shared/lib'
import { useStage, type ActId } from '../model/stage'
import { useScrollMask } from '../lib/use-scroll-mask'

interface JourneyActProps {
  /** 무대를 구동하는 장 id — 화면에 들어오면 이 장이 활성 무대가 된다. */
  id: ActId
  /** 챕터 번호(로마자) — 마커에 새긴다. */
  chapter?: string
  /** 작은 과학 앵커 라벨. 예: "엔그램 · ENGRAM". */
  eyebrow: string
  /** 문학적 챕터 제목. */
  heading: ReactNode
  /** 한두 문장의 리드. */
  lead?: ReactNode
  /** 마커 글로우 + eyebrow 색. */
  accent?: string
  /** 콘텐츠 트리거(버튼/일기 UI) — 결과는 상단 고정 무대에서 펼쳐진다. */
  children: ReactNode
  className?: string
}

/**
 * 여정의 한 장(章) — change 31 인터랙션 모델. 자족 viz를 품지 않는다: 카피(eyebrow·제목·리드)와
 * 콘텐츠 트리거(버튼/일기 UI)만 담고, 화면 중앙 띠를 지나면 상단 고정 무대를 이 장으로 전환한다.
 * 콘텐츠가 상단 무대 띠로 스크롤되어 들어가면 위에서부터 조금씩 마스킹돼 부드럽게 사라진다(useScrollMask —
 * 무대만 늘 또렷하게 남도록). 투명 무대라 배경/그림자로 덮을 수 없어 콘텐츠 자체를 그라디언트로 가린다.
 */
export function JourneyAct({
  id,
  chapter,
  eyebrow,
  heading,
  lead,
  accent = 'var(--ld-accent-soft)',
  children,
  className,
}: JourneyActProps) {
  const setActiveAct = useStage((s) => s.setActiveAct)
  const contentRef = useRef<HTMLDivElement>(null)
  // 콘텐츠가 상단 무대 띠로 올라가면 위에서부터 조금씩 마스킹돼 부드럽게 사라진다(div 통째 페이드 아님).
  const mask = useScrollMask(contentRef)

  return (
    <section
      id={id}
      className={cn('relative mx-auto w-full max-w-3xl px-6 py-24 sm:py-32', className)}
    >
      {/* 무대 활성 센티넬 — 장이 화면 중앙 띠를 지날 때 무대를 이 장으로 전환(once 없이 재진입마다). */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px"
        onViewportEnter={() => setActiveAct(id)}
        viewport={{ margin: '-45% 0px -45% 0px' }}
      />

      <motion.div ref={contentRef} style={{ WebkitMaskImage: mask, maskImage: mask }}>
        <div className="flex items-center gap-3">
          {/* 챕터 마커 — 작은 별(글로우). */}
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
        </div>

        <h2 className="mt-4 font-display text-3xl leading-tight text-white/90 sm:text-4xl">{heading}</h2>

        {lead && <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">{lead}</p>}

        <div className="mt-10">{children}</div>
      </motion.div>
    </section>
  )
}
