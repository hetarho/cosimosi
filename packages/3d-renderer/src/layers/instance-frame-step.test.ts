import * as THREE from 'three/webgpu'
import { describe, expect, it, vi } from 'vitest'

import { instanceAttributeCapacity, uploadInstanceAttribute } from './instance-attributes.ts'
import type { ComposeInstancesInput, InstancePositionMapper } from './instance-compose.ts'
import {
  createInstanceFrameKey,
  instanceBufferVersion,
  stepInstanceFrame,
  type InstanceFrameKey,
} from './instance-frame-gate.ts'

const COUNT = 3

function createMesh(): THREE.InstancedMesh {
  return new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), COUNT)
}

// A gist-style projection: the slot's x, y and a lifted z, read off the buffer alone.
const lifted: InstancePositionMapper = (index, buffer, out) => {
  out[0] = buffer[index * 3] ?? 0
  out[1] = buffer[index * 3 + 1] ?? 0
  out[2] = (buffer[index * 3 + 2] ?? 0) + 10
  return true
}

/** One mapped layer's per-frame state, filled the way `InstancedNodeLayer` fills it. */
function mappedLayer(buffer: Float32Array, scales: Float32Array) {
  const mesh = createMesh()
  const setMatrixAt = vi.spyOn(mesh, 'setMatrixAt')
  const composed = createInstanceFrameKey()
  const frame: InstanceFrameKey = createInstanceFrameKey()
  const compose: ComposeInstancesInput = {
    buffer,
    count: COUNT,
    firstNodeIndex: 0,
    scale: 1,
    scales,
    vertexScales: null,
    getInstancePosition: lifted,
    elapsed: 0,
    matrix: new THREE.Matrix4(),
    zeroMatrix: new THREE.Matrix4().makeScale(0, 0, 0),
    derivedPosition: new Float32Array(3),
  }
  return {
    setMatrixAt,
    step(version: number, animating: boolean) {
      setMatrixAt.mockClear()
      frame.bufferVersion = instanceBufferVersion(version, true, animating)
      frame.buffer = buffer
      frame.channels = scales
      frame.count = COUNT
      frame.firstNodeIndex = 0
      frame.scale = 1
      frame.animationRevision = 0
      stepInstanceFrame(mesh, frame, composed, compose)
      return setMatrixAt.mock.calls.length
    },
  }
}

describe('stepInstanceFrame for a position-mapped layer', () => {
  const buffer = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9])
  const scales = new Float32Array([1, 1, 1])

  it('composes a settled layer once, then nothing while the buffer holds still', () => {
    const layer = mappedLayer(buffer, scales)
    expect(layer.step(4, false)).toBe(COUNT)
    expect(layer.step(4, false)).toBe(0)
    expect(layer.step(4, false)).toBe(0)
    // The sim presents a new picture: the projection follows it.
    expect(layer.step(5, false)).toBe(COUNT)
  })

  it('recomposes every frame while the mapper animates, and once more as it settles', () => {
    const layer = mappedLayer(buffer, scales)
    expect(layer.step(4, true)).toBe(COUNT)
    expect(layer.step(4, true)).toBe(COUNT)
    // The frame after the rise lands still composes: the last rising frame was keyed on the clock.
    expect(layer.step(4, false)).toBe(COUNT)
    expect(layer.step(4, false)).toBe(0)
  })

  it('treats a mapped layer that cannot say whether it animates as always animating', () => {
    expect(instanceBufferVersion(4, true, true)).toBeNaN()
    expect(instanceBufferVersion(4, false, true)).toBe(4)
    expect(instanceBufferVersion(undefined, false, false)).toBeNaN()
  })
})

describe('uploadInstanceAttribute', () => {
  it('uploads a replaced array and leaves an unchanged one alone', () => {
    const geometry = new THREE.BufferGeometry()
    const tint = new Float32Array([0.1, 0.2, 0.3])
    expect(uploadInstanceAttribute(geometry, { name: 'tint', array: tint, itemSize: 1 })).toBe(true)
    const attribute = geometry.getAttribute('tint') as THREE.InstancedBufferAttribute
    const version = attribute.version

    // The same array again (a brightness-only step re-sends tint): nothing to upload.
    expect(uploadInstanceAttribute(geometry, { name: 'tint', array: tint, itemSize: 1 })).toBe(
      false,
    )
    expect(attribute.version).toBe(version)

    const brighter = new Float32Array([0.4, 0.5, 0.6])
    expect(uploadInstanceAttribute(geometry, { name: 'tint', array: brighter, itemSize: 1 })).toBe(
      false,
    )
    expect(geometry.getAttribute('tint')).toBe(attribute)
    expect(attribute.version).toBe(version + 1)
    expect(Array.from(attribute.array.slice(0, 3))).toEqual(Array.from(brighter))
  })

  it('sizes to the next power of two and reuses the buffer for a count change within it', () => {
    const geometry = new THREE.BufferGeometry()
    uploadInstanceAttribute(geometry, { name: 'tint', array: new Float32Array(5 * 3), itemSize: 3 })
    const attribute = geometry.getAttribute('tint') as THREE.InstancedBufferAttribute
    expect(attribute.count).toBe(8)

    // One more memory, then one fewer: still inside the capacity, so the GPU buffer stays.
    const grown = new Float32Array(6 * 3).fill(0.5)
    expect(uploadInstanceAttribute(geometry, { name: 'tint', array: grown, itemSize: 3 })).toBe(
      false,
    )
    expect(geometry.getAttribute('tint')).toBe(attribute)
    expect(Array.from(attribute.array.slice(0, 18))).toEqual(Array.from(grown))
    uploadInstanceAttribute(geometry, { name: 'tint', array: new Float32Array(4 * 3), itemSize: 3 })
    expect(geometry.getAttribute('tint')).toBe(attribute)

    // Outgrowing it replaces the attribute and releases the old buffer.
    const dispose = vi.spyOn(attribute, 'dispose')
    expect(
      uploadInstanceAttribute(geometry, {
        name: 'tint',
        array: new Float32Array(9 * 3),
        itemSize: 3,
      }),
    ).toBe(true)
    expect(dispose).toHaveBeenCalledTimes(1)
    expect((geometry.getAttribute('tint') as THREE.InstancedBufferAttribute).count).toBe(16)
  })
})

describe('instanceAttributeCapacity', () => {
  it('rounds a count up to a power of two', () => {
    expect([0, 1, 2, 3, 4, 5, 8, 9].map(instanceAttributeCapacity)).toEqual([
      1, 1, 2, 4, 4, 8, 8, 16,
    ])
  })
})
