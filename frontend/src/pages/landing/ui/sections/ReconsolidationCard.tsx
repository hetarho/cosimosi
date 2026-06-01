import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Lock } from 'lucide-react'
import { GlassCard } from '@/shared/ui'
import { blobPath, mulberry32 } from '@/shared/lib'
import { MOOD, MOOD_KEYS, type MoodKey } from '@/shared/config'

const BASE_SEED = 4217
const ORIGINAL_TEXT = '비 오는 날, 오래된 노래를 들었다.'

/** version으로부터 결정론적으로 색을 고른다. 회상마다 강해지거나 흐려지는 양방향 변형 느낌. */
function moodFor(version: number): MoodKey {
  const rand = mulberry32(BASE_SEED + version * 31)
  return MOOD_KEYS[Math.floor(rand() * MOOD_KEYS.length)]
}

/** version으로부터 밝기(불투명도)를 결정. LTP(강화)/LTD(약화) 양방향. */
function brightnessFor(version: number): number {
  const rand = mulberry32(BASE_SEED + version * 97 + 5)
  return 0.45 + rand() * 0.5
}

interface Memory {
  version: number
  mood: MoodKey
  brightness: number
}

function makeMemory(version: number): Memory {
  return { version, mood: moodFor(version), brightness: brightnessFor(version) }
}

export function ReconsolidationCard() {
  const reduce = useReducedMotion()
  const [history, setHistory] = useState<Memory[]>(() => [makeMemory(0)])
  const current = history[history.length - 1]
  const accent = MOOD[current.mood]

  const recall = () => {
    setHistory((prev) => [...prev, makeMemory(prev.length)])
  }

  return (
    <GlassCard className="flex flex-col gap-5 p-6 sm:col-span-2 sm:p-8">
      <span className="text-xs uppercase tracking-widest text-mood-pink/80">RECONSOLIDATION</span>
      <h3 className="font-display text-xl text-white/90 sm:text-2xl">
        재공고화 — 회상할 때마다 다시 빚어진다
      </h3>
      <p className="text-sm leading-relaxed text-white/60">
        회상은 기억을 잠시 말랑하게(labile) 만들어 다시 굳힌다. 그 사이 기억은 강해지거나 약해지거나
        갱신될 수 있다. cosimosi는 세 겹이다 — 원본 일기는 불변, 별은 회상마다 다시 빚어지는 가변,
        변천사는 그 모든 흔적의 누적.
      </p>

      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* 원본 일기 — 불변 */}
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-space-900/50 p-4">
          <div className="flex items-center gap-2 text-mood-pink/80">
            <Lock className="size-4" aria-hidden />
            <span className="text-xs uppercase tracking-widest">원본 · 불변</span>
          </div>
          <p className="font-display text-base leading-relaxed text-white/85">{ORIGINAL_TEXT}</p>
          <p className="text-xs leading-relaxed text-white/40">
            회상을 거듭해도 당신이 쓴 이 문장은 절대 바뀌지 않는다.
          </p>
        </div>

        {/* 별 — 가변, 회상마다 재생성 */}
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-space-800/40 p-4">
          <motion.svg
            viewBox="0 0 100 100"
            className="size-32"
            aria-label={`회상 ${current.version}회 시점의 별`}
            animate={reduce ? undefined : { scale: [1, 1.04, 1] }}
            transition={reduce ? undefined : { duration: 0.6 }}
            key={current.version}
          >
            <defs>
              <radialGradient id={`recon-star-${current.version}`} cx="50%" cy="45%" r="60%">
                <stop offset="0%" stopColor={accent} stopOpacity={current.brightness} />
                <stop offset="100%" stopColor={accent} stopOpacity={current.brightness * 0.25} />
              </radialGradient>
            </defs>
            <motion.path
              d={blobPath(BASE_SEED + current.version, { points: 7, variance: 0.4 })}
              fill={`url(#recon-star-${current.version})`}
              stroke={accent}
              strokeOpacity={0.6}
              strokeWidth={1}
              initial={reduce ? false : { opacity: 0.3 }}
              animate={{ opacity: 1 }}
              transition={reduce ? { duration: 0 } : { duration: 0.5 }}
            />
          </motion.svg>
          <button
            type="button"
            onClick={recall}
            className="rounded-full border border-white/15 px-5 py-2 text-sm text-white/80 transition-colors hover:border-mood-pink/60 hover:text-white"
            style={{ boxShadow: `0 0 24px -8px ${accent}` }}
          >
            회상하기
          </button>
          <p className="text-xs text-white/40">
            회상 {current.version}회 · 별이 다시 빚어졌다 (밝기 {Math.round(current.brightness * 100)}%)
          </p>
        </div>
      </div>

      {/* 변천사 — 누적 */}
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-widest text-white/40">EVOLUTION · 변천사</span>
        <div className="flex items-end gap-3 overflow-x-auto pb-1">
          {history.map((m) => {
            const c = MOOD[m.mood]
            return (
              <div key={m.version} className="flex shrink-0 flex-col items-center gap-1">
                <svg viewBox="0 0 100 100" className="size-10">
                  <path
                    d={blobPath(BASE_SEED + m.version, { points: 7, variance: 0.4 })}
                    fill={c}
                    fillOpacity={m.brightness}
                    stroke={c}
                    strokeOpacity={0.5}
                    strokeWidth={1.5}
                  />
                </svg>
                <span className="text-[10px] text-white/40">{m.version}</span>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-xs leading-relaxed text-white/40">
        원본은 불변, 별은 가변, 변천사는 누적.
      </p>
    </GlassCard>
  )
}
