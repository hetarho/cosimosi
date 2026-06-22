// 절차적 지오메트리 — 정점을 변위시켜 유기적 메시 폼을 만든다. TSL 노드가 아니라 BufferGeometry를 다룬다
// (별 InstancedMesh 본체·자아 오브제 등 실제 메시용, 헌법8). 순수: 입력 지오메트리를 복제해 변형본을 돌려준다.
import * as THREE from 'three'

/** 정점을 표면 법선 방향으로 변위시킨다. displace(x,y,z)=해당 정점의 변위량(반지름 가감).
 *  새 BufferGeometry를 반환하고 입력은 건드리지 않는다(호출부가 dispose 소유). */
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
    n.copy(v).normalize() // 구형 베이스 가정: 위치 방향 = 바깥 법선
    v.addScaledVector(n, displace(v.x, v.y, v.z))
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  pos.needsUpdate = true
  g.computeVertexNormals() // 변위 후 라이팅이 맞게 법선 재계산
  return g
}
