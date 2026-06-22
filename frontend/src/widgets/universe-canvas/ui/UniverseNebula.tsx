// 우주 배경 셸(spec 44·07·51) — 큰 안쪽 구 한 겹(BackSide)에 절차적 셰이더를 입혀 사방을 감싸는 배경 워시.
// draw call 1개라 싸다(풀 볼류메트릭 3D 성운이 아님). 이 컴포넌트는 **공통 셸**만 소유한다: geometry/material
// 생성·dispose, uniform(uTime·밝기·움직임·presence·감정색 3슬롯), reduced-motion, arousal 게인. *효과별 시각
// 조립*은 entity가 소유한다 — `BACKGROUND_FORMS[effect]`(entities/appearance/ui/background-form)에서 조립
// 함수를 꺼내 색 노드를 받는다. 효과가 몇 개든 여기엔 분기가 없다(N-제네릭, plan 51).
//
// 색(spec 07): 받침은 검정에 가까운 딥스페이스(palette.base), 그 위에 순위 상위 N개(emotionSlots) 사용자 감정색을
// R-비중으로 가산한다(weaveSlots). presence=0이면 거의 검정 = 안전한 빈 우주. 별(기억) mood 색은 불간섭 — 이
// 구는 모든 것 뒤·depthWrite/Test 없음이라 별을 가리지도 깊이를 더럽히지도 않는다. frozen-time(constitution
// §3.1): BloomPass가 내장 time을 안 굴리므로 수동 uTime을 useFrame에서 bump(reduced-motion이면 정지·색 유지).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { uniform, normalize, positionLocal, vec3 } from 'three/tsl'
import { asFloatNode, asVec3Node } from '@/shared/lib/r3f'
import { VALUES, type CosmosPalette, DEFAULT_PALETTE } from '@/shared/config'
import {
  BACKGROUND_FORMS,
  type BackgroundEffect,
  type BackgroundPattern,
  type BackgroundFieldContext,
} from '@/entities/appearance'
import type { RankedEmotion } from '@/entities/memory'

// 큰 안쪽 구 — nebula 자유 궤도 최대 거리(1500)에서도 카메라가 항상 안쪽이도록 1500보다 크게. 단, 구의 *먼 쪽 벽*은
// 반경+카메라거리(최대 1800+1500=3300)까지 멀어지므로 카메라 far가 그보다 커야 중앙이 안 잘린다(UniverseCanvas far=4000).
const RADIUS = 1800
// 깊은 우주 워시 — 낮게 묶어 별을 씻어내지 않고, 대부분 bloom threshold(0.1) 아래에 둔다(밝은 결만 은은히 번짐).
const BRIGHTNESS = 0.32
const BG_BRIGHT_GAIN = VALUES.ambient.bgBrightnessGain
const BG_MOTION_GAIN = VALUES.ambient.bgMotionGain

const NOOP_RAYCAST = () => undefined
const DEFAULT_PATTERN: BackgroundPattern = { warp: 0.5, freq: 1.2, detail: 0.5 }
const EMPTY_PARAMS: Readonly<Record<string, number>> = {}

/** Top-N(emotionSlots) ranked emotions → three woven color slots + an overall presence.
 *  slot0=dominant(broad field), slot1/2=accents(brighter/peak bands). For 1 slot all three
 *  collapse to the dominant color; for ≥3 they are the top-3 (slot2 blends the tail by weight);
 *  for 0 slots / empty → presence 0 (pure skin texture). Colors fall back to a neutral skin tone
 *  (the palette c2) so an unfilled slot weaves nothing. */
function weaveSlots(
  emotions: readonly RankedEmotion[],
  emotionSlots: number,
  fallback: THREE.Color,
): { c0: THREE.Color; c1: THREE.Color; c2: THREE.Color; presence: number } {
  const fb = () => fallback.clone()
  // 주감정은 최대 4개까지만 사용(4개 초과는 의미 없음).
  const cappedSlots = Math.min(4, emotionSlots)
  if (cappedSlots <= 0 || emotions.length === 0) {
    return { c0: fb(), c1: fb(), c2: fb(), presence: 0 }
  }
  const used = emotions.slice(0, Math.max(1, cappedSlots))
  const toColor = (e: RankedEmotion) => new THREE.Color(e.rgb[0], e.rgb[1], e.rgb[2])
  const c0 = toColor(used[0])
  const c1 = used.length > 1 ? toColor(used[1]) : c0.clone()
  // slot2 = weighted blend of the remaining tail (used[2..]) so "비중대로 다색"; else mirror c1.
  let c2: THREE.Color
  const tail = used.slice(2)
  if (tail.length > 0) {
    let r = 0
    let g = 0
    let b = 0
    let w = 0
    for (const e of tail) {
      r += e.weight * e.rgb[0]
      g += e.weight * e.rgb[1]
      b += e.weight * e.rgb[2]
      w += e.weight
    }
    c2 = w > 0 ? new THREE.Color(r / w, g / w, b / w) : c1.clone()
  } else {
    c2 = c1.clone()
  }
  // presence = 주감정의 R-비중(존재감), capped — 한 감정에 쏠린 요즘은 또렷이, 흩어진 요즘은 은은히.
  const presence = Math.min(1, used[0].weight * 1.6 + 0.25)
  return { c0, c1, c2, presence }
}

export function UniverseNebula({
  palette = DEFAULT_PALETTE,
  pattern = DEFAULT_PATTERN,
  effect = 'galaxy',
  params = EMPTY_PARAMS,
  emotionSlots = 0,
  emotions = [],
  arousal = 0,
}: {
  palette?: CosmosPalette
  pattern?: BackgroundPattern
  effect?: BackgroundEffect
  params?: Readonly<Record<string, number>>
  emotionSlots?: number
  emotions?: readonly RankedEmotion[]
  arousal?: number
}) {
  const reduceMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  // 효과/패턴/팔레트/params가 바뀔 때만 재빌드 — 감정색·presence·arousal은 유니폼으로 갱신(재컴파일 없음).
  const built = useMemo(() => {
    const geometry = new THREE.SphereGeometry(RADIUS, 48, 32)
    const material = new MeshBasicNodeMaterial()
    const uTime = uniform(0)
    const uBright = uniform(1) // 1 + bg_brightness_gain·arousal
    const uMotion = uniform(1) // 1 + bg_motion_gain·arousal
    const uPresence = uniform(0) // 감정 짜임 강도(0 = 거의 검정)
    const uE0 = uniform(new THREE.Color(palette.c2))
    const uE1 = uniform(new THREE.Color(palette.c2))
    const uE2 = uniform(new THREE.Color(palette.c2))

    // 공통 노드: 구 표면 방향(uv 극 핀칭 회피) + arousal로 빨라지는 흐름 + 요즘 mood 색 3슬롯 + 검정에 가까운
    // 딥스페이스 받침. 효과별 시각 조립은 entity의 BACKGROUND_FORMS가 이 컨텍스트를 받아 색 노드를 만든다.
    const t = asFloatNode(uTime)
    const speed = asFloatNode(uMotion)
    const dir = asVec3Node(normalize(positionLocal))
    const flow = asVec3Node(vec3(t.mul(0.006), t.mul(-0.009), t.mul(0.004)).mul(speed))
    const ctx: BackgroundFieldContext = {
      dir,
      deep: asVec3Node(uniform(new THREE.Color(palette.base))),
      flow,
      speed,
      presence: asFloatNode(uPresence),
      e0: asVec3Node(uE0),
      e1: asVec3Node(uE1),
      e2: asVec3Node(uE2),
      t,
      oct: VALUES.cosmos.fluidOctaves,
      warp: pattern.warp,
      freq: pattern.freq,
      detail: pattern.detail,
      params,
    }
    // 효과 → 조립 함수(누락 시 기본 galaxy로 안전 폴백). 효과별 분기 없음 — registry lookup 하나뿐(N-제네릭).
    const form = BACKGROUND_FORMS[effect] ?? BACKGROUND_FORMS.galaxy
    const col = form(ctx)
    material.colorNode = col.mul(BRIGHTNESS).mul(asFloatNode(uBright))

    material.side = THREE.BackSide // 안쪽에서 보이게(카메라가 구 안)
    material.depthWrite = false
    material.depthTest = false // 배경 워시: 별을 가리거나 깊이에 끼어들지 않게
    material.toneMapped = false
    const update = (time: number) => {
      uTime.value = time
    }
    const setSkyDynamics = (e: { c0: THREE.Color; c1: THREE.Color; c2: THREE.Color; presence: number }, a: number) => {
      uE0.value.copy(e.c0)
      uE1.value.copy(e.c1)
      uE2.value.copy(e.c2)
      uPresence.value = e.presence
      uBright.value = 1 + BG_BRIGHT_GAIN * a
      uMotion.value = 1 + BG_MOTION_GAIN * a
    }
    return { geometry, material, update, setSkyDynamics }
  }, [palette, pattern, effect, params])

  useEffect(
    () => () => {
      built.geometry.dispose()
      built.material.dispose()
    },
    [built],
  )

  // 감정 짜임 색·presence·arousal 유니폼 — 별/감정/요즘이 바뀌면 갱신(셰이더 재컴파일 없음).
  const slots = useMemo(
    () => weaveSlots(emotions, emotionSlots, new THREE.Color(palette.c2)),
    [emotions, emotionSlots, palette],
  )
  // reduced-motion: 움직임만 멈춘다(arousal→밝기·색은 유지). uMotion은 useFrame이 시간을 멈추므로 자연히 정지.
  useEffect(() => {
    built.setSkyDynamics(slots, arousal)
  }, [built, slots, arousal])

  const updateRef = useRef<((t: number) => void) | null>(null)
  useEffect(() => {
    updateRef.current = built.update
    return () => {
      updateRef.current = null
    }
  }, [built])
  useFrame((state) => {
    updateRef.current?.(reduceMotion ? 0 : state.clock.elapsedTime)
  })

  // 모든 것 뒤, 레이캐스트 없음(별 탭 통과), 컬링 없음(거대 구).
  return (
    <mesh
      geometry={built.geometry}
      material={built.material}
      renderOrder={-11}
      frustumCulled={false}
      raycast={NOOP_RAYCAST}
      dispose={null}
    />
  )
}
