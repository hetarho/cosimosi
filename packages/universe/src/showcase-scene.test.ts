import { describe, expect, it } from 'vitest'

import { MOODS } from '@cosimosi/emotion'

import {
  SHOWCASE_ELAPSED_DAYS,
  ambientShowcaseScene,
  awakenShowcaseField,
  forgettingShowcaseScene,
  gistShowcaseScene,
  moodRingShowcaseScene,
} from './showcase-scene.ts'

// What each specimen has to hold for the review to be OF something. A scene that quietly lets a
// second variable in (two seeds in the forgetting row, a filament reaching a memory slot) produces a
// reviewer's note about the wrong thing, and the design gets changed to fix the fixture.
describe('forgetting row', () => {
  it('varies only the time since recall', () => {
    const { memories } = forgettingShowcaseScene()

    expect(memories).toHaveLength(SHOWCASE_ELAPSED_DAYS.length)
    expect(new Set(memories.map((memory) => memory.emotion.mood)).size).toBe(1)
    expect(new Set(memories.map((memory) => memory.baseStrength)).size).toBe(1)
    expect(new Set(memories.map((memory) => memory.seed)).size).toBe(1)
    expect(new Set(memories.map((memory) => memory.lastRecalledUniverseTime)).size).toBe(
      memories.length,
    )
  })

  it('lays the row out left to right, recent first', () => {
    const { positions } = forgettingShowcaseScene()
    const xs = SHOWCASE_ELAPSED_DAYS.map((_, i) => positions[i * 3])

    expect(xs).toEqual([...xs].sort((a, b) => a - b))
  })
})

describe('ambient trio', () => {
  it('connects only neuron slots, at widths that keep their order', () => {
    const scene = ambientShowcaseScene()

    expect(scene.filaments.count).toBe(3)
    for (const slot of scene.filaments.endpointPairs) {
      expect(slot).toBeLessThan(scene.neuronCount)
    }
    const widths = Array.from(scene.filaments.widths)
    expect(widths[0]).toBeGreaterThan(widths[1])
    expect(widths[1]).toBeGreaterThan(widths[2])
  })

  it('puts the dust behind the neurons rather than among them', () => {
    const scene = ambientShowcaseScene()
    const neuronZ = Array.from({ length: scene.neuronCount }, (_, i) => scene.positions[i * 3 + 2])
    const deepest = Math.min(...neuronZ)

    expect(scene.latent.count).toBeGreaterThan(0)
    for (let i = 0; i < scene.latent.count; i++) {
      expect(scene.latent.positions[i * 3 + 2]).toBeLessThan(deepest)
    }
  })
})

describe('gist pair', () => {
  it('rises only the risen memory, over its own x and y', () => {
    const scene = gistShowcaseScene()

    expect(scene.gistCount).toBeGreaterThan(0)
    const risenX = scene.positions[3]
    for (let i = 0; i < scene.gistCount; i++) {
      expect(scene.gistPositions[i * 3]).toBe(risenX)
      expect(scene.gistPositions[i * 3 + 1]).toBe(scene.positions[4])
      // Neocortex is above the hippocampus band the episodic bodies sit in.
      expect(scene.gistPositions[i * 3 + 2]).toBeGreaterThan(scene.positions[5] ?? 0)
    }
  })

  it('softens the deeper stage rather than resizing it arbitrarily', () => {
    const scene = gistShowcaseScene()
    const softness = Array.from(scene.gistSoftness.slice(0, scene.gistCount))

    expect(softness.length).toBeGreaterThan(1)
    expect(softness[softness.length - 1]).toBeGreaterThan(softness[0])
  })
})

describe('mood ring', () => {
  it('gives every mood a contributor', () => {
    const scene = moodRingShowcaseScene()

    expect(scene.contributors.count).toBe(MOODS.length)
  })
})

describe('awaken field', () => {
  it('is deterministic, so a flare can be replayed against the same dust', () => {
    expect(Array.from(awakenShowcaseField().positions)).toEqual(
      Array.from(awakenShowcaseField().positions),
    )
  })
})
