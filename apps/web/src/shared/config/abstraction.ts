// 추상화 단계(spec 27·53 / change 32) → 한국어 라벨 + 점 게이지. 회상 패널이 별의 흐려진 정도를 글·지표로
// 보여준다(형태로만 드러나던 단계를 메타에 노출). 단계 수는 VALUES.consolidation.gistStageRadii 길이에서 파생
// (0..stageMax = 5단계) — 하드코딩 금지. 라벨 문자열은 콘텐츠(mood 라벨과 동류)라 코드에 둔다.
import { VALUES } from './values.gen'

/** 최대 추상화 단계(= 야간 요지 임계 개수). 단계 범위는 0..STAGE_MAX. */
export const ABSTRACTION_STAGE_MAX = VALUES.consolidation.gistStageRadii.length // 4

// 단계 0..STAGE_MAX 라벨(또렷 → 요지). 길이는 STAGE_MAX+1과 같아야 한다 — 단계 수가 늘면 라벨도 함께 늘린다.
const STAGE_LABELS = ['또렷', '조금 흐릿', '흐릿', '많이 흐릿', '요지'] as const

/** 단계를 0..STAGE_MAX로 클램프(미수신·구 응답·범위 밖 안전). */
function clampStage(stage: number): number {
  return Math.max(0, Math.min(ABSTRACTION_STAGE_MAX, Math.round(stage)))
}

/** 추상화 단계 → 한국어 라벨(미수신 0 → '또렷'). */
export function abstractionLabel(stage: number): string {
  const s = clampStage(stage)
  return STAGE_LABELS[Math.min(s, STAGE_LABELS.length - 1)] ?? STAGE_LABELS[0]
}

/** 추상화 단계 → 점 게이지 문자열(예 stage=3 → '●●●○○'). 점 총 개수 = 단계 수 0..STAGE_MAX = STAGE_MAX+1개,
 *  채운 점 = 현재 단계 수, 빈 점 = 남은 단계. stage=0 → 전부 빈 점(또렷), stage=STAGE_MAX → 전부 채움(요지). */
export function abstractionGauge(stage: number): string {
  const s = clampStage(stage)
  return '●'.repeat(s) + '○'.repeat(ABSTRACTION_STAGE_MAX + 1 - s)
}
