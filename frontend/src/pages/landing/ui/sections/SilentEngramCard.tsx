import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Sparkles } from 'lucide-react'
import { GlassCard } from '@/shared/ui'
import { blobPath } from '@/shared/lib'
import { MOOD } from '@/shared/config'

/** 빛이 완전히 꺼지지 않는 바닥값(침묵 엔그램은 사라지지 않는다). */
const FLOOR = 0.12
/** 시간(0~100)에 따른 별빛 밝기. 고립된 별일수록 가파르게 감쇠하되 FLOOR 아래로는 안 내려감. */
function brightness(time: number, decay: number): number {
  const t = time / 100
  return FLOOR + (1 - FLOOR) * Math.exp(-decay * t)
}

interface StarProps {
  seed: number
  time: number
  decay: number
  reduced: boolean
}

/** 시드로 빚어진 블롭 별 하나. time/decay로 별빛(opacity)이 줄지만 FLOOR 유지. */
function Star({ seed, time, decay, reduced }: StarProps) {
  const path = blobPath(seed, { points: 7, radius: 30, variance: 0.4 })
  const light = brightness(time, decay)
  return (
    <svg viewBox="0 0 100 100" className="h-20 w-20" aria-hidden>
      <defs>
        <radialGradient id={`silent-glow-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={MOOD.coral} stopOpacity={0.9} />
          <stop offset="100%" stopColor={MOOD.coral} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill={`url(#silent-glow-${seed})`} opacity={light} />
      <motion.path
        d={path}
        fill={MOOD.coral}
        stroke="#ffffff"
        strokeOpacity={0.25}
        strokeWidth={1}
        animate={{ opacity: Math.max(light, FLOOR) }}
        transition={reduced ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' }}
      />
    </svg>
  )
}

export function SilentEngramCard() {
  const reduced = useReducedMotion() ?? false
  const [time, setTime] = useState(60)

  // 연결 많은 별: 완만한 감쇠 / 고립된 별: 가파른 감쇠 (망각 속도는 관련성에 좌우)
  const connectedDecay = 0.8
  const isolatedDecay = 2.6
  const connectedPct = Math.round(brightness(time, connectedDecay) * 100)
  const isolatedPct = Math.round(brightness(time, isolatedDecay) * 100)

  return (
    <GlassCard className="flex flex-col gap-4 p-6 sm:p-8">
      <span className="text-xs uppercase tracking-widest text-mood-coral/80">SILENT ENGRAM</span>
      <h3 className="font-display text-xl text-white/90 sm:text-2xl">
        침묵 엔그램 — 사라지지 않는다, 빛이 꺼질 뿐
      </h3>
      <p className="text-sm leading-relaxed text-white/60">
        오래 떠올리지 않은 기억은 어두워지지만 연결을 간직한 채 남아, 작은 단서로 다시 살아납니다.
        잊음은 삭제가 아니라 접근 실패예요. 게다가 망각 속도는 시간만이 아니라 관련성에 좌우됩니다 —
        연결이 많은 별은 천천히, 고립된 별은 빠르게 어두워집니다.
      </p>

      <div className="flex items-end justify-around gap-4 rounded-2xl border border-white/10 bg-space-900/40 p-5">
        <div className="flex flex-col items-center gap-2">
          <Star seed={107} time={time} decay={connectedDecay} reduced={reduced} />
          <span className="text-xs text-white/70">연결 많은 별</span>
          <span className="text-[11px] tabular-nums text-mood-coral/80">밝기 {connectedPct}%</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Star seed={233} time={time} decay={isolatedDecay} reduced={reduced} />
          <span className="text-xs text-white/70">고립된 별</span>
          <span className="text-[11px] tabular-nums text-mood-coral/80">밝기 {isolatedPct}%</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-white/50">
          <span>시간 흐름</span>
          <span className="tabular-nums">{time === 0 ? '방금' : `+${time}일 결`}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={time}
          onChange={(e) => setTime(Number(e.target.value))}
          aria-label="시간 흐름"
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-mood-coral"
        />
        <button
          type="button"
          onClick={() => setTime(0)}
          className="inline-flex items-center justify-center gap-1.5 self-start rounded-full border border-mood-coral/40 bg-mood-coral/10 px-4 py-1.5 text-xs text-mood-coral transition-colors hover:bg-mood-coral/20"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          회상하기
        </button>
      </div>

      <p className="text-xs leading-relaxed text-white/40">
        아무리 시간이 흘러도 빛은 {Math.round(FLOOR * 100)}% 아래로 꺼지지 않습니다. 원본은 그대로 보관되고,
        회상은 단서를 비춰 별을 다시 밝힙니다.
      </p>
    </GlassCard>
  )
}
