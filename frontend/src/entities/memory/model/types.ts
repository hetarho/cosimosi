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
  /** epoch ms; input to activation/brightness. */
  lastRecalledAt: number
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
}

/** A star in the render set; `index` is its InstancedMesh instance slot. */
export interface StarNode {
  id: string
  memory: Memory
  index: number
}
