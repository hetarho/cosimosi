// The central "나" star (spec 38·44) — the universe's anchor. It is NOT a memory: it never
// joins the graph (no edges/KNN/synapses), sits fixed at the origin, and the radial layout
// pulls strong memories close to it and lets faded ones drift outward. One mesh, three+
// selectable forms (appearance.selfObject), each a self-emissive TSL glow the BloomPass blooms
// (no scene directional light → emissive only, the StarField/forms idiom).
//
// Body color = AMBIENT mood (요즘 감정, spec 25·07): "나 = 지금의 나". It is THEME-INDEPENDENT —
// derived from the loaded stars' affect (now R-weighted, spec 07), NOT the chosen background (spec
// 44 A7). No data / unauth / empty universe → background accent fallback. ⚠️ spec-03: this changes
// ONLY the self star's own BODY color (buildSelfForm colorNode). The light the self star CASTS on
// other stars (StarField's reflection channel, star_lighting.self_intensity) stays NEUTRAL — and the
// woven emotion colors live in the background skin (UniverseNebula), not here (no double injection).
// raycast off; reduced-motion freezes the internal flow.
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useAppearance, themeAccent, buildSelfForm, type SelfObject } from '@/entities/appearance'
import {
  deriveAmbient,
  ambientToRgb,
  useMemoryStore,
  type AmbientStar,
} from '@/entities/memory'
import { virtualNowMs } from '@/shared/lib/demo'
import { VALUES } from '@/shared/config'

// Sits just inside the strongest memory shell (R_MIN=6, shared/lib/layout) so the closest
// memories ring it without being swallowed.
const SELF_RADIUS = VALUES.selfStar.radius

const NOOP_RAYCAST = () => undefined

// recall(근접 탐험)에서 아바타가 어깨-너머 앵커를 따라붙는 ease 속도(1/s). 전이(원점↔앵커)의 한 프레임
// 점프를 ~0.1s에 매끄럽게 잇고(A6 — 화면 중앙으로 튀어 bloom을 덮지 않게), 정상 항해 중엔 앵커에
// 사실상 붙어 광원=나가 한 점에 산다. nav 물리 상수(ACCEL_K 등)와 같은 결의 FE 모션 감각 상수.
const FOLLOW_K = 9

/** StarNode[] → the affect-only shape deriveAmbient reads (spec 07: includes recall_count, the
 *  Bjork retrieval-strength R input). The body color derives from the loaded stars directly. */
function ambientStars(
  stars: {
    memory: { mood: string; intensity: number; valence: number; lastRecalledAt: number; recallCount: number }
  }[],
): AmbientStar[] {
  return stars.map((s) => ({
    mood: s.memory.mood,
    intensity: s.memory.intensity,
    valence: s.memory.valence,
    lastRecalledAt: s.memory.lastRecalledAt,
    recallCount: s.memory.recallCount,
  }))
}

export function SelfStar({
  selfObject,
  anchorRef,
}: {
  selfObject: SelfObject
  // recall에서 NavController가 매 프레임 채우는 어깨-너머 앵커(광원 위치와 공유). null이면 nebula/전이 →
  // 원점 폴백(중심 닻 유지, 헌법3). 광원과 같은 ref라 "광원이 곧 나"(spec 49 A1·A3).
  anchorRef: MutableRefObject<readonly [number, number, number] | null>
}) {
  const theme = useAppearance((s) => s.theme)
  const stars = useMemoryStore((s) => s.stars)
  // Body color = ambient mood (theme-independent, A7). No meaningful ambient (empty/unauth/all-faded)
  // → background accent fallback. Derived from the loaded stars (the client ambient summary, spec 25).
  const color = useMemo(() => {
    const amb = deriveAmbient(ambientStars(stars), virtualNowMs())
    const c = new THREE.Color()
    if (stars.length > 0 && (amb.arousal > 0 || amb.sat > 0)) {
      const [r, g, b] = ambientToRgb(amb)
      c.setRGB(r, g, b) // ambient mood meaning-color (linear, mirrors AmbientNebula's setRGB)
    } else {
      c.set(themeAccent(theme)).convertSRGBToLinear() // no data → background accent (neutral-ish)
    }
    return c
  }, [stars, theme])
  const built = useMemo(() => buildSelfForm(selfObject), [selfObject])
  // Push the (possibly ambient) color into the material uniform whenever it changes — no rebuild.
  useEffect(() => {
    built.setColor(color)
  }, [built, color])
  // Dispose GPU resources when the form changes (avoid a leak on re-build).
  useEffect(
    () => () => {
      built.geometry.dispose()
      built.material.dispose()
    },
    [built],
  )

  const updateRef = useRef<((t: number) => void) | null>(null)
  useEffect(() => {
    updateRef.current = built.update
    return () => {
      updateRef.current = null
    }
  }, [built])

  const reduceMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const meshRef = useRef<THREE.Mesh>(null)
  const targetPos = useRef(new THREE.Vector3())
  useFrame((state, dt) => {
    // Freeze the internal flow under reduced-motion (still rendered, just static).
    updateRef.current?.(reduceMotion ? 0 : state.clock.elapsedTime)
    // spec 49: recall이면 어깨-너머 앵커로 항해(원점을 떠나 카메라와 함께), 아니면 원점 폴백(중심 닻).
    const mesh = meshRef.current
    if (!mesh) return
    const a = anchorRef.current
    if (a) {
      // 앵커는 world 좌표(NavController가 camera에서 파생). SelfStar는 부유하는 UniverseDrift 그룹의
      // 자식이라 mesh.position은 그룹-로컬 → world 앵커를 부모 로컬로 변환해야 광원(반사는 positionWorld
      // 공간에서 계산)과 한 점에 산다. worldToLocal은 직전 프레임 matrixWorld 기준(드리프트 ~1u, 무시 가능).
      targetPos.current.set(a[0], a[1], a[2])
      mesh.parent?.worldToLocal(targetPos.current)
    } else {
      targetPos.current.set(0, 0, 0) // nebula/전이: 로컬 원점(드리프트 그룹과 함께 부유 — 기존 동작)
    }
    if (reduceMotion) {
      mesh.position.copy(targetPos.current) // reduced-motion: 보간 없이 즉시(과한 전이 모션 회피)
    } else {
      // 전이의 한 프레임 점프(원점↔앵커)를 ease로 잇고, 정상 항해 중엔 앵커에 사실상 붙는다(A6).
      mesh.position.lerp(targetPos.current, 1 - Math.exp(-dt * FOLLOW_K))
    }
  })

  return (
    <mesh
      ref={meshRef}
      geometry={built.geometry}
      material={built.material}
      scale={SELF_RADIUS}
      dispose={null}
      raycast={NOOP_RAYCAST}
      frustumCulled={false}
    />
  )
}
