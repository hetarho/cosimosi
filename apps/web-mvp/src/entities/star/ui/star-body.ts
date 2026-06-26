// 별(기억) 오브제의 시각 정체성 — **형태(look) × 추상화 단계(stage)** 조립(change 29). 사용자가 고른 룩 3종
// (polyhedron·liquid·spiky)이 모양+질감을, abstraction_stage(0~stageMax)가 단계별 **실제 지오메트리 변형**을
// 정한다 — 단계가 오를수록 더 단순/추상(다면체 면↓·고슴도치 가시↓·액체→구름). buildStarBody(look, stage)가
// 룩 빌더를 골라 지오메트리(toolkit polyhedronForStage·spikyGeometry 등) + emissive 셰이딩을 합성한다. 같은
// 단계 내 별마다의 실루엣 차이(랜덤성)는 per-instance shape 시드로 in-shader 변위한다. 셰이더 입력은
// `StarShadeInputs` **노드**로 받아, 소비처가 per-instance attribute()(우주 StarField)든 uniform()/상수(단일·
// 배경)든 자유로이 바인딩한다. ⚠️ 단계는 이제 **빌드 타임 number**(어느 지오메트리)이지 in-shader 노드가 아니다 —
// 우주는 (룩×단계) 버킷별 InstancedMesh로 렌더한다(StarField, 헌법8 개정: 단일→소수 고정 메시).
//
// **별 빛(spec 03 self-light).** (1) 자가발광(emissive) 세기 `glow` — 우주 소비처는 거리 밝기를 넘긴다
// (brightnessFromRadius, A_MIN 바닥, bloom 함; spec 38 change 19). 빌더는 의미를 모르고 float 노드로만 받는다.
// (2) 반사(reflection)=중앙 자아-별/평행광이 별 albedo를 비춰 면/엣지를 드러냄(`recency`로 변조, gain으로
// 낮게 cap해 bloom 안 번지게). 정확 법선 룩은 N·L 반사, 변위/구름 룩(법선 부정확)은 무방향 글로우로
// recency를 살린다(가까운=강한 별일수록 밝게). (3) 색=mood(hueShift 회전).
// 진짜 PointLight가 아니라 emissive 그래프 안 self-position uniform + per-instance 좌표로 N·L·falloff를 직접
// 계산한다. `focus`가 self-glow·reflection 양쪽에 곱해진다.
//
// 순수 함수: uniform을 만들지도, .value를 돌리지도 않는다. time조차 inputs로 받는다 — uniform 소유와 매 프레임
// 갱신은 소비처 몫(StarField/CosmosScene의 useFrame). 조명 스칼라(intensity/distance/decay/gain)는 plain
// number `StarLightParams`로 받아 노드 그래프에 상수로 굽는다(이 파일은 three에만 의존, plan 42 라이브러리화 전제).
import * as THREE from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import {
  vec3,
  float,
  positionLocal,
  normalLocal,
  positionWorld,
  normalWorld,
  mix,
  smoothstep,
  clamp,
  pow,
  sin,
  cos,
  max,
  dot,
  length,
  normalize,
} from 'three/tsl'
import {
  asFloatNode,
  asVec3Node,
  rotateAroundAxis,
  fbm,
  fbm01,
  gnoise,
  polyhedronForStage,
  spikyGeometry,
  TUNE,
} from '@/shared/lib/r3f'
// TUNE: dev 라이브 튜너 — uniform 기본값 = 아래 상수라 프로덕션 동작 불변(스캐폴딩, 확정 후 상수로 복원).
import { type StarLook, DEFAULT_STAR_LOOK } from '../model/forms'

type FloatNode = ReturnType<typeof asFloatNode>
type Vec3Node = ReturnType<typeof asVec3Node>

/** 셰이더 입력 계약 — 전부 TSL 노드. 소비처가 attribute()(인스턴스) 또는 uniform()/상수(단일·배경)로 공급한다. */
export interface StarShadeInputs {
  /** 의미색(linear RGB) — vec3 노드. */
  mood: unknown
  /** 자가발광 세기 — float 노드. 우주는 거리 밝기(∈[A_MIN,1], +reshape offset, spec 38 change 19)를 넘긴다. emissive에 곱한다. */
  glow: unknown
  /** 반사 변조([0,1]) — float 노드. 중앙 광원 반사가 이 값으로 변조된다(우주는 거리 밝기 → 가까운=강한 별일수록 밝게). */
  recency: unknown
  /** 노이즈 오프셋(별마다 고유 무늬) — float 노드. surface 발광 무늬가 쓴다. */
  seed: unknown
  /** 형태(geometry) 변형 3축 시드(선택, change 29) — vec3 노드. 룩 빌더가 같은 단계 내 별마다 정점을 변위·비대칭화한다.
   *  미지정이면 seed 단일값에서 파생(단일 프리뷰·배경 장식 별은 per-star 변형 불필요). */
  shape?: unknown
  /** 재공고화 색조(spec 23, rad) — float 노드. 0이면 회전 없음. */
  hueShift: unknown
  /** 공유 시간 — float 노드. 소비처가 매 프레임 .value를 올린다. */
  time: unknown
  /** 광원 — vec3 노드. positional=1이면 월드 위치(점광/자아-별), 0이면 방향(평행광/배경). */
  selfLightPos: unknown
  /** 1=점광(거리 감쇠), 0=평행광(감쇠 없음) — float 노드. */
  lightPositional: unknown
  /** 반사 항 게이트(0|1) — float 노드. 0이면 lit 연산이 0(저사양/WebGL2 kill-switch). */
  litMix: unknown
  /** 포커스 디밍/부스트(기본 1) — float 노드. self-glow·reflection 양쪽에 곱한다(spec 11/28). */
  focus: unknown
  /** 카메라 월드 위치 — vec3 노드. 소비처가 매 프레임 uniform .value를 갱신한다(time과 동일 관용구). 표면→카메라
   *  viewDir(=ndv·헤드램프 광원 방향)을 여기서 만든다. ⚠️ three의 빌트인 cameraPosition 노드를 쓰면 안 된다 —
   *  BloomPass(RenderPipeline)가 노드 프레임 갱신을 우회해 그 빌트인이 초기 카메라 위치에 동결되기 때문. */
  cameraPos: unknown
  /** 카메라 헤드램프(0|1) — float 노드(선택). 1이면 정확-법선 룩의 반사 광원을 selfLightPos 대신 cameraPos에서
   *  만든 viewDir(+ 살짝 위 틸트)로 잡는다 — 시점을 돌리면 보이는 면이 늘 비춰진다(far-view 헤드램프). */
  cameraHeadlight?: unknown
}

/** 조명 스칼라 — plain number(노드 아님). 소비처가 VALUES.starLighting.*를 넘긴다(이 파일은 three만 의존). */
export interface StarLightParams {
  /** 반사광 전체 세기(self_intensity). */
  intensity: number
  /** 거리 falloff 기준 거리(self_distance). */
  distance: number
  /** 거리 falloff 지수(self_decay) — 완만(물리 1/d² 아님). */
  decay: number
  /** 반사 cap(lit_albedo_gain) — self-glow를 못 이기게 + bloom threshold 아래로 묶어 안 번지게. */
  gain: number
}

/** 형태 변형 스칼라(change 29) — plain number. 소비처가 VALUES.starForm.*를 넘긴다. 우주(StarField)만 실제 값을
 *  넘기고, 단일 프리뷰·배경 장식 별은 기본(변형 약·단계 0)을 쓴다. 단계별 룩 파라미터(spikes·spikeLen·opacityFloor)는
 *  소비처가 그 버킷의 stage로 배열을 인덱싱해 **이미 해석된 스칼라**로 넣는다(이 파일은 배열·values를 모른다). */
export interface StarFormParams {
  /** 저주파 정점 변위 진폭(별마다 다른 실루엣 럼프). */
  displaceAmp: number
  /** 고주파 디테일 변위 진폭 — 추상화가 진행되면 가장 먼저 녹는다. */
  detailAmp: number
  /** shape 방향 비대칭 스트레치(별마다 비율/실루엣 차이 — 회전만이 아닌 형태 차이). */
  asymmetry: number
  /** 최대 단계에서 변위·비대칭이 줄어드는 비율(요지화 — 높을수록 일반적 인상만). */
  stageSimplify: number
  /** 추상화 단계 정규화 분모(= consolidation.gist_stage_radii 길이, 보통 4). */
  stageMax: number
  /** 고슴도치 — 이 단계의 가시 개수(소비처가 spikySpikes[stage]). 미지정 0. */
  spikes?: number
  /** 고슴도치 — 이 단계의 가시 길이(spikyLen[stage]). */
  spikeLen?: number
  /** 고슴도치 — 가시 뾰족함. */
  spikeSharpness?: number
  /** 고슴도치 — 코어 분할(가시 윤곽 매끈도). */
  spikeDetail?: number
  /** 액체→구름 — 이 단계의 불투명 바닥(liquidOpacity[stage]). 1=불투명 액체, 낮을수록 구름처럼 비침. */
  opacityFloor?: number
}

/** 변형 off 기본값 — formParams 미지정 시(단일 프리뷰·배경). seedShape가 거의 항등이라 깔끔한 단계-0 룩. */
const NO_FORM_VARIATION: StarFormParams = {
  displaceAmp: 0,
  detailAmp: 0,
  asymmetry: 0,
  stageSimplify: 0,
  stageMax: 4,
}

export interface StarBodyBuild {
  geometry: THREE.BufferGeometry
  material: THREE.Material
}

/** 룩 빌더 입력 — seed/time 노드(변위·자전용) + 카메라 월드 위치(뷰 의존 항용) + 형태 고유성 시드 + 빌드타임 단계. */
interface StarLookCtx {
  seed: FloatNode
  time: FloatNode
  cameraPos: Vec3Node
  /** 형태(geometry) 변형 3축 시드 — 같은 단계 내 별마다 다른 실루엣(in-shader 변위). */
  shape: Vec3Node
  /** 추상화 단계(빌드타임 number) — 어느 지오메트리·단순화. */
  stage: number
  /** 변형 스칼라 + 단계별 룩 파라미터(해석된 스칼라). */
  form: StarFormParams
}

/** 단계 정규화·단순화(빌드타임 number). 높은 단계일수록 simplify↓ → 변위·비대칭이 함께 줄어든다(요지로 수렴). */
function stageScalars(ctx: StarLookCtx) {
  const stageNorm = Math.min(1, Math.max(0, ctx.stage / Math.max(1, ctx.form.stageMax)))
  const simplify = 1 - stageNorm * ctx.form.stageSimplify
  return { stageNorm, simplify }
}

/** shape 3축 방향 비대칭 스트레치 — 별마다 비율이 달라 회전만이 아닌 실루엣 차이. 평균 기준 편차로 스트레치해
 *  세 시드가 같이 커도 통째로 커지지 않고 비율만 변한다(크기는 sizeFor(intensity)가 단독으로 정한다는 규칙 보존). */
function anisoStretch(pos: Vec3Node, shape: Vec3Node, k: number): Vec3Node {
  const sx = asFloatNode(shape.x)
  const sy = asFloatNode(shape.y)
  const sz = asFloatNode(shape.z)
  const mean = asFloatNode(sx.add(sy).add(sz).div(3))
  const f = (c: FloatNode) => float(1).add(c.sub(mean).mul(float(k)))
  return asVec3Node(pos.mul(vec3(f(sx), f(sy), f(sz))))
}

/** 같은 단계 내 별마다 고유 실루엣(랜덤성) — 공유 지오메트리(버킷) 위에서 per-instance shape 시드로 정점을 **반지름
 *  방향**으로 변위·비대칭화한다(면 법선 방향이 아니라 — 비인덱스 다면체의 복제 정점이 갈라지지 않게). 시간 비의존
 *  → 같은 shape면 항상 같은 실루엣(결정론). amp/detail/asym은 호출자가 이미 단계 simplify를 곱해 넘긴다. */
function seedDisplace(
  ctx: StarLookCtx,
  mul: { amp: number; detail: number; asym: number; freq?: number },
): Vec3Node {
  const { stageNorm, simplify } = stageScalars(ctx)
  const stretched = anisoStretch(
    asVec3Node(positionLocal),
    ctx.shape,
    ctx.form.asymmetry * mul.asym * simplify,
  )
  const np = asVec3Node(stretched.mul(float(mul.freq ?? 1.3)).add(ctx.shape))
  const lump = asFloatNode(gnoise(np)).mul(float(ctx.form.displaceAmp * mul.amp * simplify))
  // 디테일(고주파)은 단계가 오르면 럼프보다 먼저 사라진다.
  const fine = asFloatNode(gnoise(np.mul(3.1).add(vec3(4.7))))
    .mul(float(ctx.form.detailAmp * mul.detail * simplify * (1 - stageNorm)))
  const disp = lump.add(fine)
  return asVec3Node(stretched.add(normalize(stretched).mul(disp)))
}

/** 룩 빌더 출력 — 지오메트리 + 머티리얼 형태 설정 + emissive 셰이딩 함수. */
interface StarLookBuild {
  geometry: THREE.BufferGeometry
  roughness: number
  metalness: number
  flatShading: boolean
  /** true → 표면 반사가 자아광 N·L(법선 정확) · false → 무방향 최근성 글로우(변위/구름 — 법선 부정확). */
  accurateNormals: boolean
  positionNode?: Vec3Node
  normalNode?: Vec3Node
  /** 반투명 룩(구름화). true면 alpha 블렌드 + depthWrite off, opacityNode로 가장자리를 얇게 사라지게 한다. */
  transparent?: boolean
  opacityNode?: FloatNode
  /** self/reflect emissive 비중(룩 정체성). */
  mixSelf: number
  mixReflect: number
  shade: StarSurfaceFn
}

/** 셰이딩 입력 — 색/발광 계산 노드 묶음. */
interface StarSurfaceCtx {
  mood: Vec3Node
  glow: FloatNode
  recency: FloatNode
  seed: FloatNode
  time: FloatNode
  /** N·V(정면=1) — 뷰의존 항(facet/glossy/pulse). */
  ndv: FloatNode
}
interface StarSurfaceBuild {
  colorNode: Vec3Node
  /** 자가발광(반사·focus 적용 전). */
  self: Vec3Node
}
type StarSurfaceFn = (ctx: StarSurfaceCtx) => StarSurfaceBuild
type StarLookFn = (ctx: StarLookCtx) => StarLookBuild

// ── 셰이딩 헬퍼(룩이 조합) ──────────────────────────────────────────────────────────────────
// facet — 면 음영 + 가장자리 회절 스파클. 다면체 룩의 보석 면이 시점에 따라 스텝지게 음영진다.
const facetShade: StarSurfaceFn = ({ mood, glow, ndv }) => {
  const facetTerm = ndv.mul(asFloatNode(TUNE.starFacetGain)).add(asFloatNode(TUNE.starFacetFloor))
  const edge = pow(clamp(float(1).sub(ndv), float(0), float(1)), asFloatNode(TUNE.starFacetEdgePow))
  const self = mood
    .mul(glow)
    .mul(facetTerm)
    .add(vec3(0.9, 0.95, 1.0).mul(edge.mul(glow).mul(asFloatNode(TUNE.starFacetEdgeGain))))
  return { colorNode: mood, self: asVec3Node(self) }
}

// glossy — 어두운 바디 + 얇고 강한 림 + 정면 좁은 흰 스페큘러(매끈 유리/물방울).
const glossyShade: StarSurfaceFn = ({ mood, glow, ndv }) => {
  const rim = pow(clamp(float(1).sub(ndv), float(0), float(1)), float(2.2))
  const spec = pow(clamp(ndv, float(0), float(1)), float(14.0))
  const self = mood.mul(0.16).add(mood.mul(rim.mul(1.2))).add(vec3(1).mul(spec.mul(1.8))).mul(glow)
  return { colorNode: asVec3Node(mood.mul(0.22)), self: asVec3Node(self) }
}

// cloud — 도메인워프 fbm 빛구름(자가발광·무방향). 액체가 잊혀 구름이 된 단계의 표면.
const cloudShade: StarSurfaceFn = ({ mood, glow, seed, time }) => {
  const flow = vec3(0, 1, 0).mul(time.mul(0.2)).add(vec3(1, 0, 0).mul(sin(time.mul(0.3).add(seed)).mul(0.28)))
  const p = positionLocal.mul(1.6).add(flow).add(vec3(seed))
  const warp = fbm(p.add(vec3(0, 0, 1).mul(time.mul(0.16))), { octaves: 3 })
  const pw = p.add(vec3(warp).mul(0.7))
  const n = fbm01(pw, { octaves: 5 })
  const n2 = fbm01(pw.mul(2.3).add(vec3(7.1)), { octaves: 4 })
  const cloudCol = mix(mood.mul(0.55), mood.mul(1.4), pow(n, float(1.2)))
  const self = cloudCol.mul(n2.mul(0.4).add(0.7)).mul(glow)
  return { colorNode: asVec3Node(mood.mul(0.3)), self: asVec3Node(self) }
}

// spikeGlow — 가시 룩 표면: 백열 균열 fbm + flicker(달궈진 가시 끝) 위에 면 음영. 고슴도치의 "살아있는" 질감.
const spikeShade: StarSurfaceFn = ({ mood, glow, seed, time, ndv }) => {
  const np = positionLocal.mul(1.5).add(vec3(seed)).add(vec3(0.6, 1, 0.2).mul(time.mul(0.1)))
  const n = fbm01(np, { octaves: 3 })
  const heat = smoothstep(float(0.45), float(0.9), n)
  const flicker = sin(time.mul(2.0).add(seed)).mul(0.06).add(0.94)
  const facetTerm = ndv.mul(0.7).add(0.3)
  const base = mood.mul(facetTerm)
  const hot = mood.mul(1.5).add(vec3(0.35, 0.12, 0))
  const self = mix(base, hot, heat).mul(flicker).mul(glow)
  return { colorNode: asVec3Node(mood.mul(0.12)), self: asVec3Node(self) }
}

// ── 룩(look) 빌더 ───────────────────────────────────────────────────────────────────────────
// polyhedron — 단계별 다면체(20→12→8→4면, flatShading). seedDisplace로 같은 단계 내 별마다 다른 비대칭 결정
// 실루엣 + seed 축으로 느린 자전(면이 빛을 받아 살아 있게). flat 법선 자동 재계산 → 반사 N·L 정확.
const polyhedron: StarLookFn = (ctx) => {
  const { seed, time } = ctx
  const axis = asVec3Node(
    normalize(vec3(sin(seed.mul(1.7)).add(0.3), cos(seed.mul(1.1)), sin(seed.mul(2.3)).sub(0.2))),
  )
  const angle = time.mul(0.1).add(sin(time.mul(0.55).add(seed.mul(1.7))).mul(0.5))
  const shaped = seedDisplace(ctx, { amp: 1, detail: 0.6, asym: 1, freq: 1.4 })
  return {
    geometry: polyhedronForStage(ctx.stage),
    roughness: 0.34,
    metalness: 0,
    flatShading: true,
    accurateNormals: true,
    positionNode: asVec3Node(rotateAroundAxis(shaped, axis, angle)),
    normalNode: asVec3Node(rotateAroundAxis(normalLocal, axis, angle)),
    mixSelf: 0,
    mixReflect: 3,
    shade: facetShade,
  }
}

// spiky — 고슴도치: 구형 코어 + 산처럼 솟은 가시(toolkit spikyGeometry). 단계가 오르면 가시 개수·길이↓ → 가시
// 없는 다각형(요지). seed 축으로 느린 텀블(가시가 시점마다 다른 빛을 받음) + 약한 per-star 변위. 가시는 공유
// 지오메트리에 구워지므로(버킷당 1개), 별별 차이는 자전·변위가 진다(랜덤성 v1). flatShading=true로 가시·면을
// 또렷이 각지게(크리스털 가시) — 단계 끝 가시 0의 저폴리 구도 같은 면 음영이라 단계 간 셰이딩이 끊기지 않는다.
const spiky: StarLookFn = (ctx) => {
  const { seed, time, form } = ctx
  const axis = asVec3Node(
    normalize(vec3(cos(seed.mul(1.3)), sin(seed.mul(2.1)).add(0.2), cos(seed.mul(0.7)).sub(0.3))),
  )
  const angle = time.mul(0.14).add(sin(time.mul(0.4).add(seed)).mul(0.3))
  // 코어 노이즈 럼프는 약하게(amp↓·detail↓) — 가시가 주인공이라 럼프가 세면 "뾰루지"처럼 뭉툭해진다. 비대칭만 살려
  // 별마다 다른 실루엣을 준다(가시 배치 차이는 자전이 진다).
  const shaped = seedDisplace(ctx, { amp: 0.12, detail: 0.04, asym: 0.5, freq: 1.2 })
  return {
    geometry: spikyGeometry({
      spikes: Math.max(0, Math.round(form.spikes ?? 0)),
      spikeLen: form.spikeLen ?? 0,
      sharpness: form.spikeSharpness ?? 6,
      detail: Math.max(1, Math.round(form.spikeDetail ?? 4)),
    }),
    roughness: 0.45,
    metalness: 0,
    flatShading: true,
    accurateNormals: true,
    positionNode: asVec3Node(rotateAroundAxis(shaped, axis, angle)),
    normalNode: asVec3Node(rotateAroundAxis(normalLocal, axis, angle)),
    mixSelf: 1.2,
    mixReflect: 0.5,
    shade: spikeShade,
  }
}

// liquid — 액체 구슬 → 구름. 단계 0=불투명 출렁이는 변위 구(glossy), 단계가 오를수록 더 투명·뭉게(구름빛
// 셰이딩으로 크로스페이드, opacityFloor로 바닥을 깔아 깊은 우주에서 안 사라지게). 변위/구름이라 무방향 반사.
const liquid: StarLookFn = (ctx) => {
  const { time, shape, cameraPos } = ctx
  const { stageNorm, simplify } = stageScalars(ctx)
  const cloudiness = stageNorm // 0=액체, 1=구름
  const stretched = anisoStretch(asVec3Node(positionLocal), shape, ctx.form.asymmetry * simplify)
  const np = asVec3Node(stretched.mul(1.1).add(shape).add(vec3(0, 0, 1).mul(time.mul(0.7))))
  // 단계가 오르면 변위 진폭↑(출렁이는 구슬 → 뭉게뭉게 구름 윤곽).
  const dispAmp = ctx.form.displaceAmp * (1 + cloudiness * 1.6)
  const disp = asFloatNode(
    gnoise(np).mul(dispAmp).add(gnoise(np.mul(2.6).add(vec3(3.7))).mul(ctx.form.detailAmp)),
  )
  const transparent = cloudiness > 0.01
  // 정면(중심)은 진하고 실루엣 가장자리는 얇게 — 구름화될수록 더 비친다. opacityFloor가 최소 가시성 바닥.
  const viewDir = asVec3Node(normalize(cameraPos.sub(positionWorld)))
  const facing = asFloatNode(max(dot(normalWorld, viewDir), float(0)))
  const floorOp = ctx.form.opacityFloor ?? 1
  const opacity = asFloatNode(
    clamp(mix(float(1), facing.mul(0.7).add(float(floorOp).mul(0.6)), float(cloudiness)), float(0.06), float(1)),
  )
  return {
    geometry: new THREE.IcosahedronGeometry(1, 6),
    roughness: 0.08 + cloudiness * 0.85,
    metalness: 0.15 * (1 - cloudiness),
    flatShading: false,
    accurateNormals: false,
    positionNode: asVec3Node(stretched.add(normalLocal.mul(disp))),
    transparent,
    opacityNode: transparent ? opacity : undefined,
    mixSelf: 0.5,
    mixReflect: 0.5,
    // 액체(glossy) ↔ 구름(cloud)을 단계로 크로스페이드.
    shade: (s) => {
      const g = glossyShade(s)
      const c = cloudShade(s)
      return {
        colorNode: asVec3Node(mix(g.colorNode, c.colorNode, float(cloudiness))),
        self: asVec3Node(mix(g.self, c.self, float(cloudiness))),
      }
    },
  }
}

/** look id → 빌더. `satisfies Record<StarLook, …>`로 총괄성 강제(카탈로그가 새 룩을 허용하면 누락이 컴파일 오류). */
export const STAR_LOOK_BUILDERS = { polyhedron, liquid, spiky } satisfies Record<StarLook, StarLookFn>

/** look별 mesh-레벨 자전 각속도(rad/s) — 메시를 통째로 도는 단일 소비처(CosmosScene)용 메타데이터. 우주는
 *  셰이더 안에서 돌리고 인스턴스를 mesh-spin하지 않는다. */
export const STAR_LOOK_SPIN: Record<StarLook, number> = {
  polyhedron: 0,
  liquid: 0.4,
  spiky: 0.16,
}

/** look × stage + 입력 노드 + 조명 스칼라 → 별 본체 {geometry, material}. mood 색은 hueShift로 회색축 둘레로
 *  돌려 보존한다. emissive = self-glow(연결성·표면 발광) + reflection(자아광), 둘 다 focus 곱. stage는 빌드타임
 *  number(어느 지오메트리) — 우주는 (룩×단계) 버킷별로 이 함수를 호출해 메시를 만든다(헌법8 개정). */
export function buildStarBody(
  look: StarLook,
  stage: number,
  inputs: StarShadeInputs,
  light: StarLightParams,
  formParams: StarFormParams = NO_FORM_VARIATION,
): StarBodyBuild {
  const moodRaw = asVec3Node(inputs.mood)
  // 재공고화 색조(spec 23): mood 색을 회색축(1,1,1) 둘레로 hueShift(rad)만큼 돌린다 — 휘도(성분 합) 보존.
  const hueShift = asFloatNode(inputs.hueShift)
  const mood = asVec3Node(rotateAroundAxis(moodRaw, normalize(vec3(1, 1, 1)), hueShift))
  const glow = asFloatNode(inputs.glow)
  const rec = asFloatNode(inputs.recency)
  const foc = asFloatNode(inputs.focus)
  const litMix = asFloatNode(inputs.litMix)
  const selfPos = asVec3Node(inputs.selfLightPos)
  const positional = asFloatNode(inputs.lightPositional)
  const seed = asFloatNode(inputs.seed)
  const t = asFloatNode(inputs.time)
  const camPos = asVec3Node(inputs.cameraPos)
  // 형태 변형 3축 시드(change 29). 미지정이면 seed 단일값 브로드캐스트(단일 프리뷰·배경은 per-star 변형 불필요).
  const shapeNode = inputs.shape != null ? asVec3Node(inputs.shape) : asVec3Node(vec3(seed))

  const lookFn = STAR_LOOK_BUILDERS[look] ?? STAR_LOOK_BUILDERS[DEFAULT_STAR_LOOK]
  const built = lookFn({ seed, time: t, cameraPos: camPos, shape: shapeNode, stage, form: formParams })

  const m = new MeshStandardNodeMaterial()
  m.metalness = built.metalness
  m.roughness = built.roughness
  m.flatShading = built.flatShading
  m.toneMapped = false // emissive를 bloom이 집어가도록(HDR) 유지
  if (built.positionNode) m.positionNode = built.positionNode
  if (built.normalNode) m.normalNode = built.normalNode
  // 반투명 룩(구름) — alpha 블렌드 + depthWrite off로 가장자리가 얇게 사라진다(발광 구체라 정렬 깜빡임 허용).
  if (built.transparent) {
    m.transparent = true
    m.depthWrite = false
    if (built.opacityNode) m.opacityNode = built.opacityNode
  }

  const viewDir = asVec3Node(normalize(camPos.sub(positionWorld)))
  const ndv = asFloatNode(max(dot(normalWorld, viewDir), float(0)))

  // 반사(lit) 항 — 정확 법선 룩은 자아광 방향 N·L · 거리 falloff(점광만) · gain cap · 최근성 · litMix로 면/엣지를
  // 드러낸다. 변위/구름 룩(법선 부정확)은 무방향 최근성 글로우로 recency만 살린다(spec 03 회귀 방지). recEff =
  // recency에 바닥(reflectRecencyFloor)을 깐 유효 최근성: 헤드램프는 면을 드러내는 "모델링 광"이라 recency=0
  // (오래된 별)이어도 완전히 꺼지면 안 된다(facet은 자가발광 0이라 반사가 유일한 빛).
  const recEff = asFloatNode(mix(asFloatNode(TUNE.reflectRecencyFloor), float(1), rec))
  const reflectNL = (nrm: unknown) => {
    const toPoint = selfPos.sub(positionWorld)
    const toLight = mix(selfPos, toPoint, positional) // positional=0 → 방향, 1 → 위치차
    const lightDir = normalize(toLight)
    const dist = length(toPoint)
    const attenPoint = float(1).div(float(1).add(float(light.decay).mul(dist.div(float(light.distance)))))
    const atten = mix(float(1), attenPoint, positional).mul(float(light.intensity))
    const ndl = max(dot(asVec3Node(nrm), lightDir), float(0))
    return mood.mul(ndl).mul(atten).mul(float(light.gain)).mul(recEff).mul(litMix)
  }
  // 카메라 헤드램프(far-view): 광원 방향 = viewDir(표면→카메라) + 살짝 위 틸트. viewDir은 cameraPos uniform로
  // 만들어 시점을 돌리면 보이는 면이 늘 비춰진다. 거리 감쇠 없음(평행광·intensity만).
  const camHeadlight = inputs.cameraHeadlight != null ? asFloatNode(inputs.cameraHeadlight) : float(0)
  const headDir = asVec3Node(normalize(viewDir.add(vec3(0, 1, 0).mul(0.45))))
  const ndlCam = max(dot(normalWorld, headDir), float(0))
  const reflectCam = mood.mul(ndlCam).mul(float(light.intensity)).mul(float(light.gain)).mul(recEff).mul(litMix)
  const reflectUndirected = mood.mul(recEff).mul(float(light.gain)).mul(litMix)
  const reflectBase = built.accurateNormals
    ? asVec3Node(mix(reflectNL(normalWorld), reflectCam, camHeadlight))
    : reflectUndirected
  const reflect = reflectBase.mul(built.mixReflect).mul(asFloatNode(TUNE.starReflectMul))

  const shade = built.shade({ mood, glow, recency: rec, seed, time: t, ndv })
  m.colorNode = shade.colorNode
  m.emissiveNode = asVec3Node(
    shade.self.mul(built.mixSelf).mul(asFloatNode(TUNE.starSelfMul)).add(reflect).mul(foc),
  )
  return { geometry: built.geometry, material: m }
}
