import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Lock } from 'lucide-react'
import { GlassCard } from '@/shared/ui'
import { mulberry32 } from '@/shared/lib'
import { MOOD } from '@/shared/config'
import { useLandingTheme } from '../../model/theme'
import { VizStar } from '../viz'
import { StarCanvas, Star3D } from '../star3d'

const BASE_SEED = 4217
const ORIGINAL_TEXT = '비 오는 날, 오래된 노래를 들었다.'
/** 이 기억의 감정 색 계열(고정). 회상이 색을 통째로 바꾸지는 않는다. */
const BASE_COLOR = MOOD.pink

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/**
 * 한 기억의 한 시점. 회상은 "랜덤 재생성"이 아니라 같은 기억을 다시 굳히는 과정이다.
 * 그래서 형태(seed)와 감정 색 계열은 유지되고 — 밝기만 강화/약화 양방향으로, 색조는 좁은 폭으로
 * 갱신된다. (재공고화는 강화·약화·갱신 모두 가능하되 "그 기억"을 벗어나진 않는다.)
 */
interface Memory {
  version: number
  /** 0.4~1 — 직전 대비 ±한 발씩 걷는 양방향 워크. */
  brightness: number
  /** 원본 색 기준 ±28° 이내의 좁은 색조 갱신. */
  hueShift: number
  /** 직전 시점 대비 강화(up)/약화(down). */
  dir: 'up' | 'down'
}

/** 직전 상태로부터 결정론적으로 다음 회상 시점을 빚는다(난수 재생성이 아닌 제약된 드리프트). */
function nextMemory(prev: Memory | null, version: number): Memory {
  if (!prev) return { version, brightness: 0.7, hueShift: 0, dir: 'up' }
  const rand = mulberry32(BASE_SEED + version * 2654435761)
  const goesUp = rand() < 0.5
  const step = 0.1 + rand() * 0.12 // 0.10~0.22
  const brightness = clamp(prev.brightness + (goesUp ? step : -step), 0.4, 1)
  const hueShift = clamp(prev.hueShift + (rand() - 0.5) * 18, -28, 28)
  const dir = brightness >= prev.brightness ? 'up' : 'down'
  return { version, brightness, hueShift, dir }
}

export function ReconsolidationCard() {
  const reduce = useReducedMotion()
  const concept = useLandingTheme((s) => s.theme)
  const [history, setHistory] = useState<Memory[]>(() => [nextMemory(null, 0)])
  const current = history[history.length - 1]

  const recall = () => {
    setHistory((prev) => [...prev, nextMemory(prev[prev.length - 1], prev.length)])
  }

  return (
    <GlassCard className="flex flex-col gap-5 p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* 원본 일기 — 불변 */}
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-space-900/50 p-4">
          <div className="flex items-center gap-2 text-mood-pink/80">
            <Lock className="size-4" aria-hidden />
            <span className="text-xs uppercase tracking-widest">원본 · 바뀌지 않음</span>
          </div>
          <p className="font-display text-base leading-relaxed text-white/85">{ORIGINAL_TEXT}</p>
          <p className="text-xs leading-relaxed text-white/40">
            몇 번을 떠올려도, 그날 내가 쓴 이 문장은 그대로다.
          </p>
        </div>

        {/* 별 — 가변, 회상마다 재성형 */}
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-space-800/40 p-4">
          <div
            className="relative size-32"
            style={{ filter: `hue-rotate(${current.hueShift}deg)`, transition: 'filter 0.5s ease' }}
            role="img"
            aria-label={`${current.version}번째 회상의 별`}
          >
            {/* 회상 순간의 짧은 빛 파문 — 다시 굳는 찰나. */}
            {!reduce && current.version > 0 && (
              <motion.span
                key={current.version}
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{ background: `radial-gradient(circle, ${BASE_COLOR}66 0%, transparent 62%)` }}
                initial={{ opacity: 0.6, scale: 0.7 }}
                animate={{ opacity: 0, scale: 1.7 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            )}
            <StarCanvas width={100} height={100} animated className="h-full w-full">
              <Star3D concept={concept} color={BASE_COLOR} x={50} y={50} r={30} seed={BASE_SEED} brightness={current.brightness} active />
            </StarCanvas>
          </div>
          <button
            type="button"
            onClick={recall}
            className="rounded-full border border-white/15 px-5 py-2 text-sm text-white/80 transition-colors hover:border-mood-pink/60 hover:text-white"
            style={{ boxShadow: `0 0 24px -8px ${BASE_COLOR}` }}
          >
            다시 떠올리기
          </button>
          <p className="text-xs text-white/40">
            {current.version === 0
              ? '처음 그대로의 별. 같은 모습으로 다시 굳을 준비가 됐다.'
              : `${current.version}번째 회상 · ${current.dir === 'up' ? '강화 ↑' : '약화 ↓'} · 같은 기억이 조금 다른 빛으로 굳었다 (밝기 ${Math.round(current.brightness * 100)}%)`}
          </p>
        </div>
      </div>

      {/* 변천사 — 누적 */}
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-widest text-white/40">변천사 · 남는 길</span>
        <div className="flex items-end gap-3 overflow-x-auto pb-1">
          {history.map((m) => (
            <div key={m.version} className="flex shrink-0 flex-col items-center gap-1">
              <svg viewBox="0 0 100 100" className="size-10" style={{ filter: `hue-rotate(${m.hueShift}deg)` }}>
                <VizStar
                  cx={50}
                  cy={50}
                  r={30}
                  color={BASE_COLOR}
                  seed={BASE_SEED}
                  concept={concept}
                  brightness={m.brightness}
                />
              </svg>
              <span className="text-[10px] text-white/40">
                {m.version === 0 ? '최초' : `${m.version}${m.dir === 'up' ? '↑' : '↓'}`}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs leading-relaxed text-white/40">원본은 그대로, 별은 변하고, 변천사는 쌓인다.</p>
    </GlassCard>
  )
}
