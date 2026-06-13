// Star visualization (spec 08, Architecture §3.3): every star drawn by ONE
// InstancedMesh (few draw calls — constitution §8) with a TSL node material so it
// runs on WebGPU and the WebGL2 fallback. Per-instance color/brightness/seed come
// from InstancedBufferAttributes; size (=f(intensity)) is baked into the instance
// matrix scale. Coordinates are updated in useFrame from the live force-sim buffer
// (07/22, wired by UniverseCanvas's LiveLayoutController) with NO React re-render
// (constitution §3, acceptance 1.6); when the buffer isn't ready yet a deterministic
// fibonacci dummy stands in (same formula → no flicker). This is the only place
// three/TSL appears; the model layer stays pure.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { reshapedBrightness, reshapedSeed, starBrightness, useMemoryStore } from '@/entities/memory/@x/star'
import { virtualNowMs } from '@/shared/lib/demo'
import { WOBBLE_AMP, wobbleUnit } from '../model/wobble'
import { DEFAULT_OBJECT } from '../model/kinds'
import type { StarObject } from '../model/types'
import { resolveMoodRgb } from '@/shared/config'
import { fibonacciStarPosition } from '@/shared/lib'
import { buildStarForm } from './forms'

/** intensity (0..1) → instance scale. */
function sizeFor(intensity: number): number {
  return 0.6 + Math.max(0, Math.min(1, intensity)) * 1.4
}

/** 버스트 레이어는 클릭 대상이 아니다 — raycast 무력화로 별 클릭이 가려지지 않게. */
const NOOP_RAYCAST = () => undefined

// 별 탄생 애니메이션: 새로 생긴 별은 한 점에서 살짝 튀어 오르며(easeOutBack) 정상 크기로
// 자라난다 — 뚝 나타나는 등장을 "태어나는" 등장으로 바꾼다. 첫 로드/출처 리셋의 일괄
// 시드는 애니메이션하지 않는다(우주 전체가 펑펑 터지면 소음이다).
const BIRTH_DUR_S = 1.2
function easeOutBack(x: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

// 탄생 버스트: 새 별 자리에서 mood 색의 발광 디스크+링이 빠르게 퍼지며 사그라든다
// (additive — 색이 검정으로 가면 투명과 같다). 스케일 탄생 애니메이션과 함께 "별이
// 태어났다"를 한눈에 알린다. 빌보드 인스턴스 메시 1개 = 추가 드로우콜 1개(헌법 §8).
const BURST_DUR_S = 1.6
const MAX_BURSTS = 32 // 동시 탄생 상한(초과분은 버스트만 생략 — 별 자체는 정상 탄생)
const BURST_BASE_SCALE = 2.5 // 시작 크기(별 스케일 배수)
const BURST_GROW = 16 // 수명 동안 추가로 퍼지는 배수
function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3)
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

// Focus spotlight (11): while a star is selected, every OTHER star dims to FOCUS_DIM of its
// brightness and the selected one is nudged up by FOCUS_BOOST — applied by re-weighting the
// per-instance aBrightness the forms read (each form multiplies emissive by it). No rebuild.
const FOCUS_DIM = 0.12
const FOCUS_BOOST = 1.3

export interface StarFieldProps {
  /** force-sim positions buffer (07/10). When absent, a dev dummy cluster is used. */
  positionsRef?: { readonly current: Float32Array | null }
  /** 별(기억) 오브제 형태(appearance.object) — 형태별 지오메트리·머티리얼로 dispatch. 기본 deepfield. */
  object?: StarObject
  /** 감정색 사용자 오버라이드(mood→"#RRGGBB", spec 30). 없는 mood는 기본 팔레트(MOOD_PALETTE). */
  emotionColors?: Record<string, string>
}

export function StarField({ positionsRef, object = DEFAULT_OBJECT, emotionColors }: StarFieldProps) {
  const stars = useMemoryStore((s) => s.stars)
  const select = useMemoryStore((s) => s.select)
  const selectedId = useMemoryStore((s) => s.selectedId)
  const count = stars.length
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

  // 선택된 형태(object)별 공유 지오메트리 + TSL 머티리얼. 모든 인스턴스가 하나를 공유하므로
  // 형태 변경은 O(1)(메시 1개 재구성) — 드로우콜은 그대로다(constitution §8). 머티리얼은
  // per-instance attribute(aMood/aBrightness/aSeed)를 읽어 mood 색을 보존한다(forms.ts).
  const { geometry, material, update } = useMemo(() => buildStarForm(object), [object])
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
    if (seen.size > 0 || useMemoryStore.getState().loadedEmpty) {
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

    const moodArr = new Float32Array(count * 3)
    const seedArr = new Float32Array(count)
    const brightArr = new Float32Array(count)
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
      const rgb = resolveMoodRgb(m.mood, emotionColors)
      moodArr[i * 3] = rgb[0]
      moodArr[i * 3 + 1] = rgb[1]
      moodArr[i * 3 + 2] = rgb[2]
      // 재성형 합성(spec 23): 형태 시드·밝기는 누적 재공고화 상태를 더한 유효값으로,
      // 색조는 라디안 attribute로 머티리얼에 넘긴다. 기본 0이면 기존 별과 동일.
      seedArr[i] = reshapedSeed(m.seed, m.formSeedDelta)
      brightArr[i] = reshapedBrightness(starBrightness(m.lastRecalledAt, now), m.brightnessOffset)
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
    geometry.setAttribute('aBrightness', new THREE.InstancedBufferAttribute(brightArr, 1))
    geometry.setAttribute('aHueShift', new THREE.InstancedBufferAttribute(hueArr, 1))
    scalesRef.current = scales
    dummyRef.current = dummy
    moodsRef.current = moodArr
    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
  }, [stars, count, geometry, emotionColors])

  // Focus spotlight: re-weight aBrightness when the selection (or star set / form) changes —
  // selected boosted, all others dimmed; full brightness restored when nothing is selected. Reads
  // the attribute the layout effect built (so it re-applies after a rebuild) and re-uploads only
  // that one buffer; if a form's attr layout ever lacks it, this safely no-ops.
  useEffect(() => {
    const attr = geometry.getAttribute('aBrightness') as THREE.InstancedBufferAttribute | undefined
    if (!attr || count === 0) return
    const selIdx = selectedId ? stars.findIndex((s) => s.id === selectedId) : -1
    const now = virtualNowMs()
    const arr = attr.array as Float32Array
    for (let i = 0; i < count; i++) {
      // Focus 재가중도 재성형 합성을 거친 같은 유효 밝기(spec 23)에서 출발한다.
      const m = stars[i].memory
      const base = reshapedBrightness(starBrightness(m.lastRecalledAt, now), m.brightnessOffset)
      arr[i] = base * (selIdx < 0 ? 1 : i === selIdx ? FOCUS_BOOST : FOCUS_DIM)
    }
    attr.needsUpdate = true
  }, [selectedId, stars, count, geometry])

  // Per-frame matrix write: LIVE force-sim positions (07/10) 또는 더미 좌표 위에 별 미세
  // 부유(WOBBLE_AMP)와 탄생 스케일을 얹는다. No setState → no re-render (1.6).
  // reduced-motion + 버퍼·탄생 없음이면 정적 장면을 매 프레임 다시 올리지 않는다.
  const scratch = useMemo(() => new THREE.Object3D(), [])
  // 버스트 전용 스크래치 — scratch와 분리(빌보드가 쿼터니언을 만지므로 별 행렬이 오염되지 않게).
  const burstScratch = useMemo(() => new THREE.Object3D(), [])
  const burstColor = useMemo(() => new THREE.Color(), [])
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
    // 움직일 것이 하나도 없으면(모션 축소 + 라이브 버퍼·탄생 없음) 정적 유지.
    if (wob === 0 && !live && spawns.size === 0 && bursts.size === 0) return

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
          const fade = (1 - age) * (1 - age) * 1.6
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
          if (e.instanceId == null) return
          const node = stars[e.instanceId]
          if (node) select(node.id)
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
    </>
  )
}
