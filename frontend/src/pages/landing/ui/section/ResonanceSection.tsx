import { useEffect, useState } from 'react'
import { MOOD } from '@/shared/config'
import { useStage, type StageScene } from '../../model/stage'
import { useResetOnActive } from '../../lib/use-reset-on-active'

/**
 * "같은 밤, 두 개의 별" (resonance, 소셜·분산 엔그램 §7, 🚧) — 닫는 비전 비트. 콘텐츠 토글이 무대 두 별
 * (나·친구)을 공명 선으로 잇는다(소셜은 아직 spec만 — 계획된 비전). 카드 안 자족 인터랙션이 아니라
 * 트리거→무대 모델을 따른다(change 31).
 */

const apart: StageScene = {
  stars: [
    { id: 'me', x: 30, y: 46, size: 0.7, color: MOOD.violet, seed: 0x5e0f, brightness: 1 },
    { id: 'friend', x: 70, y: 46, size: 0.7, color: MOOD.teal, seed: 0xa17c, brightness: 0.55 },
  ],
  synapses: [],
}
const resonantScene: StageScene = {
  stars: [apart.stars[0], { ...apart.stars[1], brightness: 1 }],
  synapses: [{ id: 'res', a: 'me', b: 'friend', color: MOOD.amber, strength: 0.85, arc: 0.06, active: true }],
}

export function ResonanceSection() {
  const isActive = useStage((s) => s.activeAct === 'resonance')
  const setScene = useStage((s) => s.setScene)
  const [resonant, setResonant] = useState(false)

  useResetOnActive(isActive, () => setResonant(false))

  useEffect(() => {
    if (isActive) setScene(resonant ? resonantScene : apart)
  }, [isActive, resonant, setScene])

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setResonant((v) => !v)}
        aria-pressed={resonant}
        className="w-fit rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-white/80 transition hover:bg-white/10"
      >
        {resonant ? '공명 풀기' : '친구가 같은 날을 다시 쓰다'}
      </button>
      <p className="text-xs leading-relaxed text-white/45">
        {resonant
          ? '따로 빛나던 두 별이 하나의 빛줄기로 이어졌어요 — 같은 밤을 함께 떠올릴수록 또렷해져요. 우리는 그걸 공명이라 불러요.'
          : '같은 일도 두 사람의 우주엔 저마다의 별로 남아요. 친구가 그날을 자기 말로 다시 쓰면 — 위 무대에서 보세요.'}
      </p>
    </div>
  )
}
