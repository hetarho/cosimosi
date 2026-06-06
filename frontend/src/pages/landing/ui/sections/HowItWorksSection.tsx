import { useState } from 'react'
import type { ComponentType } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { PenLine, Sparkles, Repeat, Moon } from 'lucide-react'
import { GlassCard, Section } from '@/shared/ui'
import { cn } from '@/shared/lib'
import { MOOD } from '@/shared/config'

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>

interface Step {
  icon: IconType
  tag: string
  title: string
  desc: string
  caption: string
  accent: string // hex
}

const STEPS: Step[] = [
  {
    icon: PenLine,
    tag: 'Write',
    title: '일기를 쓴다',
    desc: '언제든 — 오늘 일도, 지난 날의 일도 적을 수 있어요. 한번 쓴 원본 문장은 절대 바뀌지 않고 그대로 영구 보관돼요.',
    caption: '원본 텍스트 = 불변 보관',
    accent: MOOD.violet,
  },
  {
    icon: Sparkles,
    tag: 'Connect',
    title: '별이 되어 이어진다',
    desc: 'AI가 일기를 임베딩해 하나의 별(엔그램)로 만들고, 의미가 가까운 기억과 빛의 선으로 잇습니다.',
    caption: '연결은 수 시간~하루 안에 가장 잘 생겨요',
    accent: MOOD.teal,
  },
  {
    icon: Repeat,
    tag: 'Recall',
    title: '회상하면 다시 빚어진다',
    desc: '별에 다가가 함께 떠올리면 연결이 강해지고(LTP), 새 맥락에 따라 별이 다시 빚어져요(재공고화). 원본은 그대로예요.',
    caption: '강화 · 약화 · 갱신 — 원본은 불변',
    accent: MOOD.coral,
  },
  {
    icon: Moon,
    tag: 'Silence',
    title: '잠들되 사라지지 않는다',
    desc: '오래 떠올리지 않은 별은 어두워지며 잠듭니다(침묵 엔그램). 삭제가 아니라 접근 실패일 뿐, 다시 비추면 깨어나요.',
    caption: '망각 = 삭제 아닌 접근 실패',
    accent: MOOD.amber,
  },
]

export function HowItWorksSection() {
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)

  return (
    <Section id="how" className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <span className="text-xs uppercase tracking-widest text-mood-violet/80">How it works</span>
        <h2 className="font-display text-3xl text-white/90 sm:text-4xl">어떻게 작동하나</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-white/60">
          네 단계로 흐르는 작은 우주. 카드를 누르면 그 단계의 별이 더 밝게 빛납니다.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        {STEPS.map((step, i) => {
          const Icon = step.icon
          const isActive = i === active
          return (
            <GlassCard
              key={step.tag}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              onClick={() => setActive(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setActive(i)
                }
              }}
              className={cn(
                'flex cursor-pointer flex-col gap-4 p-6 outline-none transition-colors duration-300 sm:p-8',
                'border border-white/10 focus-visible:border-white/30',
                isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]',
              )}
              style={isActive ? { borderColor: `${step.accent}66` } : undefined}
            >
              <div className="flex items-center justify-between">
                <motion.span
                  className="flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${step.accent}1f`, color: step.accent }}
                  animate={
                    reduce || !isActive ? { scale: 1 } : { scale: [1, 1.12, 1] }
                  }
                  transition={{ duration: 1.6, repeat: isActive && !reduce ? Infinity : 0, ease: 'easeInOut' }}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </motion.span>
                <span
                  className="font-display text-2xl tabular-nums transition-opacity duration-300"
                  style={{ color: step.accent, opacity: isActive ? 0.95 : 0.4 }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>

              <h3 className="font-display text-xl text-white/90 sm:text-2xl">{step.title}</h3>
              <p className="text-sm leading-relaxed text-white/60">{step.desc}</p>

              <div className="mt-1 flex items-center gap-2" aria-hidden>
                {STEPS.map((dot, di) => (
                  <span
                    key={dot.tag}
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: di === i ? 22 : 8,
                      backgroundColor: di === i ? step.accent : '#ffffff',
                      opacity: di === i ? (isActive ? 0.9 : 0.5) : 0.18,
                    }}
                  />
                ))}
              </div>

              <p className="text-xs uppercase tracking-widest text-white/40">
                <span style={{ color: `${step.accent}cc` }}>{step.tag}</span>
                {' · '}
                {step.caption}
              </p>
            </GlassCard>
          )
        })}
      </div>
    </Section>
  )
}
