import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { mulberry32 } from '@/shared/lib'
import { MOOD, VALUES } from '@/shared/config'
import { shiftHue } from '@/entities/star'
import { useStage } from '../../model/stage'
import { useResetOnActive } from '../../lib/use-reset-on-active'

const BASE_SEED = 4217
const ORIGINAL_TEXT = '비 오는 날, 오래된 노래를 들었다.'
/** 이 기억의 감정 색 계열(고정) — 회상이 색을 통째로 바꾸지는 않는다(의미 색 보존). */
const BASE_COLOR = MOOD.pink

/** 예측 오차 게이트(PE_THRESHOLD): 새로운 맥락이 이만큼은 돼야 별이 말랑해진다. */
const PE_THRESHOLD = VALUES.reshape.peThreshold

// 회상이 옅게 다시 쓰는 "지금 떠오르는 이야기"(spec 54). 원본은 불변이고, 추상화가 깊어질수록 줄거리에 가까워진다.
const RETELLINGS = [
  '비 오는 날, 오래된 노래를 들었다.',
  '비 오던 그날, 익숙한 노래가 가만히 흘렀다.',
  '비 오는 날이면 떠오르는 노래가 있었다.',
  '비와 음악에 젖어들던, 어떤 날.',
] as const

function retellingFor(version: number): { text: string; rewritten: boolean } {
  const level = Math.min(RETELLINGS.length - 1, Math.max(0, Math.floor(version / 2)))
  return { text: RETELLINGS[level], rewritten: level > 0 }
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

interface Memory {
  version: number
  brightness: number
  hueShift: number
  formSeedDelta: number
  dir: 'up' | 'down'
}

function strengthFor(version: number): number {
  return clamp(VALUES.reshape.strengthRecallGain * Math.log2(1 + version), 0, 1)
}

/** 한 번의 회상 — PE 게이트를 통과(novelty 충분)할 때만 별을 다시 빚는다(아니면 무변, 단순 재점화). */
function attemptRecall(prev: Memory, attempt: number): { next: Memory; changed: boolean } {
  const rand = mulberry32(BASE_SEED + attempt * 2654435761)
  const pe = rand()
  if (pe < PE_THRESHOLD) return { next: prev, changed: false }
  const magnitude = VALUES.reshape.baseStep * pe * (1 - strengthFor(prev.version))
  const goesUp = rand() < 0.5
  const dirSign = goesUp ? 1 : -1
  const brightnessStep = clamp(magnitude, VALUES.reshape.minBrightStep, VALUES.reshape.maxBrightStep)
  const brightness = clamp(prev.brightness + dirSign * brightnessStep, 0.4, 1)
  const hueShift = clamp(
    prev.hueShift + dirSign * magnitude * VALUES.reshape.hueGainDeg,
    -VALUES.reshape.hueMaxDeg,
    VALUES.reshape.hueMaxDeg,
  )
  const formSeedDelta = clamp(
    prev.formSeedDelta + dirSign * magnitude * VALUES.reshape.formGain,
    -VALUES.reshape.formDeltaMax,
    VALUES.reshape.formDeltaMax,
  )
  return { next: { version: prev.version + 1, brightness, hueShift, formSeedDelta, dir: goesUp ? 'up' : 'down' }, changed: true }
}

const INITIAL: Memory = { version: 0, brightness: 0.7, hueShift: 0, formSeedDelta: 0, dir: 'up' }

/**
 * "떠올릴 때마다 다시 빚어져요" (reconsolidation, §3.1) — "다시 떠올리기"로 무대 별의 밝기±·hue가
 * 드리프트한다. **형태 변화**(abstraction_stage별 지오메트리)는 change 29/job 45 의존 — 그 작업이
 * 켜지면 무대 별이 단계 형태까지 자동 반영한다(이 장은 밝기·색·형태 시드만 구동하는 seam). 원본 문장은 불변(헌법 §1).
 */
export function ReconsolidationCard() {
  const isActive = useStage((s) => s.activeAct === 'reconsolidation')
  const setScene = useStage((s) => s.setScene)
  const [history, setHistory] = useState<Memory[]>([INITIAL])
  const [attempts, setAttempts] = useState(0)
  const [lastBlocked, setLastBlocked] = useState(false)
  const current = history[history.length - 1]
  const retelling = retellingFor(current.version)

  useResetOnActive(isActive, () => {
    setHistory([INITIAL])
    setAttempts(0)
    setLastBlocked(false)
  })

  useEffect(() => {
    if (!isActive) return
    setScene({
      stars: [
        {
          id: 'recon',
          x: 50,
          y: 46,
          size: 0.78,
          // 의미 색 계열은 유지하되 hue만 좁게 드리프트(재공고화 색 변화). 형태 시드도 미세 jitter.
          color: shiftHue(BASE_COLOR, current.hueShift),
          brightness: current.brightness,
          seed: BASE_SEED + current.formSeedDelta * 6,
        },
      ],
      synapses: [],
    })
  }, [isActive, current, setScene])

  const recall = () => {
    const attempt = attempts + 1
    setAttempts(attempt)
    const { next, changed } = attemptRecall(history[history.length - 1], attempt)
    setLastBlocked(!changed)
    if (changed) setHistory((prev) => [...prev, next]) // 변천사는 변형이 일어날 때만 쌓인다
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 원본 일기 — 불변(헌법 §1). 회상이 거듭돼도 그대로 병치. */}
      <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-mood-pink/80 flex items-center gap-2">
          <Lock className="size-4" aria-hidden />
          <span className="text-xs tracking-widest uppercase">원본 · 바뀌지 않음</span>
        </div>
        <p className="font-display text-base leading-relaxed text-white/85">{ORIGINAL_TEXT}</p>
      </div>

      {/* 회상이 옅게 다시 쓰는 이야기(spec 54) — 추상화가 깊어질수록 줄거리에 가까워진다(원본은 위 그대로). */}
      <div className="flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-white/3 p-4">
        <span className="text-xs tracking-widest text-white/40 uppercase">지금 떠오르는 이야기 · 회상이 옅게 다시 써요</span>
        <p className="font-display text-sm leading-relaxed text-white/75">{retelling.text}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={recall}
          className="hover:border-mood-pink/60 rounded-full border border-white/15 px-5 py-2 text-sm text-white/80 transition-colors hover:text-white"
          style={{ boxShadow: `0 0 24px -8px ${BASE_COLOR}` }}
        >
          다시 떠올리기
        </button>
        <span className="text-xs text-white/45">
          {current.version > 0 && `${current.version}번째 · ${current.dir === 'up' ? '강화 ↑' : '약화 ↓'} · 밝기 ${Math.round(current.brightness * 100)}%`}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-white/45">
        {lastBlocked
          ? '새로울 게 없던 회상 — 별은 그대로 다시 굳었어요(예측 오차가 낮아 변형 없음).'
          : current.version === 0
            ? '위 무대의 별을 보세요. 다시 떠올릴 때마다 같은 기억이 조금 다른 빛과 색으로 다시 굳어요 — 원본 문장은 그대로예요.'
            : '같은 기억이 조금 다른 빛과 색으로 다시 굳었어요. 형태 변화는 별 형태 시스템(job 45)이 켜지면 함께 반영돼요.'}
      </p>
    </div>
  )
}
