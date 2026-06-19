// Star visualization (spec 08, Architecture §3.3): every star drawn by ONE
// InstancedMesh (few draw calls — constitution §8) with a TSL node material so it
// runs on WebGPU and the WebGL2 fallback. Per-instance color/brightness/seed come
// from InstancedBufferAttributes; size (=f(intensity)) is baked into the instance
// matrix scale. Coordinates are updated in useFrame from the live force-sim buffer
// (07/22, wired by UniverseCanvas's LiveLayoutController) with NO React re-render
// (constitution §3, acceptance 1.6); when the buffer isn't ready yet a deterministic
// fibonacci dummy stands in (same formula → no flicker). This is the only place
// three/TSL appears; the model layer stays pure.
import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { attribute, uniform } from 'three/tsl'
import { selfGlow, activation, reshapedBrightness, reshapedSeed, starsOfRecord, useMemoryStore, type StarNode } from '@/entities/memory/@x/star'
import { degreeNormById, weightedDegreeById, useSynapseStore, type SynapseEdge } from '@/entities/synapse/@x/star'
import { virtualNowMs } from '@/shared/lib/demo'
import { WOBBLE_AMP, wobbleUnit } from '../model/wobble'
import { DEFAULT_OBJECT } from '../model/kinds'
import type { StarObject } from '../model/types'
import { resolveMoodRgb } from '@/shared/config'
import { VALUES } from '@/shared/config'
import { fibonacciStarPosition } from '@/shared/lib'
import { buildStarBody } from './star-body'

/** intensity (0..1) → instance scale. */
function sizeFor(intensity: number): number {
  return VALUES.starRender.sizeBase + Math.max(0, Math.min(1, intensity)) * VALUES.starRender.sizeRange
}

/** 버스트 레이어는 클릭 대상이 아니다 — raycast 무력화로 별 클릭이 가려지지 않게. */
const NOOP_RAYCAST = () => undefined

// 별 탄생 애니메이션: 새로 생긴 별은 한 점에서 살짝 튀어 오르며(easeOutBack) 정상 크기로
// 자라난다 — 뚝 나타나는 등장을 "태어나는" 등장으로 바꾼다. 첫 로드/출처 리셋의 일괄
// 시드는 애니메이션하지 않는다(우주 전체가 펑펑 터지면 소음이다).
const BIRTH_DUR_S = VALUES.starRender.birthDurS
function easeOutBack(x: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

// 탄생 버스트: 새 별 자리에서 mood 색의 발광 디스크+링이 빠르게 퍼지며 사그라든다
// (additive — 색이 검정으로 가면 투명과 같다). 스케일 탄생 애니메이션과 함께 "별이
// 태어났다"를 한눈에 알린다. 빌보드 인스턴스 메시 1개 = 추가 드로우콜 1개(헌법 §8).
const BURST_DUR_S = VALUES.starRender.burstDurS
const MAX_BURSTS = 32 // 동시 탄생 상한(초과분은 버스트만 생략 — 별 자체는 정상 탄생)
const BURST_BASE_SCALE = VALUES.starRender.burstBaseScale // 시작 크기(별 스케일 배수)
const BURST_GROW = VALUES.starRender.burstGrow // 수명 동안 추가로 퍼지는 배수
const BURST_FADE_GAIN = VALUES.starRender.burstFadeGain // 페이드 게인((1-age)²·gain) — 별 본체가 self-light로 어두워져 하향(spec 03)
function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3)
}

// 공명 마커(spec 36): 공명으로 이어진 별 둘레의 은은한 링이 천천히 맥동한다 — "두 우주에 걸친
// 하나의 사건"의 시각 신호. BloomPass가 nodeFrame을 우회해 TSL time 노드가 동결되므로(메모), 맥동은
// useFrame의 수동 시간으로 스케일·밝기를 직접 움직인다(time 노드 금지). reduced-motion이면 정지(고정값).
const RING_BASE_SCALE = VALUES.resonanceRing.baseScale // 별 스케일 대비 링 크기
const RING_PULSE_SCALE = VALUES.resonanceRing.pulseScale // 맥동 크기 변동폭(은은하게)
const RING_SPEED = VALUES.resonanceRing.pulseSpeed // 맥동 각속도(rad/s) — 느리게
const RING_OPACITY_MIN = VALUES.resonanceRing.opacityMin
const RING_OPACITY_AMP = VALUES.resonanceRing.opacityAmp
const MAX_RINGS = 64 // 동시 공명 마커 상한(초과분은 마커만 생략 — 별 자체는 정상)

// 부드러운 헤일로 링 텍스처(중심 투명) — 모듈 싱글턴. shadowBlur로 가장자리를 번지게 해 또렷한 선이
// 아니라 은은한 빛 고리로 읽히게 한다.
let ringTexture: THREE.CanvasTexture | null = null
function getRingTexture(): THREE.CanvasTexture | null {
  if (ringTexture || typeof document === 'undefined') return ringTexture
  const size = 128
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  if (!g) return null
  g.strokeStyle = 'rgba(255,255,255,0.95)'
  g.lineWidth = size * 0.06
  g.shadowColor = 'rgba(255,255,255,0.9)'
  g.shadowBlur = size * 0.09
  g.beginPath()
  g.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2)
  g.stroke()
  ringTexture = new THREE.CanvasTexture(c)
  return ringTexture
}

// 방사형 글로우(중심 코어) + 얇은 링(충격파) 텍스처 — 모듈 싱글턴(재생성 방지).
let burstTexture: THREE.CanvasTexture | null = null
function getBurstTexture(): THREE.CanvasTexture | null {
  if (burstTexture || typeof document === 'undefined') return burstTexture
  const size = 128
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  if (!g) return null
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.22, 'rgba(255,255,255,0.55)')
  grad.addColorStop(0.6, 'rgba(255,255,255,0.12)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  g.strokeStyle = 'rgba(255,255,255,0.5)'
  g.lineWidth = 3
  g.beginPath()
  g.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2)
  g.stroke()
  burstTexture = new THREE.CanvasTexture(c)
  return burstTexture
}

// 별 미세 부유: 각 별이 제 좌표 주변을 seed 기반의 서로 다른 주기·위상으로 떠다닌다 —
// 우주가 정지화면처럼 굳지 않는다. 수식·파라미터는 model/wobble이 단일 출처:
// SynapseFilaments의 정점 셰이더가 같은 수식으로 끝점을 움직여 연결이 별 중앙을
// 정확히 따라간다. prefers-reduced-motion이면 정지.

// Focus spotlight (11): while a star is selected, every OTHER star dims to FOCUS_DIM and the
// selected one is nudged up by FOCUS_BOOST — written to the per-instance `aFocus` factor, which
// the shader multiplies onto BOTH channels (self-glow + reflection) so dimming can't be bypassed
// (spec 03). The brightness base now lives in aGlow/aRecency, so this effect is a pure factor (no
// base recompute). Diary highlight (spec 28) reuses the SAME factor at the same strengths: the
// chosen diary's stars boost, the rest dim — only the SET (one star vs many) differs. (Focus takes
// precedence: framing a diary clears any single selection.)
const FOCUS_DIM = VALUES.focus.dim
const FOCUS_BOOST = VALUES.focus.boost

// 자아 광원(spec 03 반사 채널) 기본 위치 — 우주는 자아-별이 UniverseDrift 원점이라 [0,0,0].
// 안정 참조(매 렌더 새 배열 방지 — 아래 uniform 동기 효과의 deps 튐 방지).
const STAR_LIGHT_ORIGIN = [0, 0, 0] as const

export interface StarFieldProps {
  /** force-sim positions buffer (07/10). When absent, a dev dummy cluster is used. */
  positionsRef?: { readonly current: Float32Array | null }
  /** 별(기억) 오브제 형태(appearance.object) — 형태별 지오메트리·머티리얼로 dispatch. 기본 deepfield. */
  object?: StarObject
  /** 감정색 사용자 오버라이드(mood→"#RRGGBB", spec 30). 없는 mood는 기본 팔레트(MOOD_PALETTE). */
  emotionColors?: Record<string, string>
  /** 강조할 원본 일기 id(spec 28) — 그 일기의 별만 밝히고 나머지는 dim한다(원본 일기로 별 찾기).
   *  record_id만 받아 자기 stars 구독으로 집합을 파생한다. null = 강조 없음. */
  highlightedRecordId?: string | null
  /** 선택된 별 id(focus 머신, spec 39) — 위젯이 prop으로 내린다(엔터티는 머신을 직접 읽지 않음·
   *  props 구동). 선택된 별은 FOCUS_BOOST, 나머지는 FOCUS_DIM. null = 선택 없음. */
  selectedId?: string | null
  /** 별 탭 → 그 별 선택(위젯이 focus.SELECT_STAR로 배선). 드래그(우주 회전)는 제외(e.delta 가드). */
  onSelect?: (id: string) => void
  /** 외부 별 소스(spec 37 겹쳐보기) — 주어지면 useMemoryStore 대신 이 배열을 그린다(한 씬에 두 우주를
   *  동시 렌더하려면 싱글턴 스토어로는 불가). 미지정 시 스토어 구독(기존 단일 우주 경로 — 동작 불변).
   *  외부 소스는 정적 스냅샷이라 탄생 연출을 켜지 않는다(우주가 일괄로 펑펑 터지는 소음 방지). */
  stars?: StarNode[]
  /** 외부 엣지 소스 — 변조 감쇠(spec 26) R_conn(degree) 입력. 외부 stars와 함께 쓴다. */
  edges?: SynapseEdge[]
  /** 별 색을 이 색 쪽으로 tintStrength만큼 블렌드(spec 37 겹쳐보기 "남의 하늘" 공통 틴트) — 감정색을
   *  지우지 않고 살짝 보정만 한다. 미지정이면 무틴트(기본 단일 우주 경로는 동작 불변). */
  tint?: readonly [number, number, number]
  /** tint 블렌드 강도(0..1) — tint가 있을 때만 의미. */
  tintStrength?: number
  /** 자아 광원(spec 03 반사 채널)의 월드 위치(점광·우주=원점) 또는 방향(평행광·배경). 기본 원점.
   *  positional=1이면 위치, 0이면 방향. overlay는 그 하늘의 중심(offset)을 넘긴다. */
  selfLightPos?: readonly [number, number, number]
  /** 1=점광(거리 감쇠·자아-별), 0=평행광(우상단·배경). 기본 1(우주). */
  lightPositional?: number
  /** 반사 항 게이트(0|1) — 저사양/WebGL2는 0으로 광 연산 분기 제거. 기본 1. */
  litMix?: number
  /** spec 06(change 08): 매 프레임 갱신되는 동적 자아 광원 위치. 주어지면 useFrame이 ref.current로
   *  반사 채널 uniform만 갱신한다(React rerender 없음) — 근접 탐험에서 광원이 탐험자를 따라온다.
   *  null/미전달이면 정적 selfLightPos를 쓴다(원거리=중심 자아 광원·오버레이·배경 동일). 반사 채널만
   *  바꾸고 selfGlow/activation/λ_eff/별 색·좌표는 불변. */
  selfLightRef?: MutableRefObject<readonly [number, number, number] | null>
}

export function StarField({
  positionsRef,
  object = DEFAULT_OBJECT,
  emotionColors,
  highlightedRecordId = null,
  selectedId = null,
  onSelect,
  stars: externalStars,
  edges: externalEdges,
  tint,
  tintStrength = 0,
  selfLightPos = STAR_LIGHT_ORIGIN,
  lightPositional = 1,
  litMix = 1,
  selfLightRef,
}: StarFieldProps) {
  const storeStars = useMemoryStore((s) => s.stars)
  // 외부 소스(겹쳐보기)면 그것을, 아니면 스토어를 그린다. external=true면 탄생 연출·loadedEmpty 게이트를 끈다.
  const stars = externalStars ?? storeStars
  const external = externalStars !== undefined
  const count = stars.length
  // 강조 일기의 별 id 집합 — record_id로 그룹(spec 28). 선택 변경/별 집합 변경 시에만 재계산.
  const highlightedIds = useMemo(
    () =>
      highlightedRecordId
        ? new Set(starsOfRecord(stars, highlightedRecordId).map((s) => s.id))
        : null,
    [highlightedRecordId, stars],
  )
  // 변조 감쇠(spec 26)의 R_conn 입력: 별별 degree를 우주 중앙값으로 정규화한 맵. degree는
  // 어떤 PAIR가 존재하느냐(토폴로지)에만 의존하므로 토폴로지 시그니처로 메모해, 시간 머신의
  // refreshActivation이 밝기 재파생만을 위해 엣지 배열을 갈아끼우는 동안(spec 19) 아래 빌드
  // 효과가 헛돌지 않게 한다(같은 pair 집합 → 같은 맵 identity → rebuild 미발화).
  const storeEdges = useSynapseStore((s) => s.edges)
  const edges = externalEdges ?? storeEdges
  const edgeTopo = useMemo(() => edges.map((e) => `${e.aId}~${e.bId}`).join(','), [edges])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the pair set, not the array identity
  const degreeNorm = useMemo(() => degreeNormById(edges), [edgeTopo])
  // self-glow 연결성(spec 03) Σweight 항: degree와 달리 weight에도 의존하므로 weight 포함 시그니처로 메모
  // (회상 강화로 weight가 바뀌면 글로우도 갱신). 2자리 양자화로 미세 변동에 헛돌지 않게.
  const edgeWTopo = useMemo(() => edges.map((e) => `${e.aId}~${e.bId}:${e.weight.toFixed(2)}`).join(','), [edges])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the weight-inclusive signature
  const weightedDegreeNorm = useMemo(() => weightedDegreeById(edges), [edgeWTopo])
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const scalesRef = useRef<Float32Array>(new Float32Array(0))
  // 탄생 추적: 더미 좌표 보존(버퍼 없는 셸에서 탄생 중 별의 행렬을 다시 쓰기 위해) +
  // 본 적 있는 id 집합 + 탄생 중 id → 시작 시각(elapsed; -1은 "다음 프레임에 시작" 마커).
  const dummyRef = useRef<Float32Array>(new Float32Array(0))
  const seenRef = useRef<Set<string>>(new Set())
  const spawnRef = useRef<Map<string, number>>(new Map())
  // 탄생 버스트 추적(스케일 탄생과 분리 — 수명이 다르다) + mood 색 배열 + id→슬롯 맵
  // (버스트 루프가 전체 별이 아니라 활성 버스트만 돌게).
  const burstRef = useRef<THREE.InstancedMesh>(null)
  const burstsRef = useRef<Map<string, number>>(new Map())
  const moodsRef = useRef<Float32Array>(new Float32Array(0))
  const indexByIdRef = useRef<Map<string, number>>(new Map())
  // 공명 마커(spec 36): 공명 별의 인스턴스 슬롯 목록(레이아웃 효과가 채움 — 매 프레임 전체 스캔 방지)
  // + 빌보드 링 메시.
  const ringRef = useRef<THREE.InstancedMesh>(null)
  const resonantIdxRef = useRef<number[]>([])

  // 선택된 형태(object)별 공유 지오메트리 + TSL 머티리얼. 모든 인스턴스가 하나를 공유하므로
  // 형태 변경은 O(1)(메시 1개 재구성) — 드로우콜은 그대로다(constitution §8). 입력을 per-instance
  // attribute(aMood/aBrightness/aSeed/aHueShift)로 바인딩해 별-바디 프리미티브(star-body)를 소비하고,
  // 공유 시간 uniform은 StarField가 소유해 useFrame에서 .value를 올린다(form 애니메이션 구동).
  // 시간 갱신은 update 클로저로 감싼다 — uniform .value 변경을 클로저 안에 두어 useFrame이 render-local을
  // 직접 만지지 않게 한다(react-hooks 룰; Star3D와 동일 관용구). uniform 소유는 여전히 소비처(StarField).
  const { geometry, material, update, setLight } = useMemo(() => {
    const t = uniform(0)
    // 자아 광원 uniform(전 인스턴스 공유): 위치/방향 · positional · litMix. 값은 props에서 아래 효과가 동기.
    const selfPosU = uniform(new THREE.Vector3(0, 0, 0))
    const positionalU = uniform(1)
    const litMixU = uniform(1)
    const built = buildStarBody(
      object,
      {
        mood: attribute('aMood', 'vec3'),
        glow: attribute('aGlow', 'float'), // 자가발광=연결성(selfGlow, A_MIN 바닥은 attribute 계산에서)
        recency: attribute('aRecency', 'float'), // 반사 변조=최근성
        seed: attribute('aSeed', 'float'),
        hueShift: attribute('aHueShift', 'float'),
        time: t,
        selfLightPos: selfPosU,
        lightPositional: positionalU,
        litMix: litMixU,
        focus: attribute('aFocus', 'float'), // 포커스 디밍/부스트(두 채널 공통)
      },
      {
        intensity: VALUES.starLighting.selfIntensity,
        distance: VALUES.starLighting.selfDistance,
        decay: VALUES.starLighting.selfDecay,
        gain: VALUES.starLighting.litAlbedoGain,
      },
    )
    const update = (time: number) => {
      t.value = time
    }
    // 광원 uniform 변경도 클로저 안에 둔다(update와 동일 관용구) — effect가 메모된 uniform을 직접 만지지
    // 않게(react-compiler 규칙). 정적이라 매 프레임 아닌 prop 동기 effect에서 호출.
    const setLight = (pos: readonly [number, number, number], positional: number, mix: number) => {
      selfPosU.value.set(pos[0], pos[1], pos[2])
      positionalU.value = positional
      litMixU.value = mix
    }
    return { geometry: built.geometry, material: built.material, update, setLight }
  }, [object])
  // 자아 광원 uniform을 props로 동기(씬마다 위치/방향·점광/평행광·게이트가 다름). 정적이라 effect로 충분.
  useEffect(() => {
    setLight(selfLightPos, lightPositional, litMix)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 배열 원소로 분해 의존(참조 변동 무시)
  }, [setLight, selfLightPos[0], selfLightPos[1], selfLightPos[2], lightPositional, litMix])
  // 형태가 바뀌면 직전 지오메트리·머티리얼을 해제(GPU 누수 방지).
  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  // 탄생 버스트용 빌보드 쿼드 + additive 머티리얼(컴포넌트 수명 동안 1회 생성).
  const burst = useMemo(
    () => ({
      geometry: new THREE.PlaneGeometry(1, 1),
      material: new THREE.MeshBasicMaterial({
        map: getBurstTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    }),
    [],
  )
  useEffect(() => () => {
    burst.geometry.dispose()
    burst.material.dispose()
  }, [burst])

  // 공명 마커용 빌보드 쿼드 + additive 머티리얼(컴포넌트 수명 동안 1회). 색은 per-instance
  // instanceColor로 mood 색을 입혀 맥동시킨다(별색 = 그 별의 감정색).
  const ring = useMemo(
    () => ({
      geometry: new THREE.PlaneGeometry(1, 1),
      material: new THREE.MeshBasicMaterial({
        map: getRingTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    }),
    [],
  )
  useEffect(() => () => {
    ring.geometry.dispose()
    ring.material.dispose()
  }, [ring])

  // (Re)build per-instance attributes + base matrices when the star set changes.
  // useLayoutEffect runs in the commit phase (before the first R3F frame), so the
  // attributes are bound before the material first renders. Date.now() here is fine
  // (effect, not render).
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh || count === 0) {
      // 우주가 비워지면(출처 리셋) 탄생 추적도 초기화 — 재시드가 일괄 탄생 연출이 되지 않게.
      seenRef.current = new Set()
      spawnRef.current.clear()
      burstsRef.current.clear()
      return
    }
    // 새로 생긴 별만 탄생 대상으로 표시. 첫 시드(seen 비어 있음)는 제외하되, "빈 우주를
    // 이미 확인한"(loadedEmpty) 뒤의 첫 도착 — 신규 유저의 첫 일기 — 은 진짜 탄생이다.
    const seen = seenRef.current
    // 외부 소스(겹쳐보기)는 정적 스냅샷 — 탄생 연출을 켜지 않는다(seen만 채워 정리 로직은 유지).
    if (!external && (seen.size > 0 || useMemoryStore.getState().loadedEmpty)) {
      for (const s of stars) {
        if (!seen.has(s.id)) {
          spawnRef.current.set(s.id, -1)
          burstsRef.current.set(s.id, -1)
        }
      }
    }
    seenRef.current = new Set(stars.map((s) => s.id))
    indexByIdRef.current = new Map(stars.map((s, i) => [s.id, i]))
    // 별 집합에서 빠진 id의 탄생 추적은 정리 — 만료가 별 루프에 묶여 있어 그대로 두면
    // bursts.size가 0으로 못 돌아가 정적 장면 최적화가 영영 깨진다.
    for (const id of spawnRef.current.keys()) if (!seenRef.current.has(id)) spawnRef.current.delete(id)
    for (const id of burstsRef.current.keys()) if (!seenRef.current.has(id)) burstsRef.current.delete(id)

    // 공명 별 슬롯 목록을 다시 만든다(매 프레임 전체 스캔 대신 이 작은 배열만 순회). 공명은 드물어
    // 대개 빈 배열 → 링 루프가 사실상 무비용.
    const resonantIdx: number[] = []

    const moodArr = new Float32Array(count * 3)
    const seedArr = new Float32Array(count)
    const glowArr = new Float32Array(count) // 자가발광=연결성(selfGlow, A_MIN 바닥)
    const recencyArr = new Float32Array(count) // 반사 변조=최근성(activation)
    const focusArr = new Float32Array(count).fill(1) // 포커스 배율(아래 focus effect가 갱신; 기본 1)
    // 재공고화 색조(spec 23): hueShift(도)를 라디안으로 — 머티리얼이 mood 색을 회색축
    // 둘레로 그만큼 돌린다. 기본 0 → 회전 없음(기존 별 무변).
    const hueArr = new Float32Array(count)
    const scales = new Float32Array(count)
    const dummy = new Float32Array(count * 3)
    // 가상 시계(spec 19): 데모 시간 머신이 흘린 시간만큼 감쇠가 진행된 밝기로 그린다.
    // 비데모에선 Date.now()와 동일값.
    const now = virtualNowMs()
    const obj = new THREE.Object3D()

    for (let i = 0; i < count; i++) {
      const m = stars[i].memory
      if (m.resonant) resonantIdx.push(i) // 36: 공명 마커 대상
      const rgb = resolveMoodRgb(m.mood, emotionColors)
      // spec 37 겹쳐보기 틴트: 감정색을 공통 atmosphere 색 쪽으로 tintStrength만큼만 끌어당긴다(보정).
      // tint 미지정(기본 단일 우주)이면 ts=0 → 원색 그대로.
      const ts = tint ? tintStrength : 0
      moodArr[i * 3] = rgb[0] + (tint ? (tint[0] - rgb[0]) * ts : 0)
      moodArr[i * 3 + 1] = rgb[1] + (tint ? (tint[1] - rgb[1]) * ts : 0)
      moodArr[i * 3 + 2] = rgb[2] + (tint ? (tint[2] - rgb[2]) * ts : 0)
      // 재성형 합성(spec 23): 형태 시드·밝기는 누적 재공고화 상태를 더한 유효값으로,
      // 색조는 라디안 attribute로 머티리얼에 넘긴다. 기본 0이면 기존 별과 동일.
      // 밝기는 변조 감쇠(spec 26): 연결(R_conn)·요즘 관련성(R_recent)·감정(R_emo)으로 별마다
      // λ_eff가 달라 — 연결 많고 요즘과 닿고 감정 강한 별일수록 천천히 어두워진다.
      seedArr[i] = reshapedSeed(m.seed, m.formSeedDelta)
      // 자가발광(spec 03): 연결성(degree + Σweight) 구동 self-glow가 λ_glow로 감쇠, +reshape offset,
      // A_MIN 바닥(reshapedBrightness가 clamp(.,A_MIN,1)로 OUTERMOST 적용). 연결 0이어도 ≥A_MIN 잔광(헌법2).
      glowArr[i] = reshapedBrightness(
        selfGlow(
          m.lastRecalledAt,
          now,
          degreeNorm.get(stars[i].id) ?? 0,
          weightedDegreeNorm.get(stars[i].id) ?? 0,
          m.relevance,
          m.intensity,
          m.valence,
        ),
        m.brightnessOffset,
      )
      // 반사 변조(spec 03): 최근성 — 가까운(중앙=최근/회상) 별일수록 자아광 반사가 밝다(위치=spec 38 광학 읽기).
      recencyArr[i] = activation(m.lastRecalledAt, now)
      hueArr[i] = (m.hueShift * Math.PI) / 180
      scales[i] = sizeFor(m.intensity)

      // Deterministic fibonacci-sphere dummy layout (shared with the camera fly-to so
      // they agree on each star's position — 12). Radius varies by seed.
      const [px, py, pz] = fibonacciStarPosition(i, count, m.seed)
      dummy[i * 3] = px
      dummy[i * 3 + 1] = py
      dummy[i * 3 + 2] = pz

      obj.position.set(px, py, pz)
      // 탄생 대기 중인 별은 0에 가깝게 시작 — useFrame이 easeOutBack으로 키운다.
      obj.scale.setScalar(scales[i] * (spawnRef.current.has(stars[i].id) ? 1e-3 : 1))
      obj.updateMatrix()
      mesh.setMatrixAt(i, obj.matrix)
    }

    geometry.setAttribute('aMood', new THREE.InstancedBufferAttribute(moodArr, 3))
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedArr, 1))
    geometry.setAttribute('aGlow', new THREE.InstancedBufferAttribute(glowArr, 1))
    geometry.setAttribute('aRecency', new THREE.InstancedBufferAttribute(recencyArr, 1))
    geometry.setAttribute('aFocus', new THREE.InstancedBufferAttribute(focusArr, 1))
    geometry.setAttribute('aHueShift', new THREE.InstancedBufferAttribute(hueArr, 1))
    scalesRef.current = scales
    dummyRef.current = dummy
    moodsRef.current = moodArr
    resonantIdxRef.current = resonantIdx
    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
  }, [stars, count, geometry, emotionColors, degreeNorm, weightedDegreeNorm, external, tint, tintStrength])

  // Focus spotlight: re-weight aBrightness when the selection (or star set / form) changes —
  // selected boosted, all others dimmed; full brightness restored when nothing is selected. Reads
  // the attribute the layout effect built (so it re-applies after a rebuild) and re-uploads only
  // that one buffer; if a form's attr layout ever lacks it, this safely no-ops.
  useEffect(() => {
    const attr = geometry.getAttribute('aFocus') as THREE.InstancedBufferAttribute | undefined
    if (!attr || count === 0) return
    const selIdx = selectedId ? stars.findIndex((s) => s.id === selectedId) : -1
    // 일기 조망 강조(spec 28): 단일 선택이 없을 때만 적용(선택=근접 포커스가 우선). 강조 집합의
    // 별은 FOCUS_BOOST로 밝히고 나머지는 FOCUS_DIM(잠든 별 dust dimming과 같은 시각 언어).
    const hi = selIdx < 0 && highlightedIds && highlightedIds.size > 0 ? highlightedIds : null
    const arr = attr.array as Float32Array
    for (let i = 0; i < count; i++) {
      // 순수 배율만(밝기 base는 aGlow/aRecency가 소유 — 셰이더가 (self-glow+reflection)·aFocus로 합성).
      let factor = 1
      if (selIdx >= 0) factor = i === selIdx ? FOCUS_BOOST : FOCUS_DIM
      else if (hi) factor = hi.has(stars[i].id) ? FOCUS_BOOST : FOCUS_DIM
      arr[i] = factor
    }
    attr.needsUpdate = true
    // deps에 layout 효과의 재빌드 트리거(emotionColors·degreeNorm·weightedDegreeNorm·external·tint·
    // tintStrength)도 포함 — layout 효과가 재빌드 시 aFocus를 1로 리셋하므로, 그 뒤 디밍/부스트를 다시
    // 적용해야 한다(선택 변경뿐 아니라 어떤 재빌드 후에도). 안 그러면 선택 중 가중치/색 변경 시 포커스가 풀린다.
  }, [selectedId, highlightedIds, stars, count, geometry, emotionColors, degreeNorm, weightedDegreeNorm, external, tint, tintStrength])

  // Per-frame matrix write: LIVE force-sim positions (07/10) 또는 더미 좌표 위에 별 미세
  // 부유(WOBBLE_AMP)와 탄생 스케일을 얹는다. No setState → no re-render (1.6).
  // reduced-motion + 버퍼·탄생 없음이면 정적 장면을 매 프레임 다시 올리지 않는다.
  const scratch = useMemo(() => new THREE.Object3D(), [])
  // 버스트 전용 스크래치 — scratch와 분리(빌보드가 쿼터니언을 만지므로 별 행렬이 오염되지 않게).
  const burstScratch = useMemo(() => new THREE.Object3D(), [])
  const burstColor = useMemo(() => new THREE.Color(), [])
  // 공명 링 전용 스크래치(빌보드 쿼터니언을 만지므로 별 행렬과 분리).
  const ringScratch = useMemo(() => new THREE.Object3D(), [])
  const ringColor = useMemo(() => new THREE.Color(), [])
  const reduceMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  useFrame((state) => {
    // 형태 애니메이션용 시간 전진(liquid 출렁임 / ember 깜빡임 / aurora 흐름). 위치 버퍼가 없어도
    // 매 프레임 올려야 하므로 아래 early-return보다 먼저 둔다.
    update(state.clock.elapsedTime)
    // spec 06(change 08): 동적 자아 광원 — 주어지면 매 프레임 반사 채널 uniform만 갱신(근접 탐험에서
    // 광원이 탐험자를 따라온다). 반사 항만 바뀌고 selfGlow/activation/별 색·좌표는 불변(채널 경계).
    if (selfLightRef?.current) setLight(selfLightRef.current, lightPositional, litMix)
    const mesh = meshRef.current
    if (!mesh || count === 0) return
    const scales = scalesRef.current
    const t = state.clock.elapsedTime
    const spawns = spawnRef.current
    // -1 마커(레이아웃에서 표시)는 첫 프레임의 elapsed로 확정.
    if (spawns.size > 0) for (const [id, t0] of spawns) if (t0 < 0) spawns.set(id, t)
    /** 탄생 스케일 배율(easeOutBack 0→1, 완료 시 추적 해제). 추적에 없으면 1. */
    const birthFactor = (id: string): number => {
      const t0 = spawns.get(id)
      if (t0 == null) return 1
      const age = (t - t0) / BIRTH_DUR_S
      if (age >= 1) {
        spawns.delete(id)
        return 1
      }
      return Math.max(1e-3, easeOutBack(age))
    }

    const buf = positionsRef?.current
    const live = buf && buf.length >= count * 3 ? buf : null
    const base = live ?? dummyRef.current
    if (base.length < count * 3 || scales.length < count) return
    const wob = reduceMotion ? 0 : WOBBLE_AMP
    const bursts = burstsRef.current
    if (reduceMotion) bursts.clear() // 모션 축소: 탄생 버스트도 생략
    // 움직일 것이 하나도 없으면(모션 축소 + 라이브 버퍼·탄생·공명 마커 없음) 정적 유지. ⚠️ 공명
    // 마커가 있으면 일찍 빠지지 않는다 — 아래 링 루프가 마커를 (reduced-motion이면 정지값으로라도)
    // 그리고 count/visible을 갱신해야 하므로(라이브 버퍼 발행 전 프레임에 마커가 누락·잔류하지 않게).
    if (wob === 0 && !live && spawns.size === 0 && bursts.size === 0 && resonantIdxRef.current.length === 0)
      return

    for (let i = 0; i < count; i++) {
      const m = stars[i].memory
      // seed(0..1) 기반의 별마다 다른 주기·위상 — 같은 별은 항상 같은 궤적(결정론).
      scratch.position.set(
        base[i * 3] + wobbleUnit(m.seed, t, 0) * wob,
        base[i * 3 + 1] + wobbleUnit(m.seed, t, 1) * wob,
        base[i * 3 + 2] + wobbleUnit(m.seed, t, 2) * wob,
      )
      scratch.scale.setScalar(scales[i] * birthFactor(stars[i].id))
      scratch.updateMatrix()
      mesh.setMatrixAt(i, scratch.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true

    // 공명 마커(spec 36): 공명 별 둘레에 mood 색 링을 빌보드로 그리고 천천히 맥동시킨다(수동 시간 —
    // time 노드 금지). reduced-motion이면 맥동 정지(고정값). 공명 별은 드물어 대개 0개 = 무비용.
    const ringMesh = ringRef.current
    if (ringMesh) {
      const resonant = resonantIdxRef.current
      const moods = moodsRef.current
      let slot = 0
      if (resonant.length > 0 && moods.length >= count * 3) {
        for (const i of resonant) {
          if (slot >= MAX_RINGS) break
          if (i >= count) continue
          const m = stars[i].memory
          // per-star 위상(seed)로 별마다 어긋난 맥동 — 한꺼번에 깜빡이지 않게.
          const pulse = reduceMotion ? 0.6 : 0.5 + 0.5 * Math.sin(t * RING_SPEED + m.seed * Math.PI * 2)
          ringScratch.position.set(
            base[i * 3] + wobbleUnit(m.seed, t, 0) * wob,
            base[i * 3 + 1] + wobbleUnit(m.seed, t, 1) * wob,
            base[i * 3 + 2] + wobbleUnit(m.seed, t, 2) * wob,
          )
          ringScratch.quaternion.copy(state.camera.quaternion) // billboard
          ringScratch.scale.setScalar(scales[i] * RING_BASE_SCALE * (1 + RING_PULSE_SCALE * pulse))
          ringScratch.updateMatrix()
          ringMesh.setMatrixAt(slot, ringScratch.matrix)
          const op = RING_OPACITY_MIN + RING_OPACITY_AMP * pulse
          ringColor.setRGB(moods[i * 3] * op, moods[i * 3 + 1] * op, moods[i * 3 + 2] * op)
          ringMesh.setColorAt(slot, ringColor)
          slot++
        }
      }
      ringMesh.count = slot
      ringMesh.visible = slot > 0
      if (slot > 0) {
        ringMesh.instanceMatrix.needsUpdate = true
        if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true
      }
    }

    // 탄생 버스트: 활성 버스트만(전체 별이 아니라) 빌보드 슬롯에 채운다 — 별과 같은
    // 좌표(wobble 포함)에서 mood 색 글로우가 퍼지며 (1-age)²로 사그라든다(additive라
    // 색→검정 = 페이드아웃). 별 집합에 없는 id는 레이아웃 효과가 이미 정리했다.
    const burstMesh = burstRef.current
    if (burstMesh) {
      const moods = moodsRef.current
      const indexById = indexByIdRef.current
      let slot = 0
      if (bursts.size > 0 && moods.length >= count * 3) {
        for (const [id, marked] of bursts) {
          if (slot >= MAX_BURSTS) break
          const i = indexById.get(id)
          if (i == null || i >= count) {
            bursts.delete(id)
            continue
          }
          let t0 = marked
          if (t0 < 0) {
            t0 = t // -1 마커는 첫 프레임의 elapsed로 확정(스케일 탄생과 동일 규약)
            bursts.set(id, t)
          }
          const age = (t - t0) / BURST_DUR_S
          if (age >= 1) {
            bursts.delete(id)
            continue
          }
          const m = stars[i].memory
          burstScratch.position.set(
            base[i * 3] + wobbleUnit(m.seed, t, 0) * wob,
            base[i * 3 + 1] + wobbleUnit(m.seed, t, 1) * wob,
            base[i * 3 + 2] + wobbleUnit(m.seed, t, 2) * wob,
          )
          burstScratch.quaternion.copy(state.camera.quaternion) // billboard
          burstScratch.scale.setScalar(
            scales[i] * (BURST_BASE_SCALE + BURST_GROW * easeOutCubic(age)),
          )
          burstScratch.updateMatrix()
          burstMesh.setMatrixAt(slot, burstScratch.matrix)
          const fade = (1 - age) * (1 - age) * BURST_FADE_GAIN
          burstColor.setRGB(moods[i * 3] * fade, moods[i * 3 + 1] * fade, moods[i * 3 + 2] * fade)
          burstMesh.setColorAt(slot, burstColor)
          slot++
        }
      }
      burstMesh.count = slot
      burstMesh.visible = slot > 0
      if (slot > 0) {
        burstMesh.instanceMatrix.needsUpdate = true
        if (burstMesh.instanceColor) burstMesh.instanceColor.needsUpdate = true
      }
    }
  })

  if (count === 0) return null
  // key=`${object}-${count}` → 형태(object)나 개수(count)가 바뀌면 새 지오메트리·count에 맞춰
  // instanceMatrix를 깨끗이 다시 만든다. onClick → 그 별 선택(raycast가 인스턴스 슬롯을 준다);
  // 회상 기능(11)이 selectedId에 반응. stopPropagation으로 가장 가까운 별만 집힌다.
  return (
    <>
      <instancedMesh
        key={`${object}-${count}`}
        ref={meshRef}
        args={[geometry, material, count]}
        // 지오메트리·머티리얼은 위 useEffect가 직접 해제하므로 R3F 자동 해제를 끈다(이중 해제 방지).
        dispose={null}
        onClick={(e) => {
          e.stopPropagation()
          // 드래그(우주 회전)면 선택이 아니다 — 탭만 별을 연다. R3F가 e.delta에 down↔up 이동거리(px)를
          // 채우므로, 우주를 끌어 돌리다 손을 뗀 별은 선택되지 않는다(NebulaOrbitController 드래그
          // 데드존 8px과 같은 기준). 없으면 raycast가 down 시점 히트로 onClick을 쏴 별이 잘못 선택된다.
          if (e.delta > 8) return
          if (e.instanceId == null) return
          const node = stars[e.instanceId]
          if (node) onSelect?.(node.id)
        }}
      />
      {/* 탄생 버스트 레이어 — 클릭은 별이 받아야 하므로 raycast를 끈다. 행렬이 매 프레임
          갱신되는 빌보드라 frustumCulled를 꺼서(기본 바운딩이 plane 1×1) 오컬링을 막는다. */}
      <instancedMesh
        ref={burstRef}
        args={[burst.geometry, burst.material, MAX_BURSTS]}
        dispose={null}
        visible={false}
        frustumCulled={false}
        raycast={NOOP_RAYCAST}
      />
      {/* 공명 마커 레이어(spec 36) — 빌보드 링. 별 클릭을 가리지 않게 raycast를 끄고, 매 프레임
          갱신되는 빌보드라 frustumCulled를 끈다. */}
      <instancedMesh
        ref={ringRef}
        args={[ring.geometry, ring.material, MAX_RINGS]}
        dispose={null}
        visible={false}
        frustumCulled={false}
        raycast={NOOP_RAYCAST}
      />
    </>
  )
}
