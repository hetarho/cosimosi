// Procedural geometry — displaces vertices into organic mesh forms. Operates on a
// BufferGeometry (not TSL nodes) for real meshes (star InstancedMesh bodies, self-objects).
// Pure: clones the input geometry and returns the deformed copy.
import * as THREE from 'three'

/** Displaces vertices along their surface normal. displace(x,y,z) = displacement per vertex
 *  (radius delta). Returns a new BufferGeometry; the input is untouched (caller owns dispose). */
export function displaceGeometry(
  geometry: THREE.BufferGeometry,
  displace: (x: number, y: number, z: number) => number,
): THREE.BufferGeometry {
  const g = geometry.clone()
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const v = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    n.copy(v).normalize() // spherical-base assumption: position direction = outward normal
    v.addScaledVector(n, displace(v.x, v.y, v.z))
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  pos.needsUpdate = true
  g.computeVertexNormals() // recompute normals so lighting matches the displacement
  return g
}
