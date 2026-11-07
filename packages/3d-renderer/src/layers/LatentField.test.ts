import { act, createRoot, extend, type RootState, type RootStore } from '@react-three/fiber'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { uniform } from 'three/tsl'
import * as THREE from 'three/webgpu'

import {
  LATENT_FIELD_SEGMENTS,
  LATENT_INSTANCE_SEED,
  LatentField,
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

extend({ InstancedMesh: THREE.InstancedMesh })

describe('latent field reconciler lifecycle', () => {
  beforeEach(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true))
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    { name: 'unchanged inputs', change: {}, geometryChanges: false, materialChanges: false },
    {
      name: 'material-only color replacement',
      change: { color: '#aa5500' },
      geometryChanges: false,
      materialChanges: true,
    },
    {
      name: 'material-only drift replacement',
      change: { drift: 0.75 },
      geometryChanges: false,
      materialChanges: true,
    },
    {
      name: 'segments update',
      change: { segments: 12 },
      geometryChanges: true,
      materialChanges: false,
    },
    { name: 'size update', change: { size: 3 }, geometryChanges: false, materialChanges: false },
    {
      name: 'consumed update',
      change: { consumed: new Set([1]) },
      geometryChanges: false,
      materialChanges: false,
    },
    { name: 'count update', change: { count: 1 }, geometryChanges: true, materialChanges: false },
    { name: 'genuine keyed remount', change: {}, geometryChanges: true, materialChanges: true },
  ])(
    'keeps exact populated transforms and resource ownership for $name',
    async ({ name, change, geometryChanges, materialChanges }) => {
      const canvas = {
        width: 800,
        height: 600,
        style: {},
        addEventListener() {},
        removeEventListener() {},
      } as unknown as HTMLCanvasElement
      // React, R3F and Three resources are real; only the backend that needs a GPU is a stub.
      const renderer = {
        render: vi.fn(),
        setSize: vi.fn(),
        setPixelRatio: vi.fn(),
        domElement: canvas,
        xr: { isPresenting: false, addEventListener: vi.fn(), removeEventListener: vi.fn() },
        renderLists: { dispose: vi.fn() },
        forceContextLoss: vi.fn(),
      }
      const camera = new THREE.PerspectiveCamera(60, 800 / 600, 0.1, 1000)
      camera.position.set(0, 0, 10)
      camera.updateMatrixWorld()
      const props = {
        positions: new Float32Array([1, 2, 3, 4, 5, 6]),
        count: 2,
        size: 2,
        color: '#7d8ba8',
        drift: 0.5,
        consumed: null as ReadonlySet<number> | null,
        reducedMotion: false,
        segments: 8,
      }
      let root: ReturnType<typeof createRoot>
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        root = createRoot(canvas)
        await root.configure({
          gl: renderer as unknown as RootState['gl'],
          camera,
          frameloop: 'never',
          dpr: 1,
          size: { width: 800, height: 600, top: 0, left: 0 },
        })
        expect(warning.mock.calls).toEqual([
          ['THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.'],
        ])
      } finally {
        warning.mockRestore()
      }
      let store: RootStore
      let timestamp = 0
      const initialGeometryDisposed = vi.fn()
      const initialMaterialDisposed = vi.fn()
      const currentGeometryDisposed = vi.fn()
      const currentMaterialDisposed = vi.fn()
      try {
        await act(async () => {
          store = root.render(createElement(LatentField, { key: 'field', ...props }))
        })
        const initial = store!.getState().scene.children[0] as THREE.InstancedMesh<
          THREE.BufferGeometry,
          THREE.Material
        >
        expect(initial).toBeInstanceOf(THREE.InstancedMesh)
        const matrices = [
          2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 1, 2, 3, 1, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 4, 5,
          6, 1,
        ]
        expect(Array.from(initial.instanceMatrix.array)).toEqual(matrices)
        expect(initial.count).toBe(2)
        expect(initial.visible).toBe(true)
        initial.geometry.addEventListener('dispose', initialGeometryDisposed)
        initial.material.addEventListener('dispose', initialMaterialDisposed)
        // Spy after construction and initial composition, both of which legitimately write matrices.
        const initialWrites = vi.spyOn(initial, 'setMatrixAt')
        const initialVersion = initial.instanceMatrix.version
        for (let index = 0; index < 20; index++) {
          await act(async () => {
            root.render(createElement(LatentField, { key: 'field', ...props }))
          })
          await act(async () => store!.getState().advance((timestamp += 1 / 60)))
          expect(store!.getState().scene.children[0]).toBe(initial)
          expect(initial.count).toBe(2)
          expect(initial.visible).toBe(true)
          expect(Array.from(initial.instanceMatrix.array)).toEqual(matrices)
          expect(initial.instanceMatrix.version).toBe(initialVersion)
        }
        expect(initialWrites).not.toHaveBeenCalled()
        expect(initialGeometryDisposed).not.toHaveBeenCalled()
        expect(initialMaterialDisposed).not.toHaveBeenCalled()

        Object.assign(props, change)
        const key = name === 'genuine keyed remount' ? 'remounted' : 'field'
        await act(async () => {
          root.render(createElement(LatentField, { key, ...props }))
        })
        const changed = store!.getState().scene.children[0] as THREE.InstancedMesh<
          THREE.BufferGeometry,
          THREE.Material
        >
        expect(changed.geometry === initial.geometry).toBe(!geometryChanges)
        expect(changed.material === initial.material).toBe(!materialChanges)
        expect(initialGeometryDisposed).toHaveBeenCalledTimes(geometryChanges ? 1 : 0)
        expect(initialMaterialDisposed).toHaveBeenCalledTimes(materialChanges ? 1 : 0)
        changed.geometry.addEventListener('dispose', currentGeometryDisposed)
        changed.material.addEventListener('dispose', currentMaterialDisposed)
        const changedWrites = vi.spyOn(changed, 'setMatrixAt').mockClear()
        const changedVersion = changed.instanceMatrix.version
        for (let index = 0; index < 3; index++)
          await act(async () => store!.getState().advance((timestamp += 1 / 60)))
        expect(changedWrites).not.toHaveBeenCalled()
        expect(changed.instanceMatrix.version).toBe(changedVersion)
        expect(changed.count).toBe(props.count)
        expect(changed.visible).toBe(true)
        const expected = matrices.slice(0, props.count * 16)
        if (name === 'size update')
          for (const offset of [0, 5, 10, 16, 21, 26]) expected[offset] = 3
        if (name === 'consumed update') for (const offset of [16, 21, 26]) expected[offset] = 0
        expect(Array.from(changed.instanceMatrix.array)).toEqual(expected)
        await act(async () => {
          root.render(createElement(LatentField, { key, ...props }))
        })
        await act(async () => store!.getState().advance((timestamp += 1 / 60)))
        expect(store!.getState().scene.children[0]).toBe(changed)
        expect(changedWrites).not.toHaveBeenCalled()
        expect(changed.instanceMatrix.version).toBe(changedVersion)
        expect(currentGeometryDisposed).not.toHaveBeenCalled()
        expect(currentMaterialDisposed).not.toHaveBeenCalled()
      } finally {
        await act(async () => {
          root.render(null)
        })
        vi.useFakeTimers()
        try {
          await act(async () => root.unmount())
          await vi.runOnlyPendingTimersAsync()
        } finally {
          vi.useRealTimers()
        }
      }
      expect(initialGeometryDisposed).toHaveBeenCalledOnce()
      expect(initialMaterialDisposed).toHaveBeenCalledOnce()
      expect(currentGeometryDisposed).toHaveBeenCalledOnce()
      expect(currentMaterialDisposed).toHaveBeenCalledOnce()
    },
  )
})
