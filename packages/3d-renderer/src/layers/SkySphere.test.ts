import { describe, expect, it } from 'vitest'
import { uniform } from 'three/tsl'
import * as THREE from 'three/webgpu'

import { buildEmotionGradientTexture } from '../assets/sky/emotion-gradient.ts'
import { GRAINIENT_SPIN } from '../assets/sky/grainient-sky.ts'
import { GRAINSTORM_SPIN } from '../assets/sky/grainstorm-sky.ts'
import { LIQUID_ETHER_SPIN } from '../assets/sky/liquid-ether-sky.ts'
import type { SkyFrameSpin } from '../assets/sky/sky-domain.ts'
import { SKY_EFFECTS, resolveSkyEffect, type SkyEffect } from '../assets/sky/sky-effects.ts'
import { emotionAnchors } from '../assets/sky/sky-emotion.ts'
import {
  advanceSkyFacing,
  createSkyMaterial,
  normalizeSkyWeights,
  skyFacingAt,
  skyFacingQuaternion,
  skyFacingStep,
  skyWeightsKey,
} from './SkySphere.tsx'

describe('emotion sky material', () => {
  it('gives every registered backdrop a partial-opacity tuning', () => {
    for (const effect of SKY_EFFECTS) {
      expect(effect.opacity, effect.key).toBeGreaterThan(0)
      expect(effect.opacity, effect.key).toBeLessThan(1)
    }
  })

  it('uses normal transparency as a depth-tested, non-writing backdrop', () => {
    const gradient = buildEmotionGradientTexture([{ color: '#ff0000', weight: 1 }])
    const material = createSkyMaterial({
      gradient,
      time: uniform(0),
      effect: 'grainient',
      count: 1,
      weights: [1],
      opacity: 0.82,
      headroom: 0.7,
    })

    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(false)
    expect(material.depthTest).toBe(true)
    expect(material.opacityNode).toBeDefined()

    material.dispose()
    gradient.dispose()
  })

  it('clamps opacity to an opaque material at one', () => {
    const gradient = buildEmotionGradientTexture([{ color: '#ff0000', weight: 1 }])
    const material = createSkyMaterial({
      gradient,
      time: uniform(0),
      effect: 'grainient',
      count: 1,
      weights: [1],
      opacity: 2,
      headroom: 0.7,
    })

    expect(material.transparent).toBe(false)

    material.dispose()
    gradient.dispose()
  })
})

describe('sky material memo key (R003)', () => {
  const stops = () => [
    { color: '#ff0000', weight: 2 },
    { color: '#00ff00', weight: 1 },
    { color: '#0000ff', weight: 1 },
  ]

  it('is identical for two distinct arrays carrying the same emotions', () => {
    // What a content-identical GetUniverse refetch produces: a fresh array, the same numbers. The
    // material must not rebuild — recompiling the sky's TSL shader is the scene's costliest work.
    const first = stops()
    const second = stops()
    expect(second).not.toBe(first)
    expect(skyWeightsKey(normalizeSkyWeights(second))).toBe(
      skyWeightsKey(normalizeSkyWeights(first)),
    )
  })

  it('moves when a weight value moves', () => {
    const changed = stops()
    changed[1] = { color: '#00ff00', weight: 3 }
    expect(skyWeightsKey(normalizeSkyWeights(changed))).not.toBe(
      skyWeightsKey(normalizeSkyWeights(stops())),
    )
  })

  it('moves when the emotion count changes, since count-structured effects bake it in', () => {
    expect(skyWeightsKey(normalizeSkyWeights(stops().slice(0, 2)))).not.toBe(
      skyWeightsKey(normalizeSkyWeights(stops())),
    )
  })

  it('ignores a color-only change — that takes the ramp-repaint path instead', () => {
    const recolored = stops().map((stop, index) =>
      index === 0 ? { color: '#123456', weight: stop.weight } : stop,
    )
    expect(skyWeightsKey(normalizeSkyWeights(recolored))).toBe(
      skyWeightsKey(normalizeSkyWeights(stops())),
    )
  })

  it('round-trips through the key, so the derived array is the fixed-precision one', () => {
    // The component rebuilds `weights` from this string, which is what makes the memo's dependency
    // list honest: the array's identity moves exactly when a weight's six-decimal value moves.
    const weights = normalizeSkyWeights(stops())
    expect(skyWeightsKey(weights).split(',').map(Number)).toEqual(
      weights.map((weight) => Number(weight.toFixed(6))),
    )
  })

  it('spreads evenly rather than dividing by zero when nothing carries weight', () => {
    expect(
      normalizeSkyWeights([
        { color: '#fff', weight: 0 },
        { color: '#000', weight: 0 },
      ]),
    ).toEqual([0.5, 0.5])
  })
})

describe('sky facing', () => {
  const VIEW = new THREE.Vector3(0, 0, -1)
  const facingOf = (count: number, index: number) => {
    const goal = skyFacingQuaternion(count, index)
    if (goal === null) throw new Error(`no facing for slice ${index} of ${count}`)
    return goal
  }

  it('leaves the orientation at identity when no facing is given', () => {
    // What the sky does on every surface that never passes `facing`: the universe, the demo,
    // sign-in and the design benches keep the untouched mesh.
    const orientation = new THREE.Quaternion()
    let held = false
    for (const step of [skyFacingStep(1 / 60, 4), 1]) {
      held = advanceSkyFacing(orientation, null, held, step)
      expect(held).toBe(false)
      expect(orientation.equals(new THREE.Quaternion())).toBe(true)
    }
  })

  it("turns each slice's anchor onto the view direction", () => {
    for (const count of [1, 2, 3, 6, 13]) {
      const anchors = emotionAnchors(count)
      for (let index = 0; index < count; index++) {
        const [x, y, z] = anchors[index]
        const faced = new THREE.Vector3(x, y, z).applyQuaternion(facingOf(count, index))
        expect(faced.angleTo(VIEW), `${index} of ${count}`).toBeLessThan(1e-6)
      }
    }
  })

  it('faces nothing for an index outside the slices', () => {
    expect(skyFacingQuaternion(6, -1)).toBeNull()
    expect(skyFacingQuaternion(6, 6)).toBeNull()
    expect(skyFacingQuaternion(6, 1.5)).toBeNull()
    expect(skyFacingQuaternion(0, 0)).toBeNull()
  })

  it('takes a facing that appears at once, and drops it at once when it goes', () => {
    const goal = facingOf(6, 0)
    const orientation = new THREE.Quaternion()
    let held = advanceSkyFacing(orientation, goal, false, skyFacingStep(1 / 60, 4))
    expect(held).toBe(true)
    expect(orientation.angleTo(goal)).toBeLessThan(1e-6)

    held = advanceSkyFacing(orientation, null, held, skyFacingStep(1 / 60, 4))
    expect(held).toBe(false)
    expect(orientation.equals(new THREE.Quaternion())).toBe(true)
  })

  it('eases between two facings as an exponential approach at the given responsiveness', () => {
    const from = facingOf(6, 0)
    const to = facingOf(6, 3)
    const lambda = 4
    const frame = 1 / 60
    const orientation = from.clone()
    const arc = from.angleTo(to)

    advanceSkyFacing(orientation, to, true, skyFacingStep(frame, lambda))
    // One frame moves it, but only part of the way.
    expect(orientation.angleTo(from)).toBeGreaterThan(0)
    expect(orientation.angleTo(to)).toBeGreaterThan(arc / 2)

    // After one second, what is left of the arc is e^(-lambda), the camera rig's damp.
    for (let i = 1; i < 60; i++)
      advanceSkyFacing(orientation, to, true, skyFacingStep(frame, lambda))
    expect(orientation.angleTo(to)).toBeCloseTo(arc * Math.exp(-lambda), 4)
  })

  it('snaps without a responsiveness', () => {
    expect(skyFacingStep(1 / 60, undefined)).toBe(1)
    expect(skyFacingStep(1 / 60, 0)).toBe(1)
    const to = facingOf(6, 3)
    const orientation = facingOf(6, 0).clone()
    advanceSkyFacing(orientation, to, true, skyFacingStep(1 / 60, undefined))
    expect(orientation.angleTo(to)).toBeLessThan(1e-6)
  })
})

describe('sky facing under a spinning frame', () => {
  const VIEW = new THREE.Vector3(0, 0, -1)

  // The shader's own turn (`skySpin`, Rodrigues) applied in JS: the field reads a surface direction
  // `d` at `spun(d)`, so the surface point showing field-space anchor `a` is the inverse turn of `a`.
  const where = (anchor: readonly number[], spin: SkyFrameSpin, seconds: number) => {
    const axis = new THREE.Vector3(...spin.axis).normalize()
    return new THREE.Vector3(anchor[0], anchor[1], anchor[2]).applyAxisAngle(
      axis,
      -spin.rate * seconds,
    )
  }

  it("keeps the faced territory on the view direction while the effect's frame turns", () => {
    for (const count of [3, 6]) {
      const anchors = emotionAnchors(count)
      for (let index = 0; index < count; index++) {
        const facing = skyFacingQuaternion(count, index)
        if (facing === null) throw new Error('no facing')
        for (const seconds of [0, 12, 31, 90, 600]) {
          const now = skyFacingAt(facing, GRAINIENT_SPIN, seconds, new THREE.Quaternion())
          const shown = where(anchors[index], GRAINIENT_SPIN, seconds).applyQuaternion(now)
          expect(shown.angleTo(VIEW), `${index}/${count} at ${seconds}s`).toBeLessThan(1e-5)
        }
      }
    }
  })

  it('without the compensation, the same territory drifts off the view direction', () => {
    // What the static facing alone showed: LOVE's slice of the walkthrough sky ~56° off centre half
    // a minute in. Pinned so the test above cannot pass by the spin being too slow to matter.
    const facing = skyFacingQuaternion(6, 1)
    if (facing === null) throw new Error('no facing')
    const shown = where(emotionAnchors(6)[1], GRAINIENT_SPIN, 31).applyQuaternion(facing)
    expect(shown.angleTo(VIEW)).toBeGreaterThan((30 * Math.PI) / 180)
  })

  it('is the static facing when the effect does not spin', () => {
    const facing = skyFacingQuaternion(6, 2)
    if (facing === null) throw new Error('no facing')
    const now = skyFacingAt(facing, undefined, 42, new THREE.Quaternion())
    expect(now.angleTo(facing)).toBeLessThan(1e-9)
  })
})

describe('published frame spins', () => {
  it('belong to exactly the effects whose shader spins its frame, as the same constant', () => {
    const spins = new Map<string, SkyFrameSpin | undefined>(
      SKY_EFFECTS.map((effect: SkyEffect) => [effect.key, effect.spin]),
    )
    expect(spins.get('grainient')).toBe(GRAINIENT_SPIN)
    expect(spins.get('grainstorm')).toBe(GRAINSTORM_SPIN)
    expect(spins.get('liquid-ether')).toBe(LIQUID_ETHER_SPIN)
    const others = [...spins].filter(([, spin]) => spin !== undefined).map(([key]) => key)
    expect(others.sort()).toEqual(['grainient', 'grainstorm', 'liquid-ether'])
  })

  it("restate each effect's clock and turn as radians per sky second", () => {
    // The values the shaders spun by before the constants were published: clock 0.25 at 0.15 rad
    // for the two marbles, clock 0.08 at 0.1 rad for the water, all about [0.25, 1, 0.2].
    expect(GRAINIENT_SPIN).toEqual({ axis: [0.25, 1, 0.2], rate: 0.25 * 0.15 })
    expect(GRAINSTORM_SPIN).toEqual({ axis: [0.25, 1, 0.2], rate: 0.25 * 0.15 })
    expect(LIQUID_ETHER_SPIN).toEqual({ axis: [0.25, 1, 0.2], rate: 0.08 * 0.1 })
    expect((resolveSkyEffect('grainient') as SkyEffect).spin).toBe(GRAINIENT_SPIN)
  })
})
