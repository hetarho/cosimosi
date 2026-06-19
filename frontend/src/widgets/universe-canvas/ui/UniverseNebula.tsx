// 우주 몽환 배경(spec 44·07) — 랜딩/사인인의 도메인워프 오로라(buildFluidMaterial)와 같은 결을, 진짜 3D
// 원근 씬인 우주에 들인 것. 큰 안쪽 구 한 겹(BackSide)에 도메인워프 fbm을 *방향(normalize(positionLocal))*
// 도메인으로 입혀 사방을 감싸는 성운 워시가 된다 — draw call 1개라 싸다(풀 볼류메트릭 3D 성운이 아님).
//
// spec 07: 이 배경이 "요즘 감정"을 직접 짜 넣는다(떠 있던 무드 오브 AmbientNebula는 제거). 받침색 + 무늬는
// 선택한 배경(Background) 스킨이 정하고(스킨마다 *다른* 패턴 — A6), 그 위에 순위 상위 N개(스킨별
// emotionSlots) **사용자 감정색**(resolveMoodRgb, spec 45)을 R-비중으로 합성한다. arousal(Σ R 도출)은
// 배경의 전역 생동(밝기·움직임)을 정한다. emotionSlots=0이면 감정 무관 순수 텍스처.
// 별(기억) mood 색은 불간섭: 이 구는 모든 것 뒤·depthWrite/Test 없음이라 별을 가리지도 깊이를 더럽히지도
// 않는다. frozen-time idiom(constitution §3.1): BloomPass가 내장 time을 안 굴리므로 수동 uTime을 useFrame
// 에서 bump(reduced-motion이면 정지·색 유지).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import {
  vec3,
  float,
  uniform,
  normalize,
  positionLocal,
  mix,
  smoothstep,
  clamp,
  pow,
  sin,
  mx_fractal_noise_float,
} from 'three/tsl'
import { VALUES, type CosmosPalette, DEFAULT_PALETTE } from '@/shared/config'
import type { BackgroundPattern } from '@/entities/appearance'
import type { RankedEmotion } from '@/entities/memory'

// 큰 안쪽 구 — nebula 자유 궤도 최대 거리(1500)에서도 카메라가 항상 안쪽에 있도록 1500보다 크게.
// 단, 구의 *먼 쪽 벽*은 반경+카메라거리(최대 1800+1500=3300)까지 멀어지므로 카메라 far가 그보다 커야
// 중앙이 안 잘린다(UniverseCanvas의 Canvas camera far=4000 참고). 안 그러면 줌아웃 시 중앙이 원형으로 잘려 배경색이 드러난다.
const RADIUS = 1800
// 깊은 우주 워시 — 낮게 묶어 별을 씻어내지 않고, 대부분 bloom threshold(0.1) 아래에 둔다(밝은 결만 은은히 번짐).
const BRIGHTNESS = 0.32
// 감정 짜임 상한 — 가장 밝은 결에서 감정색이 받침색을 덮는 최대 비율(별을 씻지 않게 절제).
const EMO_WEAVE_MAX = 0.7
const BG_BRIGHT_GAIN = VALUES.ambient.bgBrightnessGain
const BG_MOTION_GAIN = VALUES.ambient.bgMotionGain

const NOOP_RAYCAST = () => undefined
const DEFAULT_PATTERN: BackgroundPattern = { warp: 0.5, freq: 1.2, detail: 0.5 }

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
  if (emotionSlots <= 0 || emotions.length === 0) {
    return { c0: fb(), c1: fb(), c2: fb(), presence: 0 }
  }
  const used = emotions.slice(0, Math.max(1, emotionSlots))
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
  // presence = how strongly the dominant emotion is present (its R-share), capped — a one-emotion
  // 요즘 weaves boldly, a scattered one stays subtle. emotionSlots>0 here so it's always >0.
  const presence = Math.min(1, used[0].weight * 1.6 + 0.25)
  return { c0, c1, c2, presence }
}

export function UniverseNebula({
  palette = DEFAULT_PALETTE,
  pattern = DEFAULT_PATTERN,
  emotionSlots = 0,
  emotions = [],
  arousal = 0,
}: {
  palette?: CosmosPalette
  pattern?: BackgroundPattern
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

  // 무늬 결은 스킨 패턴(warp/freq/detail)으로 정해진다 → 패턴/팔레트가 바뀔 때만 셰이더 재빌드.
  // 감정색·presence·arousal은 유니폼으로 매 변경 시 갱신(재컴파일 없음).
  const built = useMemo(() => {
    const geometry = new THREE.SphereGeometry(RADIUS, 48, 32)
    const material = new MeshBasicNodeMaterial()
    const uTime = uniform(0)
    const uBright = uniform(1) // 1 + bg_brightness_gain·arousal
    const uMotion = uniform(1) // 1 + bg_motion_gain·arousal
    const uPresence = uniform(0) // 감정 짜임 강도(0 = 순수 텍스처)
    const uE0 = uniform(new THREE.Color(palette.c2))
    const uE1 = uniform(new THREE.Color(palette.c2))
    const uE2 = uniform(new THREE.Color(palette.c2))
    const t = float(uTime as never)
    const oct = VALUES.cosmos.fluidOctaves
    const warp = pattern.warp
    const freq = pattern.freq
    const detail = pattern.detail

    // 팔레트 6색(선형색 — flat 렌더, 톤매핑 없음).
    const cBase = vec3(uniform(new THREE.Color(palette.base)) as never)
    const cC1 = vec3(uniform(new THREE.Color(palette.c1)) as never)
    const cC2 = vec3(uniform(new THREE.Color(palette.c2)) as never)
    const cC3 = vec3(uniform(new THREE.Color(palette.c3)) as never)
    const cC4 = vec3(uniform(new THREE.Color(palette.c4)) as never)
    const cHi = vec3(uniform(new THREE.Color(palette.hi)) as never)

    // 노이즈 도메인 = 구 표면 방향(uv 극 핀칭 회피). arousal이 흐름 속도를 키운다(uMotion).
    const dir = normalize(positionLocal)
    const speed = float(uMotion as never)
    const flow = vec3(t.mul(0.006), t.mul(-0.009), t.mul(0.004)).mul(speed)
    const p = vec3(dir).mul(freq).add(flow)
    // Pass 1 — 도메인 워프(스킨 patten.warp 만큼 휨).
    const wx = mx_fractal_noise_float(p, oct, 2.0, 0.5)
    const wy = mx_fractal_noise_float(p.add(vec3(5.2, 1.3, 2.7)), oct, 2.0, 0.5)
    const warped = p.add(vec3(wx, wy, wx).mul(warp))
    // Pass 2 — n=주 팔레트 램프, n2(더 미세·patten.detail 게인)=밴드를 깨 불규칙하게.
    const n = mx_fractal_noise_float(warped, oct, 2.0, 0.55).mul(0.5).add(0.5)
    const n2 = mx_fractal_noise_float(warped.mul(1.6 + detail).add(vec3(11.7, 3.1, 7.3)), oct, 2.0, 0.5)
      .mul(0.5)
      .add(0.5)

    // 받침색 레이어링: deep base → c1 → c2 → c3 → c4, 노이즈 밴드 위로 smoothstep 페이드(소프트·겹침).
    let col = mix(cBase, cC1, smoothstep(float(0.15), float(0.5), n))
    col = mix(col, cC2, smoothstep(float(0.4), float(0.7), n))
    col = mix(col, cC3, smoothstep(float(0.6), float(0.85), n.mul(n2.mul(0.6).add(0.7))))
    col = mix(col, cC4, smoothstep(float(0.78), float(0.98), n2))

    // 감정 짜임(spec 07): 사용자 감정색을 노이즈 밴드 위로 합성. dominant(c0)는 넓은 결, c1/c2는 더 밝은
    // 결의 액센트. presence가 전체 강도(0 = 순수 텍스처). 가장 밝은 결일수록 감정색이 도드라진다.
    const e0 = vec3(uE0 as never)
    const e1 = vec3(uE1 as never)
    const e2 = vec3(uE2 as never)
    const emo01 = mix(e0, e1, smoothstep(float(0.45), float(0.8), n))
    const emoCol = mix(emo01, e2, smoothstep(float(0.7), float(0.97), n2))
    const weave = clamp(n.mul(0.7).add(float(0.15)), float(0), float(1))
      .mul(float(uPresence as never))
      .mul(float(EMO_WEAVE_MAX))
    col = mix(col, emoCol, weave)

    // 두 필드가 함께 봉우리치는 곳에만 드물게 하이라이트.
    const hi = pow(clamp(n.mul(n2), float(0), float(1)), float(3.0))
    const shimmer = sin(t.mul(0.25).mul(speed).add(n.mul(6.28))).mul(0.15).add(0.85)
    col = mix(col, cHi, hi.mul(shimmer).mul(0.5))
    material.colorNode = col.mul(BRIGHTNESS).mul(float(uBright as never))

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
  }, [palette, pattern])

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
  // reduced-motion: 움직임만 멈춘다(arousal→밝기·색은 유지, 색은 살아있게). uMotion은 useFrame이 시간을
  // 멈추므로 자연히 정지하지만, 명시적으로 arousal의 밝기 기여는 유지한다.
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
