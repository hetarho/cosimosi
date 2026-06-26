// 추상화 단계(change 29) 버킷화 + buildStarBody용 단계별 형태 파라미터. 우주(StarField)·회상 포트레이트
// (change 32)·감정별 스튜디오 미리보기(change 33)가 같은 단계 지오메트리를 그리도록 공유한다. 배열 노브
// (VALUES.starForm.*)를 그 단계로 인덱싱해 buildStarBody가 받는 해석된 스칼라(StarFormParams)로 만든다 —
// 별 빌더는 배열·values를 모른다(star-body.ts는 three에만 의존).
import { VALUES } from '@/shared/config'
import type { StarFormParams } from './star-body'

// abstraction_stage ∈ 0..STAGE_MAX(= 야간 요지 임계 개수). 단계마다 다른 지오메트리(buildStarBody(look, stage))의
// 버킷으로 나뉜다. stageMax는 buildStarBody의 단계 정규화 분모로도 쓴다.
export const STAGE_MAX = VALUES.consolidation.gistStageRadii.length // 4
export const STAGE_LEVELS = STAGE_MAX + 1 // 단계 0..STAGE_MAX = 5 버킷

const sf = VALUES.starForm
const spikySpikes = sf.spikySpikes as readonly number[]
const spikyLen = sf.spikyLen as readonly number[]
const liquidOpacity = sf.liquidOpacity as readonly number[]

/** 별 abstraction_stage → 단계 버킷 인덱스(0..STAGE_MAX). */
export function stageBucket(stage: number): number {
  return Math.max(0, Math.min(STAGE_MAX, Math.round(stage)))
}

/** buildStarBody에 넘길 단계별 형태 파라미터 — 배열 노브를 그 단계로 인덱싱해 해석된 스칼라로 준다(별 빌더는
 *  배열·values를 모른다). 단계 범위를 벗어나면 마지막 값으로 클램프(가시 0·최저 투명). */
export function formParamsFor(stage: number): StarFormParams {
  const at = (a: readonly number[]) => a[Math.min(stage, a.length - 1)] ?? 0
  return {
    displaceAmp: sf.displaceAmp,
    detailAmp: sf.detailAmp,
    asymmetry: sf.asymmetry,
    stageSimplify: sf.stageSimplify,
    stageMax: STAGE_MAX,
    spikes: at(spikySpikes),
    spikeLen: at(spikyLen),
    spikeSharpness: sf.spikySharpness,
    spikeDetail: sf.spikyDetail,
    opacityFloor: at(liquidOpacity),
  }
}
