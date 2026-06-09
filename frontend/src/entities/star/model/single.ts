// 단일 별 몸체 — 한 개를 큼직하게 그리는 곳이 쓰는 별 form(우주의 인스턴스 별 forms.ts와 같은 4형태,
// 단일·uniform색·directional 조명 환경에 맞춘 별도 튜닝). 색은 mood hex로 받는다(의미색 보존).
//
// 엔티티는 "별 몸체"만 만든다 — halo·캔버스·배치 같은 합성은 소비처(랜딩)의 관심사다. 애니메이션
// 유니폼(time·bright)은 빌드가 직접 들고 update 클로저로 돌려준다(호출부는 메서드만 부른다 →
// react-hooks/immutability 회피).
//
// 타입 메모: uniform()의 TS 타입엔 .mul/.add가 없어 vec3()/float()로 감싸(as never) 체이닝 가능 노드를 얻는다.
import * as THREE from 'three'
import { MeshStandardNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu'
import {
  vec3,
  float,
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

const makeColorNode = (hex: string) => vec3(uniform(new THREE.Color(hex)) as never)
type V3 = ReturnType<typeof makeColorNode>

/** time·bright raw 유니폼. 식에선 float(...as never)로 감싼 노드를 쓴다(타입드 체이닝). */
interface U {
  time: ReturnType<typeof uniform>
  bright: ReturnType<typeof uniform>
}
const ftime = (u: U) => float(u.time as never)
const fbright = (u: U) => float(u.bright as never)

type Body = { geometry: THREE.BufferGeometry; material: THREE.Material; spin: number }

export interface SingleStarBuild extends Body {
  /** 매 프레임 시간·밝기 갱신(유니폼 .value 변경은 이 모듈 안에서만). */
  update: (time: number, bright: number) => void
}

/** deepfield — 불투명 저폴리 보석. 면 페이싯 + 발광 바닥 + 가장자리 흰빛 회절 스파클. */
function crystalBody(col: V3, u: U): Body {
  const geometry = new THREE.IcosahedronGeometry(1, 0)
  const m = new MeshStandardNodeMaterial()
  m.flatShading = true
  m.metalness = 0.0
  m.roughness = 0.34
  const viewDir = normalize(cameraPosition.sub(positionWorld))
  const ndv = max(dot(normalWorld, viewDir), float(0))
  const edge = pow(clamp(float(1).sub(ndv), float(0), float(1)), float(4.0))
  m.colorNode = col.mul(0.85)
  m.emissiveNode = col.mul(0.4).add(vec3(0.92, 0.96, 1.0).mul(edge.mul(0.7))).mul(fbright(u))
  return { geometry, material: m, spin: 0.4 }
}

/** aurora — 도메인 워핑 fbm 성운(흐르는 빛 구름, 중심 불투명·가장자리 투명). */
function nebulaBody(col: V3, u: U, seed: number): Body {
  const geometry = new THREE.IcosahedronGeometry(1, 5)
  const m = new MeshBasicNodeMaterial()
  m.transparent = true
  m.depthWrite = false
  const flow = vec3(0, 1, 0).mul(ftime(u).mul(0.14))
  const p = positionLocal.mul(1.6).add(flow).add(vec3(seed))
  const warp = mx_fractal_noise_float(p, 3)
  const pw = p.add(vec3(warp).mul(0.7))
  const n = mx_fractal_noise_float(pw, 5).mul(0.5).add(0.5)
  const n2 = mx_fractal_noise_float(pw.mul(2.3).add(vec3(7.1)), 4).mul(0.5).add(0.5)
  const cloud = mix(col.mul(0.6), col.mul(1.9).add(vec3(0.2, 0.08, 0.3)), pow(n, float(1.2)))
  m.colorNode = cloud.mul(n2.mul(0.5).add(0.7)).mul(fbright(u))
  const viewDir = normalize(cameraPosition.sub(positionWorld))
  const facing = clamp(dot(normalWorld, viewDir), float(0), float(1))
  m.opacityNode = pow(facing, float(1.3)).mul(n.mul(0.4).add(0.6)).mul(0.96)
  return { geometry, material: m, spin: 0.05 }
}

/** liquid — 2중 노이즈 변위 + 림 sheen + 스페큘러의 액체 구슬. */
function liquidBody(col: V3, u: U, seed: number): Body {
  const geometry = new THREE.IcosahedronGeometry(1, 6)
  const m = new MeshStandardNodeMaterial()
  m.metalness = 0.15
  m.roughness = 0.04
  const np = positionLocal.mul(1.1).add(vec3(seed)).add(vec3(0, 0, 1).mul(ftime(u).mul(0.8)))
  const disp = mx_noise_float(np).mul(0.22).add(mx_noise_float(np.mul(2.6).add(vec3(3.7))).mul(0.07))
  m.positionNode = positionLocal.add(normalLocal.mul(disp))
  const viewDir = normalize(cameraPosition.sub(positionWorld))
  const ndv = max(dot(normalWorld, viewDir), float(0))
  const rim = pow(clamp(float(1).sub(ndv), float(0), float(1)), float(1.4))
  const spec = pow(clamp(float(1).sub(ndv), float(0), float(1)), float(4.0))
  m.colorNode = col.mul(0.5)
  m.emissiveNode = col.mul(0.26).add(col.mul(rim.mul(0.5))).add(vec3(1).mul(spec.mul(0.95))).mul(fbright(u))
  return { geometry, material: m, spin: 0.4 }
}

/** ember — 저폴리 8면 결정. 저주파 fbm으로 달궈진 면이 용암색으로 빛나고 은은히 깜빡인다. */
function emberBody(col: V3, u: U, seed: number): Body {
  const geometry = new THREE.OctahedronGeometry(1, 0)
  const m = new MeshStandardNodeMaterial()
  m.flatShading = true
  m.metalness = 0.0
  m.roughness = 0.5
  const np = positionLocal.mul(1.4).add(vec3(seed))
  const n = mx_fractal_noise_float(np, 3).mul(0.5).add(0.5)
  const heat = smoothstep(float(0.5), float(0.92), n)
  const flicker = sin(ftime(u).mul(2.4).add(float(seed))).mul(0.07).add(0.93)
  const crust = col.mul(0.1)
  const lava = col.mul(1.9).add(vec3(0.5, 0.18, 0))
  m.colorNode = crust
  m.emissiveNode = mix(crust, lava, heat).mul(flicker).mul(fbright(u))
  return { geometry, material: m, spin: 0.16 }
}

/** object → 단일 별 몸체(geometry+material+spin+update). color는 mood hex, seed는 결정론 변형. */
export function buildSingleStar(object: StarObject, hex: string, seed: number, brightness: number): SingleStarBuild {
  const u: U = { time: uniform(0), bright: uniform(brightness) }
  const update = (t: number, b: number) => {
    u.time.value = t
    u.bright.value = b
  }
  const col = makeColorNode(hex)
  const body =
    object === 'aurora'
      ? nebulaBody(col, u, seed)
      : object === 'liquid'
        ? liquidBody(col, u, seed)
        : object === 'ember'
          ? emberBody(col, u, seed)
          : crystalBody(col, u)
  return { ...body, update }
}
