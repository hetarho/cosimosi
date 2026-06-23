import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Lock } from 'lucide-react'
import { GlassCard } from '@/shared/ui'
import { mulberry32 } from '@/shared/lib'
import { MOOD, VALUES } from '@/shared/config'
import { useAppearance } from '@/entities/appearance'
import { VizStar } from '@/entities/star'
import { TheoryBadge } from './TheoryBadge'

const BASE_SEED = 4217
const ORIGINAL_TEXT = '비 오는 날, 오래된 노래를 들었다.'
/** 이 기억의 감정 색 계열(고정). 회상이 색을 통째로 바꾸지는 않는다. */
const BASE_COLOR = MOOD.pink

/** 예측 오차 게이트(spec 23 PE_THRESHOLD): 새로운 맥락이 이만큼은 돼야 별이 말랑해진다. */
const PE_THRESHOLD = VALUES.reshape.peThreshold

// 회상이 옅게 다시 쓰는 "지금 떠오르는 이야기"(spec 54). 원본(ORIGINAL_TEXT)은 불변이고,
// 회상이 거듭돼 추상화가 깊어질수록 회상의 *이야기*만 디테일을 덜어내 줄거리(요지)에 가까워진다.
// 높은 단계일수록 더 일반적 인상만 남는다 — append-only 변천사에 쌓이는 별도 레이어다(원본 records 아님, 헌법1).
const RETELLINGS = [
  '비 오는 날, 오래된 노래를 들었다.', // 0 — 아직 원본 그대로
  '비 오던 그날, 익숙한 노래가 가만히 흘렀다.', // 1
  '비 오는 날이면 떠오르는 노래가 있었다.', // 2
  '비와 음악에 젖어들던, 어떤 날.', // 3 — 줄거리만 남은 요지
] as const

/** 회상 횟수(version)가 깊어질수록 회상의 이야기가 줄거리 쪽으로. 변형은 2회째부터(추상화 단계 임계 — 그 전엔 원본 그대로). */
function retellingFor(version: number): { text: string; rewritten: boolean } {
  const level = Math.min(RETELLINGS.length - 1, Math.max(0, Math.floor(version / 2)))
  return { text: RETELLINGS[level], rewritten: level > 0 }
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/**
 * 한 기억의 한 시점. 회상은 "랜덤 재생성"이 아니라 같은 기억을 다시 굳히는 과정이다.
 * 그래서 형태(seed)와 감정 색 계열은 유지되고 — 밝기만 강화/약화 양방향으로, 색조는 좁은 폭으로,
 * 형태는 시드 미세 jitter로 갱신된다. (재공고화는 강화·약화·갱신 모두 가능하되 "그 기억"을 벗어나진 않는다.)
 */
interface Memory {
  version: number
  /** 0.4~1 — 직전 대비 ±한 발씩 걷는 양방향 워크. */
  brightness: number
  /** 원본 색 기준 ±28° 이내의 좁은 색조 갱신. */
  hueShift: number
  /** 형태 시드 미세 jitter(±0.6 이내) — 같은 기억이 조금 다른 형태로 다시 굳는다. */
  formSeedDelta: number
  /** 직전 시점 대비 강화(up)/약화(down). */
  dir: 'up' | 'down'
}

/** 회상이 거듭될수록(version↑) 별이 더 굳어 변화폭이 작아진다(강도 의존 — strength↑ ⇒ magnitude↓). */
function strengthFor(version: number): number {
  return clamp(VALUES.reshape.strengthRecallGain * Math.log2(1 + version), 0, 1)
}

/** 한 번의 회상 시도. PE 게이트를 통과(novelty 충분)할 때만 별을 다시 빚고, 아니면 prev 그대로(무변).
 *  attempt마다 결정론적 PE를 뽑아 "매 클릭 ≠ 변형"을 보인다(난수 재생성이 아닌 제약된 드리프트). */
function attemptRecall(prev: Memory, attempt: number): { next: Memory; changed: boolean } {
  const rand = mulberry32(BASE_SEED + attempt * 2654435761)
  const pe = rand() // 0..1 — 이번 회상이 담은 새 맥락의 크기
  if (pe < PE_THRESHOLD) return { next: prev, changed: false } // novelty 없음 → 단순 재점화(무변)
  const magnitude = VALUES.reshape.baseStep * pe * (1 - strengthFor(prev.version)) // strength↑ ⇒ 작아짐
  const goesUp = rand() < 0.5
  const dirSign = goesUp ? 1 : -1
  const brightnessStep = clamp(
    magnitude,
    VALUES.reshape.minBrightStep,
    VALUES.reshape.maxBrightStep,
  )
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
  return {
    next: {
      version: prev.version + 1,
      brightness,
      hueShift,
      formSeedDelta,
      dir: goesUp ? 'up' : 'down',
    },
    changed: true,
  }
}

const INITIAL: Memory = { version: 0, brightness: 0.7, hueShift: 0, formSeedDelta: 0, dir: 'up' }

export function ReconsolidationCard() {
  const reduce = useReducedMotion()
  const concept = useAppearance((s) => s.object)
  const [history, setHistory] = useState<Memory[]>(() => [INITIAL])
  const [attempts, setAttempts] = useState(0)
  /** 직전 클릭이 게이트에 막혀 변화가 없었는지 — 안내 문구로 보인다. */
  const [lastBlocked, setLastBlocked] = useState(false)
  const current = history[history.length - 1]
  const retelling = retellingFor(current.version)

  const recall = () => {
    const attempt = attempts + 1
    setAttempts(attempt)
    const { next, changed } = attemptRecall(history[history.length - 1], attempt)
    setLastBlocked(!changed)
    if (changed) setHistory((prev) => [...prev, next]) // 변천사는 변형이 일어날 때만 쌓인다
  }

  return (
    <GlassCard className="flex flex-col gap-5 p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* 원본 일기 — 불변 */}
        <div className="bg-space-900/50 flex flex-col gap-3 rounded-2xl border border-white/10 p-4">
          <div className="text-mood-pink/80 flex items-center gap-2">
            <Lock className="size-4" aria-hidden />
            <span className="text-xs tracking-widest uppercase">원본 · 바뀌지 않음</span>
          </div>
          <p className="font-display text-base leading-relaxed text-white/85">{ORIGINAL_TEXT}</p>
          <p className="text-xs leading-relaxed text-white/40">
            몇 번을 떠올려도, 그날 내가 쓴 이 문장은 그대로예요.
          </p>
        </div>

        {/* 별 — 가변, 회상마다 재성형 */}
        <div className="bg-space-800/40 flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 p-4">
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
                style={{
                  background: `radial-gradient(circle, ${BASE_COLOR}66 0%, transparent 62%)`,
                }}
                initial={{ opacity: 0.6, scale: 0.7 }}
                animate={{ opacity: 0, scale: 1.7 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            )}
            <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
              {/* 형태 시드에 formSeedDelta를 합성 — 밝기·색조뿐 아니라 형태까지 다시 빚어진다(spec 23). */}
              <VizStar
                cx={50}
                cy={50}
                r={30}
                color={BASE_COLOR}
                concept={concept}
                seed={BASE_SEED + current.formSeedDelta * 6}
                brightness={current.brightness}
                active
              />
            </svg>
          </div>
          <button
            type="button"
            onClick={recall}
            className="hover:border-mood-pink/60 rounded-full border border-white/15 px-5 py-2 text-sm text-white/80 transition-colors hover:text-white"
            style={{ boxShadow: `0 0 24px -8px ${BASE_COLOR}` }}
          >
            다시 떠올리기
          </button>
          <p className="text-xs text-white/40">
            {lastBlocked
              ? '새로울 게 없던 회상 — 별은 그대로 다시 굳었어요 (예측 오차가 낮아 변형 없음).'
              : current.version === 0
                ? '처음 그대로의 별. 같은 모습으로 다시 굳을 준비가 됐어요.'
                : `${current.version}번째 회상 · ${current.dir === 'up' ? '강화 ↑' : '약화 ↓'} · 같은 기억이 조금 다른 빛과 형태로 굳었어요 (밝기 ${Math.round(current.brightness * 100)}%)`}
          </p>
        </div>
      </div>

      {/* 회상이 옅게 다시 쓰는 이야기(spec 54) — 원본은 위에서 그대로, 회상의 이야기만 추상화될수록 줄거리에 가까워진다. */}
      <div className="bg-space-900/40 flex flex-col gap-1.5 rounded-2xl border border-white/10 p-4">
        <span className="text-xs tracking-widest text-white/40 uppercase">지금 떠오르는 이야기 · 회상이 옅게 다시 써요</span>
        <p className="font-display text-sm leading-relaxed text-white/75">{retelling.text}</p>
        <p className="text-[11px] leading-relaxed text-white/40">
          {retelling.rewritten
            ? '여러 번 떠올려 추상화가 깊어지자, 회상의 이야기가 줄거리 쪽으로 옅게 다시 쓰였어요 — 위 원본은 한 글자도 그대로예요.'
            : '아직은 원본 그대로 떠올라요. 추상화가 깊어지면 회상의 이야기만 줄거리 쪽으로 옅게 다시 쓰여요(원본은 불변).'}
        </p>
      </div>

      {/* 변천사 — 누적 */}
      <div className="flex flex-col gap-2">
        <span className="text-xs tracking-widest text-white/40 uppercase">변천사 · 남는 길</span>
        <div className="flex items-end gap-3 overflow-x-auto pb-1">
          {history.map((m) => (
            <div key={m.version} className="flex shrink-0 flex-col items-center gap-1">
              <svg
                viewBox="0 0 100 100"
                className="size-10"
                style={{ filter: `hue-rotate(${m.hueShift}deg)` }}
              >
                <VizStar
                  cx={50}
                  cy={50}
                  r={30}
                  color={BASE_COLOR}
                  seed={BASE_SEED + m.formSeedDelta * 6}
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

      <p className="text-xs leading-relaxed text-white/40">
        원본은 그대로, 별의 빛도 형태도 회상의 이야기도 조금씩 변하고, 변천사는 차곡차곡 쌓여가요.
      </p>

      {/* PE 게이트 양방향 재성형 + append-only 변천사는 plan 23이 구현했다(타임랩스 UI는 24). */}
      <TheoryBadge status="done" plan="23" />
    </GlassCard>
  )
}
