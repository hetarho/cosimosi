import { act, createRoot, extend, type RootState, type RootStore } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ColorField } from './ColorField.tsx'

extend({ InstancedMesh: THREE.InstancedMesh })

beforeEach(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true))
afterEach(() => vi.unstubAllGlobals())

async function createFieldHarness() {
  const canvas = {
    width: 800,
    height: 600,
    style: {},
    addEventListener() {},
    removeEventListener() {},
  } as unknown as HTMLCanvasElement
  // The reconciler and three objects are real; only the backend that would require a GPU is a stub.
  const renderer = {
    render: vi.fn(),
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    xr: {
      isPresenting: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    renderLists: { dispose: vi.fn() },
    forceContextLoss: vi.fn(),
    domElement: canvas,
  }
  const camera = new THREE.PerspectiveCamera(60, 800 / 600, 0.1, 1000)
  camera.position.set(0, 0, 10)
  camera.updateMatrixWorld()
  const props = {
    positions: { current: new Float32Array([1, 2, 3, 4, 5, 6]), version: 1 },
    count: 2,
    nodeIndices: new Int32Array([0, 1]),
    radii: new Float32Array([2, 3]),
    tints: new Float32Array([0.2, 0.3, 0.4, 0.4, 0.3, 0.2]),
    resolution: 8,
    falloffExponent: 2,
    baseIntensity: 0.5,
  }
  // R3F owns this deprecated clock internally. Assert its known diagnostic rather than leaking it.
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
  return {
    props,
    camera,
    async render(key = 'field') {
      await act(async () => {
        store = root.render(<ColorField key={key} {...props} />)
      })
    },
    mesh() {
      const mesh = store.getState().scene.children.find((child) => 'isInstancedMesh' in child)
      expect(mesh).toBeInstanceOf(THREE.InstancedMesh)
      return mesh as THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material>
    },
    async frame() {
      await act(async () => store.getState().advance((timestamp += 1 / 60)))
    },
    async unmount() {
      await act(async () => {
        root.render(null)
      })
    },
    async dispose() {
      vi.useFakeTimers()
      try {
        await act(async () => root.unmount())
        await vi.runOnlyPendingTimersAsync()
      } finally {
        vi.useRealTimers()
      }
    },
  }
}

describe('ColorField settled-frame lifecycle', () => {
  it('preserves the populated mesh across 20 unchanged React rerenders without matrix uploads', async () => {
    const field = await createFieldHarness()
    try {
      await field.render()
      const mesh = field.mesh()
      // Spy after construction: InstancedMesh writes its initial identity matrices in its constructor.
      const matrixWrites = vi.spyOn(mesh, 'setMatrixAt')
      await field.frame()
      expect(matrixWrites).toHaveBeenCalledTimes(field.props.count)
      expect(mesh.count).toBe(field.props.count)
      expect(mesh.visible).toBe(true)
      const matrices = Array.from(mesh.instanceMatrix.array)
      const uploadedVersion = mesh.instanceMatrix.version
      matrixWrites.mockClear()

      for (let rerender = 0; rerender < 20; rerender += 1) {
        await field.render()
        expect(field.mesh()).toBe(mesh)
        expect(mesh.count).toBe(field.props.count)
        expect(mesh.visible).toBe(true)
        await field.frame()
        expect(mesh.count).toBe(field.props.count)
        expect(mesh.visible).toBe(true)
        expect(Array.from(mesh.instanceMatrix.array)).toEqual(matrices)
        expect(mesh.instanceMatrix.version).toBe(uploadedVersion)
      }
      expect(matrixWrites).not.toHaveBeenCalled()
    } finally {
      await field.dispose()
    }
  })

  it('updates camera and buffer changes while a genuine remount waits for its first composition', async () => {
    const field = await createFieldHarness()
    try {
      await field.render()
      const mesh = field.mesh()
      await field.frame()
      const initial = Array.from(mesh.instanceMatrix.array)
      const matrixWrites = vi.spyOn(mesh, 'setMatrixAt')
      const uploadedVersion = mesh.instanceMatrix.version

      field.camera.rotation.z = 0.1
      field.camera.updateMatrixWorld()
      await field.frame()
      expect(matrixWrites).toHaveBeenCalledTimes(field.props.count)
      expect(Array.from(mesh.instanceMatrix.array)).not.toEqual(initial)
      expect(mesh.instanceMatrix.version).toBe(uploadedVersion + 1)
      matrixWrites.mockClear()

      field.props.positions.current[0] = 7
      field.props.positions.version += 1
      await field.frame()
      expect(matrixWrites).toHaveBeenCalledTimes(field.props.count)
      expect(mesh.instanceMatrix.array[12]).toBe(7)
      const updated = Array.from(mesh.instanceMatrix.array)
      const updatedVersion = mesh.instanceMatrix.version
      matrixWrites.mockClear()
      await field.frame()
      expect(matrixWrites).not.toHaveBeenCalled()
      expect(mesh.instanceMatrix.version).toBe(updatedVersion)

      await field.render('remounted')
      const remounted = field.mesh()
      expect(remounted).not.toBe(mesh)
      expect(remounted.count).toBe(0)
      expect(remounted.visible).toBe(false)
      const remountWrites = vi.spyOn(remounted, 'setMatrixAt')
      await field.frame()
      expect(remountWrites).toHaveBeenCalledTimes(field.props.count)
      expect(remounted.count).toBe(field.props.count)
      expect(remounted.visible).toBe(true)
      expect(Array.from(remounted.instanceMatrix.array)).toEqual(updated)
    } finally {
      await field.dispose()
    }
  })
})

describe('ColorField resource ownership', () => {
  it('uploads unchanged tint and radius channels when resolution replaces the geometry', async () => {
    const field = await createFieldHarness()
    try {
      await field.render()
      await field.frame()
      const initial = field.mesh()
      const matrices = Array.from(initial.instanceMatrix.array)

      field.props.resolution = 12
      await field.render()
      const changed = field.mesh()
      expect(changed.geometry).not.toBe(initial.geometry)
      expect(changed.geometry.getAttribute('aFieldTint')?.array).toEqual(field.props.tints)
      expect(changed.geometry.getAttribute('aFieldRadius')?.array).toEqual(field.props.radii)
      await field.frame()
      expect(Array.from(changed.instanceMatrix.array)).toEqual(matrices)
      expect(changed.count).toBe(field.props.count)
      expect(changed.visible).toBe(true)
    } finally {
      await field.dispose()
    }
  })

  it.each([
    {
      name: 'resolution-only',
      change: { resolution: 12 },
      geometryChanges: true,
      materialChanges: false,
    },
    {
      name: 'falloff-only',
      change: { falloffExponent: 3 },
      geometryChanges: false,
      materialChanges: true,
    },
    {
      name: 'intensity-only',
      change: { baseIntensity: 0.75 },
      geometryChanges: false,
      materialChanges: true,
    },
    {
      name: 'both-resource replacement',
      change: { resolution: 12, falloffExponent: 3 },
      geometryChanges: true,
      materialChanges: true,
    },
    { name: 'genuine keyed remount', change: {}, geometryChanges: true, materialChanges: true },
  ])(
    'disposes only departed resources on $name and releases current resources once on unmount',
    async ({ name, change, geometryChanges, materialChanges }) => {
      const field = await createFieldHarness()
      try {
        await field.render()
        await field.frame()
        const initial = field.mesh()
        const initialGeometryDisposed = vi.fn()
        const initialMaterialDisposed = vi.fn()
        initial.geometry.addEventListener('dispose', initialGeometryDisposed)
        initial.material.addEventListener('dispose', initialMaterialDisposed)
        const matrices = Array.from(initial.instanceMatrix.array)

        await field.render()
        await field.frame()
        expect(field.mesh()).toBe(initial)
        expect(initialGeometryDisposed).not.toHaveBeenCalled()
        expect(initialMaterialDisposed).not.toHaveBeenCalled()

        Object.assign(field.props, change)
        await field.render(name === 'genuine keyed remount' ? 'remounted' : 'field')
        const changed = field.mesh()
        expect(changed.geometry === initial.geometry).toBe(!geometryChanges)
        expect(changed.material === initial.material).toBe(!materialChanges)
        expect(initialGeometryDisposed).toHaveBeenCalledTimes(geometryChanges ? 1 : 0)
        expect(initialMaterialDisposed).toHaveBeenCalledTimes(materialChanges ? 1 : 0)
        const currentGeometryDisposed = vi.fn()
        const currentMaterialDisposed = vi.fn()
        changed.geometry.addEventListener('dispose', currentGeometryDisposed)
        changed.material.addEventListener('dispose', currentMaterialDisposed)
        const tint = changed.geometry.getAttribute('aFieldTint') as THREE.InstancedBufferAttribute
        const radius = changed.geometry.getAttribute(
          'aFieldRadius',
        ) as THREE.InstancedBufferAttribute
        expect(tint?.array).toEqual(field.props.tints)
        expect(radius?.array).toEqual(field.props.radii)
        await field.frame()
        expect(Array.from(changed.instanceMatrix.array)).toEqual(matrices)
        expect(changed.count).toBe(field.props.count)
        expect(changed.visible).toBe(true)
        const matrixWrites = vi.spyOn(changed, 'setMatrixAt')
        const matrixVersion = changed.instanceMatrix.version
        const tintVersion = tint.version
        const radiusVersion = radius.version
        await field.render(name === 'genuine keyed remount' ? 'remounted' : 'field')
        await field.frame()
        expect(field.mesh()).toBe(changed)
        expect(matrixWrites).not.toHaveBeenCalled()
        expect(changed.instanceMatrix.version).toBe(matrixVersion)
        expect(tint.version).toBe(tintVersion)
        expect(radius.version).toBe(radiusVersion)
        expect(currentGeometryDisposed).not.toHaveBeenCalled()
        expect(currentMaterialDisposed).not.toHaveBeenCalled()

        await field.unmount()
        expect(currentGeometryDisposed).toHaveBeenCalledOnce()
        expect(currentMaterialDisposed).toHaveBeenCalledOnce()
        expect(initialGeometryDisposed).toHaveBeenCalledOnce()
        expect(initialMaterialDisposed).toHaveBeenCalledOnce()
        await field.dispose()
        expect(currentGeometryDisposed).toHaveBeenCalledOnce()
        expect(currentMaterialDisposed).toHaveBeenCalledOnce()
      } finally {
        await field.dispose()
      }
    },
  )
})
