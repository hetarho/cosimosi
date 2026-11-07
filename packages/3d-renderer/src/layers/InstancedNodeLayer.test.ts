import * as React from 'react'
import { act, createRoot, extend, type RootState, type RootStore } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { InstancedNodeLayer, type InstancedNodeLayerProps } from './InstancedNodeLayer.tsx'

import {
  createInstanceFrameKey,
  recordInstanceFrame,
  resetInstanceFrame,
  sameInstanceFrame,
  type InstanceFrameKey,
} from './instance-frame-gate.ts'
import { syncVertexScale } from './instance-visibility.ts'

extend({ InstancedMesh: THREE.InstancedMesh })

describe('instanced vertex-scale visibility', () => {
  it('collapses a hidden shader-displaced instance and restores its world scale', () => {
    const scales = new Float32Array([1.4, 2.2])

    expect(syncVertexScale(scales, 1, 0)).toBe(true)
    expect(scales[0]).toBeCloseTo(1.4)
    expect(scales[1]).toBe(0)

    const restoredScale = new Float32Array([2.2])[0] ?? 0
    expect(syncVertexScale(scales, 1, restoredScale)).toBe(true)
    expect(scales[1]).toBeCloseTo(2.2)
  })

  it('does not request an upload when the visible scale is unchanged', () => {
    const scales = new Float32Array([1.4])

    expect(syncVertexScale(scales, 0, scales[0] ?? 0)).toBe(false)
    expect(syncVertexScale(null, 0, 0)).toBe(false)
  })
})

describe('instanced clean-frame gate', () => {
  const CHANNELS = { scales: new Float32Array([1]) }
  const BUFFER = new Float32Array(9)
  const baseline = (): InstanceFrameKey => ({
    bufferVersion: 7,
    buffer: BUFFER,
    channels: CHANNELS,
    count: 3,
    firstNodeIndex: 0,
    scale: 1,
    animationRevision: 0,
  })

  /** Compose once, then report whether a second frame stated by `mutate` would recompose. */
  function recomposesOn(mutate: (frame: InstanceFrameKey) => void): boolean {
    const composed = createInstanceFrameKey()
    recordInstanceFrame(composed, baseline())
    const next = baseline()
    mutate(next)
    return !sameInstanceFrame(composed, next)
  }

  it('composes the first frame after a mount — a fresh key matches nothing', () => {
    expect(sameInstanceFrame(createInstanceFrameKey(), baseline())).toBe(false)
  })

  it('skips a frame whose every input is unchanged', () => {
    expect(recomposesOn(() => undefined)).toBe(false)
  })

  it('recomposes on a new buffer version, even when the object is the same one', () => {
    expect(recomposesOn((frame) => (frame.bufferVersion = 8))).toBe(true)
  })

  it('recomposes when the positions ref is repointed at a buffer that reused the version', () => {
    // A rebuilt sim bridge starts its version at zero, so a version alone can repeat across
    // producers. The array identity cannot.
    expect(recomposesOn((frame) => (frame.buffer = new Float32Array(9)))).toBe(true)
  })

  it('recomposes on a slot-window, scale, channels or animation-revision change', () => {
    expect(recomposesOn((frame) => (frame.firstNodeIndex = 4))).toBe(true)
    expect(recomposesOn((frame) => (frame.count = 4))).toBe(true)
    expect(recomposesOn((frame) => (frame.scale = 1.5))).toBe(true)
    expect(recomposesOn((frame) => (frame.channels = { scales: new Float32Array([1]) }))).toBe(true)
    expect(recomposesOn((frame) => (frame.animationRevision = 1))).toBe(true)
  })

  it('never skips for a buffer that publishes no version', () => {
    // The NaN opt-out: fail open, because a wrongly skipped frame is a frozen scene with nothing
    // on screen to say why.
    const composed = createInstanceFrameKey()
    const unversioned = { ...baseline(), bufferVersion: Number.NaN }
    recordInstanceFrame(composed, unversioned)
    expect(sameInstanceFrame(composed, unversioned)).toBe(false)
  })

  it('forgets the composed frame on reset, so the next one recomposes', () => {
    const composed = createInstanceFrameKey()
    recordInstanceFrame(composed, baseline())
    expect(sameInstanceFrame(composed, baseline())).toBe(true)

    resetInstanceFrame(composed)

    expect(sameInstanceFrame(composed, baseline())).toBe(false)
  })
})

// Independent literal column-major matrices; the production composer is never the test oracle.
const CONTIGUOUS_MATRICES = [
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 4, 5, 6, 1,
]
const REVERSED_MATRICES = [
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 4, 5, 6, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1,
]

interface MapperCase {
  name: string
  initial: 'A' | 'B' | 'default'
  next: 'B' | 'default' | 'same'
  reversed?: boolean
  versioned?: boolean
  animating?: boolean
  brightnessOnly?: boolean
  bumpVersion?: boolean
  repeats?: number
}

async function createMapperHarness(fixture: MapperCase) {
  const canvas = {
    width: 800,
    height: 600,
    style: {},
    addEventListener() {},
    removeEventListener() {},
  } as unknown as HTMLCanvasElement
  // React/R3F and the Three resources are real; only the backend requiring a GPU is stubbed.
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
  const geometryDisposed = vi.fn()
  const materialDisposed = vi.fn()
  const meshDisposed = vi.fn()
  const source = {
    resolve: vi.fn(() => {
      const geometry = new THREE.BoxGeometry(1, 1, 1)
      const material = new THREE.MeshBasicNodeMaterial()
      geometry.addEventListener('dispose', geometryDisposed)
      material.addEventListener('dispose', materialDisposed)
      return new THREE.Mesh(geometry, material)
    }),
  }
  const mapperA = (index: number, buffer: Float32Array, out: Float32Array) => {
    out[0] = buffer[index * 3] ?? 0
    out[1] = buffer[index * 3 + 1] ?? 0
    out[2] = buffer[index * 3 + 2] ?? 0
    return true
  }
  const mapperB = (index: number, buffer: Float32Array, out: Float32Array) => {
    const slot = 1 - index
    out[0] = buffer[slot * 3] ?? 0
    out[1] = buffer[slot * 3 + 1] ?? 0
    out[2] = buffer[slot * 3 + 2] ?? 0
    return true
  }
  const positions = {
    current: new Float32Array([1, 2, 3, 4, 5, 6]),
    version: fixture.versioned === false ? undefined : 7,
  }
  const scales = new Float32Array([1, 1])
  const props: InstancedNodeLayerProps = {
    source,
    bodyId: 'mapper-test',
    kind: 'primitive',
    count: 2,
    positions,
    firstNodeIndex: 0,
    scale: 1,
    channels: {
      scales,
      attributes: [{ name: 'aTestBrightness', array: new Float32Array([0.25, 0.75]), itemSize: 1 }],
    },
    getInstancePosition:
      fixture.initial === 'default' ? undefined : fixture.initial === 'B' ? mapperB : mapperA,
    isPositionAnimating: () => fixture.animating === true,
  }
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  let root: ReturnType<typeof createRoot>
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
  await act(async () => {
    store = root.render(React.createElement(InstancedNodeLayer, props))
  })
  const mesh = store!.getState().scene.children.find((child) => 'isInstancedMesh' in child)
  expect(mesh).toBeInstanceOf(THREE.InstancedMesh)
  const instance = mesh as THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material>
  instance.addEventListener('dispose', meshDisposed)
  // InstancedMesh writes initial identities in its constructor; count only actual frame writes.
  const writes = vi.spyOn(instance, 'setMatrixAt')
  const snapshot = () => {
    const current = store
      .getState()
      .scene.children.find((child) => 'isInstancedMesh' in child) as typeof instance
    const brightness = current.geometry.getAttribute('aTestBrightness') as THREE.BufferAttribute
    return {
      mesh: current,
      geometry: current.geometry,
      material: current.material,
      matrices: Array.from(current.instanceMatrix.array),
      matrixVersion: current.instanceMatrix.version,
      count: current.count,
      visible: current.visible,
      writes: writes.mock.calls.length,
      brightness: Array.from(brightness.array).slice(0, 2),
      brightnessVersion: brightness.version,
    }
  }
  return {
    source,
    scales,
    geometryDisposed,
    materialDisposed,
    meshDisposed,
    snapshot,
    async change() {
      const getInstancePosition =
        fixture.next === 'same'
          ? props.getInstancePosition
          : fixture.next === 'default'
            ? undefined
            : mapperB
      const channels = fixture.brightnessOnly
        ? {
            scales,
            attributes: [
              { name: 'aTestBrightness', array: new Float32Array([0.5, 1]), itemSize: 1 },
            ],
          }
        : props.channels
      if (fixture.bumpVersion) positions.version = 8
      writes.mockClear()
      await act(async () => {
        root.render(
          React.createElement(InstancedNodeLayer, { ...props, getInstancePosition, channels }),
        )
      })
      return snapshot()
    },
    async frame() {
      writes.mockClear()
      await act(async () => store.getState().advance((timestamp += 1 / 60)))
      return snapshot()
    },
    async dispose() {
      try {
        await act(async () => {
          root.render(null)
        })
        expect(store.getState().scene.children).toHaveLength(0)
        expect(geometryDisposed).toHaveBeenCalledTimes(1)
        expect(materialDisposed).toHaveBeenCalledTimes(1)
        expect(meshDisposed).toHaveBeenCalledTimes(1)
      } finally {
        vi.useFakeTimers()
        try {
          await act(async () => root.unmount())
          await vi.runOnlyPendingTimersAsync()
          expect(vi.getTimerCount()).toBe(0)
        } finally {
          vi.useRealTimers()
        }
      }
    },
  }
}

describe('committed instance mapper changes', () => {
  beforeEach(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true))
  afterEach(() => vi.unstubAllGlobals())
  const cases: readonly MapperCase[] = [
    { name: 'settled mapper A to B', initial: 'A', next: 'B', reversed: true },
    { name: 'default to settled mapper', initial: 'default', next: 'B', reversed: true },
    { name: 'settled mapper to default', initial: 'B', next: 'default' },
    { name: 'five unchanged rerenders and fifteen frames', initial: 'A', next: 'same', repeats: 5 },
    {
      name: 'unversioned mapper change',
      initial: 'A',
      next: 'B',
      reversed: true,
      versioned: false,
    },
    { name: 'animating mapper change', initial: 'A', next: 'B', reversed: true, animating: true },
    { name: 'brightness-only replacement', initial: 'A', next: 'same', brightnessOnly: true },
    {
      name: 'coordinate-version invalidation',
      initial: 'A',
      next: 'B',
      reversed: true,
      bumpVersion: true,
    },
  ]
  it.each(cases)(
    'preserves exact matrices, uploads and resource lifetime on $name',
    async (fixture) => {
      const layer = await createMapperHarness(fixture)
      try {
        const initial = await layer.frame()
        const initialMatrices = fixture.initial === 'B' ? REVERSED_MATRICES : CONTIGUOUS_MATRICES
        expect(initial.matrices).toEqual(initialMatrices)
        expect(initial.writes).toBe(2)
        expect(initial.count).toBe(2)
        expect(initial.visible).toBe(true)
        const baseline = await layer.frame()
        const alwaysComposes = fixture.animating || fixture.versioned === false
        expect(baseline.writes).toBe(alwaysComposes ? 2 : 0)
        expect(baseline.matrices).toEqual(initialMatrices)
        const frames: ReturnType<typeof layer.snapshot>[] = []
        for (let repeat = 0; repeat < (fixture.repeats ?? 1); repeat++) {
          const committed = await layer.change()
          expect(committed.mesh).toBe(initial.mesh)
          expect(committed.geometry).toBe(initial.geometry)
          expect(committed.material).toBe(initial.material)
          expect(committed.writes).toBe(0)
          for (let frame = 0; frame < 3; frame++) frames.push(await layer.frame())
        }
        const expected = fixture.reversed ? REVERSED_MATRICES : CONTIGUOUS_MATRICES
        const changesMatrices = fixture.next !== 'same' || fixture.bumpVersion
        for (const [index, frame] of frames.entries()) {
          expect(frame.matrices).toEqual(expected)
          expect(frame.count).toBe(2)
          expect(frame.visible).toBe(true)
          expect(frame.writes).toBe(alwaysComposes || (changesMatrices && index === 0) ? 2 : 0)
          expect(frame.matrixVersion).toBe(
            baseline.matrixVersion + (alwaysComposes ? index + 1 : changesMatrices ? 1 : 0),
          )
          expect(frame.brightness).toEqual(fixture.brightnessOnly ? [0.5, 1] : baseline.brightness)
          expect(frame.brightnessVersion).toBe(
            baseline.brightnessVersion + (fixture.brightnessOnly ? 1 : 0),
          )
        }
        expect(layer.source.resolve).toHaveBeenCalledTimes(1)
        expect(layer.geometryDisposed).not.toHaveBeenCalled()
        expect(layer.materialDisposed).not.toHaveBeenCalled()
        expect(layer.meshDisposed).not.toHaveBeenCalled()
      } finally {
        await layer.dispose()
      }
    },
  )
})
