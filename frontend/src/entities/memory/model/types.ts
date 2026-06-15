// Pure star/memory domain types. No three/React/DOM, no json/db/proto tags
// (constitution §4·§5 — mobile reusable, transport/persistence stay outside).
import type { Mood } from '@/shared/config'

// Mood's single source is shared/config (the palette types its keys there). Re-export
// so consumers can `import { Mood } from '@/entities/memory'`.
export type { Mood }

/** The star domain object — NOT a transport/persistence type. */
export interface Memory {
  id: string
  mood: Mood
  /** 0..1 emotional intensity → size/presence. */
  intensity: number
  /** -1..1 signed affect of the fragment (spec 21; 26 consumes in λ_eff). */
  valence: number
  /** 0..1 alignment with the "요즘 토픽" centroid (spec 26) — server-computed in GetUniverse
   *  (cos of this star's embedding vs the recent-weighted centroid), the R_recent input to
   *  λ_eff. 0 outside GetUniverse / in demo (no server) → R_recent folds to the no-op 1.0. */
  relevance: number
  /** epoch ms; input to activation/brightness. */
  lastRecalledAt: number
  /** 이 별이 가리키는 불변 원본 일기 id (spec 28). 클라가 record_id로 별을 일기 단위로
   *  그룹해 조망/하이라이팅한다(원본 일기로 별 찾기). 빈 문자열 = 그룹 키 없음(구 데이터). */
  recordId: string
  /** 일기 내 조각 순서(spec 28; 21이 채움). */
  fragmentIndex: number
  /** deterministic hash of the memory id (seedFromId) → per-instance shape variation. */
  seed: number
  /** 재공고화 누적 ±밝기 오프셋(spec 23) — reshapedBrightness가 별 밝기에 합성. */
  brightnessOffset: number
  /** 감정 기준 색 ±28° 색조(도, spec 23) — StarField가 aHueShift로 머티리얼에 합성. */
  hueShift: number
  /** 형태 시드 미세 jitter(spec 23) — reshapedSeed가 별 형태 시드에 합성. */
  formSeedDelta: number
  /** 재성형 횟수(=변천사 길이, spec 23). */
  version: number
  /** 공명(spec 36): 다른 우주의 별과 이어진 별인지(보낸 별·수락으로 태어난 별 양쪽). 서버
   *  GetUniverse가 채운다(데모·공개 방문·구 응답엔 false). StarField가 은은한 공명 마커를 그린다. */
  resonant: boolean
}

/** A star in the render set; `index` is its InstancedMesh instance slot. */
export interface StarNode {
  id: string
  memory: Memory
  index: number
}
