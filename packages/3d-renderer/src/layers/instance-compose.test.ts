import * as THREE from 'three/webgpu'
import { describe, expect, it } from 'vitest'

import { composeInstances, type ComposeInstancesInput } from './instance-compose.ts'

function createMesh(capacity: number): THREE.InstancedMesh {
  // A double-sided box gives the ray a face to hit from any side; the geometry itself is not under test.
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    capacity,
  )
  mesh.count = 0
  return mesh
}

function input(buffer: Float32Array, count: number): ComposeInstancesInput {
  return {
    buffer,
    count,
    firstNodeIndex: 0,
    scale: 1,
    scales: null,
    vertexScales: null,
    getInstancePosition: undefined,
    elapsed: 0,
    matrix: new THREE.Matrix4(),
    zeroMatrix: new THREE.Matrix4().makeScale(0, 0, 0),
    derivedPosition: new Float32Array(3),
  }
}

/** Instance ids a ray straight down the -z axis through (x, y) hits. */
function pickAt(mesh: THREE.InstancedMesh, x: number, y: number): number[] {
  const raycaster = new THREE.Raycaster(new THREE.Vector3(x, y, 50), new THREE.Vector3(0, 0, -1))
  return raycaster.intersectObject(mesh).map((hit) => hit.instanceId ?? -1)
}

describe('composeInstances pick volume', () => {
  it('re-picks after instances move', () => {
    const mesh = createMesh(2)
    composeInstances(mesh, input(new Float32Array([2, 0, 0, -2, 0, 0]), 2))
    expect(pickAt(mesh, 2, 0)).toContain(0)

    composeInstances(mesh, input(new Float32Array([30, 0, 0, -2, 0, 0]), 2))
    expect(pickAt(mesh, 30, 0)).toContain(0)
  })

  it('picks after first coordinates arrive', () => {
    const mesh = createMesh(1)
    // A tap before any coordinates: three caches the volume of zero instances.
    expect(pickAt(mesh, 20, 0)).toEqual([])

    composeInstances(mesh, input(new Float32Array([20, 0, 0]), 1))
    expect(pickAt(mesh, 20, 0)).toContain(0)
  })

  it('picks a lifted gist whose count did not change', () => {
    const mesh = createMesh(1)
    const lifted = input(new Float32Array([5, 0, 0]), 1)
    lifted.getInstancePosition = (_index, buffer, out, elapsed) => {
      out[0] = buffer[0] ?? 0
      out[1] = elapsed
      out[2] = 0
      return true
    }
    composeInstances(mesh, lifted)
    expect(pickAt(mesh, 5, 0)).toContain(0)

    lifted.elapsed = 12
    composeInstances(mesh, lifted)
    expect(pickAt(mesh, 5, 12)).toContain(0)
  })
})
