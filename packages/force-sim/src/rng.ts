import type { ForceSimCoordinate } from './graph.ts'

export interface SeededRng {
  next(): number
  between(min: number, max: number): number
  vector(radius: number): ForceSimCoordinate
}

export function normalizeForceSimSeed(seed: number): number {
  if (!Number.isFinite(seed)) {
    throw new Error(`force-sim seed must be finite: ${seed}`)
  }
  return Math.trunc(seed) >>> 0
}

export function createSeededRng(seed: number): SeededRng {
  let state = normalizeForceSimSeed(seed)

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    between(min, max) {
      return min + (max - min) * next()
    },
    vector(radius) {
      return {
        x: (next() * 2 - 1) * radius,
        y: (next() * 2 - 1) * radius,
        z: (next() * 2 - 1) * radius,
      }
    },
  }
}

export function deriveForceSimSeed(seed: number, label: string): number {
  let state = normalizeForceSimSeed(seed) ^ 0x811c9dc5
  for (let index = 0; index < label.length; index += 1) {
    state ^= label.charCodeAt(index)
    state = Math.imul(state, 0x01000193) >>> 0
  }
  return state >>> 0
}
