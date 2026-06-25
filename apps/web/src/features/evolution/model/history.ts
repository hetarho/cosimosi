// Pure evolution-history model (spec 24). No three/React/DOM (constitution §4 /
// acceptance 1.9 — mobile reusable). The viewer READS the append-only log spec 23
// wrote; nothing here mutates anything (it's a timelapse of variants).

/** A variant snapshot as the viewer consumes it — proto EvolutionSnapshot folded to a
 *  display shape. `brightness` is already an absolute 0..1 the renderer can use; `hueShift`
 *  is in degrees; `formSeedDelta` adds to the base seed (same memory, a little re-shaped). */
export interface EvolutionSnapshotVM {
  version: number
  brightness: number
  hueShift: number
  formSeedDelta: number
  trigger: string
  pe: number
  dir: number
  createdAt: string
  /** AI 내용 변형 텍스트(spec 54) — trigger='ai_rewrite' 스냅샷만 비어있지 않다. 시각 reshape/gist 행은 "". */
  content: string
  /** 이 버전 시점의 추상화 단계(change 32) — 'nightly_gist' 행만 의미 있는 값(요지화 · N단계). 그 외 0. */
  abstractionStage: number
}

/** trigger → 사건 라벨(change 32). 변천사는 연속적 강화/약화가 아니라 **이산 변환 사건**만 보여준다:
 *  요지화(추상화 단계 변경)·재공고화(회상하며 형태·내용이 변형됨). 'recall'·'new_neighbor'(형태 재성형)과
 *  'ai_rewrite'(내용 변형, spec 54)는 모두 한 사건군 '재공고화'로 묶는다. 미지 trigger는 원값 폴백. */
const TRIGGER_LABEL: Record<string, string> = {
  recall: '재공고화',
  new_neighbor: '재공고화',
  ai_rewrite: '재공고화',
  nightly_gist: '요지화',
}

/** One scrub step: a snapshot plus its resolved event label. dir(형태 지터 부호)은 UI에 노출하지 않는다
 *  (change 32 — 재공고화엔 강화/약화 방향이 없고, 망각은 이산 이벤트가 아니다). */
interface EvolutionStep {
  version: number
  brightness: number
  hueShift: number
  formSeedDelta: number
  /** 원 trigger — UI가 요지화/재공고화 분기에 쓴다('nightly_gist'면 단계 숫자, 그 외 재공고화 N번째). */
  trigger: string
  triggerLabel: string
  /** 이 버전 시점의 추상화 단계(change 32) — 요지화 행의 '요지화 · N단계'. */
  abstractionStage: number
  /** 이 시점의 흐려진 내용(spec 54) — 변형 스냅샷만 비어있지 않다. */
  content: string
}

/** snapshots (version ASC) → scrubbable steps. Form/color drift comes only from the
 *  per-snapshot deltas (the base seed + emotion color stay fixed — same memory, a variant). */
export function toEvolutionSteps(snapshots: EvolutionSnapshotVM[]): EvolutionStep[] {
  return snapshots.map((s) => ({
    version: s.version,
    brightness: s.brightness,
    hueShift: s.hueShift,
    formSeedDelta: s.formSeedDelta,
    trigger: s.trigger,
    triggerLabel: TRIGGER_LABEL[s.trigger] ?? s.trigger,
    abstractionStage: s.abstractionStage,
    content: s.content,
  }))
}

/** Clamp a scrub index to [0, len-1] (0 when empty), so the slider can't run off the ends. */
export function clampIndex(i: number, len: number): number {
  if (len <= 0) return 0
  return Math.max(0, Math.min(len - 1, i))
}
