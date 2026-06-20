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
  abs,
  pow,
  sin,
  mx_noise_float,
  mx_fractal_noise_float,
} from 'three/tsl'
import { VALUES, type CosmosPalette, DEFAULT_PALETTE } from '@/shared/config'
import type { BackgroundEffect, BackgroundPattern } from '@/entities/appearance'
import type { RankedEmotion } from '@/entities/memory'

// 큰 안쪽 구 — nebula 자유 궤도 최대 거리(1500)에서도 카메라가 항상 안쪽에 있도록 1500보다 크게.
// 단, 구의 *먼 쪽 벽*은 반경+카메라거리(최대 1800+1500=3300)까지 멀어지므로 카메라 far가 그보다 커야
// 중앙이 안 잘린다(UniverseCanvas의 Canvas camera far=4000 참고). 안 그러면 줌아웃 시 중앙이 원형으로 잘려 배경색이 드러난다.
const RADIUS = 1800
// 깊은 우주 워시 — 낮게 묶어 별을 씻어내지 않고, 대부분 bloom threshold(0.1) 아래에 둔다(밝은 결만 은은히 번짐).
const BRIGHTNESS = 0.32
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
  effect = 'haze',
  emotionSlots = 0,
  emotions = [],
  arousal = 0,
}: {
  palette?: CosmosPalette
  pattern?: BackgroundPattern
  effect?: BackgroundEffect
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

  // 배경 효과(change 11)는 스킨마다 *다른 절차적 셰이더 경로*를 만든다 — 모두 검은 우주 위에 요즘 mood 색만
  // 칠한다(presence=0이면 거의 검정 = 안전한 빈 우주). 효과/패턴/팔레트가 바뀔 때만 재빌드, 감정색·presence·
  // arousal은 유니폼으로 갱신(재컴파일 없음). EMO_WEAVE_MAX는 효과별 mood 칠 강도 안에 녹였다.
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
    const t = float(uTime as never)
    const oct = VALUES.cosmos.fluidOctaves
    const warp = pattern.warp
    const freq = pattern.freq
    const detail = pattern.detail

    // 공통 노드: 구 표면 방향(uv 극 핀칭 회피) + arousal로 빨라지는 흐름 + 요즘 mood 색 3슬롯 + 아주 옅은
    // 딥스페이스 받침(검정에 가깝게 — 별을 씻지 않게). presence가 mood 칠 전체 강도.
    const dir = normalize(positionLocal)
    const speed = float(uMotion as never)
    const flow = vec3(t.mul(0.006), t.mul(-0.009), t.mul(0.004)).mul(speed)
    const e0 = vec3(uE0 as never)
    const e1 = vec3(uE1 as never)
    const e2 = vec3(uE2 as never)
    const presence = float(uPresence as never)

    // 받침은 검정에 가까운 딥스페이스(palette.base). 효과 대부분은 그 위에 mood 하이라이트를 *가산*해 또렷하게
    // 칠하고(전면 안개 아님), **기본 우주(haze)만** navy↔mood 블렌드로 하늘 전체가 요즘 감정색으로 물든다(아주
    // 예전 초기 3D 우주의 결 — 흰색 대체가 아니라 navy↔mood mix). 색=mood·받침=어둠, 별 mood 색·깊이 불간섭.
    const deep = vec3(uniform(new THREE.Color(palette.base)) as never)
    const NAVY = vec3(0.09, 0.12, 0.28) // haze 받침 — 검정에 가까운 남청색(선형값; BRIGHTNESS로 near-black navy)
    let col

    if (effect === 'aurora') {
      // 오로라 커튼(reactbits Aurora/Threads 영감): 어두운 우주에 얇은 mood 색 *선*들이 걸리고, 느린 sweep이
      // 그 선들을 가끔씩 지나간다(전면 확산 아님). 가로 phase + fbm 흔들림으로 굽이치는 커튼, 능선 crest만 발광.
      const wob = mx_fractal_noise_float(dir.mul(1.4).add(vec3(t.mul(0.03).mul(speed))), oct, 2.0, 0.5)
      const hphase = dir.x.mul(2.2).add(dir.z.mul(1.6)).add(wob.mul(1.8))
      const ribbon = sin(hphase.mul(float(2.4).add(freq))) // -1..1 굽이치는 커튼
      const line = pow(smoothstep(float(0.55), float(1.0), abs(ribbon)), float(2.2)) // crest만 얇게
      const vfall = smoothstep(float(0.95), float(0.1), abs(dir.y)) // 극 쪽으로 사그라듦
      const sweep = smoothstep(
        float(0.35),
        float(1.0),
        sin(hphase.mul(0.6).sub(t.mul(0.18).mul(speed))).mul(0.5).add(0.5),
      ) // 가끔씩 지나가는 빛 흐름
      const curtain = line.mul(vfall).mul(sweep.mul(0.75).add(0.25))
      const moodCol = mix(e0, e2, sin(hphase).mul(0.5).add(0.5))
      // 어두운 우주 + 선에만 mood 가산(전면 확산 아님).
      col = deep.mul(0.5).add(moodCol.mul(curtain).mul(presence.mul(1.15).add(0.05)))
    } else if (effect === 'static') {
      // 지지직 정적(reactbits 그레인/글리치 영감): 어두운 화면에 강한 쿨 그레인(시간에 흐르는 고주파 노이즈) +
      // 드물게 번뜩이는 가로 글리치 밴드 + 스캔라인. 쿨하고 거친 인상. mood 색이 그레인에 흩뿌려진다.
      const grain = mx_noise_float(dir.mul(70.0).add(vec3(t.mul(2.5)))).mul(0.5).add(0.5)
      const grain2 = mx_noise_float(dir.mul(140.0).add(vec3(t.mul(-3.7)))).mul(0.5).add(0.5)
      const fuzz = grain.mul(0.6).add(grain2.mul(0.4))
      const rowN = mx_noise_float(vec3(dir.y.mul(22.0), t.mul(0.7), float(0.0))).mul(0.5).add(0.5)
      const glitch = smoothstep(float(0.82), float(1.0), rowN) // 소수의 번뜩이는 행
      const scan = sin(dir.y.mul(90.0).add(t.mul(2.0))).mul(0.5).add(0.5) // 스캔라인 깜빡임
      const moodCol = mix(e0, e1, fuzz)
      const tex = fuzz.mul(float(0.22).add(detail * 0.12)).add(glitch.mul(0.9)).add(scan.mul(0.06))
      col = deep.mul(0.5).add(moodCol.mul(tex).mul(presence.mul(0.9).add(0.12)))
    } else if (effect === 'waves') {
      // 느린 파동(잔잔): 가로 결의 부드러운 mood 파동. 저주파 fbm로 굽이만 주고 sin으로 큰 물결.
      const wn = mx_fractal_noise_float(dir.mul(float(0.7).add(freq * 0.3)).add(flow.mul(0.5)), oct, 2.0, 0.5)
      const wph = dir.y.mul(3.0).add(wn.mul(1.4)).add(t.mul(0.08).mul(speed))
      const wave = sin(wph).mul(0.5).add(0.5)
      const moodCol = mix(e0, e1, wave)
      const band = smoothstep(float(0.25), float(0.9), wave)
      col = deep.mul(0.6).add(moodCol.mul(band).mul(presence.mul(0.85).add(0.07)))
    } else if (effect === 'caustics') {
      // 심해 물빛 굴절: 두 겹 노이즈의 abs(sin) 곱으로 얽히는 caustic 망. 느리게 일렁인다.
      const cp = dir.mul(float(2.2).add(freq)).add(flow.mul(1.4))
      const w1 = mx_fractal_noise_float(cp, oct, 2.0, 0.5)
      const w2 = mx_fractal_noise_float(cp.mul(1.7).add(vec3(t.mul(0.05).mul(speed))), oct, 2.0, 0.5)
      const c1n = abs(sin(w1.mul(6.0).add(t.mul(0.2).mul(speed))))
      const c2n = abs(sin(w2.mul(5.0).sub(t.mul(0.15).mul(speed))))
      const moodCol = mix(e0, e2, w1.mul(0.5).add(0.5))
      const caustic = pow(c1n.mul(c2n), float(2.0))
      col = deep.mul(0.7).add(moodCol.mul(caustic.mul(1.3).add(0.04)).mul(presence.mul(0.95).add(0.06)))
    } else if (effect === 'ridges') {
      // 성운 절벽 능선: ridged noise(1-|fbm|)로 날카로운 먼지 능선/기둥. detail이 능선 날카로움을 키운다.
      const rp = dir.mul(float(1.6).add(freq * 0.4)).add(flow.mul(0.6))
      const f = mx_fractal_noise_float(rp, oct, 2.0, 0.5) // -1..1
      const f2 = mx_fractal_noise_float(rp.mul(2.3).add(vec3(4.0, 1.0, 2.0)), oct, 2.0, 0.5).mul(0.5).add(0.5)
      const moodCol = mix(e0, e1, f2)
      const ridge = pow(clamp(float(1).sub(abs(f)), float(0), float(1)), float(3.0).add(detail * 2.0))
      col = deep.mul(0.6).add(moodCol.mul(ridge.mul(1.15).add(0.05)).mul(presence.mul(0.95).add(0.06)))
    } else if (effect === 'nebula') {
      // 격동 성운 워시(도메인워프 fbm) — 휘몰아치는 와류. mood가 결을 따라 칠해지고 봉우리에 액센트.
      const p = vec3(dir).mul(freq).add(flow)
      const wx = mx_fractal_noise_float(p, oct, 2.0, 0.5)
      const wy = mx_fractal_noise_float(p.add(vec3(5.2, 1.3, 2.7)), oct, 2.0, 0.5)
      const warped = p.add(vec3(wx, wy, wx).mul(warp * 1.4))
      const n = mx_fractal_noise_float(warped, oct, 2.0, 0.55).mul(0.5).add(0.5)
      const n2 = mx_fractal_noise_float(warped.mul(float(1.6).add(detail)).add(vec3(11.7, 3.1, 7.3)), oct, 2.0, 0.5)
        .mul(0.5)
        .add(0.5)
      const accentS = pow(clamp(n.mul(n2), float(0), float(1)), float(3.0))
      const moodCol = mix(e0, e1, n)
      const accent = e2.mul(accentS) // 봉우리는 액센트 mood로
      const body = smoothstep(float(0.32), float(0.95), n)
      col = deep.mul(0.6).add(moodCol.mul(body).add(accent.mul(0.6)).mul(presence.mul(0.95).add(0.05)))
    } else {
      // haze(기본): **검정에 가까운 남청색(NAVY)이 요즘 mood 색으로 블렌딩**되는 뿌연 안개(흰색 대체가 아니라
      // navy↔mood mix — 아주 예전 초기 3D 우주의 결). 저주파 fbm로 크고 부드러운 안개가 천천히 흐르며 하늘
      // 전체를 감정 색으로 물들인다. presence·안개 밀도가 블렌드 비율 — 감정 없으면 순수 남청색, 강하면 초록·
      // 빨강 등으로. NAVY는 mix 상한 0.9로 완전히 사라지지 않는다(검정 우주 인상 유지). **이 블렌드는 기본
      // 우주에만** — 다른 효과는 위처럼 어두운 받침 + mood 하이라이트 가산으로 또렷하게(전면 안개 아님).
      const hp = dir.mul(float(0.8).add(freq * 0.2)).add(flow)
      const n = mx_fractal_noise_float(hp, oct, 2.0, 0.5).mul(0.5).add(0.5)
      const n2 = mx_fractal_noise_float(hp.mul(2.1).add(vec3(7.0, 3.0, 1.0)), oct, 2.0, 0.5).mul(0.5).add(0.5)
      const tone = mix(e0, e1, n2)
      const dens = smoothstep(float(0.25), float(0.95), n)
      const tint = clamp(presence.mul(float(0.45).add(dens.mul(0.7))), float(0), float(1))
      col = mix(NAVY, tone, tint.mul(0.9)).add(tone.mul(dens.mul(0.35).mul(presence).mul(0.45)))
    }

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
  }, [palette, pattern, effect])

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
