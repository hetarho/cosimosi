import { describe, expect, it } from 'vitest'
import { uniform } from 'three/tsl'
import * as THREE from 'three/webgpu'

import {
  LATENT_FIELD_SEGMENTS,
  LATENT_INSTANCE_SEED,
  createLatentGeometry,
  createLatentMaterial,
} from './LatentField.tsx'

// The dust's SHADER-STAGE contract, not its look. A TSL graph that reads a stage-contextual node from
// the wrong stage constructs without complaint, compiles to an invalid shader, and shows up only as an
// empty sky — there is no exception to catch and nothing in a screenshot to diff against. So the stage
// rule is asserted on the node graph itself.
//
// The rule: `instanceIndex` is one shared contextual node. Outside the vertex stage it resolves through
// a varying, and per the TSL spec a varying does not survive being created inside `positionNode` (the
// one material input computed at the vertex stage) — the fragment side is left holding a vertex-only
// variable. The twinkle therefore reads it (fragment) and the wander must not (vertex).

// `type` is three's own class tag (a declared string, unlike a constructor name a bundler may rename).
interface NodeLike {
  readonly type?: string
  traverse: (visit: (node: NodeLike) => void) => void
}

function kindsIn(node: unknown): ReadonlySet<string> {
  const kinds = new Set<string>()
  ;(node as NodeLike).traverse((child) => {
    if (child.type !== undefined) kinds.add(child.type)
  })
  return kinds
}

const OPTIONS = { color: '#6b768f', drift: 1.5, time: uniform(0) }

describe('latent field material', () => {
  it('builds a graph for both the twinkle and the wander', () => {
    const material = createLatentMaterial(OPTIONS)
    expect(material).toBeInstanceOf(THREE.MeshBasicNodeMaterial)
    expect(material.opacityNode).toBeTruthy()
    expect(material.positionNode).toBeTruthy()
    material.dispose()
  })

  it('leaves the position pipeline alone when the wander is off', () => {
    const material = createLatentMaterial({ ...OPTIONS, drift: 0 })
    expect(material.positionNode).toBeNull()
    material.dispose()
  })

  it('reads the instance index in the twinkle, so each mote is lit on its own clock', () => {
    const material = createLatentMaterial(OPTIONS)
    expect(kindsIn(material.opacityNode)).toContain('IndexNode')
    material.dispose()
  })

  it('keeps the instance index out of the wander, which would draw the field as nothing', () => {
    const material = createLatentMaterial(OPTIONS)
    const wander = kindsIn(material.positionNode)
    expect(wander).not.toContain('IndexNode')
    // `positionLocal` is itself a varying, which is the whole reason an index read here comes apart:
    // the position pipeline already owns one. The wander's randomness rides an instanced attribute
    // instead — per-mote by construction, and needing no varying of its own.
    expect(wander).toContain('AttributeNode')
    material.dispose()
  })

  it('hands the wander the seed it reads, one per mote and spread across the field', () => {
    const geometry = createLatentGeometry(1800, LATENT_FIELD_SEGMENTS.web)
    const seed = geometry.getAttribute(LATENT_INSTANCE_SEED)
    expect(seed).toBeDefined()
    expect(seed.count).toBe(1800)
    expect(seed.itemSize).toBe(1)
    const values = Array.from(seed.array)
    // A seed that clumped would hand a whole neighbourhood the same heading, and the field would slide
    // together again; one that never varied would freeze it. Both show up as spread.
    expect(Math.min(...values)).toBeLessThan(0.02)
    expect(Math.max(...values)).toBeGreaterThan(0.98)
    expect(new Set(values).size).toBe(values.length)
    geometry.dispose()
  })

  it('proves the stage check can fail', () => {
    // A guard nobody has seen fail is a guard nobody knows is wired. The twinkle graph IS an offender
    // by the wander's rule, walked through the same helper the assertions above use.
    expect(kindsIn(createLatentMaterial(OPTIONS).opacityNode)).toContain('IndexNode')
  })
})

// Both platform tessellations are shipped topology, so both must actually build a mote — the mobile
// arm has no renderer in CI, and a segment count that produced a degenerate shell would otherwise
// only show up as an empty sky on a device.
describe('latent mote tessellation', () => {
  it('builds a closed shell at every platform segment count', () => {
    for (const [platform, segments] of Object.entries(LATENT_FIELD_SEGMENTS)) {
      const geometry = createLatentGeometry(4, segments)
      const index = geometry.getIndex()
      expect(index, platform).not.toBeNull()
      expect(index!.count % 3, platform).toBe(0)
      expect(index!.count / 3, platform).toBe(segments * segments * 2 - segments * 2)
      geometry.dispose()
    }
    // The mobile arm is the cheaper one — that is the whole point of the pair.
    expect(LATENT_FIELD_SEGMENTS.mobile).toBeLessThan(LATENT_FIELD_SEGMENTS.web)
  })
})
