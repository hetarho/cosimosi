// 절차적 지오메트리 — 정점을 변위시켜 유기적 메시 폼을 만든다. TSL 노드가 아니라 BufferGeometry를 다룬다
// (별 InstancedMesh 본체·자아 오브제 등 실제 메시용, 헌법8). 순수: 입력 지오메트리를 복제해 변형본을 돌려준다.
import * as THREE from 'three'

// ── 균등 구면 방향(피보나치 격자) — Math.random 비사용 결정론(같은 입력 = 같은 방향). spike 분포·시드 변형에 쓴다.
function fibonacciDirs(n: number, seedRot = 0): THREE.Vector3[] {
  const out: THREE.Vector3[] = []
  if (n <= 0) return out
  const golden = Math.PI * (3 - Math.sqrt(5)) // 황금각
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(1, n - 1)) * 2 // 1 → -1
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i + seedRot
    out.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r))
  }
  return out
}

/** 추상화 단계 → 다면체 지오메트리(change 29). 단계가 오를수록 면이 줄어 더 단순/추상해진다(요지화):
 *  0=20면체(Icosa) · 1=12면체(Dodeca) · 2=8면체(Octa) · 3+=4면체(Tetra). 전부 flatShading용 비인덱스 지오메트리. */
export function polyhedronForStage(stage: number): THREE.BufferGeometry {
  switch (Math.max(0, Math.round(stage))) {
    case 0:
      return new THREE.IcosahedronGeometry(1, 0)
    case 1:
      return new THREE.DodecahedronGeometry(1, 0)
    case 2:
      return new THREE.OctahedronGeometry(1, 0)
    default:
      return new THREE.TetrahedronGeometry(1, 0)
  }
}

/** 고슴도치 — 작은 구형 코어에서 바깥으로 길게 솟은 가시(바늘처럼). **바깥 반지름은 항상 1로 정규화**해(가시 끝=1,
 *  코어=1−spikeLen) 다른 룩(반지름 1)과 같은 크기로 보이게 한다 — 가시를 길게 해도 별이 통째로 커지지 않는다.
 *  단계가 오를수록 가시 개수·높이가 줄어 코어가 커지고, 단계 끝엔 가시 없는 매끈한 다각형(반지름 1)이 된다(change 29).
 *  비인덱스+면 법선이라 가시가 또렷이 각진다. 결정론(피보나치 방향·Math.random 비사용). */
export function spikyGeometry(opts: {
  /** 가시 개수(단계로 감소). */
  spikes: number
  /** 가시 높이 비율(0..1) — 코어 반지름 = 1−spikeLen, 가시 끝 = 1. 클수록 코어 작고 가시 길다. */
  spikeLen: number
  /** 가시 뾰족함(클수록 좁고 날카로운 바늘; 작을수록 둥근 혹). */
  sharpness?: number
  /** 코어 분할(클수록 가시 끝이 뾰족·고밀도). */
  detail?: number
  /** 가시 방향 회전 오프셋(seed로 별 그룹마다 다른 배치). */
  seedRot?: number
}): THREE.BufferGeometry {
  const { spikes, spikeLen, sharpness = 6, detail = 4, seedRot = 0 } = opts
  if (spikes <= 0 || spikeLen <= 0) return new THREE.IcosahedronGeometry(1, 1) // 가시 0 = 매끈한 다각형(요지)
  const body = Math.max(0.05, 1 - spikeLen) // 코어(몸통) 반지름 — 가시가 길수록 작아진다
  const g = new THREE.IcosahedronGeometry(1, detail).toNonIndexed()
  const dirs = fibonacciDirs(spikes, seedRot)
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    // 가장 가까운 가시 방향과의 정렬도(0..1). 봉우리에서 최대 → 가시 끝(반지름 1), 골은 코어(body)에 붙는다.
    let peak = 0
    for (const d of dirs) {
      const align = Math.max(0, v.dot(d))
      if (align > peak) peak = align
    }
    const radius = body + (1 - body) * Math.pow(peak, sharpness) // 끝=1, 코어=body로 정규화(바깥 반지름 일정)
    pos.setXYZ(i, v.x * radius, v.y * radius, v.z * radius)
  }
  pos.needsUpdate = true
  g.computeVertexNormals()
  return g
}

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
