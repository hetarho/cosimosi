// Star visualization (spec 08, Architecture §3.3): every star drawn by ONE
// InstancedMesh (few draw calls — constitution §8) with a TSL node material so it
// runs on WebGPU and the WebGL2 fallback. Per-instance color/brightness/seed come
// from InstancedBufferAttributes; size (=f(intensity)) is baked into the instance
// matrix scale. Coordinates are updated in useFrame from the force-sim buffer (07)
// with NO React re-render (constitution §3, acceptance 1.6) — until 10 wires that
// buffer, a deterministic dummy cluster stands in. This is the only place three/TSL
// appears; the model layer stays pure.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { starBrightness, useMemoryStore } from '@/entities/memory/@x/star'
import { DEFAULT_OBJECT } from '../model/kinds'
import type { StarObject } from '../model/types'
import { moodRgb } from '@/shared/config'
import { fibonacciStarPosition } from '@/shared/lib'
import { buildStarForm } from './forms'

/** intensity (0..1) → instance scale. */
function sizeFor(intensity: number): number {
  return 0.6 + Math.max(0, Math.min(1, intensity)) * 1.4
}

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
}

export function StarField({ positionsRef, object = DEFAULT_OBJECT }: StarFieldProps) {
  const stars = useMemoryStore((s) => s.stars)
  const select = useMemoryStore((s) => s.select)
  const selectedId = useMemoryStore((s) => s.selectedId)
  const count = stars.length
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const scalesRef = useRef<Float32Array>(new Float32Array(0))

  // 선택된 형태(object)별 공유 지오메트리 + TSL 머티리얼. 모든 인스턴스가 하나를 공유하므로
  // 형태 변경은 O(1)(메시 1개 재구성) — 드로우콜은 그대로다(constitution §8). 머티리얼은
  // per-instance attribute(aMood/aBrightness/aSeed)를 읽어 mood 색을 보존한다(forms.ts).
  const { geometry, material, update } = useMemo(() => buildStarForm(object), [object])
  // 형태가 바뀌면 직전 지오메트리·머티리얼을 해제(GPU 누수 방지).
  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  // (Re)build per-instance attributes + base matrices when the star set changes.
  // useLayoutEffect runs in the commit phase (before the first R3F frame), so the
  // attributes are bound before the material first renders. Date.now() here is fine
  // (effect, not render).
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh || count === 0) return
    const moodArr = new Float32Array(count * 3)
    const seedArr = new Float32Array(count)
    const brightArr = new Float32Array(count)
    const scales = new Float32Array(count)
    const dummy = new Float32Array(count * 3)
    const now = Date.now()
    const obj = new THREE.Object3D()

    for (let i = 0; i < count; i++) {
      const m = stars[i].memory
      const rgb = moodRgb(m.mood)
      moodArr[i * 3] = rgb[0]
      moodArr[i * 3 + 1] = rgb[1]
      moodArr[i * 3 + 2] = rgb[2]
      seedArr[i] = m.seed
      brightArr[i] = starBrightness(m.lastRecalledAt, now)
      scales[i] = sizeFor(m.intensity)

      // Deterministic fibonacci-sphere dummy layout (shared with the camera fly-to so
      // they agree on each star's position — 12). Radius varies by seed.
      const [px, py, pz] = fibonacciStarPosition(i, count, m.seed)
      dummy[i * 3] = px
      dummy[i * 3 + 1] = py
      dummy[i * 3 + 2] = pz

      obj.position.set(px, py, pz)
      obj.scale.setScalar(scales[i])
      obj.updateMatrix()
      mesh.setMatrixAt(i, obj.matrix)
    }

    geometry.setAttribute('aMood', new THREE.InstancedBufferAttribute(moodArr, 3))
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedArr, 1))
    geometry.setAttribute('aBrightness', new THREE.InstancedBufferAttribute(brightArr, 1))
    scalesRef.current = scales
    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
  }, [stars, count, geometry])

  // Focus spotlight: re-weight aBrightness when the selection (or star set / form) changes —
  // selected boosted, all others dimmed; full brightness restored when nothing is selected. Reads
  // the attribute the layout effect built (so it re-applies after a rebuild) and re-uploads only
  // that one buffer; if a form's attr layout ever lacks it, this safely no-ops.
  useEffect(() => {
    const attr = geometry.getAttribute('aBrightness') as THREE.InstancedBufferAttribute | undefined
    if (!attr || count === 0) return
    const selIdx = selectedId ? stars.findIndex((s) => s.id === selectedId) : -1
    const now = Date.now()
    const arr = attr.array as Float32Array
    for (let i = 0; i < count; i++) {
      const base = starBrightness(stars[i].memory.lastRecalledAt, now)
      arr[i] = base * (selIdx < 0 ? 1 : i === selIdx ? FOCUS_BOOST : FOCUS_DIM)
    }
    attr.needsUpdate = true
  }, [selectedId, stars, count, geometry])

  // Per-frame coordinate subscription: write LIVE force-sim positions (07/10) into the
  // instance matrices, preserving the baked scale. No setState → no re-render (1.6).
  // The dummy layout is static (set once above), so without a live buffer this does
  // nothing — no per-frame re-upload of a motionless scene.
  const scratch = useMemo(() => new THREE.Object3D(), [])
  useFrame((state) => {
    // 형태 애니메이션용 시간 전진(liquid 출렁임 / ember 깜빡임 / aurora 흐름). 위치 버퍼가 없어도
    // 매 프레임 올려야 하므로 아래 early-return보다 먼저 둔다.
    update(state.clock.elapsedTime)
    const mesh = meshRef.current
    const buf = positionsRef?.current
    if (!mesh || count === 0 || !buf) return
    const scales = scalesRef.current
    if (buf.length < count * 3 || scales.length < count) return
    for (let i = 0; i < count; i++) {
      scratch.position.set(buf[i * 3], buf[i * 3 + 1], buf[i * 3 + 2])
      scratch.scale.setScalar(scales[i])
      scratch.updateMatrix()
      mesh.setMatrixAt(i, scratch.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  if (count === 0) return null
  // key=`${object}-${count}` → 형태(object)나 개수(count)가 바뀌면 새 지오메트리·count에 맞춰
  // instanceMatrix를 깨끗이 다시 만든다. onClick → 그 별 선택(raycast가 인스턴스 슬롯을 준다);
  // 회상 기능(11)이 selectedId에 반응. stopPropagation으로 가장 가까운 별만 집힌다.
  return (
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
  )
}
