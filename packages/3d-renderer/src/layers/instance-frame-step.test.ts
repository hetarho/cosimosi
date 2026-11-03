import * as THREE from 'three/webgpu'
import { describe, expect, it, vi } from 'vitest'

import { uploadInstanceAttribute } from './instance-attributes.ts'
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
    expect(Array.from(attribute.array)).toEqual(Array.from(brighter))
  })
})
