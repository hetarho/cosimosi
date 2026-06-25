import { useMemo } from 'react'
import type { StarVisual, SynapseVisual } from '@/widgets/cosmos-scene'
import { useStage } from '../model/stage'

/**
 * 무대 정규화 좌표(`x,y∈[0,100]`)를 CosmosScene 전체화면 앵커(`[0,1]`)로 사상한다(change 31). 무대 별·시냅스는
 * **진짜 3D 별 오브제**(CosmosScene `StarMesh`/`SampleStrand` — 20면체 등 현재 룩)로 그려진다 — 2D 근사가 아니다.
 * 무대는 화면 상단 띠에 산다: 세로는 [BAND_TOP, BAND_TOP+BAND_H], 가로는 중앙 기준 ±(X_SPREAD/2).
 */
const BAND_TOP = 0.09
const BAND_H = 0.21
const X_SPREAD = 0.66

/** 무대 [0,100] → 화면 앵커 [0,1]. */
export function bandToAnchor(x: number, y: number): [number, number] {
  return [0.5 + (x / 100 - 0.5) * X_SPREAD, BAND_TOP + (y / 100) * BAND_H]
}

/** 무대 size [0,1] → 별 코어 월드 반지름(뷰 높이 [-1,1] 기준). */
export function bandStarSize(size: number): number {
  return 0.04 + size * 0.055
}

// 무대 별 셰이딩 — 자체발광은 약하게(EMISSION), 외부 광원은 강하게(LIGHT) 둬 정20면체 면/엣지가 극적으로 드러난다.
const STAGE_EMISSION = 0.4
const STAGE_LIGHT = 1.8
/** 히어로/seed 별 색 — 연보라 계열(브랜드 별). 의미색을 운반하는 장별 기억 별과 구분된다. */
export const STAGE_SEED_COLOR = '#b8a8e8'

// 히어로 엠블럼 전환 — 진행도 0(중앙 큰 별) → 1(상단 무대 자리). 끝 위치는 무대 띠 중앙(중앙 정렬 별과 이어짐).
const HERO_Y0 = 0.26 // 최초 화면에서 글자 위로 — 히어로 카피와 겹치지 않게 높이 둔다
const HERO_Y1 = BAND_TOP + 0.46 * BAND_H
const HERO_SIZE0 = 0.18
const HERO_SIZE1 = bandStarSize(0.85)

/**
 * 무대 상태 + 히어로 진행도 → CosmosScene에 주입할 별·시냅스 배열. 진행도 < 1이면 히어로 엠블럼(진짜 3D 별)을
 * 중앙 큰 별 → 상단 무대로 떠오르게 얹는다(이후 무대 별이 그 자리를 잇는다). 색은 연보라 브랜드 별.
 */
export function useStageCosmos(concept: string, progress: number): {
  stars: StarVisual[]
  synapses: SynapseVisual[]
} {
  const scene = useStage((s) => s.scene)
  const activeAct = useStage((s) => s.activeAct)
  return useMemo(() => {
    const byId = new Map(scene.stars.map((s) => [s.id, s]))
    const stars: StarVisual[] = scene.stars.map((s) => ({
      concept,
      color: s.color,
      anchor: bandToAnchor(s.x, s.y),
      size: bandStarSize(s.size),
      seed: s.seed,
      brightness: s.brightness,
      emission: STAGE_EMISSION,
      lightIntensity: STAGE_LIGHT,
    }))
    const synapses: SynapseVisual[] = scene.synapses.flatMap((syn) => {
      const a = byId.get(syn.a)
      const b = byId.get(syn.b)
      if (!a || !b) return []
      // 양 끝 별이 어두우면 시냅스도 함께 옅어진다(밝기만 — 사라지지 않음, 헌법 §2).
      const dim = Math.min(a.brightness, b.brightness)
      return [
        {
          a: bandToAnchor(a.x, a.y),
          b: bandToAnchor(b.x, b.y),
          colorA: syn.color,
          colorB: syn.color,
          weight: syn.strength * dim,
        },
      ]
    })
    // 히어로 엠블럼은 히어로가 활성일 때만 — 다른 장이 활성이면 그 장의 무대 별이 자리를 잇는다(별 두 개 겹침 방지).
    if (activeAct === 'hero') {
      const t = progress
      stars.unshift({
        concept,
        color: STAGE_SEED_COLOR, // 연보라 브랜드 별
        anchor: [0.5, HERO_Y0 + (HERO_Y1 - HERO_Y0) * t],
        size: HERO_SIZE0 + (HERO_SIZE1 - HERO_SIZE0) * t,
        seed: 7,
        brightness: 1,
        emission: STAGE_EMISSION,
        lightIntensity: STAGE_LIGHT,
      })
    }
    return { stars, synapses }
  }, [scene, activeAct, concept, progress])
}
