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

extend({ Group: THREE.Group })

class AssetErrorBoundary extends React.Component<
  { caught: Error[]; children?: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    this.props.caught.push(error)
  }
  render() {
    return this.state.error
      ? React.createElement('group', { name: 'asset-error-signal' })
      : this.props.children
  }
}

function ThrowAssetError({ error }: { error: Error }): never {
  throw error
}

function deferredAsset() {
  let resolve!: (body: THREE.Object3D) => void
  let reject!: (error: Error) => void
  const promise = new Promise<THREE.Object3D>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

async function createAssetHarness(expectedError: Error) {
  const canvas = {
    width: 800,
    height: 600,
    style: {},
    addEventListener() {},
    removeEventListener() {},
  } as unknown as HTMLCanvasElement
  // Real React/R3F and Three resources; only the GPU backend and canvas-shaped host are stubs.
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
  const makeResource = () => ({
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: new THREE.MeshBasicNodeMaterial(),
    geometryDisposed: vi.fn(),
    materialDisposed: vi.fn(),
  })
  const resources = new Map<string, ReturnType<typeof makeResource>>()
  const instances = new Map<
    THREE.InstancedMesh,
    {
      owner: string
      writes: ReturnType<typeof vi.spyOn>
      disposed: ReturnType<typeof vi.fn>
    }
  >()
  const makeBody = (owner: string) => {
    expect(resources.has(owner)).toBe(false)
    const resource = makeResource()
    resources.set(owner, resource)
    resource.geometry.addEventListener('dispose', resource.geometryDisposed)
    resource.material.addEventListener('dispose', resource.materialDisposed)
    return new THREE.Mesh(resource.geometry, resource.material)
  }
  const resource = (owner: string) => {
    const value = resources.get(owner)
    expect(value).toBeDefined()
    return value!
  }
  const positions = { current: new Float32Array([1, 2, 3, 4, 5, 6]), version: 7 }
  const caught: Error[] = []
  const diagnostics: unknown[][] = []
  // The reconciler captures its error callback during createRoot, before configure.
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const errorLog = vi
    .spyOn(console, 'error')
    .mockImplementation((...args: unknown[]) => diagnostics.push(args))
  let root: ReturnType<typeof createRoot>
  try {
    expect(typeof globalThis.reportError).not.toBe('function')
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
  } catch (error) {
    warning.mockRestore()
    errorLog.mockRestore()
    throw error
  }
  let store: RootStore
  let timestamp = 0
  const observe = () => {
    for (const child of store.getState().scene.children) {
      if (!(child instanceof THREE.InstancedMesh) || instances.has(child)) continue
      const owner = [...resources].find(([, value]) => value.geometry === child.geometry)?.[0]
      expect(owner).toBeDefined()
      const disposed = vi.fn()
      child.addEventListener('dispose', disposed)
      // Constructor identity writes are excluded from the frame-write oracle.
      instances.set(child, { owner: owner!, writes: vi.spyOn(child, 'setMatrixAt'), disposed })
    }
  }
  const snapshot = () => {
    observe()
    const children = store.getState().scene.children
    return {
      markers: children.filter((child) => child.name === 'asset-error-signal').length,
      meshes: children
        .filter((child) => child instanceof THREE.InstancedMesh)
        .map((child) => {
          const mesh = child as THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material>
          return {
            owner: instances.get(mesh)!.owner,
            mesh,
            geometry: mesh.geometry,
            material: mesh.material,
            matrices: Array.from(mesh.instanceMatrix.array),
            version: mesh.instanceMatrix.version,
            writes: instances.get(mesh)!.writes.mock.calls.length,
            count: mesh.count,
            visible: mesh.visible,
          }
        }),
    }
  }
  const renderChild = async (child: React.ReactNode) => {
    await act(async () => {
      store = root.render(React.createElement(AssetErrorBoundary, { caught }, child))
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    return snapshot()
  }
  return {
    caught,
    diagnostics,
    resources,
    instances,
    makeBody,
    resource,
    snapshot,
    renderChild,
    source: (resolve: () => THREE.Object3D | Promise<THREE.Object3D>) => ({
      resolve: vi.fn(resolve),
    }),
    async render(source: InstancedNodeLayerProps['source']) {
      return renderChild(
        React.createElement(InstancedNodeLayer, {
          source,
          bodyId: 'asset-test',
          kind: 'primitive',
          count: 2,
          positions,
          firstNodeIndex: 0,
          scale: 1,
        }),
      )
    },
    async settle(action: () => void) {
      await act(async () => {
        action()
        await Promise.resolve()
        await Promise.resolve()
      })
      return snapshot()
    },
    async frame() {
      observe()
      for (const { writes } of instances.values()) writes.mockClear()
      await act(async () => store.getState().advance((timestamp += 1 / 60)))
      return snapshot()
    },
    async dispose() {
      try {
        await act(async () => {
          root.render(null)
        })
        expect(store.getState().scene.children).toHaveLength(0)
        for (const value of resources.values()) {
          expect(value.geometryDisposed).toHaveBeenCalledTimes(1)
          expect(value.materialDisposed).toHaveBeenCalledTimes(1)
        }
        for (const { disposed } of instances.values()) expect(disposed).toHaveBeenCalledTimes(1)
        for (const entry of diagnostics) {
          expect(entry[0]).toBe(expectedError)
          expect(entry[1]).toMatchObject({ errorBoundary: expect.any(AssetErrorBoundary) })
        }
        expect(warning.mock.calls).toEqual([
          ['THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.'],
        ])
      } finally {
        vi.useFakeTimers()
        try {
          await act(async () => root.unmount())
          await vi.runOnlyPendingTimersAsync()
          expect(vi.getTimerCount()).toBe(0)
        } finally {
          vi.useRealTimers()
          warning.mockRestore()
          errorLog.mockRestore()
        }
      }
    },
  }
}

function expectAssetPopulated(
  snapshot: Awaited<ReturnType<Awaited<ReturnType<typeof createAssetHarness>>['frame']>>,
  owner: string,
) {
  expect(snapshot.markers).toBe(0)
  expect(snapshot.meshes).toHaveLength(1)
  expect(snapshot.meshes[0].owner).toBe(owner)
  expect(snapshot.meshes[0].matrices).toEqual(CONTIGUOUS_MATRICES)
  expect(snapshot.meshes[0].count).toBe(2)
  expect(snapshot.meshes[0].visible).toBe(true)
}

describe('current asset failure propagation', () => {
  beforeEach(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true))
  afterEach(() => vi.unstubAllGlobals())
  it.each([
    'initial synchronous throw',
    'initial deferred rejection',
    'current replacement rejection',
    'deferred success',
    'obsolete rejection',
    'post-unmount rejection',
    'obsolete resolution',
    'direct boundary calibration',
  ])('preserves boundary and resource behavior on %s', async (name) => {
    const error = new Error('asset-test-fixed-failure')
    const layer = await createAssetHarness(error)
    const a = deferredAsset()
    const b = deferredAsset()
    const pendingA = layer.source(() => a.promise)
    const pendingB = layer.source(() => b.promise)
    try {
      if (name === 'direct boundary calibration') {
        await layer.renderChild(React.createElement(ThrowAssetError, { error }))
      } else if (name === 'initial synchronous throw') {
        const source = layer.source(() => {
          throw error
        })
        await layer.render(source)
        expect(source.resolve).toHaveBeenCalledTimes(1)
      } else if (name === 'current replacement rejection') {
        const source = layer.source(() => layer.makeBody('A'))
        await layer.render(source)
        const initial = await layer.frame()
        expectAssetPopulated(initial, 'A')
        expect(initial.meshes[0].writes).toBe(2)
        expect(layer.resource('A').geometryDisposed).not.toHaveBeenCalled()
        await layer.render(pendingB)
        expect(pendingB.resolve).toHaveBeenCalledTimes(1)
        expect(layer.caught).toHaveLength(0)
        await layer.settle(() => b.reject(error))
        expect(source.resolve).toHaveBeenCalledTimes(1)
        expect(layer.resource('A').geometryDisposed).toHaveBeenCalledTimes(1)
        expect(layer.resource('A').materialDisposed).toHaveBeenCalledTimes(1)
        expect(layer.instances.get(initial.meshes[0].mesh)!.disposed).toHaveBeenCalledTimes(1)
      } else {
        const pending = await layer.render(pendingA)
        expect(pendingA.resolve).toHaveBeenCalledTimes(1)
        expect(pending.meshes).toHaveLength(0)
        expect(pending.markers).toBe(0)
        expect(layer.caught).toHaveLength(0)
        if (name === 'initial deferred rejection') await layer.settle(() => a.reject(error))
        else if (name === 'deferred success')
          await layer.settle(() => a.resolve(layer.makeBody('A')))
        else if (name === 'post-unmount rejection') {
          await layer.renderChild(null)
          await layer.settle(() => a.reject(error))
        } else {
          const source = layer.source(() => layer.makeBody('B'))
          await layer.render(source)
          const initial = await layer.frame()
          expectAssetPopulated(initial, 'B')
          expect(initial.meshes[0].writes).toBe(2)
          expect(source.resolve).toHaveBeenCalledTimes(1)
          expect(layer.resource('B').geometryDisposed).not.toHaveBeenCalled()
          if (name === 'obsolete rejection') await layer.settle(() => a.reject(error))
          else {
            await layer.settle(() => a.resolve(layer.makeBody('A')))
            expect(layer.resource('A').geometryDisposed).toHaveBeenCalledTimes(1)
            expect(layer.resource('A').materialDisposed).toHaveBeenCalledTimes(1)
            expect(
              [...layer.instances.values()].filter((instance) => instance.owner === 'A'),
            ).toHaveLength(0)
          }
        }
      }
      const frames: ReturnType<typeof layer.snapshot>[] = []
      for (let frame = 0; frame < 3; frame++) frames.push(await layer.frame())
      const expectsBoundary = [
        'initial synchronous throw',
        'initial deferred rejection',
        'current replacement rejection',
        'direct boundary calibration',
      ].includes(name)
      if (expectsBoundary) {
        expect(layer.caught).toEqual([error])
        expect(layer.caught[0]).toBe(error)
        expect(layer.diagnostics).toHaveLength(1)
        expect(layer.diagnostics[0][0]).toBe(error)
        for (const frame of frames) {
          expect(frame.markers).toBe(1)
          expect(frame.meshes).toHaveLength(0)
        }
      } else {
        expect(layer.caught).toHaveLength(0)
        expect(layer.diagnostics).toHaveLength(0)
        for (const frame of frames) {
          expect(frame.markers).toBe(0)
          if (name === 'post-unmount rejection') expect(frame.meshes).toHaveLength(0)
          else expectAssetPopulated(frame, name === 'deferred success' ? 'A' : 'B')
        }
        if (name !== 'post-unmount rejection') {
          const owner = name === 'deferred success' ? 'A' : 'B'
          expect(layer.resource(owner).geometryDisposed).not.toHaveBeenCalled()
          expect(layer.resource(owner).materialDisposed).not.toHaveBeenCalled()
          const initial = frames[0].meshes[0]
          for (const [index, frame] of frames.entries()) {
            const mesh = frame.meshes[0]
            expect(mesh.mesh).toBe(initial.mesh)
            expect(mesh.geometry).toBe(initial.geometry)
            expect(mesh.material).toBe(initial.material)
            expect(mesh.writes).toBe(name === 'deferred success' && index === 0 ? 2 : 0)
            expect(mesh.version).toBe(initial.version)
          }
        }
      }
    } finally {
      await layer.dispose()
    }
  })
})
