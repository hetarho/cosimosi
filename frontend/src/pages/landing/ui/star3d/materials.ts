// 랜딩 별 오브제의 테마별 TSL 머티리얼. 4테마가 "색만 다른 같은 별"이 아니라
// 완전히 다른 형태·기법·재질의 오브제로 그려진다(컨셉 "기억마다 하나뿐인 생성 오브제"의 증명):
//  - deepfield → 크리스털: 저폴리 페이싯 + 프레넬 림(천체사진의 보석 같은 별빛)
//  - aurora    → 성운/플라스마: 흐르는 fbm 노이즈, 가산 합성, 부드러운 가장자리(표면 없는 빛 구름)
//  - liquid    → 유리 액체 구슬: 노이즈 변위 + 강한 스페큘러/프레넬 sheen(광택 액체)
//  - ember     → 녹은 잉걸불: fbm 균열 발광 + 깜빡임(검은 외피 위 용암 빛)
// 모두 WebGPU + WebGL2 폴백에서 도는 node material이며, 색은 mood hex로 받는다(의미색 보존).
//
// 타입 메모: TSL은 런타임에 .mul/.add 등을 노드에 붙이지만 uniform()/attribute()의 TS 타입엔
// 그 메서드가 없다. StarField와 동일하게 vec3()/float()로 감싸(as never) 체이닝 가능한 타입드 노드를
// 얻는다. .value 갱신이 필요한 유니폼은 raw로 보관하고, 식에서만 감싼 노드를 쓴다.
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
  uv,
  mix,
  smoothstep,
  clamp,
  pow,
  sin,
  max,
  dot,
  normalize,
  length,
  mx_noise_float,
  mx_fractal_noise_float,
} from 'three/tsl'
import type { LandingThemeId } from '../../model/theme'

/** mood hex → 체이닝 가능한 타입드 vec3 색 노드(상수). */
const makeColorNode = (hex: string) => vec3(uniform(new THREE.Color(hex)) as never)
type V3 = ReturnType<typeof makeColorNode>

/** useFrame이 매 프레임 .value를 갱신하는 공유 raw 유니폼. */
export interface StarUniforms {
  time: ReturnType<typeof uniform>
  bright: ReturnType<typeof uniform>
}

export interface ThemedStarBuild {
  star: { geometry: THREE.BufferGeometry; material: THREE.Material }
  halo: { geometry: THREE.BufferGeometry; material: THREE.Material }
  /** 매 프레임 유니폼 갱신(메서드 호출 — React memo 직접 변경 회피). */
  update: (time: number, bright: number) => void
  /** 기본 자전 속도(rad/s). */
  spin: number
  dispose: () => void
}

function makeUniforms(brightness: number): StarUniforms {
  return { time: uniform(0), bright: uniform(brightness) }
}

/** 유니폼 .value 갱신 클로저(materials 내부에서만 변경 → 호출부는 메서드만 부른다). */
const makeUpdate = (u: StarUniforms) => (time: number, bright: number) => {
  u.time.value = time
  u.bright.value = bright
}

// 식에서 쓰는 타입드 노드(감싸기).
const fbright = (u: StarUniforms) => float(u.bright as never)
const ftime = (u: StarUniforms) => float(u.time as never)

/** 별 뒤에 깔리는 가산 글로우 헤일로(테마 무관, bloom 대용). */
function buildHalo(col: V3, u: StarUniforms) {
  const geometry = new THREE.PlaneGeometry(1, 1)
  const m = new MeshBasicNodeMaterial()
  m.transparent = true
  m.depthWrite = false
  m.blending = THREE.AdditiveBlending
  const d = length(uv().sub(0.5)).mul(2.0) // 0(중심)~1.41(모서리)
  const a = smoothstep(float(1.0), float(0.0), d) // 중심 1 → 가장자리 0
  m.colorNode = col
  m.opacityNode = pow(a, float(2.2)).mul(fbright(u)).mul(0.65)
  return { geometry, material: m }
}

function disposerFor(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  halo: { geometry: THREE.BufferGeometry; material: THREE.Material },
) {
  return () => {
    geometry.dispose()
    material.dispose()
    halo.geometry.dispose()
    halo.material.dispose()
  }
}

/** deepfield — 불투명 저폴리 보석. 면마다 빛을 받아 페이싯이 드러나고(diffuse), 은은히 발광하며,
 *  가장자리에 흰빛 회절 스파클이 돈다. (속이 비어 링처럼 보이던 프레넬-only 방식을 폐기.) */
function buildCrystal(col: V3, u: StarUniforms): ThemedStarBuild {
  const geometry = new THREE.IcosahedronGeometry(1, 0) // 20 면 페이싯(보석)
  const m = new MeshStandardNodeMaterial()
  m.flatShading = true // 면마다 평면 노멀 → 빛 받는 각도 차로 보석 컷이 드러남
  m.metalness = 0.0
  m.roughness = 0.34

  const viewDir = normalize(cameraPosition.sub(positionWorld))
  const ndv = max(dot(normalWorld, viewDir), float(0))
  const edge = pow(clamp(float(1).sub(ndv), float(0), float(1)), float(4.0)) // 가장자리 회절 스파클
  // 본체는 mood색 diffuse(조명이 면을 깎아 보임) + 발광 바닥(그림자 면도 안 죽게) + 흰빛 엣지.
  m.colorNode = col.mul(0.85)
  m.emissiveNode = col.mul(0.4).add(vec3(0.92, 0.96, 1.0).mul(edge.mul(0.7))).mul(fbright(u))

  const halo = buildHalo(col, u)
  return { star: { geometry, material: m }, halo, update: makeUpdate(u), spin: 0.4, dispose: disposerFor(geometry, m, halo) }
}

/** aurora — 도메인 워핑한 fbm 성운(일반 블렌딩의 또렷한 빛 구름, 표면 없는 커튼 결).
 *  가산 합성은 밝은 aurora 배경에서 묻혀 안 보였다 → 중심 불투명·가장자리 투명으로 배경 무관 가시화. */
function buildNebula(col: V3, u: StarUniforms, seed: number): ThemedStarBuild {
  const geometry = new THREE.IcosahedronGeometry(1, 5)
  const m = new MeshBasicNodeMaterial()
  m.transparent = true
  m.depthWrite = false

  const flow = vec3(0, 1, 0).mul(ftime(u).mul(0.14))
  const p = positionLocal.mul(1.6).add(flow).add(vec3(seed))
  // 도메인 워핑: 노이즈로 좌표를 휘어 wispy한 커튼 결을 만든다.
  const warp = mx_fractal_noise_float(p, 3)
  const pw = p.add(vec3(warp).mul(0.7))
  const n = mx_fractal_noise_float(pw, 5).mul(0.5).add(0.5)
  const n2 = mx_fractal_noise_float(pw.mul(2.3).add(vec3(7.1)), 4).mul(0.5).add(0.5)
  const cloud = mix(col.mul(0.6), col.mul(1.9).add(vec3(0.2, 0.08, 0.3)), pow(n, float(1.2)))
  m.colorNode = cloud.mul(n2.mul(0.5).add(0.7)).mul(fbright(u))

  const viewDir = normalize(cameraPosition.sub(positionWorld))
  const facing = clamp(dot(normalWorld, viewDir), float(0), float(1))
  // 중심은 거의 불투명(배경을 가려 또렷), 가장자리는 부드럽게 사라진다.
  m.opacityNode = pow(facing, float(1.3)).mul(n.mul(0.4).add(0.6)).mul(0.96)

  const halo = buildHalo(col, u)
  return { star: { geometry, material: m }, halo, update: makeUpdate(u), spin: 0.05, dispose: disposerFor(geometry, m, halo) }
}

/** liquid — 2중 노이즈로 출렁이는 표면 + 강한 스페큘러 + 림 sheen의 액체 구슬. */
function buildLiquid(col: V3, u: StarUniforms, seed: number): ThemedStarBuild {
  const geometry = new THREE.IcosahedronGeometry(1, 6)
  const m = new MeshStandardNodeMaterial()
  m.metalness = 0.15
  m.roughness = 0.04

  const t = ftime(u)
  const np = positionLocal.mul(1.1).add(vec3(seed)).add(vec3(0, 0, 1).mul(t.mul(0.8)))
  // 크게 출렁이는 저주파 + 잔물결 고주파 — 둘 다 진폭·속도를 키워 훨씬 액체처럼 일렁인다.
  const disp = mx_noise_float(np).mul(0.22).add(mx_noise_float(np.mul(2.6).add(vec3(3.7))).mul(0.07))
  m.positionNode = positionLocal.add(normalLocal.mul(disp))

  const viewDir = normalize(cameraPosition.sub(positionWorld))
  const ndv = max(dot(normalWorld, viewDir), float(0))
  const rim = pow(clamp(float(1).sub(ndv), float(0), float(1)), float(1.4)) // 넓은 sheen
  const spec = pow(clamp(float(1).sub(ndv), float(0), float(1)), float(4.0)) // 좁은 하이라이트
  m.colorNode = col.mul(0.5)
  m.emissiveNode = col.mul(0.26).add(col.mul(rim.mul(0.5))).add(vec3(1).mul(spec.mul(0.95))).mul(fbright(u))

  const halo = buildHalo(col, u)
  return { star: { geometry, material: m }, halo, update: makeUpdate(u), spin: 0.4, dispose: disposerFor(geometry, m, halo) }
}

/** ember — 저폴리 기하 흑요석 결정. 2중 fbm 균열망(과해서 폐기) 대신, 면을 또렷이 드러내는
 *  flatShading 위에 부드러운 저주파 노이즈로 '어디가 달궈졌나'만 정해 면 일부가 용암처럼 빛나고
 *  은은히 깜빡인다. 기하학적이고 절제된 잉걸불. */
function buildEmber(col: V3, u: StarUniforms, seed: number): ThemedStarBuild {
  const geometry = new THREE.OctahedronGeometry(1, 0) // 8면 결정 — deepfield(20면 보석)와 확실히 다른 각진 형태
  const m = new MeshStandardNodeMaterial()
  m.flatShading = true // 면마다 평면 노멀 → 각진 기하가 또렷이 드러남
  m.metalness = 0.0
  m.roughness = 0.5

  const t = ftime(u)
  // 균열을 그리지 않는다 — 저주파 노이즈로 달궈진 영역만 정하고, 면 음영이 형태를 만든다.
  const np = positionLocal.mul(1.4).add(vec3(seed))
  const n = mx_fractal_noise_float(np, 3).mul(0.5).add(0.5) // 0~1
  const heat = smoothstep(float(0.5), float(0.92), n) // 일부 면만 용암색으로 달군다
  const flicker = sin(t.mul(2.4).add(float(seed))).mul(0.07).add(0.93) // 은은한 깜빡임
  const crust = col.mul(0.1)
  const lava = col.mul(1.9).add(vec3(0.5, 0.18, 0))
  m.colorNode = crust
  m.emissiveNode = mix(crust, lava, heat).mul(flicker).mul(fbright(u))

  const halo = buildHalo(col, u)
  return { star: { geometry, material: m }, halo, update: makeUpdate(u), spin: 0.16, dispose: disposerFor(geometry, m, halo) }
}

/** 테마 → 별 오브제 빌드. color는 mood hex(의미색 보존), seed는 결정론 변형. */
export function buildThemedStar(
  concept: LandingThemeId,
  hex: string,
  seed: number,
  brightness: number,
): ThemedStarBuild {
  const col = makeColorNode(hex)
  const u = makeUniforms(brightness)
  switch (concept) {
    case 'aurora':
      return buildNebula(col, u, seed)
    case 'liquid':
      return buildLiquid(col, u, seed)
    case 'ember':
      return buildEmber(col, u, seed)
    case 'deepfield':
    default:
      return buildCrystal(col, u)
  }
}
