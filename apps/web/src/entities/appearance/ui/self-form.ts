// 자아("나") 별의 **형태(form, geometry)** × **표면(surface, 셰이딩)** 2축 TSL 빌더(spec 38·44·52) — entity
// 소유 시각 정의(buildStarBody와 동형 패턴). 우주 캔버스(widgets/universe-canvas SelfStar)와 플레이그라운드
// 미리보기(widgets/cosmos-scene) 둘 다 이 한 출처를 쓴다. 색은 uColor 유니폼으로 주입하므로 형태/질감만
// 바뀌면 재빌드, 색 변경은 유니폼 갱신으로 끝난다. 자가발광 emissive(colorNode) → BloomPass가 글로우로 번지게.
//
// 형태는 셰이더만이 아니라 *지오메트리 자체*가 다르다(buildStarBody 동형) — form이 실루엣(구/큐브/돌기 변위)을,
// surface가 질감(미러 케이지/프리즘 색분산/뉴런 셸)을 만든다. buildSelfForm이 SELF_FORM_BUILDERS×
// SELF_SURFACE_BUILDERS registry에서 골라 합성한다(N-제네릭). 알 수 없는 sub-id는 축 기본으로 폴백.
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
import { asFloatNode, asVec3Node, TUNE } from '@/shared/lib/r3f'
// TUNE: dev 라이브 튜너 — uniform 기본값 = 표면 밝기 상수(0.35/0.7/0.85)라 프로덕션 불변(스캐폴딩).
import {
  type SelfForm,
  type SelfSurface,
  DEFAULT_SELF_FORM,
  DEFAULT_SELF_SURFACE,
} from '../model/self-forms'

type FloatNode = ReturnType<typeof asFloatNode>
type Vec3Node = ReturnType<typeof asVec3Node>

// ★ 표면별 밝기 — 각 표면 최종 색 전체(glint·specular·breath 핫스팟 포함)에 곱한다. 낮출수록 흰 번짐이
//   줄고 형태가 또렷. 표면마다 따로 — 미러는 좁은 반사 핫스팟이 강해 낮게, 프리즘·뉴런은 높게. 라이브
//   튜너(TUNE.selfMirror/selfPrism/selfNeuron) 노드로 노출 — 기본값이 이 수치(0.35/0.7/0.85)다.

export interface SelfFormBuild {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  /** 수동 시계 bump + 카메라 월드 위치 주입(BloomPass 아래에선 내장 time·cameraPosition 노드가 멈춰 useFrame에서 직접 갱신). */
  update: (time: number, camera: THREE.Camera) => void
  /** 몸체 색 갱신(ambient mood 등) — 재빌드 없이 유니폼만 바꾼다. */
  setColor: (color: THREE.Color) => void
}

/** form 빌더 출력 — 지오메트리 + 선택적 in-shader 변위(positionNode). */
interface SelfFormShape {
  geometry: THREE.BufferGeometry
  positionNode?: Vec3Node
}
type SelfFormFn = (ctx: { time: FloatNode }) => SelfFormShape

/** surface 빌더 입력 — 몸체 색·시간·뷰 항(facing/rim). */
interface SelfSurfaceCtx {
  base: Vec3Node
  time: FloatNode
  /** N·V 정면도(정면=1, 실루엣=0). */
  facing: FloatNode
  /** 1 - facing(가장자리=1). */
  rim: FloatNode
}
/** surface 빌더 출력 — 자가발광 색 + 불투명도. */
interface SelfSurfaceShade {
  colorNode: Vec3Node
  opacityNode: FloatNode
}
type SelfSurfaceFn = (ctx: SelfSurfaceCtx) => SelfSurfaceShade

// ── 형태(form) 빌더 ─────────────────────────────────────────────────────────────────────────
// orb — 다면체 반사구(이십면체).
const orb: SelfFormFn = () => ({ geometry: new THREE.IcosahedronGeometry(1, 2) })

// cube — 구조적 박스.
const cube: SelfFormFn = () => ({ geometry: new THREE.BoxGeometry(1.5, 1.5, 1.5) })

// bloom — 노이즈 변위 구(돌기 덩어리). 변위는 surface(neuron)가 셸 음영을 같은 np로 재구성한다.
const bloom: SelfFormFn = ({ time }) => {
  const drift = vec3(time.mul(0.12), time.mul(-0.09), time.mul(0.1))
  const np = positionLocal.mul(1.25).add(drift)
  const lump = asFloatNode(mx_noise_float(asVec3Node(np))) // -1..1
  return {
    geometry: new THREE.IcosahedronGeometry(1, 4),
    positionNode: asVec3Node(positionLocal.add(normalLocal.mul(lump.mul(0.34)))),
  }
}

export const SELF_FORM_BUILDERS = { orb, cube, bloom } satisfies Record<SelfForm, SelfFormFn>

// ── 표면(surface) 빌더 ──────────────────────────────────────────────────────────────────────
// mirror: 이십면체 격자(Geodesic Grid) 케이지 안에서 반사 결정이 잘게 쪼개져 빛난다. 면 한가운데는 반사로
// 찬란하고 면 사이 철망 경계선은 어두운 프레임으로 남아 실루엣이 또렷하다.
const mirror: SelfSurfaceFn = ({ base, time, facing, rim }) => {
  const breath = sin(time.mul(0.8)).mul(0.05).add(1)
  const glint = pow(facing, float(4.0)).mul(0.9) // 더 좁고 또렷한 정면 반사 글린트
  const gridFactor = float(14.0)
  const grid = sin(positionLocal.x.mul(gridFactor))
    .mul(sin(positionLocal.y.mul(gridFactor)))
    .mul(sin(positionLocal.z.mul(gridFactor)))
  const frameMask = smoothstep(float(-0.25), float(0.12), grid) // 철망 선 경계 마스크
  // 밝기↓(bloom white-out 방지 — 실루엣이 보이게): 셀은 낮은 베이스 + 좁은 글린트, 철망은 더 어둡게.
  const cellGlow = base.mul(float(0.45).add(glint).mul(breath)) // 미러 코어 밝기
  const cageFrame = base.mul(0.07).add(rim.mul(0.4))
  return {
    colorNode: asVec3Node(mix(cellGlow, cageFrame, frameMask).mul(asFloatNode(TUNE.selfMirror))),
    opacityNode: asFloatNode(clamp(facing.mul(0.7).add(0.3).add(frameMask.mul(0.25)), float(0), float(1))),
  }
}

// prism: 얇은 프레임 케이지가 내부의 눈부신 프리즘 코어를 감싸 쥔 펜던트 조명 룩. 외곽 뼈대(isFrame)는
// 어둡고 금속 림 라이팅만 맺히며, 틈새로 무지개빛 핵 광원이 투과한다.
const prism: SelfSurfaceFn = ({ base, time, facing, rim }) => {
  const breath = sin(time.mul(0.7)).mul(0.05).add(1)
  // 강한 무지개 색분산 — 채널별로 rim 위상을 어긋내(R 중간·G 약간·B 가장자리) 프리즘처럼 분광한다(base와 무관 vivid).
  const disperse = vec3(rim.mul(1.1), pow(rim, float(1.6)).mul(0.75), pow(rim, float(0.6)).mul(1.3))
  const posX = abs(positionLocal.x)
  const posY = abs(positionLocal.y)
  const posZ = abs(positionLocal.z)
  // 세 축 중 둘 이상이 모서리 경계에 닿으면 프레임(케이지 뼈대)
  const edgeX = smoothstep(float(0.58), float(0.72), posX)
  const edgeY = smoothstep(float(0.58), float(0.72), posY)
  const edgeZ = smoothstep(float(0.58), float(0.72), posZ)
  const isFrame = max(edgeX.mul(edgeY), max(edgeY.mul(edgeZ), edgeZ.mul(edgeX)))
  // 밝기↓ 코어 + 프레임 엣지에 강한 분광(프리즘 정체성).
  const coreGlow = base.mul(float(0.35).mul(breath)) // 프리즘 코어 밝기
  const metalFrame = base.mul(0.08).add(disperse.mul(0.9)).add(rim.mul(0.3))
  return {
    colorNode: asVec3Node(mix(coreGlow, metalFrame, isFrame).mul(asFloatNode(TUNE.selfPrism))),
    opacityNode: asFloatNode(clamp(facing.mul(0.75).add(0.25).add(isFrame.mul(0.3)), float(0), float(1))),
  }
}

// neuron: 유기적 돌기망(Dendrite Shell)이 안쪽의 찬란한 감정 핵을 감싼다. 튀어나온 외피 껍질은 어둡고,
// 틈새 골짜기 사이로만 강렬한 뉴런 에너지가 뿜어진다. 변위와 같은 np로 셸 음영을 재구성한다(form bloom과 정합).
const neuron: SelfSurfaceFn = ({ base, time, rim }) => {
  const drift = vec3(time.mul(0.12), time.mul(-0.09), time.mul(0.1))
  const np = positionLocal.mul(1.25).add(drift)
  const lump = asFloatNode(mx_noise_float(asVec3Node(np))) // -1..1 (form bloom의 변위와 동일)
  const flow = asFloatNode(mx_noise_float(asVec3Node(np.add(vec3(3.1, 1.7, 5.2)))))
    .mul(0.5)
    .add(0.5) // 0..1 drifting
  const shellMask = smoothstep(float(-0.2), float(0.35), lump) // 튀어나온 돌기부 외피 마스크(더 넓은 어두운 셸)
  // 밝기↓: 틈새 핵광은 flow로 크게 출렁여 "에너지가 새어나오는" 느낌, 외피 셸은 더 어둡게 눌러 돌기 실루엣을 드러낸다.
  const coreGlow = base.mul(float(0.8).add(flow.mul(0.7))) // 뉴런 틈새 핵광 밝기
  const outerShell = base.mul(0.1).add(rim.mul(0.5)).mul(flow.mul(0.3).add(0.55)) // 어두운 외피 셸
  return {
    colorNode: asVec3Node(mix(coreGlow, outerShell, shellMask).mul(asFloatNode(TUNE.selfNeuron))),
    opacityNode: asFloatNode(clamp(max(rim.mul(0.65), float(0.32)).mul(flow.mul(0.5).add(0.55)), float(0), float(1))),
  }
}

export const SELF_SURFACE_BUILDERS = { mirror, prism, neuron } satisfies Record<
  SelfSurface,
  SelfSurfaceFn
>

/** form × surface → 자아 별 {geometry, material, update, setColor}. 색은 uColor 유니폼(ambient mood)이라
 *  form/surface만 재빌드한다. 자가발광 → BloomPass 글로우(additive). */
export function buildSelfForm(form: SelfForm, surface: SelfSurface): SelfFormBuild {
  const material = new MeshBasicNodeMaterial()
  const uTime = uniform(0) // manual clock — the built-in `time` node is frozen under BloomPass
  // 카메라 월드 위치도 수동 주입 — 내장 cameraPosition 노드 역시 BloomPass 아래에선 동결되기 때문(time과 동일).
  const uCamPos = uniform(new THREE.Vector3())
  const update = (time: number, camera: THREE.Camera) => {
    uTime.value = time
    camera.getWorldPosition(uCamPos.value)
  }
  const uColor = uniform(new THREE.Color(0xffffff))
  const setColor = (color: THREE.Color) => {
    uColor.value.copy(color)
  }
  const t = asFloatNode(uTime)
  const base = asVec3Node(uColor)

  // View-facing fresnel rim: 0 facing the camera, 1 at the silhouette.
  const viewDir = normalize(sub(asVec3Node(uCamPos), positionWorld))
  const facing = asFloatNode(clamp(dot(normalize(normalWorld), viewDir), float(0), float(1)))
  const rim = asFloatNode(sub(float(1), facing)) // 0 centre → 1 rim

  const formFn = SELF_FORM_BUILDERS[form] ?? SELF_FORM_BUILDERS[DEFAULT_SELF_FORM]
  const surfaceFn = SELF_SURFACE_BUILDERS[surface] ?? SELF_SURFACE_BUILDERS[DEFAULT_SELF_SURFACE]
  const shape = formFn({ time: t })
  if (shape.positionNode) material.positionNode = shape.positionNode
  const shade = surfaceFn({ base, time: t, facing, rim })
  material.colorNode = shade.colorNode
  material.opacityNode = shade.opacityNode

  material.transparent = true
  material.depthWrite = false
  material.blending = THREE.AdditiveBlending // emissive glow → bloom
  material.toneMapped = false // keep HDR for bloom
  material.side = THREE.DoubleSide
  return { geometry: shape.geometry, material, update, setColor }
}
