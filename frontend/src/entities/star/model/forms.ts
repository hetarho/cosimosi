// 별(기억) 오브제의 형태별 인스턴스 머티리얼 — StarField가 선택된 appearance.object로 dispatch한다.
// 단일 쇼케이스 별(showcase.ts)의 4형태를 InstancedMesh로 이식한 판: 모든 인스턴스가 지오메트리·
// 머티리얼 하나를 공유하므로(드로우콜 그대로) 색은 uniform이 아니라 per-instance attribute에서 온다
//   - aMood(vec3)      → mood 색(감정 의미색, 보존)
//   - aBrightness(float)→ 회상 최근성 기반 밝기
//   - aSeed(float)      → 노이즈 오프셋(별마다 고유한 무늬)
// 표면 "무늬"는 모두 자가발광(emissive)·뷰의존(fresnel)·변위로 만든다 — 우주 씬엔 directional 광이
// 없어(ambient만) diffuse 면음영을 못 쓰기 때문. 애니메이션은 공유 uTime(useFrame이 .value를 올림 —
// BloomPass가 nodeFrame을 우회해 TSL time 노드가 멈추는 문제 회피, materials.ts와 동일 원칙).
import * as THREE from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import {
  attribute,
  float,
  vec3,
  uniform,
  positionLocal,
  normalLocal,
  positionWorld,
  normalWorld,
  cameraPosition,
  mix,
  smoothstep,
  clamp,
  pow,
  sin,
  max,
  dot,
  normalize,
  mx_noise_float,
  mx_fractal_noise_float,
} from 'three/tsl'
import type { StarObject } from './types'

export interface StarFormBuild {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  /** 매 프레임 시간 갱신(메서드 — 유니폼 .value 변경은 이 모듈 안에서만; 호출부는 메서드만 부른다). */
  update: (time: number) => void
}

/** appearance.object → 별 인스턴스의 {지오메트리, 머티리얼, uTime}. mood 색은 attribute로 보존. */
export function buildStarForm(object: StarObject): StarFormBuild {
  // attribute()/uniform()의 TS 타입엔 .mul/.add가 없어 vec3()/float()로 감싸(as never) 체이닝 가능 노드를 얻는다.
  const mood = vec3(attribute('aMood', 'vec3') as never)
  const bright = float(attribute('aBrightness', 'float') as never)
  const seed = float(attribute('aSeed', 'float') as never)
  const uTime = uniform(0)
  const t = float(uTime as never)
  // 유니폼 .value 갱신은 이 클로저 안에서만 — 호출부(StarField)는 메서드만 불러 react-hooks/immutability를 피한다.
  const update = (time: number) => {
    uTime.value = time
  }

  const m = new MeshStandardNodeMaterial()
  m.metalness = 0.0
  m.toneMapped = false // emissive를 bloom이 집어가도록(HDR) 유지

  switch (object) {
    case 'aurora': {
      // 성운 — 도메인 워핑 fbm 빛구름이 천천히 흐른다. (instanced 정렬 이슈 회피 위해 불투명 + 자가발광.)
      const geometry = new THREE.IcosahedronGeometry(1, 4)
      m.roughness = 0.9
      const flow = vec3(0, 1, 0).mul(t.mul(0.14))
      const p = positionLocal.mul(1.6).add(flow).add(vec3(seed))
      const warp = mx_fractal_noise_float(p, 3)
      const pw = p.add(vec3(warp).mul(0.7))
      const n = mx_fractal_noise_float(pw, 5).mul(0.5).add(0.5)
      const n2 = mx_fractal_noise_float(pw.mul(2.3).add(vec3(7.1)), 4).mul(0.5).add(0.5)
      // base는 mood, 결(n) 따라 더 밝게 — 흰색 클리핑은 약하게(1.4) 묶어 hue 보존.
      const cloud = mix(mood.mul(0.55), mood.mul(1.4), pow(n, float(1.2)))
      m.colorNode = mood.mul(0.3)
      m.emissiveNode = cloud.mul(n2.mul(0.4).add(0.7)).mul(bright)
      return { geometry, material: m, update }
    }
    case 'liquid': {
      // 액체 구슬 — 2중 노이즈로 표면이 출렁이고(변위), 넓은 림 sheen + 좁은 스페큘러가 광택을 준다.
      const geometry = new THREE.IcosahedronGeometry(1, 6)
      m.roughness = 0.08
      m.metalness = 0.15
      const np = positionLocal.mul(1.1).add(vec3(seed)).add(vec3(0, 0, 1).mul(t.mul(0.8)))
      const disp = mx_noise_float(np).mul(0.18).add(mx_noise_float(np.mul(2.6).add(vec3(3.7))).mul(0.06))
      m.positionNode = positionLocal.add(normalLocal.mul(disp))
      const viewDir = normalize(cameraPosition.sub(positionWorld))
      const ndv = max(dot(normalWorld, viewDir), float(0))
      const rim = pow(clamp(float(1).sub(ndv), float(0), float(1)), float(1.4))
      const spec = pow(clamp(float(1).sub(ndv), float(0), float(1)), float(4.0))
      m.colorNode = mood.mul(0.5)
      m.emissiveNode = mood.mul(0.3).add(mood.mul(rim.mul(0.5))).add(vec3(1).mul(spec.mul(0.6))).mul(bright)
      return { geometry, material: m, update }
    }
    case 'ember': {
      // 잉걸불 — 각진 8면 결정. 저주파 fbm으로 '달궈진 면'을 정해 일부가 용암색으로 빛나고 은은히 깜빡인다.
      const geometry = new THREE.OctahedronGeometry(1, 0)
      m.flatShading = true
      m.roughness = 0.5
      const np = positionLocal.mul(1.4).add(vec3(seed))
      const n = mx_fractal_noise_float(np, 3).mul(0.5).add(0.5)
      const heat = smoothstep(float(0.5), float(0.92), n)
      const flicker = sin(t.mul(2.4).add(seed)).mul(0.07).add(0.93)
      const crust = mood.mul(0.1)
      const lava = mood.mul(1.6).add(vec3(0.4, 0.14, 0))
      m.colorNode = crust
      m.emissiveNode = mix(crust, lava, heat).mul(flicker).mul(bright)
      return { geometry, material: m, update }
    }
    case 'deepfield':
    default: {
      // 크리스털 — 저폴리 보석(20면 flatShading). directional 광이 없으니 면 음영을 뷰의존(ndv)으로
      // 자가발광시켜 페이싯이 드러나게 하고, 가장자리엔 흰빛 회절 스파클을 올린다.
      const geometry = new THREE.IcosahedronGeometry(1, 0)
      m.flatShading = true
      m.roughness = 0.34
      const viewDir = normalize(cameraPosition.sub(positionWorld))
      const ndv = max(dot(normalWorld, viewDir), float(0))
      const facet = ndv.mul(0.5).add(0.5) // 면이 카메라를 향한 정도로 밝기 차 → 컷이 보임
      const edge = pow(clamp(float(1).sub(ndv), float(0), float(1)), float(4.0))
      m.colorNode = mood
      m.emissiveNode = mood
        .mul(bright)
        .mul(facet)
        .add(vec3(0.9, 0.95, 1.0).mul(edge.mul(bright).mul(0.45)))
      return { geometry, material: m, update }
    }
  }
}
