// 별(기억) 오브제의 시각 정체성 — form별 geometry + TSL 셰이딩을 *소비 방식과 분리한* 단일 프리미티브.
// 셰이더가 필요로 하는 입력을 `StarShadeInputs` **노드**로 받으므로, 소비처가 그 노드를 per-instance
// `attribute()`로 만들지(우주 StarField) `uniform()`로 만들지(단일/배경) 자유롭게 바인딩한다.
//
// **별 빛 3겹(spec 03 self-light).** 별의 외양은 세 채널로 갈린다 — (1) **자가발광(self-glow, emissive)**:
// 스스로 빛나는 세기 = 연결성(`glow` 입력 = selfGlow, A_MIN 바닥). bloom 함. (2) **반사(reflection, lit)**:
// 중앙 자아-별(우주) 또는 우상단 평행광(배경)이 별 albedo를 비춰 면/엣지를 드러냄 = 최근성(`recency` 입력으로
// 변조). bloom 안 함(`gain`으로 낮게 cap). (3) **색(color)**: mood(hueShift 회전) — 감정 정체성. 진짜
// THREE.PointLight 객체가 아니라 여기 emissiveNode 그래프 안에서 self-position uniform + per-instance
// 좌표로 N·L·falloff를 직접 계산한다(헌법8 단일 InstancedMesh 보존). `focus`가 두 채널 모두에 곱해진다.
//
// 순수 함수: uniform을 만들지도, .value를 돌리지도 않는다. time조차 inputs로 받는다 — uniform 소유와 매 프레임
// 갱신은 소비처 몫이다(StarField/CosmosScene의 useFrame). 조명 스칼라(intensity/distance/decay/gain)는 plain
// number `StarLightParams`로 받아 노드 그래프에 상수로 굽는다 — 이 파일은 three에만 의존(plan 42 라이브러리화 전제).
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
  length,
  normalize,
  mx_noise_float,
  mx_fractal_noise_float,
} from 'three/tsl'
import { asFloatNode, asVec3Node } from '@/shared/lib/r3f'
import type { StarObject } from '../model/types'

/** 셰이더 입력 계약 — 전부 TSL 노드. 소비처가 attribute()(인스턴스) 또는 uniform()/상수(단일·배경)로 공급한다.
 *  (TSL 노드 타입엔 .mul/.add가 없어 빌더 안에서 vec3()/float()로 감싸 체이닝하므로 여기선 unknown으로 받는다.) */
export interface StarShadeInputs {
  /** 의미색(linear RGB) — vec3 노드. */
  mood: unknown
  /** 자가발광(self-glow) 세기 = 연결성(selfGlow ∈ [A_MIN,1], +reshape offset) — float 노드. emissive에 곱한다. */
  glow: unknown
  /** 최근성(reflection 변조, [0,1]) — float 노드. 중앙 광원 반사가 이 값으로 변조된다(가까운=최근=밝게). */
  recency: unknown
  /** 노이즈 오프셋(별마다 고유 무늬) — float 노드. */
  seed: unknown
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

export interface StarBodyBuild {
  geometry: THREE.BufferGeometry
  material: THREE.Material
}

/** form별 mesh-레벨 자전 각속도(rad/s) — 메시 그룹을 통째로 도는 단일 소비처용 메타데이터.
 *  (우주는 crystal을 셰이더 안에서 돌리고 인스턴스를 mesh-spin하지 않는다.) 자전의 *적용*은 소비처 몫. */
export const STAR_FORM_SPIN: Record<StarObject, number> = {
  deepfield: 0,
  aurora: 0.05,
  liquid: 0.4,
  ember: 0.16,
  pulsar: 0.6, // 빠른 자전(pulsar)
}

/** Rodrigues 회전 — 단위축 k를 중심으로 노드 v를 angle(rad)만큼 돈다. 셰이더에서 자전·색조 회전을 만든다. */
function rotateAroundAxis(vIn: unknown, kIn: unknown, angleIn: unknown) {
  const v = asVec3Node(vIn)
  const k = asVec3Node(kIn)
  const angle = asFloatNode(angleIn)
  const c = cos(angle)
  const s = sin(angle)
  const cr = asVec3Node(cross(k, v))
  const kv = asFloatNode(dot(k, v))
  return v.mul(c).add(cr.mul(s)).add(k.mul(kv.mul(float(1).sub(c))))
}

/** object(형태) + 입력 노드 + 조명 스칼라 → 별 본체 {geometry, material}. mood 색은 hueShift로 회색축 둘레를
 *  돌려 보존한다. emissive = self-glow(연결성·glow) + reflection(자아광 N·L·falloff·recency), 둘 다 focus 곱. */
export function buildStarBody(object: StarObject, inputs: StarShadeInputs, light: StarLightParams): StarBodyBuild {
  const moodRaw = asVec3Node(inputs.mood)
  // 재공고화 색조(spec 23): mood 색을 회색축(1,1,1) 둘레로 hueShift(rad)만큼 돌린다 — 휘도(성분 합) 보존.
  const hueShift = asFloatNode(inputs.hueShift)
  const mood = asVec3Node(rotateAroundAxis(moodRaw, normalize(vec3(1, 1, 1)), hueShift))
  const glow = asFloatNode(inputs.glow) // 자가발광 세기(연결성, A_MIN 바닥은 소비처 selfGlow에서 보장)
  const rec = asFloatNode(inputs.recency) // 반사 변조(최근성)
  const foc = asFloatNode(inputs.focus) // 포커스 디밍/부스트
  const litMix = asFloatNode(inputs.litMix)
  const selfPos = asVec3Node(inputs.selfLightPos)
  const positional = asFloatNode(inputs.lightPositional)
  const seed = asFloatNode(inputs.seed)
  const t = asFloatNode(inputs.time)

  // 반사(lit) 항 — 자아광 방향 N·L · 거리 falloff(점광만) · gain cap · 최근성 · litMix. albedo=회전된 mood를
  // 비춘다. bloom 안 하게 gain으로 낮게 cap(threshold 아래). 평행광(positional=0)은 감쇠 없음(태양). 진짜
  // THREE.PointLight 객체가 아니라 self-position uniform으로 여기서 계산 → 단일 InstancedMesh 보존(헌법8).
  const reflect = (nrm: unknown) => {
    const toPoint = selfPos.sub(positionWorld)
    const toLight = mix(selfPos, toPoint, positional) // positional=0 → 방향, 1 → 위치차
    const lightDir = normalize(toLight)
    const dist = length(toPoint)
    const attenPoint = float(1).div(float(1).add(float(light.decay).mul(dist.div(float(light.distance)))))
    const atten = mix(float(1), attenPoint, positional).mul(float(light.intensity))
    const ndl = max(dot(asVec3Node(nrm), lightDir), float(0))
    return mood.mul(ndl).mul(atten).mul(float(light.gain)).mul(rec).mul(litMix)
  }

  const m = new MeshStandardNodeMaterial()
  m.metalness = 0.0
  m.toneMapped = false // emissive를 bloom이 집어가도록(HDR) 유지

  switch (object) {
    case 'aurora': {
      // 성운 — 도메인 워핑 fbm 빛구름. 자가발광 구름이라 reflection 제외(법선이 표면 무늬와 무관) — emissive-only.
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
      // 구름 법선은 표면 무늬와 무관해 N·L 반사는 제외하되, 무방향 최근성 글로우로 recency는 살린다
      // (spec 03 — 안 그러면 무연결 신생 aurora 별이 어두워지는 회귀). gain·litMix로 캡·게이트.
      const self = cloud.mul(n2.mul(0.4).add(0.7)).mul(glow)
      m.emissiveNode = self.add(mood.mul(rec).mul(float(light.gain)).mul(litMix)).mul(foc)
      return { geometry, material: m }
    }
    case 'liquid': {
      // 액체 구슬 — 2중 노이즈 변위 + 림/스페큘러. 변위 표면이라 재계산 법선이 없어 reflection 제외(N·L 부정확).
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
      // 변위 표면이라 N·L 반사는 제외(법선 부정확)하되, 무방향 최근성 글로우로 recency는 살린다(spec 03 회귀 방지).
      const self = mood.mul(0.3).add(mood.mul(rim.mul(0.5))).add(vec3(1).mul(spec.mul(0.6))).mul(glow)
      m.emissiveNode = self.add(mood.mul(rec).mul(float(light.gain)).mul(litMix)).mul(foc)
      return { geometry, material: m }
    }
    case 'ember': {
      // 잉걸불 — 각진 8면 결정. 달궈진 면 fbm + flicker(자가발광) + 자아광 반사(flat 면을 N·L로 드러냄).
      const geometry = new THREE.OctahedronGeometry(1, 0)
      m.flatShading = true
      m.roughness = 0.5
      const np = positionLocal.mul(1.4).add(vec3(seed)).add(vec3(0.6, 1, 0.2).mul(t.mul(0.12)))
      const n = mx_fractal_noise_float(np, 3).mul(0.5).add(0.5)
      const heat = smoothstep(float(0.5), float(0.92), n)
      const flicker = sin(t.mul(2.4).add(seed)).mul(0.07).add(0.93)
      const crust = mood.mul(0.1)
      const lava = mood.mul(1.6).add(vec3(0.4, 0.14, 0))
      const self = mix(crust, lava, heat).mul(flicker).mul(glow)
      m.colorNode = crust
      m.emissiveNode = self.add(reflect(normalWorld)).mul(foc)
      return { geometry, material: m }
    }
    case 'pulsar': {
      // 펄사 — 고밀도 코어 orb. 색=mood 불변(별 색 규칙 무변). 매끈한 발광 코어(정면이 가장
      // 밝음) + 빠른 맥동 + 자아광 N·L 반사로 faceted deepfield와 구별한다.
      const geometry = new THREE.IcosahedronGeometry(1, 3)
      m.roughness = 0.2
      const viewDir = normalize(cameraPosition.sub(positionWorld))
      const ndv = max(dot(normalWorld, viewDir), float(0))
      const core = pow(clamp(ndv, float(0), float(1)), float(2.2)) // 정면이 가장 밝은 고밀도 코어
      const pulse = sin(t.mul(3.0).add(seed)).mul(0.12).add(1) // 빠른 맥동(pulsar)
      m.colorNode = mood.mul(0.2)
      const self = mood.mul(float(0.5).add(core.mul(1.1))).mul(pulse).mul(glow)
      m.emissiveNode = self.add(reflect(normalWorld)).mul(foc)
      return { geometry, material: m }
    }
    case 'deepfield':
    default: {
      // 크리스털 — 저폴리 보석(20면 flatShading). 자가발광(연결성)·뷰의존 면 음영을 baseline으로, 자아광이
      // 있으면(litMix) N·L 반사로 면 컷을 또렷이 드러낸다. ndv facet ↔ N·L 크로스페이드(한 면이 두 큐로
      // 이중 음영되지 않게): unlit(litMix=0)이면 ndv facet(저사양 폴백), lit이면 평탄 베이스 + reflection이 면 담당.
      const geometry = new THREE.IcosahedronGeometry(1, 0)
      m.flatShading = true
      m.roughness = 0.34
      const axis = normalize(vec3(sin(seed.mul(1.7)).add(0.3), cos(seed.mul(1.1)), sin(seed.mul(2.3)).sub(0.2)))
      const angle = t
        .mul(0.1)
        .add(sin(t.mul(1.2).add(seed)).mul(0.45))
        .add(sin(t.mul(0.55).add(seed.mul(1.7))).mul(0.5))
      // 위치·법선을 함께 돌려야 flatShading의 면 음영(ndv)·반사(N·L)가 회전을 따라온다.
      m.positionNode = rotateAroundAxis(positionLocal, axis, angle)
      m.normalNode = rotateAroundAxis(normalLocal, axis, angle)
      const viewDir = normalize(cameraPosition.sub(positionWorld))
      const ndv = max(dot(normalWorld, viewDir), float(0))
      const facetView = ndv.mul(0.5).add(0.5) // 뷰의존 면 음영(광원 없을 때)
      const facet = mix(facetView, float(0.7), litMix) // lit이면 평탄 베이스(반사가 면 담당), unlit이면 ndv facet
      const edge = pow(clamp(float(1).sub(ndv), float(0), float(1)), float(4.0))
      m.colorNode = mood
      const self = mood
        .mul(glow)
        .mul(facet)
        .add(vec3(0.9, 0.95, 1.0).mul(edge.mul(glow).mul(0.45))) // 가장자리 회절 스파클(자가발광)
      m.emissiveNode = self.add(reflect(normalWorld)).mul(foc)
      return { geometry, material: m }
    }
  }
}
