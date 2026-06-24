// Star visualization (spec 08 / change 29, Architecture §3.3): every star drawn by an InstancedMesh
// per **abstraction-stage bucket** of the chosen look — constitution §8 (amended): not ONE mesh but a
// small FIXED set (≤ look-count × stage-levels; here 1 global look × 5 stages = ≤5 meshes), so a star's
// discrete stage geometry (polyhedron 20→12→8→4 faces, hedgehog spikes thinning, liquid→cloud) is real
// geometry, not an in-shader fake — while draw calls stay bounded (independent of star count). Per-instance
// color/brightness/seed come from InstancedBufferAttributes; size (=f(intensity)) is baked into the
// instance matrix scale. Coordinates update in useFrame from the live force-sim buffer (07/22) with NO
// React re-render (constitution §3); a deterministic fibonacci dummy stands in before the buffer is ready.
// Birth/burst/resonance billboard layers stay global (one each), indexed by global star index. This is the
// only place three/TSL appears; the model layer stays pure.
import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { attribute, uniform } from 'three/tsl'
import { asVec4Node } from '@/shared/lib/r3f'
import { starGlow, reshapedBrightness, reshapedShapeSeed, starsOfRecord, useMemoryStore, type StarNode } from '@/entities/memory/@x/star'
import { degreeNormById, weightedDegreeById, useSynapseStore, type SynapseEdge } from '@/entities/synapse/@x/star'
import { virtualNowMs } from '@/shared/lib/demo'
import { WOBBLE_AMP, wobbleUnit } from '../model/wobble'
import { DEFAULT_STAR_SELECTION, parseStarLook } from '../model/forms'
import { resolveMoodRgb } from '@/shared/config'
import { VALUES } from '@/shared/config'
import { fibonacciStarPosition } from '@/shared/lib'
import { buildStarBody, type StarFormParams } from './star-body'

/** intensity (0..1) → instance scale. */
function sizeFor(intensity: number): number {
  return VALUES.starRender.sizeBase + Math.max(0, Math.min(1, intensity)) * VALUES.starRender.sizeRange
}

// 추상화 단계(change 29): abstraction_stage ∈ 0..STAGE_MAX(= 야간 요지 임계 개수). 별을 단계별 버킷으로 나눠
// 단계마다 다른 지오메트리(buildStarBody(look, stage))의 InstancedMesh로 렌더한다. 메시 수 = STAGE_LEVELS 상수
// (별 수와 무관 — 헌법8 정신 보존). stageMax는 buildStarBody의 단계 정규화 분모로도 쓴다.
const STAGE_MAX = VALUES.consolidation.gistStageRadii.length // 4
const STAGE_LEVELS = STAGE_MAX + 1 // 단계 0..STAGE_MAX = 5 버킷
const sf = VALUES.starForm
const spikySpikes = sf.spikySpikes as readonly number[]
const spikyLen = sf.spikyLen as readonly number[]
const liquidOpacity = sf.liquidOpacity as readonly number[]
/** 별 abstraction_stage → 단계 버킷 인덱스(0..STAGE_MAX). */
function stageBucket(stage: number): number {
  return Math.max(0, Math.min(STAGE_MAX, Math.round(stage)))
}
/** buildStarBody에 넘길 단계별 형태 파라미터 — 배열 노브를 그 단계로 인덱싱해 해석된 스칼라로 준다(별 빌더는
 *  배열·values를 모른다). 단계 범위를 벗어나면 마지막 값으로 클램프(가시 0·최저 투명). */
function formParamsFor(stage: number): StarFormParams {
  const at = (a: readonly number[]) => a[Math.min(stage, a.length - 1)] ?? 0
  return {
    displaceAmp: sf.displaceAmp,
    detailAmp: sf.detailAmp,
    asymmetry: sf.asymmetry,
    stageSimplify: sf.stageSimplify,
    stageMax: STAGE_MAX,
    spikes: at(spikySpikes),
    spikeLen: at(spikyLen),
    spikeSharpness: sf.spikySharpness,
    spikeDetail: sf.spikyDetail,
    opacityFloor: at(liquidOpacity),
  }
}

/** 버스트 레이어는 클릭 대상이 아니다 — raycast 무력화로 별 클릭이 가려지지 않게. */
const NOOP_RAYCAST = () => undefined

// 별 탄생 애니메이션: 새로 생긴 별은 한 점에서 살짝 튀어 오르며(easeOutBack) 정상 크기로 자라난다. 첫 로드/출처
// 리셋의 일괄 시드는 애니메이션하지 않는다(우주 전체가 펑펑 터지면 소음이다).
const BIRTH_DUR_S = VALUES.starRender.birthDurS
function easeOutBack(x: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

// 탄생 버스트: 새 별 자리에서 mood 색의 발광 디스크+링이 빠르게 퍼지며 사그라든다(additive). 빌보드 인스턴스
// 메시 1개 = 추가 드로우콜 1개(헌법 §8).
const BURST_DUR_S = VALUES.starRender.burstDurS
const MAX_BURSTS = 32 // 동시 탄생 상한(초과분은 버스트만 생략 — 별 자체는 정상 탄생)
const BURST_BASE_SCALE = VALUES.starRender.burstBaseScale
const BURST_GROW = VALUES.starRender.burstGrow
const BURST_FADE_GAIN = VALUES.starRender.burstFadeGain
function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3)
}

// 공명 마커(spec 36): 공명으로 이어진 별 둘레의 은은한 링이 천천히 맥동한다. BloomPass가 nodeFrame을 우회해 TSL
// time이 동결되므로 맥동은 useFrame의 수동 시간으로 직접 움직인다. reduced-motion이면 정지.
const RING_BASE_SCALE = VALUES.resonanceRing.baseScale
const RING_PULSE_SCALE = VALUES.resonanceRing.pulseScale
const RING_SPEED = VALUES.resonanceRing.pulseSpeed
const RING_OPACITY_MIN = VALUES.resonanceRing.opacityMin
const RING_OPACITY_AMP = VALUES.resonanceRing.opacityAmp
const MAX_RINGS = 64

// 부드러운 헤일로 링 텍스처(중심 투명) — 모듈 싱글턴.
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

// 방사형 글로우(중심 코어) + 얇은 링(충격파) 텍스처 — 모듈 싱글턴.
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

// Focus spotlight (11): while a star is selected, every OTHER star dims to FOCUS_DIM and the selected one
// boosts — written to the per-instance `aFocus` factor (now per stage-bucket), which the shader multiplies
// onto BOTH channels (self-glow + reflection). Diary highlight (spec 28) reuses the SAME factor.
const FOCUS_DIM = VALUES.focus.dim
const FOCUS_BOOST = VALUES.focus.boost

// 자아 광원(spec 03 반사 채널) 기본 위치 — 우주는 자아-별이 UniverseDrift 원점이라 [0,0,0]. 안정 참조.
const STAR_LIGHT_ORIGIN = [0, 0, 0] as const

export interface StarFieldProps {
  /** force-sim positions buffer (07/10). When absent, a dev dummy cluster is used. */
  positionsRef?: { readonly current: Float32Array | null }
  /** 별(기억) 스킨 선택(appearance.object) — 단일 축 룩 id(change 29). 미지/레거시는 디폴트 룩으로 폴백. */
  object?: string
  /** 감정색 사용자 오버라이드(mood→"#RRGGBB", spec 30). */
  emotionColors?: Record<string, string>
  /** 강조할 원본 일기 id(spec 28) — 그 일기의 별만 밝히고 나머지는 dim한다. null = 강조 없음. */
  highlightedRecordId?: string | null
  /** 선택된 별 id(focus 머신, spec 39). 선택된 별은 FOCUS_BOOST, 나머지는 FOCUS_DIM. null = 선택 없음. */
  selectedId?: string | null
  /** 별 탭 → 그 별 선택. 드래그(우주 회전)는 제외(e.delta 가드). */
  onSelect?: (id: string) => void
  /** 외부 별 소스(spec 37 겹쳐보기). 미지정 시 스토어 구독(기존 단일 우주 경로). 외부 소스는 정적 스냅샷이라 탄생 연출 끔. */
  stars?: StarNode[]
  /** 외부 엣지 소스 — 변조 감쇠(spec 26) R_conn(degree) 입력. */
  edges?: SynapseEdge[]
  /** 별 색을 이 색 쪽으로 tintStrength만큼 블렌드(spec 37 공통 틴트). */
  tint?: readonly [number, number, number]
  /** tint 블렌드 강도(0..1). */
  tintStrength?: number
  /** 자아 광원(spec 03 반사 채널)의 월드 위치(점광·우주=원점) 또는 방향(평행광·배경). 기본 원점. */
  selfLightPos?: readonly [number, number, number]
  /** 1=점광(거리 감쇠·자아-별), 0=평행광(우상단·배경). 기본 1(우주). */
  lightPositional?: number
  /** 반사 항 게이트(0|1). 기본 1. */
  litMix?: number
  /** 매 프레임 갱신되는 동적 자아 광원 위치(근접 탐험에서 광원이 탐험자를 따라온다). */
  selfLightRef?: MutableRefObject<readonly [number, number, number] | null>
  /** 광원이 매 프레임 카메라 위치를 따라간다(헤드램프). 메인 우주 far-view만 켠다. */
  cameraLight?: boolean
}

export function StarField({
  positionsRef,
  object = DEFAULT_STAR_SELECTION,
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
  cameraLight = false,
}: StarFieldProps) {
  const storeStars = useMemoryStore((s) => s.stars)
  const stars = externalStars ?? storeStars
  const external = externalStars !== undefined
  const count = stars.length
  const look = parseStarLook(object)
  const highlightedIds = useMemo(
    () =>
      highlightedRecordId
        ? new Set(starsOfRecord(stars, highlightedRecordId).map((s) => s.id))
        : null,
    [highlightedRecordId, stars],
  )
  const storeEdges = useSynapseStore((s) => s.edges)
  const edges = externalEdges ?? storeEdges
  const edgeTopo = useMemo(() => edges.map((e) => `${e.aId}~${e.bId}`).join(','), [edges])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the pair set, not the array identity
  const degreeNorm = useMemo(() => degreeNormById(edges), [edgeTopo])
  const edgeWTopo = useMemo(() => edges.map((e) => `${e.aId}~${e.bId}:${e.weight.toFixed(2)}`).join(','), [edges])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the weight-inclusive signature
  const weightedDegreeNorm = useMemo(() => weightedDegreeById(edges), [edgeWTopo])

  // 단계 버킷 메시 refs(STAGE_LEVELS개, 고정 길이). 탄생/좌표/공명 추적은 글로벌(별 인덱스 기준).
  const meshRefs = useRef<(THREE.InstancedMesh | null)[]>([])
  // 별 글로벌 인덱스 → {stage 버킷, 그 버킷 내 slot}. focus·useFrame·raycast가 글로벌↔버킷 슬롯을 잇는다.
  const placementRef = useRef<{ stage: number; slot: number }[]>([])
  // 버킷별 멤버 글로벌 인덱스 목록(slot → global i). useFrame이 버킷별로 좌표를 쓴다.
  const membersRef = useRef<number[][]>([])
  const scalesRef = useRef<Float32Array>(new Float32Array(0))
  const dummyRef = useRef<Float32Array>(new Float32Array(0))
  const seenRef = useRef<Set<string>>(new Set())
  const spawnRef = useRef<Map<string, number>>(new Map())
  const burstRef = useRef<THREE.InstancedMesh>(null)
  const burstsRef = useRef<Map<string, number>>(new Map())
  const moodsRef = useRef<Float32Array>(new Float32Array(0))
  const indexByIdRef = useRef<Map<string, number>>(new Map())
  const ringRef = useRef<THREE.InstancedMesh>(null)
  const resonantIdxRef = useRef<number[]>([])

  // 선택된 룩의 단계별(0..STAGE_MAX) 별-바디 프리미티브 + 공유 uniform. 모든 단계 머티리얼이 같은 uniform·
  // attribute 노드를 공유하므로 update()/setLight()이 한 번에 전부를 구동한다(드로우콜 = 단계 수, 헌법8 개정).
  // attribute는 버킷 지오메트리마다 따로 채워진다(layout 효과).
  const { bodies, update, setLight } = useMemo(() => {
    const t = uniform(0)
    const camPosU = uniform(new THREE.Vector3())
    const selfPosU = uniform(new THREE.Vector3(0, 0, 0))
    const positionalU = uniform(1)
    const litMixU = uniform(1)
    const camHeadlightU = uniform(0)
    // change 29: 형태 시드를 vec4 aShape에 묶는다(WebGPU 파이프라인당 정점 버퍼 ≤8). .xyz = 3축 형태 시드(별마다
    // 다른 실루엣), .x = surface 무늬 시드(옛 aSeed). .w는 예비(미사용 — 단계는 이제 버킷이 표현, in-shader 아님).
    const aShape = asVec4Node(attribute('aShape', 'vec4'))
    const sharedInputs = {
      mood: attribute('aMood', 'vec3'),
      glow: attribute('aGlow', 'float'),
      recency: attribute('aRecency', 'float'),
      seed: aShape.x,
      shape: aShape.xyz,
      hueShift: attribute('aHueShift', 'float'),
      time: t,
      cameraPos: camPosU,
      selfLightPos: selfPosU,
      lightPositional: positionalU,
      litMix: litMixU,
      focus: attribute('aFocus', 'float'),
      cameraHeadlight: camHeadlightU,
    }
    const light = {
      intensity: VALUES.starLighting.selfIntensity,
      distance: VALUES.starLighting.selfDistance,
      decay: VALUES.starLighting.selfDecay,
      gain: VALUES.starLighting.litAlbedoGain,
    }
    const bodies = Array.from({ length: STAGE_LEVELS }, (_unused, stage) =>
      buildStarBody(look, stage, sharedInputs, light, formParamsFor(stage)),
    )
    const update = (time: number, camera: THREE.Camera) => {
      t.value = time
      camera.getWorldPosition(camPosU.value)
    }
    const setLight = (
      pos: readonly [number, number, number],
      positional: number,
      mix: number,
      headlight = 0,
    ) => {
      selfPosU.value.set(pos[0], pos[1], pos[2])
      positionalU.value = positional
      litMixU.value = mix
      camHeadlightU.value = headlight
    }
    return { bodies, update, setLight }
  }, [look])
  // 자아 광원 uniform을 props로 동기(씬마다 위치/방향·점광/평행광·게이트가 다름).
  useEffect(() => {
    setLight(selfLightPos, lightPositional, litMix)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 배열 원소로 분해 의존(참조 변동 무시)
  }, [setLight, selfLightPos[0], selfLightPos[1], selfLightPos[2], lightPositional, litMix])
  // 룩이 바뀌면 직전 단계 지오메트리·머티리얼 전부 해제(GPU 누수 방지).
  useEffect(
    () => () => {
      for (const b of bodies) {
        b.geometry.dispose()
        b.material.dispose()
      }
    },
    [bodies],
  )

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

  // (Re)build per-bucket attributes + base matrices when the star set changes. useLayoutEffect runs in the
  // commit phase (before the first R3F frame), so attributes are bound before the material first renders.
  useLayoutEffect(() => {
    if (count === 0) {
      seenRef.current = new Set()
      spawnRef.current.clear()
      burstsRef.current.clear()
      return
    }
    // 새로 생긴 별만 탄생 대상으로 표시(첫 시드 제외, loadedEmpty 뒤 첫 도착은 진짜 탄생). 외부 소스는 정적이라 끔.
    const seen = seenRef.current
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
    for (const id of spawnRef.current.keys()) if (!seenRef.current.has(id)) spawnRef.current.delete(id)
    for (const id of burstsRef.current.keys()) if (!seenRef.current.has(id)) burstsRef.current.delete(id)

    const now = virtualNowMs()
    // 1) 글로벌 패스: mood(틴트 포함)·크기·더미 좌표·공명·단계 버킷 배치를 한 번에 계산한다.
    const members: number[][] = Array.from({ length: STAGE_LEVELS }, () => [])
    const placement: { stage: number; slot: number }[] = new Array(count)
    const moodArrG = new Float32Array(count * 3) // 글로벌 mood(버스트·공명 빌보드용)
    const scales = new Float32Array(count)
    const dummy = new Float32Array(count * 3)
    const resonantIdx: number[] = []
    for (let i = 0; i < count; i++) {
      const m = stars[i].memory
      if (m.resonant) resonantIdx.push(i)
      const rgb = resolveMoodRgb(m.mood, emotionColors)
      const ts = tint ? tintStrength : 0
      moodArrG[i * 3] = rgb[0] + (tint ? (tint[0] - rgb[0]) * ts : 0)
      moodArrG[i * 3 + 1] = rgb[1] + (tint ? (tint[1] - rgb[1]) * ts : 0)
      moodArrG[i * 3 + 2] = rgb[2] + (tint ? (tint[2] - rgb[2]) * ts : 0)
      scales[i] = sizeFor(m.intensity)
      const [px, py, pz] = fibonacciStarPosition(i, count, m.seed)
      dummy[i * 3] = px
      dummy[i * 3 + 1] = py
      dummy[i * 3 + 2] = pz
      const st = stageBucket(m.abstractionStage)
      placement[i] = { stage: st, slot: members[st].length }
      members[st].push(i)
    }

    // 2) 버킷 패스: 단계 버킷마다 attribute(aMood/aShape/aGlow/aRecency/aFocus/aHueShift) + 초기 행렬을 채운다.
    const obj = new THREE.Object3D()
    for (let st = 0; st < STAGE_LEVELS; st++) {
      const mesh = meshRefs.current[st]
      if (!mesh) continue
      const idxs = members[st]
      const n = idxs.length
      const moodArr = new Float32Array(n * 3)
      // change 29: aShape vec4 = (s0,s1,s2, 예비). 형태 3축 시드는 회상/요지가 누적한 form_seed_delta를 각 축에
      // 더해 다시 빚어지고, .x(s0)는 surface 무늬에도 쓰인다.
      const shapeArr = new Float32Array(n * 4)
      const glowArr = new Float32Array(n)
      const recencyArr = new Float32Array(n)
      const focusArr = new Float32Array(n).fill(1)
      const hueArr = new Float32Array(n)
      for (let slot = 0; slot < n; slot++) {
        const i = idxs[slot]
        const m = stars[i].memory
        moodArr[slot * 3] = moodArrG[i * 3]
        moodArr[slot * 3 + 1] = moodArrG[i * 3 + 1]
        moodArr[slot * 3 + 2] = moodArrG[i * 3 + 2]
        const shapeSeed = reshapedShapeSeed(m.shapeSeed, m.formSeedDelta)
        shapeArr[slot * 4] = shapeSeed[0]
        shapeArr[slot * 4 + 1] = shapeSeed[1]
        shapeArr[slot * 4 + 2] = shapeSeed[2]
        const b = starGlow(
          m.recallCount,
          m.intensity,
          m.lastRecalledAt,
          now,
          degreeNorm.get(stars[i].id) ?? 0,
          weightedDegreeNorm.get(stars[i].id) ?? 0,
        )
        glowArr[slot] = reshapedBrightness(b, m.brightnessOffset)
        recencyArr[slot] = b
        hueArr[slot] = (m.hueShift * Math.PI) / 180
        obj.position.set(dummy[i * 3], dummy[i * 3 + 1], dummy[i * 3 + 2])
        obj.scale.setScalar(scales[i] * (spawnRef.current.has(stars[i].id) ? 1e-3 : 1))
        obj.updateMatrix()
        mesh.setMatrixAt(slot, obj.matrix)
      }
      const geom = bodies[st].geometry
      geom.setAttribute('aMood', new THREE.InstancedBufferAttribute(moodArr, 3))
      geom.setAttribute('aShape', new THREE.InstancedBufferAttribute(shapeArr, 4))
      geom.setAttribute('aGlow', new THREE.InstancedBufferAttribute(glowArr, 1))
      geom.setAttribute('aRecency', new THREE.InstancedBufferAttribute(recencyArr, 1))
      geom.setAttribute('aFocus', new THREE.InstancedBufferAttribute(focusArr, 1))
      geom.setAttribute('aHueShift', new THREE.InstancedBufferAttribute(hueArr, 1))
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
    }
    scalesRef.current = scales
    dummyRef.current = dummy
    moodsRef.current = moodArrG
    membersRef.current = members
    placementRef.current = placement
    resonantIdxRef.current = resonantIdx
  }, [stars, count, bodies, emotionColors, degreeNorm, weightedDegreeNorm, external, tint, tintStrength])

  // Focus spotlight: re-weight aFocus per stage-bucket when the selection (or star set / look) changes.
  useEffect(() => {
    if (count === 0) return
    const placement = placementRef.current
    const selIdx = selectedId ? stars.findIndex((s) => s.id === selectedId) : -1
    const hi = selIdx < 0 && highlightedIds && highlightedIds.size > 0 ? highlightedIds : null
    const touched = new Set<number>()
    for (let i = 0; i < count; i++) {
      const p = placement[i]
      if (!p) continue
      const attr = bodies[p.stage].geometry.getAttribute('aFocus') as THREE.InstancedBufferAttribute | undefined
      if (!attr) continue
      let factor = 1
      if (selIdx >= 0) factor = i === selIdx ? FOCUS_BOOST : FOCUS_DIM
      else if (hi) factor = hi.has(stars[i].id) ? FOCUS_BOOST : FOCUS_DIM
      ;(attr.array as Float32Array)[p.slot] = factor
      touched.add(p.stage)
    }
    for (const st of touched) {
      const attr = bodies[st].geometry.getAttribute('aFocus') as THREE.InstancedBufferAttribute | undefined
      if (attr) attr.needsUpdate = true
    }
    // deps에 layout 재빌드 트리거 포함 — 재빌드가 aFocus를 1로 리셋하므로 그 뒤 디밍/부스트를 다시 적용한다.
  }, [selectedId, highlightedIds, stars, count, bodies, emotionColors, degreeNorm, weightedDegreeNorm, external, tint, tintStrength])

  // Per-frame matrix write: LIVE force-sim positions (07/10) 또는 더미 좌표 위에 별 미세 부유(WOBBLE_AMP)와
  // 탄생 스케일을 얹는다 — 단계 버킷마다. No setState → no re-render.
  const scratch = useMemo(() => new THREE.Object3D(), [])
  const burstScratch = useMemo(() => new THREE.Object3D(), [])
  const burstColor = useMemo(() => new THREE.Color(), [])
  const ringScratch = useMemo(() => new THREE.Object3D(), [])
  const ringColor = useMemo(() => new THREE.Color(), [])
  const reduceMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  useFrame((state) => {
    update(state.clock.elapsedTime, state.camera)
    if (selfLightRef?.current) {
      setLight(selfLightRef.current, lightPositional, litMix, 0)
    } else if (cameraLight) {
      setLight(STAR_LIGHT_ORIGIN, 0, litMix, 1)
    }
    if (count === 0) return
    const scales = scalesRef.current
    const t = state.clock.elapsedTime
    const spawns = spawnRef.current
    if (spawns.size > 0) for (const [id, t0] of spawns) if (t0 < 0) spawns.set(id, t)
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
    if (reduceMotion) bursts.clear()
    // 움직일 것이 없으면(모션 축소 + 라이브 버퍼·탄생·공명 없음) 정적 유지(layout이 더미 행렬을 이미 깔았다).
    if (wob === 0 && !live && spawns.size === 0 && bursts.size === 0 && resonantIdxRef.current.length === 0)
      return

    const members = membersRef.current
    for (let st = 0; st < STAGE_LEVELS; st++) {
      const mesh = meshRefs.current[st]
      const idxs = members[st]
      if (!mesh || !idxs || idxs.length === 0) continue
      for (let slot = 0; slot < idxs.length; slot++) {
        const i = idxs[slot]
        const m = stars[i].memory
        scratch.position.set(
          base[i * 3] + wobbleUnit(m.seed, t, 0) * wob,
          base[i * 3 + 1] + wobbleUnit(m.seed, t, 1) * wob,
          base[i * 3 + 2] + wobbleUnit(m.seed, t, 2) * wob,
        )
        scratch.scale.setScalar(scales[i] * birthFactor(stars[i].id))
        scratch.updateMatrix()
        mesh.setMatrixAt(slot, scratch.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }

    // 공명 마커(spec 36): 공명 별 둘레에 mood 색 링을 빌보드로 그리고 맥동시킨다(글로벌 인덱스).
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
          const pulse = reduceMotion ? 0.6 : 0.5 + 0.5 * Math.sin(t * RING_SPEED + m.seed * Math.PI * 2)
          ringScratch.position.set(
            base[i * 3] + wobbleUnit(m.seed, t, 0) * wob,
            base[i * 3 + 1] + wobbleUnit(m.seed, t, 1) * wob,
            base[i * 3 + 2] + wobbleUnit(m.seed, t, 2) * wob,
          )
          ringScratch.quaternion.copy(state.camera.quaternion)
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

    // 탄생 버스트: 활성 버스트만 빌보드 슬롯에 채운다(글로벌 인덱스). 별과 같은 좌표에서 mood 색 글로우가 퍼진다.
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
            t0 = t
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
          burstScratch.quaternion.copy(state.camera.quaternion)
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
  // 단계 버킷마다 InstancedMesh 1개(룩×단계 = 헌법8 개정의 소수 고정 메시). key에 look·stage·count를 넣어 룩
  // 변경/개수 변동 시 깨끗이 다시 만든다. capacity=count(한 단계에 전부 몰릴 최악) — 메모리 STAGE_LEVELS배지만
  // 상수배라 별 수 비례 드로우콜은 그대로다. onClick → raycast 슬롯을 버킷 멤버로 매핑해 그 별 선택.
  return (
    <>
      {bodies.map((body, stage) => (
        <instancedMesh
          key={`${look}-${stage}-${count}`}
          ref={(el) => {
            meshRefs.current[stage] = el
          }}
          args={[body.geometry, body.material, count]}
          dispose={null}
          onClick={(e) => {
            e.stopPropagation()
            if (e.delta > 8) return
            if (e.instanceId == null) return
            const i = membersRef.current[stage]?.[e.instanceId]
            if (i == null) return
            const node = stars[i]
            if (node) onSelect?.(node.id)
          }}
        />
      ))}
      {/* 탄생 버스트 레이어(글로벌) — 클릭은 별이 받아야 하므로 raycast를 끈다. */}
      <instancedMesh
        ref={burstRef}
        args={[burst.geometry, burst.material, MAX_BURSTS]}
        dispose={null}
        visible={false}
        frustumCulled={false}
        raycast={NOOP_RAYCAST}
      />
      {/* 공명 마커 레이어(spec 36, 글로벌) — 빌보드 링. */}
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
