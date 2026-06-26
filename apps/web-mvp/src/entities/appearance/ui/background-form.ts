// 배경 스킨의 시각 조립(spec 51) — shared 셰이더 아트 툴킷(plan 50)을 조합해 효과별 색 노드를 만든다.
// 위젯(UniverseNebula)은 공통 셸(geometry·material·uniform·frozen-time·reduced-motion)만 소유하고,
// 선택 효과에 따라 여기 registry에서 조립 함수를 꺼내 쓴다 — 효과가 몇 개든 위젯엔 분기가 없다(N-제네릭).
//
// 색 규약(change 11·spec 07): 셸이 검정에 가까운 받침(deep)과 요즘 mood 색 3슬롯(e0/e1/e2)·presence를
// 유니폼으로 넣는다. 각 함수는 자기 *무늬 마스크*([0,1])를 만들고 그 위에 mood 색을 가산한다 — presence=0
// (감정 없음·미인증·빈 우주)이면 거의 검정이 남아 안전한 딥스페이스. 별 mood 색·깊이는 셸이 불간섭 보장.
import { vec3, float, mix, sin, cos, smoothstep, clamp, pow, abs, oneMinus } from 'three/tsl'
import {
  fbm01,
  worley,
  domainWarp,
  toSpherical,
  logSpiral,
  kaleido,
  cellEdge,
  contourSteps,
  asFloatNode,
  asVec3Node,
} from '@/shared/lib/r3f'
import type { BackgroundEffect } from '../model/types'

type FloatNode = ReturnType<typeof asFloatNode>
type Vec3Node = ReturnType<typeof asVec3Node>

/** 공통 셸이 각 조립 함수에 넘기는 노드 묶음. params는 효과별 튜닝 수치(entity 카탈로그)이고, 누락 키는
 *  안전 기본값으로 폴백해 렌더가 깨지지 않는다. */
export interface BackgroundFieldContext {
  /** 구 표면 단위 방향(uv 극 핀칭 회피). */
  dir: Vec3Node
  /** 검정에 가까운 딥스페이스 받침색(palette.base). */
  deep: Vec3Node
  /** arousal로 빨라지는 흐름 벡터(시간·움직임 게인 반영). */
  flow: Vec3Node
  /** 흐름/움직임 속도 스칼라(= 1 + motion_gain·arousal). */
  speed: FloatNode
  /** 감정 짜임 강도(0 = 거의 검정). mood 가산 전체를 게이트. */
  presence: FloatNode
  /** 요즘 mood 색 3슬롯 — 주(field)·강조·꼬리. */
  e0: Vec3Node
  e1: Vec3Node
  e2: Vec3Node
  /** 수동 시계 노드(frozen-time — BloomPass가 내장 time을 안 굴려 셸이 useFrame에서 bump). */
  t: FloatNode
  /** fbm 옥타브(VALUES.cosmos.fluidOctaves). */
  oct: number
  /** 무늬 결 — 도메인워프 세기. */
  warp: number
  /** 무늬 결 — 기본 주파수. */
  freq: number
  /** 무늬 결 — 미세 디테일 게인. */
  detail: number
  /** 효과별 튜닝 수치(주석 달린 카탈로그 params). */
  params: Readonly<Record<string, number>>
}

/** 효과별 조립 함수 — 색 노드(vec3)를 반환한다(asVec3Node로 일반 노드를 좁혀 반환). material/uniform/React는 셸 몫. */
export type BackgroundForm = (ctx: BackgroundFieldContext) => Vec3Node

/** params에서 수치를 안전하게 읽는다(누락·비수치 → 기본값). */
function num(params: Readonly<Record<string, number>>, key: string, fallback: number): number {
  const v = params[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/** galaxy — 적도 은하면(band)에 log-spiral 나선팔이 감기고 fbm 먼지가 흩뿌려진 은하 백드롭. */
const galaxy: BackgroundForm = (ctx) => {
  const { dir, deep, flow, speed, presence, e0, e2, t, oct, freq, params } = ctx
  const arms = num(params, 'arms', 5)
  const twist = num(params, 'twist', 0.8)
  const spinSpeed = num(params, 'spinSpeed', 0.04)
  const bandSharp = num(params, 'bandSharp', 2.2)
  const coreGlow = num(params, 'coreGlow', 0.5)
  const armBright = num(params, 'armBright', 0.55)
  const { lon, lat } = toSpherical(dir)
  // 적도(은하면) 집중: |lat|이 0(적도)일수록 1. pow로 면 두께 조절.
  const band = pow(oneMinus(clamp(abs(lat).div(Math.PI / 2), float(0), float(1))), float(bandSharp))
  // log-spiral 위상에 sin → 회전하는 나선팔 줄무늬. radius = cos(lat)(적도 1·극 0).
  const spPhase = logSpiral(lon, cos(lat).add(0.05), { arms, twist })
  const swirl = sin(spPhase.add(t.mul(spinSpeed).mul(speed))).mul(0.5).add(0.5)
  const dust = fbm01(dir.mul(float(2).add(freq)).add(flow), { octaves: oct })
  const armMask = band.mul(swirl).mul(dust.mul(0.6).add(0.4)).mul(armBright)
  const core = pow(band, float(3)).mul(coreGlow) // 은하면 중심 글로우
  const moodCol = mix(e0, e2, swirl)
  return asVec3Node(deep.mul(0.9).add(moodCol.mul(armMask.add(core)).mul(presence.mul(0.6).add(0.05))))
}

/** vortex — +y 극에 어두운 중심(블랙홀)을 두고 도메인워프 강착원반이 휘감는 와류. */
const vortex: BackgroundForm = (ctx) => {
  const { dir, deep, flow, speed, presence, e0, e1, oct, warp, freq, params } = ctx
  const coreFocus = num(params, 'coreFocus', 2.0)
  const ringGain = num(params, 'ringGain', 0.65)
  const up = clamp(dir.y, float(0), float(1)) // 1 at +y 중심
  const warped = domainWarp(dir.mul(float(1).add(freq)).add(flow.mul(speed)), { amount: warp, octaves: oct })
  const swirl = fbm01(warped, { octaves: oct })
  const disk = smoothstep(float(0.15), float(0.92), up) // 극 주변 원반
  const darkCore = smoothstep(float(0.86), float(1.0), up) // 중심 어둠(blackhole)
  const ring = pow(disk, float(coreFocus)).mul(swirl).mul(ringGain)
  const mask = ring.mul(oneMinus(darkCore)) // 중심은 비워 어둠 유지
  const moodCol = mix(e0, e1, swirl)
  return asVec3Node(deep.mul(0.85).add(moodCol.mul(mask).mul(presence.mul(0.6).add(0.04))))
}

/** crystal — Worley 셀 경계선이 빛나는 결정/세포망. 셀 내부엔 미세 톤차. */
const crystal: BackgroundForm = (ctx) => {
  const { dir, deep, flow, speed, presence, e0, e1, freq, params } = ctx
  const cellScale = num(params, 'cellScale', 3.2)
  const jitter = num(params, 'jitter', 1)
  const edgeSharp = num(params, 'edgeSharp', 8)
  const edgeGlow = num(params, 'edgeGlow', 0.6)
  const cellTone = num(params, 'cellTone', 0.12)
  const p = dir.mul(float(cellScale).add(freq)).add(flow.mul(speed).mul(0.3))
  const w = worley(p, jitter)
  const edge = cellEdge(w.f1, w.f2, edgeSharp)
  const interior = w.f1.mul(cellTone) // 셀 중심까지 거리 → 내부 미세 명암
  const mask = edge.mul(edgeGlow).add(interior.mul(0.15))
  const moodCol = mix(e0, e1, clamp(w.f1, float(0), float(1)))
  return asVec3Node(deep.mul(0.88).add(moodCol.mul(mask).mul(presence.mul(0.6).add(0.05))))
}

/** mandala — 각을 거울 대칭으로 접어(kaleido) fbm을 등고선 층(contourSteps)으로 쪼갠 방사 신성기하. */
const mandala: BackgroundForm = (ctx) => {
  const { dir, deep, flow, speed, presence, e0, e2, t, oct, freq, params } = ctx
  const segments = num(params, 'segments', 8)
  const petals = num(params, 'petals', 6)
  const ringFreq = num(params, 'ringFreq', 3)
  const steps = num(params, 'steps', 6)
  const maskGain = num(params, 'maskGain', 0.55)
  const { lon, lat } = toSpherical(dir)
  const folded = kaleido(lon, segments) // 방사 대칭 각(0..π/segments)
  const r = abs(lat) // 위도 반경
  const p = vec3(folded.mul(petals), r.mul(ringFreq), t.mul(0.02).mul(speed)).add(flow.mul(0.2))
  const n = fbm01(p.mul(float(1).add(freq)), { octaves: oct })
  const layered = contourSteps(n, steps) // 계단 층
  const sym = sin(folded.mul(petals)).mul(0.5).add(0.5)
  const mask = layered.mul(sym).mul(maskGain)
  const moodCol = mix(e0, e2, layered)
  return asVec3Node(deep.mul(0.88).add(moodCol.mul(mask).mul(presence.mul(0.6).add(0.05))))
}

/** 효과 id → 조립 함수. `satisfies Record<BackgroundEffect, …>`로 총괄성 강제: 카탈로그가 새 효과를
 *  허용하면 여기 누락이 컴파일 오류가 된다(plan 51 A3). 위젯은 이 registry만 lookup한다. */
export const BACKGROUND_FORMS = {
  galaxy,
  vortex,
  crystal,
  mandala,
} satisfies Record<BackgroundEffect, BackgroundForm>
