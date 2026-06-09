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
  /** epoch ms; input to activation/brightness. */
  lastRecalledAt: number
  /** deterministic hash of the memory id (seedFromId) → per-instance shape variation. */
  seed: number
}

/** A star in the render set; `index` is its InstancedMesh instance slot. */
export interface StarNode {
  id: string
  memory: Memory
  index: number
}
