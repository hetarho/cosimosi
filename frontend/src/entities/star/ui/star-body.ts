// 별(기억) 오브제의 시각 정체성 — form별 geometry + TSL 셰이딩을 *소비 방식과 분리한* 단일 프리미티브.
// 셰이더가 필요로 하는 입력(mood색·밝기·seed·hueShift·time)을 `StarShadeInputs` **노드**로 받으므로, 소비처가
// 그 노드를 per-instance `attribute()`로 만들지(우주 StarField) `uniform()`로 만들지(단일 Star3D) 자유롭게
// 바인딩한다 — 같은 셰이더, 다른 입력원. 이 한 벌이 예전 forms.ts(인스턴스)+single.ts(단일)의 중복을 대체한다.
//
// 표면 "무늬"는 모두 자가발광(emissive)·뷰의존(fresnel)·변위로 만든다 — 별을 씬의 광원과 무관하게 보이게 해
// (ambient-only 우주든 directional 쇼케이스든 동일) 어디에 꽂아도 일관된다.
//
// 순수 함수: uniform을 만들지도, .value를 돌리지도 않는다. time조차 inputs로 받는다 — uniform 소유와 매 프레임
// 갱신은 소비처 몫이다(StarField/Star3D의 useFrame). frozen-time 관용구(BloomPass가 TSL `time` 노드를 멈추므로
// 수동 uTime)는 유지하되, 그 uTime을 소비처가 소유한다. (위치·자전·wobble 등 움직임도 전부 소비처가 주입한다.)
import * as THREE from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import {
  vec3,
  float,
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
  cos,
  max,
  dot,
  cross,
  normalize,
  mx_noise_float,
  mx_fractal_noise_float,
} from 'three/tsl'
import type { StarObject } from '../model/types'

/** 셰이더 입력 계약 — 전부 TSL 노드. 소비처가 attribute()(인스턴스) 또는 uniform()/상수(단일)로 공급한다.
 *  (TSL 노드 타입엔 .mul/.add가 없어 빌더 안에서 vec3()/float()로 감싸 체이닝하므로 여기선 unknown으로 받는다.) */
export interface StarShadeInputs {
  /** 의미색(linear RGB) — vec3 노드. */
  mood: unknown
  /** 밝기 — float 노드. */
  brightness: unknown
  /** 노이즈 오프셋(별마다 고유 무늬) — float 노드. */
  seed: unknown
  /** 재공고화 색조(spec 23, rad) — float 노드. 0이면 회전 없음. */
  hueShift: unknown
  /** 공유 시간 — float 노드. 소비처가 매 프레임 .value를 올린다. */
  time: unknown
}

export interface StarBodyBuild {
  geometry: THREE.BufferGeometry
  material: THREE.Material
}

/** form별 mesh-레벨 자전 각속도(rad/s) — 메시 그룹을 통째로 도는 단일 소비처(Star3D)용 메타데이터.
 *  (우주는 crystal을 셰이더 안에서 돌리고 인스턴스를 mesh-spin하지 않는다.) 자전의 *적용*은 소비처 몫. */
export const STAR_FORM_SPIN: Record<StarObject, number> = {
  deepfield: 0,
  aurora: 0.05,
  liquid: 0.4,
  ember: 0.16,
}

/** Rodrigues 회전 — 단위축 k를 중심으로 노드 v를 angle(rad)만큼 돈다. 셰이더에서 자전·색조 회전을 만든다.
 *  입력은 내부에서 vec3()/float()로 감싼다(TS 타입엔 .mul/.add가 없어 감싸야 체이닝 가능 — 파일 관용구). */
function rotateAroundAxis(vIn: unknown, kIn: unknown, angleIn: unknown) {
  const v = vec3(vIn as never)
  const k = vec3(kIn as never)
  const angle = float(angleIn as never)
  const c = cos(angle)
  const s = sin(angle)
  const cr = vec3(cross(k, v) as never)
  const kv = float(dot(k, v) as never)
  return v.mul(c).add(cr.mul(s)).add(k.mul(kv.mul(float(1).sub(c))))
}

/** object(형태) + 입력 노드 → 별 본체 {geometry, material}. mood 색은 hueShift로 회색축 둘레를 돌려 보존한다. */
export function buildStarBody(object: StarObject, inputs: StarShadeInputs): StarBodyBuild {
  const moodRaw = vec3(inputs.mood as never)
  // 재공고화 색조(spec 23): mood 색을 회색축(1,1,1) 둘레로 hueShift(rad)만큼 돌린다 — 휘도(성분 합) 보존.
  const hueShift = float(inputs.hueShift as never)
  const mood = vec3(rotateAroundAxis(moodRaw, normalize(vec3(1, 1, 1)), hueShift) as never)
  const bright = float(inputs.brightness as never)
  const seed = float(inputs.seed as never)
  const t = float(inputs.time as never)

  const m = new MeshStandardNodeMaterial()
  m.metalness = 0.0
  m.toneMapped = false // emissive를 bloom이 집어가도록(HDR) 유지

  switch (object) {
    case 'aurora': {
      // 성운 — 도메인 워핑 fbm 빛구름이 대기처럼 순환한다: 위로 흐르며 좌우로 천천히 휘젓고, 도메인 워프
      // 자체가 시간에 따라 진화해 무늬가 휘돌며 섞인다. (instanced 정렬 회피 위해 불투명+자가발광.)
      const geometry = new THREE.IcosahedronGeometry(1, 4)
      m.roughness = 0.9
      const flow = vec3(0, 1, 0).mul(t.mul(0.2)).add(vec3(1, 0, 0).mul(sin(t.mul(0.3).add(seed)).mul(0.28)))
      const p = positionLocal.mul(1.6).add(flow).add(vec3(seed))
      const warp = mx_fractal_noise_float(p.add(vec3(0, 0, 1).mul(t.mul(0.16))), 3)
      const pw = p.add(vec3(warp).mul(0.7))
      const n = mx_fractal_noise_float(pw, 5).mul(0.5).add(0.5)
      const n2 = mx_fractal_noise_float(pw.mul(2.3).add(vec3(7.1)), 4).mul(0.5).add(0.5)
      const cloud = mix(mood.mul(0.55), mood.mul(1.4), pow(n, float(1.2)))
      m.colorNode = mood.mul(0.3)
      m.emissiveNode = cloud.mul(n2.mul(0.4).add(0.7)).mul(bright)
      return { geometry, material: m }
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
      return { geometry, material: m }
    }
    case 'ember': {
      // 잉걸불 — 각진 8면 결정. 저주파 fbm '달궈진 면'이 표면을 따라 천천히 흘러 순환하고(시간 드리프트),
      // 그 위에서 은은히 깜빡인다(flicker).
      const geometry = new THREE.OctahedronGeometry(1, 0)
      m.flatShading = true
      m.roughness = 0.5
      const np = positionLocal.mul(1.4).add(vec3(seed)).add(vec3(0.6, 1, 0.2).mul(t.mul(0.12)))
      const n = mx_fractal_noise_float(np, 3).mul(0.5).add(0.5)
      const heat = smoothstep(float(0.5), float(0.92), n)
      const flicker = sin(t.mul(2.4).add(seed)).mul(0.07).add(0.93)
      const crust = mood.mul(0.1)
      const lava = mood.mul(1.6).add(vec3(0.4, 0.14, 0))
      m.colorNode = crust
      m.emissiveNode = mix(crust, lava, heat).mul(flicker).mul(bright)
      return { geometry, material: m }
    }
    case 'deepfield':
    default: {
      // 크리스털 — 저폴리 보석(20면 flatShading). directional 광이 없어도 면 음영을 뷰의존(ndv)으로
      // 자가발광시켜 페이싯이 드러나게 하고, 가장자리엔 흰빛 회절 스파클을 올린다.
      const geometry = new THREE.IcosahedronGeometry(1, 0)
      m.flatShading = true
      m.roughness = 0.34
      // 천천히 자전하되 방향이 부드럽게 바뀐다 — 별마다 seed로 회전축·위상이 달라 제각각 돈다. 각속도가
      // ~2~3초마다 부호를 바꿔 방향이 천천히 뒤집힌다. seed가 상수든(단일) attribute든(인스턴스) 동일하게 동작.
      const axis = normalize(vec3(sin(seed.mul(1.7)).add(0.3), cos(seed.mul(1.1)), sin(seed.mul(2.3)).sub(0.2)))
      const angle = t
        .mul(0.1)
        .add(sin(t.mul(1.2).add(seed)).mul(0.45))
        .add(sin(t.mul(0.55).add(seed.mul(1.7))).mul(0.5))
      // 위치·법선을 함께 돌려야 flatShading의 면 음영(ndv)이 회전을 따라온다.
      m.positionNode = rotateAroundAxis(positionLocal, axis, angle)
      m.normalNode = rotateAroundAxis(normalLocal, axis, angle)
      const viewDir = normalize(cameraPosition.sub(positionWorld))
      const ndv = max(dot(normalWorld, viewDir), float(0))
      const facet = ndv.mul(0.5).add(0.5) // 면이 카메라를 향한 정도로 밝기 차 → 컷이 보임
      const edge = pow(clamp(float(1).sub(ndv), float(0), float(1)), float(4.0))
      m.colorNode = mood
      m.emissiveNode = mood
        .mul(bright)
        .mul(facet)
        .add(vec3(0.9, 0.95, 1.0).mul(edge.mul(bright).mul(0.45)))
      return { geometry, material: m }
    }
  }
}
