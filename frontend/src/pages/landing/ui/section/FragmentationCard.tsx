import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { MOOD } from '@/shared/config'
import { useStage, type StageScene, type StageStar } from '../../model/stage'
import { useResetOnActive } from '../../lib/use-reset-on-active'
import { TryInUniverse } from './TryInUniverse'

/**
 * "일기를 별로 나눠 우주에 띄워요" (diary, 엔그램 §1.1 + 사건 분할 §1.2 통합) — 구 EngramCard +
 * FragmentationCard. 실제 작성 UI와 같은 톤의 일기(작성돼 있음)가 "별 나누기 → 별 띄우기"로 N개 조각
 * 별로 갈라져 무대로 떠오른다(같은 하루의 조각은 강한 일내 결속 시냅스로 가까이 모임). 원본 일기는 불변(헌법 §1).
 */

// 하루 안의 세 장면 — 사건 경계에서 갈라진 조각. 색 = 감정.
const FRAGMENTS = [
  { label: '아침 · 평온', color: MOOD.teal, line: '창을 여니 비 냄새. 오랜만에 마음이 가라앉았다.' },
  { label: '낮 · 분노', color: MOOD.coral, line: '회의에서 또 말이 끊겼다. 종일 속이 시끄러웠다.' },
  { label: '밤 · 안도', color: MOOD.amber, line: '집에 와 음악을 틀었다. 그제야 하루가 풀렸다.' },
] as const

const DIARY_STAR: StageStar = { id: 'diary', x: 50, y: 46, size: 0.8, color: MOOD.violet, seed: 7, brightness: 1 }

// 갈라진 직후(흩어짐) → 떠올라 결속(가까이 모임)의 두 배치.
const SCATTERED = [
  { x: 26, y: 30 },
  { x: 70, y: 28 },
  { x: 48, y: 64 },
]
const BOUND = [
  { x: 40, y: 40 },
  { x: 60, y: 38 },
  { x: 50, y: 60 },
]

function fragStars(pos: typeof SCATTERED): StageStar[] {
  return FRAGMENTS.map((f, i) => ({
    id: `frag-${i}`,
    x: pos[i].x,
    y: pos[i].y,
    size: 0.52,
    color: f.color,
    seed: 11 + i * 36,
    brightness: 1,
  }))
}

const sceneWhole: StageScene = { stars: [DIARY_STAR], synapses: [] }
const sceneScattered: StageScene = { stars: fragStars(SCATTERED), synapses: [] }
// 일내 결속(intra-entry) — 같은 일기에서 태어난 별은 가장 굵은 선으로 묶인다(w≈0.85).
const sceneBound: StageScene = {
  stars: fragStars(BOUND),
  synapses: [
    { id: 'b01', a: 'frag-0', b: 'frag-1', color: MOOD.violet, strength: 0.85, active: true },
    { id: 'b12', a: 'frag-1', b: 'frag-2', color: MOOD.violet, strength: 0.85, active: true },
    { id: 'b02', a: 'frag-0', b: 'frag-2', color: MOOD.violet, strength: 0.8, active: true },
  ],
}

type Phase = 'whole' | 'scattered' | 'bound'

export function FragmentationCard() {
  const isActive = useStage((s) => s.activeAct === 'diary')
  const setScene = useStage((s) => s.setScene)
  const [phase, setPhase] = useState<Phase>('whole')

  // 스크롤 진입 시 원본 일기 한 별로 되돌린다(다시 시연 가능).
  useResetOnActive(isActive, () => setPhase('whole'))

  useEffect(() => {
    if (!isActive) return
    setScene(phase === 'whole' ? sceneWhole : phase === 'scattered' ? sceneScattered : sceneBound)
  }, [isActive, phase, setScene])

  return (
    <div className="flex flex-col gap-5">
      {/* 원본 일기 — 실제 작성 UI 톤(다크 글래스). 불변(헌법 §1). */}
      <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between text-[11px] text-white/40">
          <span className="inline-flex items-center gap-1">
            <Lock className="size-3" aria-hidden />
            원본 일기 · 그대로 1편
          </span>
          <span>2026 · 6 · 14</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {FRAGMENTS.map((f) => (
            <p key={f.label} className="flex items-start gap-2 text-sm leading-relaxed text-white/80">
              <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: f.color }} />
              {f.line}
            </p>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setPhase('scattered')}
          disabled={phase !== 'whole'}
          className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:border-white/35 hover:text-white disabled:opacity-40"
        >
          별 나누기
        </button>
        <button
          type="button"
          onClick={() => setPhase('bound')}
          disabled={phase !== 'scattered'}
          className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:border-white/35 hover:text-white disabled:opacity-40"
          style={{ boxShadow: phase === 'scattered' ? `0 0 22px -8px ${MOOD.amber}` : undefined }}
        >
          별 띄우기
        </button>
        {phase === 'bound' && (
          <button
            type="button"
            onClick={() => setPhase('whole')}
            className="text-xs text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
          >
            처음부터
          </button>
        )}
      </div>

      <p className="text-xs leading-relaxed text-white/45">
        {phase === 'whole'
          ? '일기 한 편을 사건의 경계에서 나눠 보세요 — 조각마다 자기 감정의 별이 태어나요.'
          : phase === 'scattered'
            ? '세 조각 별로 갈라졌어요. 이제 우주로 띄우면, 같은 하루의 별들은 가장 굵은 선으로 묶여요.'
            : '같은 일기에서 태어난 별들이 강한 일내 결속으로 가까이 모였어요. 원본은 한 글자도 그대로예요.'}
      </p>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <TryInUniverse sim="fragmentation" />
      </div>
    </div>
  )
}
