// 자아("나") 별의 형태(form) TSL 빌더(spec 38·44) — entity 소유 시각 정의(buildStarBody와 동형 패턴).
// 우주 캔버스(widgets/universe-canvas SelfStar)와 플레이그라운드 미리보기(widgets/cosmos-scene) 둘 다
// 이 한 출처를 쓴다. 색은 uColor 유니폼으로 주입하므로 형태만 바뀌면 재빌드, 색 변경은 유니폼 갱신으로
// 끝난다. 자가발광 emissive(MeshBasicNodeMaterial colorNode) → BloomPass가 글로우로 번지게 한다.
//
// ⚠ 형태는 셰이더만이 아니라 *지오메트리 자체*가 다르다(buildStarBody가 형태별 Icosahedron/Octahedron을
// 쓰는 것과 동형) — "나"가 별처럼 각자 개성 있는 실루엣을 갖도록(change 11 카탈로그):
//   • mirrorball(기본·무료): 각진 면이 빛을 되비추는 *반사구* — flatShading 면 + 면별 글린트.
//   • prism-cube(유료): 굴절·색분산이 있는 *구조적 큐브* — Box 실루엣 + 엣지 색분산 힌트.
//   • neuron-bloom(유료): soma에서 dendrite가 뻗는 *유기적 덩어리* — 노이즈 변위 구름.
// ⚠ 위 세 폼의 실루엣은 식별되되, 진짜 반사/굴절/dendrite 분기 셰이더는 후속 비주얼 폴리시 대상이다.
// 레거시 nebula-heart/core/well은 union에서 제거됐고 else(mirrorball)로 폴백한다.
import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import {
  float,
  vec3,
  uniform,
  positionLocal,
  normalLocal,
  positionWorld,
  normalWorld,
  cameraPosition,
  normalize,
  dot,
  sub,
  max,
  clamp,
  pow,
  sin,
  abs,
  smoothstep,
  mix,
  mx_noise_float,
} from 'three/tsl'
import type { SelfObject } from '../model/types'

export interface SelfFormBuild {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  /** 수동 시계 bump(BloomPass 아래에선 내장 time 노드가 멈춰 useFrame에서 직접 갱신). */
  update: (time: number) => void
  /** 몸체 색 갱신(ambient mood 등) — 재빌드 없이 유니폼만 바꾼다. */
  setColor: (color: THREE.Color) => void
}

/** Build the self star's geometry + TSL material for the chosen form. Color rides a uniform
 *  (uColor) so an ambient-mood change updates it without rebuilding the mesh — only the form
 *  selection rebuilds. Each form has its OWN geometry + emissive shader so the silhouettes read
 *  distinct (cloud / orb / ring), not just differently-shaded spheres. */
export function buildSelfForm(form: SelfObject): SelfFormBuild {
  const material = new MeshBasicNodeMaterial()
  const uTime = uniform(0) // manual clock — the built-in `time` node is frozen under BloomPass
  const update = (time: number) => {
    uTime.value = time
  }
  const uColor = uniform(new THREE.Color(0xffffff))
  const setColor = (color: THREE.Color) => {
    uColor.value.copy(color)
  }
  const t = float(uTime as never)
  const base = vec3(uColor as never)

  // View-facing fresnel rim: 0 facing the camera, 1 at the silhouette.
  const viewDir = normalize(sub(cameraPosition, positionWorld))
  const facing = clamp(dot(normalize(normalWorld), viewDir), float(0), float(1))
  const rim = sub(float(1), facing) // 0 centre → 1 rim

  let geometry: THREE.BufferGeometry

  if (form === 'prism-cube') {
    // 프리즘 큐브: 큐브의 얇은 프레임 케이지가 내부의 눈부신 프리즘 코어를 감싸 쥐고 있는 현대적 펜던트 조명 룩.
    // 외곽 뼈대(isFrame)는 어둡고 금속 질감의 림 라이팅만 맺히며, 그 안쪽 틈새로 무지개빛 핵심 광원이 투과되어 나옵니다.
    geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5)
    const breath = sin(t.mul(0.7)).mul(0.05).add(1)
    const disperse = vec3(rim.mul(0.5), rim.mul(0.2), rim.mul(0.7)) // 엣지 색분산 틴트

    const posX = abs(positionLocal.x)
    const posY = abs(positionLocal.y)
    const posZ = abs(positionLocal.z)
    // 세 축 중 두 개 이상이 큐브 모서리 경계에 맞닿아 있으면 프레임(케이지 뼈대)으로 검출
    const edgeX = smoothstep(float(0.58), float(0.72), posX)
    const edgeY = smoothstep(float(0.58), float(0.72), posY)
    const edgeZ = smoothstep(float(0.58), float(0.72), posZ)
    const isFrame = max(edgeX.mul(edgeY), max(edgeY.mul(edgeZ), edgeZ.mul(edgeX)))

    const coreGlow = base.mul(float(1.5).mul(breath))
    const metalFrame = base.mul(0.18).add(disperse.mul(0.35)).add(rim.mul(0.5))
    material.colorNode = mix(coreGlow, metalFrame, isFrame)
    material.opacityNode = clamp(facing.mul(0.75).add(0.25).add(isFrame.mul(0.3)), float(0), float(1))
  } else if (form === 'neuron-bloom') {
    // 뉴런 꽃: 유기적 돌기망(Neuron Dendrite Shell)이 안쪽의 찬란한 감정 핵(Core)을 감싸고 흘러가는 형상.
    // 튀어나온 외피 껍질은 어둡게 쉐이딩되어 구조적 실루엣을 그리고, 그 틈새 골짜기 사이로만 강렬한 뉴런 에너지가 뿜어져 나옵니다.
    geometry = new THREE.IcosahedronGeometry(1, 4)
    const drift = vec3(t.mul(0.12), t.mul(-0.09), t.mul(0.1))
    const np = positionLocal.mul(1.25).add(drift)
    const lump = float(mx_noise_float(vec3(np as never) as never) as never) // -1..1
    material.positionNode = positionLocal.add(normalLocal.mul(lump.mul(0.34)))

    const flow = float(
      mx_noise_float(vec3(np.add(vec3(3.1, 1.7, 5.2)) as never) as never) as never,
    ).mul(0.5).add(0.5) // 0..1 drifting

    const shellMask = smoothstep(float(-0.15), float(0.3), lump) // 튀어나온 돌기부 외피 마스크
    const coreGlow = base.mul(float(1.5).add(flow.mul(0.5))) // 틈새 핵광
    const outerShell = base.mul(0.22).add(rim.mul(0.75)).mul(flow.mul(0.3).add(0.7)) // 어두운 외피 쉘
    material.colorNode = mix(coreGlow, outerShell, shellMask)
    material.opacityNode = clamp(max(rim.mul(0.65), float(0.32)).mul(flow.mul(0.5).add(0.55)), float(0), float(1))
  } else {
    // mirrorball: 이십면체의 다면체 프레임(Geodesic Grid) 안에서 빛의 반사 결정들이 잘게 쪼개져 뿜어져 나오는 조명 기구.
    // 면들의 한가운데 결정은 반사로 찬란히 빛나고, 면 사이의 기하학적 철망 경계선은 어두운 프레임으로 남아 실루엣이 또렷하게 유지됩니다.
    geometry = new THREE.IcosahedronGeometry(1, 2)
    const breath = sin(t.mul(0.8)).mul(0.06).add(1)
    const glint = pow(facing, float(3.0)).mul(0.6) // 미러볼 정면 반사 글린트

    const gridFactor = float(14.0)
    const grid = sin(positionLocal.x.mul(gridFactor))
      .mul(sin(positionLocal.y.mul(gridFactor)))
      .mul(sin(positionLocal.z.mul(gridFactor)))
    const frameMask = smoothstep(float(-0.25), float(0.12), grid) // 철망 선 경계 마스크

    const cellGlow = base.mul(float(1.3).add(glint).mul(breath))
    const cageFrame = base.mul(0.15).add(rim.mul(0.6))
    material.colorNode = mix(cellGlow, cageFrame, frameMask)
    material.opacityNode = clamp(facing.mul(0.7).add(0.3).add(frameMask.mul(0.25)), float(0), float(1))
  }

  material.transparent = true
  material.depthWrite = false
  material.blending = THREE.AdditiveBlending // emissive glow → bloom
  material.toneMapped = false // keep HDR for bloom
  material.side = THREE.DoubleSide
  return { geometry, material, update, setColor }
}
