// 별(기억) 오브제의 시각 정체성 — **형태(form, geometry)** × **표면(surface, emissive 셰이딩)** 2축 조립
// (spec 52). 형태가 지오메트리/실루엣(+in-shader 변형)을, 표면이 색/질감 발광을 만들고, buildStarBody가
// STAR_FORM_BUILDERS × STAR_SURFACE_BUILDERS registry에서 골라 합성한다 — per-form/surface if/else 없이
// N-제네릭(새 form/surface 추가가 이 합성기 수정 없이 카탈로그 + 빌더 추가로 끝난다, A6). 셰이더 입력은
// `StarShadeInputs` **노드**로 받아, 소비처가 per-instance attribute()(우주 StarField)든 uniform()/상수(단일·
// 배경)든 자유로이 바인딩한다.
//
// **별 빛(spec 03 self-light).** (1) 자가발광(emissive) 세기 `glow` — 우주 소비처는 거리 밝기를 넘긴다
// (brightnessFromRadius, A_MIN 바닥, bloom 함; spec 38 change 19). 빌더는 의미를 모르고 float 노드로만 받는다.
// (2) 반사(reflection)=중앙 자아-별/평행광이 별 albedo를 비춰 면/엣지를 드러냄(`recency`로 변조, gain으로
// 낮게 cap해 bloom 안 번지게). 정확 법선 form은 N·L 반사, 변위/구름 form(법선 부정확)은 무방향 글로우로
// recency를 살린다(가까운=강한 별일수록 밝게). (3) 색=mood(hueShift 회전).
// 진짜 PointLight가 아니라 emissive 그래프 안 self-position uniform + per-instance 좌표로 N·L·falloff를 직접
// 계산한다(헌법8 단일 InstancedMesh 보존). `focus`가 self-glow·reflection 양쪽에 곱해진다.
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
import { asFloatNode, asVec3Node, rotateAroundAxis, fbm, fbm01, gnoise, TUNE } from '@/shared/lib/r3f'
// TUNE: dev 라이브 튜너 — uniform 기본값 = 아래 상수라 프로덕션 동작 불변(스캐폴딩, 확정 후 상수로 복원).
import {
  type StarForm,
  type StarSurface,
  DEFAULT_STAR_FORM,
  DEFAULT_STAR_SURFACE,
} from '../model/forms'

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
  /** 형태(geometry) 변형 3축 시드 — vec3 노드(선택, spec 53). form 빌더가 정점을 별마다 변위·비대칭화한다.
   *  미지정이면 seed 단일값에서 파생(단일 프리뷰·배경 장식 별은 per-star 변형 불필요). */
  shape?: unknown
  /** 추상화 단계 0~stageMax — float 노드(선택, spec 53). 높을수록 form 변위·디테일이 녹아 요지로 수렴(A2).
   *  미지정이면 0(또렷). */
  stage?: unknown
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
   *  BloomPass(RenderPipeline)가 노드 프레임 갱신을 우회해 그 빌트인이 초기 카메라 위치에 동결되기 때문(time과
   *  같은 함정). 그래서 카메라 위치를 CPU에서 직접 먹인다. */
  cameraPos: unknown
  /** 카메라 헤드램프(0|1) — float 노드(선택). 1이면 정확-법선 form의 반사 광원을 selfLightPos 대신 cameraPos에서
   *  만든 viewDir(+ 살짝 위 틸트)로 잡는다 — 시점을 돌리면 보이는 면이 늘 비춰진다(far-view 헤드램프). 미지정/0이면
   *  기존 selfLightPos 경로. */
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

/** 형태 변형 스칼라(spec 53) — plain number. 소비처가 VALUES.starForm.*를 넘긴다(조명 스칼라와 동일 관용구로
 *  이 파일은 three만 의존). 우주(StarField)만 실제 값을 넘기고, 단일 프리뷰·배경 장식 별은 기본(전부 0 = 변형 off)을
 *  쓴다 — 별이 하나뿐인 곳은 per-star 실루엣 차이가 필요 없다. */
export interface StarFormParams {
  /** 저주파 정점 변위 진폭(별마다 다른 실루엣 럼프). */
  displaceAmp: number
  /** 고주파 디테일 변위 진폭 — 추상화가 진행되면 가장 먼저 녹는다. */
  detailAmp: number
  /** shape 방향 비대칭 스트레치(별마다 비율/실루엣 차이 — 회전만이 아닌 형태 차이, A1). */
  asymmetry: number
  /** 최대 단계에서 변위·비대칭이 줄어드는 비율(요지화 — 높을수록 일반적 인상만, A2 단조). */
  stageSimplify: number
  /** 추상화 단계 정규화 분모(= consolidation.gist_stage_radii 길이, 보통 4). */
  stageMax: number
}

/** 변형 off 기본값 — formParams 미지정 시. 전부 0이면 seedShape가 항등(변위·비대칭 없음)이라 기존 렌더와 동일. */
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

/** form 빌더 입력 — seed/time 노드(변위·자전 무늬용) + 카메라 월드 위치(뷰 의존 항용) + 형태 고유성 시드·단계. */
interface StarFormCtx {
  seed: FloatNode
  time: FloatNode
  /** 카메라 월드 위치 — cloudy 등 form-자체 뷰 의존(facing) 계산용. buildStarBody의 viewDir과 동일 출처. */
  cameraPos: Vec3Node
  /** 형태(geometry) 변형 3축 시드(spec 53) — 정점 변위·비대칭으로 별마다 다른 실루엣. */
  shape: Vec3Node
  /** 추상화 단계 0~stageMax(spec 53) — 높을수록 단순/추상(요지화). */
  stage: FloatNode
  /** 변형 스칼라(displace/detail/asymmetry/stageSimplify/stageMax). */
  form: StarFormParams
}

/** 단계 정규화 + 단순화 계수: stageNorm = clamp(stage/stageMax, 0,1), simplify = 1 − stageNorm·stageSimplify.
 *  높은 단계일수록 simplify가 작아져 변위·비대칭이 함께 줄어든다(요지로 단조 수렴, A2). */
function stageFactors({ stage, form }: StarFormCtx) {
  const stageNorm = clamp(stage.div(float(Math.max(1, form.stageMax))), float(0), float(1))
  const simplify = float(1).sub(stageNorm.mul(float(form.stageSimplify)))
  return { stageNorm: asFloatNode(stageNorm), simplify: asFloatNode(simplify) }
}

/** shape 3축 방향 비대칭 스트레치 — 별마다 비율이 달라 회전만이 아닌 실루엣 차이(A1). k=비대칭 세기(단계 감쇠 포함).
 *  ⚠️ 평균 기준 편차로 스트레치한다(세 축 인자 합이 3 → 평균 1): 세 시드 성분이 같이 커도 별이 통째로 커지지
 *  않고 비율(축 간 차이)만 변한다 — 크기는 sizeFor(intensity)가 단독으로 정한다는 규칙을 보존(A5). */
function anisoStretch(pos: Vec3Node, shape: Vec3Node, k: FloatNode): Vec3Node {
  const sx = asFloatNode(shape.x)
  const sy = asFloatNode(shape.y)
  const sz = asFloatNode(shape.z)
  const mean = asFloatNode(sx.add(sy).add(sz).div(3))
  const f = (c: FloatNode) => float(1).add(c.sub(mean).mul(k))
  return asVec3Node(pos.mul(vec3(f(sx), f(sy), f(sz))))
}

// 별마다 고유 실루엣(A1) + 추상화 단계 단순화(A2) — 공유 지오메트리(헌법8) 위에서 per-instance shape 시드로
// 정점을 변위·비대칭화한다. 인스턴스마다 지오메트리를 못 바꾸니(InstancedMesh 1개) in-shader 변위로 실루엣을
// 가른다(liquid 변위 패턴 일반화). 시간 비의존 → 같은 shape·stage면 항상 같은 실루엣(결정론, A3). 변위는
// 반지름 1 대비 작게 잡아 크기 규칙(f(intensity))을 보존한다(A5). 추상화가 오르면 디테일(고주파)이 먼저, 이어
// 럼프·비대칭이 녹아 일반적 인상만 남는다(요지화). 반환: 변위된 positionLocal(normalLocal 방향 변위 + 비대칭 스트레치).
function seedShape(ctx: StarFormCtx, mul: { amp: number; detail: number; asym: number; freq?: number }): Vec3Node {
  const { stageNorm, simplify } = stageFactors(ctx)
  const stretched = anisoStretch(
    asVec3Node(positionLocal),
    ctx.shape,
    asFloatNode(float(ctx.form.asymmetry * mul.asym).mul(simplify)),
  )
  const np = asVec3Node(stretched.mul(float(mul.freq ?? 1.3)).add(ctx.shape))
  const lump = asFloatNode(gnoise(np)).mul(float(ctx.form.displaceAmp * mul.amp))
  // 디테일은 단계가 오르면 럼프보다 먼저 사라진다(추가로 (1−stageNorm) 곱).
  const fine = asFloatNode(gnoise(np.mul(3.1).add(vec3(4.7))))
    .mul(float(ctx.form.detailAmp * mul.detail))
    .mul(float(1).sub(stageNorm))
  const disp = lump.add(fine).mul(simplify)
  // 변위는 **반지름 방향**(normalize(stretched))으로 — 면 법선(normalLocal)으로 주면 lowpoly/octa의
  // 비인덱스 지오메트리(PolyhedronGeometry: 면마다 정점 복제·각자 면 법선)에서 한 꼭짓점의 복제들이
  // 서로 다른 방향으로 흩어져 면 사이가 벌어진다. 반지름 방향은 위치만의 함수라 같은 위치의 복제 정점이
  // 같은 방향·같은 양으로 움직여 면이 붙어 있는 채 실루엣만 변한다.
  return asVec3Node(stretched.add(normalize(stretched).mul(disp)))
}

/** form 빌더 출력 — 지오메트리 + 머티리얼 형태 설정. positionNode/normalNode는 in-shader 변형(있으면 적용). */
interface StarFormBuild {
  geometry: THREE.BufferGeometry
  roughness: number
  metalness: number
  flatShading: boolean
  /** true → 표면 반사가 자아광 N·L(법선 정확) · false → 무방향 최근성 글로우(변위/구름 — 법선 부정확). */
  accurateNormals: boolean
  positionNode?: Vec3Node
  normalNode?: Vec3Node
  /** 반투명 폼(연기·구름). true면 alpha 블렌드 + depthWrite off, opacityNode로 가장자리를 얇게 사라지게 한다. */
  transparent?: boolean
  opacityNode?: FloatNode
}

type StarFormFn = (ctx: StarFormCtx) => StarFormBuild

/** surface 빌더 입력 — 색/발광 계산에 필요한 노드 묶음. */
interface StarSurfaceCtx {
  /** hueShift 회전된 mood(linear RGB). */
  mood: Vec3Node
  /** 자가발광 세기(연결성). */
  glow: FloatNode
  /** 최근성. */
  recency: FloatNode
  seed: FloatNode
  time: FloatNode
  /** 반사 게이트(facet의 평탄 베이스 크로스페이드용). */
  litMix: FloatNode
  /** form의 법선 정확도(1|0). facet는 N·L 반사가 면을 담당하는 정확-법선 form에서만 평탄 베이스로 넘긴다 —
   *  변위/구름 form(0)은 무방향 반사라 면이 안 생기므로 facet가 자체 뷰-면 음영을 유지한다(combo 미감 보존). */
  accurate: FloatNode
  /** 시선 방향. */
  viewDir: Vec3Node
  /** N·V(정면=1) — facet/glossy/pulse 뷰의존 항. */
  ndv: FloatNode
}

/** surface 빌더 출력 — colorNode(albedo) + self(반사·focus 적용 전 emissive). */
interface StarSurfaceBuild {
  colorNode: Vec3Node
  self: Vec3Node
}

type StarSurfaceFn = (ctx: StarSurfaceCtx) => StarSurfaceBuild

// ── 형태(form) 빌더 ─────────────────────────────────────────────────────────────────────────
// lowpoly — 저폴리 보석(20면 flatShading). seedShape로 정점을 변위해 별마다 다른 비대칭 결정 실루엣을 만든
// 뒤(flatShading이라 변위 위에서 면 법선이 자동 재계산 → 반사 N·L 정확) 위치·법선을 함께 돌려 면 음영(ndv)·
// 반사가 자전을 따라온다.
const lowpoly: StarFormFn = (ctx) => {
  const { seed, time } = ctx
  const axis = asVec3Node(
    normalize(vec3(sin(seed.mul(1.7)).add(0.3), cos(seed.mul(1.1)), sin(seed.mul(2.3)).sub(0.2))),
  )
  const angle = time
    .mul(0.1)
    .add(sin(time.mul(1.2).add(seed)).mul(0.45))
    .add(sin(time.mul(0.55).add(seed.mul(1.7))).mul(0.5))
  const shaped = seedShape(ctx, { amp: 1, detail: 0.6, asym: 1, freq: 1.4 })
  return {
    geometry: new THREE.IcosahedronGeometry(1, 0),
    roughness: 0.34,
    metalness: 0,
    flatShading: true,
    accurateNormals: true,
    positionNode: asVec3Node(rotateAroundAxis(shaped, axis, angle)),
    normalNode: asVec3Node(rotateAroundAxis(normalLocal, axis, angle)),
  }
}

// octa — 각진 8면체 결정(flatShading). seedShape 변위로 별마다 다른 각진 실루엣(flat 법선 자동 재계산).
const octa: StarFormFn = (ctx) => ({
  geometry: new THREE.OctahedronGeometry(1, 0),
  roughness: 0.5,
  metalness: 0,
  flatShading: true,
  accurateNormals: true,
  positionNode: seedShape(ctx, { amp: 1, detail: 0.5, asym: 1, freq: 1.5 }),
})

// smooth — 고밀도 매끈 구(부드러운 셰이딩). 변위는 법선을 어긋나게 하므로(매끈 셰이딩) 비대칭 스트레치만 줘
// 별마다 다른 타원체 실루엣을 만든다(럼프/디테일 0 — 완만한 타원체라 구 법선으로도 반사가 자연스럽다, A5 보존).
const smooth: StarFormFn = (ctx) => ({
  geometry: new THREE.IcosahedronGeometry(1, 3),
  roughness: 0.2,
  metalness: 0,
  flatShading: false,
  accurateNormals: true,
  positionNode: seedShape(ctx, { amp: 0, detail: 0, asym: 1 }),
})

// cloudy — 연기/구름: 큰 저주파 fbm로 뭉게뭉게 부풀린 실루엣(매끈 구와 또렷이 구별) + 반투명. 정면(중심)은
// 진하고 실루엣 가장자리·fbm 구멍은 얇게 사라져 연기처럼 읽힌다. 자가발광 구름이라 무방향 반사.
const cloudy: StarFormFn = (ctx) => {
  const { time, cameraPos, shape } = ctx
  const { simplify } = stageFactors(ctx)
  // shape로 비대칭 스트레치(별마다 다른 덩어리) + shape를 노이즈 필드 오프셋으로 — 같은 form이 별마다 다르게 뭉친다.
  const stretched = anisoStretch(asVec3Node(positionLocal), shape, asFloatNode(float(ctx.form.asymmetry * 0.8).mul(simplify)))
  const np = asVec3Node(stretched.mul(1.5).add(shape).add(vec3(0, 0, 1).mul(time.mul(0.18))))
  const puff = asFloatNode(fbm(np, { octaves: 3 })).mul(0.5).add(0.5) // 0..1 큰 덩어리
  const disp = asFloatNode(puff.mul(0.5).sub(0.14)).mul(simplify) // 단계가 오르면 뭉게구름 윤곽이 잦아든다(요지)
  const viewDir = asVec3Node(normalize(cameraPos.sub(positionWorld)))
  const facing = asFloatNode(max(dot(normalWorld, viewDir), float(0)))
  const wisp = asFloatNode(fbm01(np.mul(2.4).add(vec3(5.1)), { octaves: 4 })) // 결 구멍
  const opacity = asFloatNode(
    clamp(facing.mul(0.65).add(0.12).mul(wisp.mul(0.7).add(0.45)), float(0), float(1)),
  )
  return {
    geometry: new THREE.IcosahedronGeometry(1, 5),
    roughness: 0.95,
    metalness: 0,
    flatShading: false,
    accurateNormals: false,
    positionNode: asVec3Node(stretched.add(normalLocal.mul(disp))),
    transparent: true,
    opacityNode: opacity,
  }
}

// liquid — 2중 노이즈 변위 구. 변위 표면이라 재계산 법선이 없어 N·L 부정확 → 무방향 반사. seedShape의 일반화
// 원형: shape로 비대칭 스트레치 + 노이즈 필드를 별마다 옮기고, 출렁임(time 변위)은 단계가 오르면 잦아든다.
const liquid: StarFormFn = (ctx) => {
  const { time, shape } = ctx
  const { simplify } = stageFactors(ctx)
  const stretched = anisoStretch(asVec3Node(positionLocal), shape, asFloatNode(float(ctx.form.asymmetry).mul(simplify)))
  const np = asVec3Node(stretched.mul(1.1).add(shape).add(vec3(0, 0, 1).mul(time.mul(0.8))))
  const disp = asFloatNode(gnoise(np).mul(0.18).add(gnoise(np.mul(2.6).add(vec3(3.7))).mul(0.06))).mul(simplify)
  return {
    geometry: new THREE.IcosahedronGeometry(1, 6),
    roughness: 0.08,
    metalness: 0.15,
    flatShading: false,
    accurateNormals: false,
    positionNode: asVec3Node(stretched.add(normalLocal.mul(disp))),
  }
}

/** form id → 빌더. `satisfies Record<StarForm, …>`로 총괄성 강제(카탈로그가 새 form을 허용하면 누락이
 *  컴파일 오류). buildStarBody가 이 registry만 lookup한다(A6). */
export const STAR_FORM_BUILDERS = { lowpoly, octa, smooth, cloudy, liquid } satisfies Record<
  StarForm,
  StarFormFn
>

/** form별 mesh-레벨 자전 각속도(rad/s) — 메시를 통째로 도는 단일 소비처(CosmosScene)용 메타데이터. 우주는
 *  셰이더 안에서 돌리고 인스턴스를 mesh-spin하지 않는다. 자전의 *적용*은 소비처 몫. */
export const STAR_FORM_SPIN: Record<StarForm, number> = {
  lowpoly: 0,
  octa: 0.16,
  smooth: 0.6,
  cloudy: 0.05,
  liquid: 0.4,
}

// ── 표면(surface) 빌더 ──────────────────────────────────────────────────────────────────────
// facet — 면 음영 + 가장자리 회절 스파클. lit(litMix=1)이면 평탄 베이스(반사가 면 담당), unlit이면 ndv facet.
const facet: StarSurfaceFn = ({ mood, glow, ndv }) => {
  // 뷰-면 음영: 정면 면=밝고(≈1) 실루엣 면=어둡게(0.15). 바닥을 낮춰 면대면 대비를 강하게 — 각 flat 면은
  // 법선이 상수라 면마다 한 단계로 끊겨 보석처럼 스텝진다. ndv는 카메라 상대라 시점을 어디로 돌려도 항상
  // 중심→실루엣 그라데이션이 남아 평탄해지지 않는다(반사가 0인 광원 등진 쪽에서도 입체 유지). 반사(N·L)는
  // emissive에 가산되어 이 위에 얹힌다 — 면을 반사에 의존시키지 않으므로 lit 평탄화를 두지 않는다.
  const facetView = ndv.mul(asFloatNode(TUNE.starFacetGain)).add(asFloatNode(TUNE.starFacetFloor))
  const facetTerm = facetView
  const edge = pow(clamp(float(1).sub(ndv), float(0), float(1)), asFloatNode(TUNE.starFacetEdgePow))
  const self = mood
    .mul(glow)
    .mul(facetTerm)
    .add(vec3(0.9, 0.95, 1.0).mul(edge.mul(glow).mul(asFloatNode(TUNE.starFacetEdgeGain))))
  return { colorNode: mood, self: asVec3Node(self) }
}

// glossy — 유리/물방울: 어두운 바디 + 가장자리 강한 림 + 정면의 좁고 강렬한 흰 스페큘러 핫스팟(facet의
// 면 음영·pulse의 코어 맥동과 또렷이 구별되는 매끈 유리 질감).
const glossy: StarSurfaceFn = ({ mood, glow, ndv }) => {
  const rim = pow(clamp(float(1).sub(ndv), float(0), float(1)), float(2.2)) // 더 얇고 강한 림
  const spec = pow(clamp(ndv, float(0), float(1)), float(14.0)) // 정면 좁은 거울 하이라이트
  const self = mood.mul(0.16).add(mood.mul(rim.mul(1.2))).add(vec3(1).mul(spec.mul(1.8))).mul(glow)
  return { colorNode: asVec3Node(mood.mul(0.22)), self: asVec3Node(self) }
}

// lava — 달궈진 면 fbm + flicker. crust↔lava를 heat로 mix.
const lava: StarSurfaceFn = ({ mood, glow, seed, time }) => {
  const np = positionLocal.mul(1.4).add(vec3(seed)).add(vec3(0.6, 1, 0.2).mul(time.mul(0.12)))
  const n = fbm01(np, { octaves: 3 })
  const heat = smoothstep(float(0.5), float(0.92), n)
  const flicker = sin(time.mul(2.4).add(seed)).mul(0.07).add(0.93)
  const crust = asVec3Node(mood.mul(0.1))
  const lavaCol = mood.mul(1.6).add(vec3(0.4, 0.14, 0))
  const self = mix(crust, lavaCol, heat).mul(flicker).mul(glow)
  return { colorNode: crust, self: asVec3Node(self) }
}

// cloud — 도메인워프 fbm 빛구름(자가발광).
const cloud: StarSurfaceFn = ({ mood, glow, seed, time }) => {
  const flow = vec3(0, 1, 0)
    .mul(time.mul(0.2))
    .add(vec3(1, 0, 0).mul(sin(time.mul(0.3).add(seed)).mul(0.28)))
  const p = positionLocal.mul(1.6).add(flow).add(vec3(seed))
  const warp = fbm(p.add(vec3(0, 0, 1).mul(time.mul(0.16))), { octaves: 3 })
  const pw = p.add(vec3(warp).mul(0.7))
  const n = fbm01(pw, { octaves: 5 })
  const n2 = fbm01(pw.mul(2.3).add(vec3(7.1)), { octaves: 4 })
  const cloudCol = mix(mood.mul(0.55), mood.mul(1.4), pow(n, float(1.2)))
  const self = cloudCol.mul(n2.mul(0.4).add(0.7)).mul(glow)
  return { colorNode: asVec3Node(mood.mul(0.3)), self: asVec3Node(self) }
}

// pulse — 어두운 바디 + 정면의 강렬한 고밀도 코어가 큰 진폭으로 두근거린다(0.55↔1.45). facet의 면·glossy의
// 매끈 림과 달리 "맥동하는 심장" 으로 읽히게 코어를 크게 키우고 맥동을 과장한다.
const pulse: StarSurfaceFn = ({ mood, glow, ndv, seed, time }) => {
  const core = pow(clamp(ndv, float(0), float(1)), float(3.0)) // 더 좁고 진한 코어
  const beat = sin(time.mul(3.2).add(seed)).mul(0.45).add(1) // 큰 진폭 맥동
  const halo = pow(clamp(float(1).sub(ndv), float(0), float(1)), float(2.0)).mul(0.25) // 은은한 외곽 헤일로
  const self = mood.mul(float(0.22).add(core.mul(1.9))).mul(beat).add(mood.mul(halo)).mul(glow)
  return { colorNode: asVec3Node(mood.mul(0.14)), self: asVec3Node(self) }
}

/** surface id → 빌더. `satisfies Record<StarSurface, …>`로 총괄성 강제. */
export const STAR_SURFACE_BUILDERS = { facet, glossy, lava, cloud, pulse } satisfies Record<
  StarSurface,
  StarSurfaceFn
>

/** surface별 emissive 합성 비중 — self(자가발광=연결성·표면 발광)와 reflect(반사=카메라 키라이트 N·L) 두 채널을
 *  표면 정체성에 맞춰 따로 가중한다. facet=자가발광 0·반사로만 면을 드러냄(키라이트가 빙 돌며 면을 모델링),
 *  lava=자가발광 위주(스스로 달궈진 면), glossy/구름/맥동=중간. buildStarBody가 emissive에 곱한다(전역 트림
 *  TUNE.starSelfMul/starReflectMul이 다시 ×, 기본 1 → 이 값 그대로). ⚠️ facet self=0이면 연결성·A_MIN 자가발광이
 *  사라져 회상이 오래된(recency≈0) 별은 반사도 0이라 어두워질 수 있다(spec 03 recency 변조 + 헌법2 A_MIN 잔광 고려). */
export const STAR_SURFACE_MIX: Record<StarSurface, { self: number; reflect: number }> = {
  facet: { self: 0, reflect: 3 },
  glossy: { self: 0.5, reflect: 0.25 },
  lava: { self: 1.7, reflect: 0.2 },
  cloud: { self: 0.5, reflect: 0.5 },
  pulse: { self: 0.5, reflect: 0.5 },
}

/** form × surface + 입력 노드 + 조명 스칼라 → 별 본체 {geometry, material}. mood 색은 hueShift로 회색축
 *  둘레로 돌려 보존한다. emissive = self-glow(연결성·surface 발광) + reflection(자아광), 둘 다 focus 곱. */
export function buildStarBody(
  form: StarForm,
  surface: StarSurface,
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
  // 카메라 월드 위치(빌트인 cameraPosition 노드 대신 — BloomPass가 그 빌트인을 동결시킨다, StarShadeInputs.cameraPos 참조).
  const camPos = asVec3Node(inputs.cameraPos)
  // 형태(geometry) 변형 시드/단계(spec 53). 미지정이면 seed 단일값을 3축에 브로드캐스트(= 기존 vec3(seed)) —
  // liquid/cloudy는 변형 off에서도 이 노이즈 필드를 쓰므로, 단일 프리뷰·배경 장식 별이 기존과 똑같이 보이게
  // 한다(A5). 우주(StarField)는 inputs.shape로 진짜 3축 시드를 넘겨 별마다 실루엣이 갈린다.
  const shapeNode = inputs.shape != null ? asVec3Node(inputs.shape) : asVec3Node(vec3(seed))
  const stageNode = inputs.stage != null ? asFloatNode(inputs.stage) : float(0)

  const formFn = STAR_FORM_BUILDERS[form] ?? STAR_FORM_BUILDERS[DEFAULT_STAR_FORM]
  const surfaceFn = STAR_SURFACE_BUILDERS[surface] ?? STAR_SURFACE_BUILDERS[DEFAULT_STAR_SURFACE]
  const shape = formFn({ seed, time: t, cameraPos: camPos, shape: shapeNode, stage: stageNode, form: formParams })

  const m = new MeshStandardNodeMaterial()
  m.metalness = shape.metalness
  m.roughness = shape.roughness
  m.flatShading = shape.flatShading
  m.toneMapped = false // emissive를 bloom이 집어가도록(HDR) 유지
  if (shape.positionNode) m.positionNode = shape.positionNode
  if (shape.normalNode) m.normalNode = shape.normalNode
  // 반투명 폼(cloudy 연기) — alpha 블렌드 + depthWrite off로 가장자리가 얇게 사라진다(발광 구체라 정렬 깜빡임 허용).
  if (shape.transparent) {
    m.transparent = true
    m.depthWrite = false
    if (shape.opacityNode) m.opacityNode = shape.opacityNode
  }

  const viewDir = asVec3Node(normalize(camPos.sub(positionWorld)))
  const ndv = asFloatNode(max(dot(normalWorld, viewDir), float(0)))

  // 반사(lit) 항 — 정확 법선 form은 자아광 방향 N·L · 거리 falloff(점광만) · gain cap · 최근성 · litMix로
  // 면/엣지를 드러낸다. 변위/구름 form(법선 부정확)은 무방향 최근성 글로우로 recency만 살린다(spec 03 회귀
  // 방지). 진짜 PointLight가 아니라 self-position uniform으로 여기서 계산 → 단일 InstancedMesh 보존(헌법8).
  // recEff = recency에 바닥(reflectRecencyFloor)을 깐 유효 최근성: 카메라 헤드램프는 면을 드러내는 "모델링 광"
  // 이라 recency=0(오래된 별)이어도 완전히 꺼지면 안 된다(특히 facet은 자가발광 0이라 반사가 유일한 빛). 바닥
  // 0이면 기존 동작(순수 recency 변조). bake 시 spec 03 recency-반사 변조가 전 form/surface에 완화됨에 유의.
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
  // 카메라 헤드램프(far-view): 광원 방향 = viewDir(표면→카메라) + 살짝 위 틸트. viewDir은 cameraPos uniform
  // (소비처가 매 프레임 카메라 월드 위치로 갱신 — facet ndv 음영과 동일 출처)으로 만들어 시점을 돌리면 보이는
  // 면이 늘 비춰진다. ⚠️ three 빌트인 cameraPosition 노드를 쓰면 BloomPass가 그걸 동결시켜(time과 같은 함정)
  // 광원이 초기 카메라 위치에 박히므로 쓰지 않는다. 거리 감쇠 없음(평행광·intensity만).
  const camHeadlight = inputs.cameraHeadlight != null ? asFloatNode(inputs.cameraHeadlight) : float(0)
  const headDir = asVec3Node(normalize(viewDir.add(vec3(0, 1, 0).mul(0.45))))
  const ndlCam = max(dot(normalWorld, headDir), float(0))
  const reflectCam = mood.mul(ndlCam).mul(float(light.intensity)).mul(float(light.gain)).mul(recEff).mul(litMix)
  const reflectUndirected = mood.mul(recEff).mul(float(light.gain)).mul(litMix)
  // 정확-법선 form은 헤드램프(camHeadlight=1) ↔ selfLightPos 반사를 크로스페이드, 변위/구름 form은 무방향.
  const reflectBase = shape.accurateNormals
    ? asVec3Node(mix(reflectNL(normalWorld), reflectCam, camHeadlight))
    : reflectUndirected
  // emissive 합성: surface별 self/reflect 비중(STAR_SURFACE_MIX) × 전역 트림(dev 튜너, 기본 1 → 무변).
  const mixCfg = STAR_SURFACE_MIX[surface] ?? STAR_SURFACE_MIX[DEFAULT_STAR_SURFACE]
  const reflect = reflectBase.mul(mixCfg.reflect).mul(asFloatNode(TUNE.starReflectMul))

  const accurate = float(shape.accurateNormals ? 1 : 0)
  const shade = surfaceFn({ mood, glow, recency: rec, seed, time: t, litMix, accurate, viewDir, ndv })
  m.colorNode = shade.colorNode
  m.emissiveNode = asVec3Node(
    shade.self.mul(mixCfg.self).mul(asFloatNode(TUNE.starSelfMul)).add(reflect).mul(foc),
  )
  return { geometry: shape.geometry, material: m }
}
