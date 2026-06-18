// 우주 몽환 배경(spec 44) — 랜딩/사인인의 도메인워프 오로라(buildFluidMaterial)와 같은 결을, 진짜 3D
// 원근 씬인 우주에 들인 것. 랜딩은 2D ortho 풀스크린 fluid라 싸고, 우주는 같은 걸 그대로 못 깔지만 큰
// 안쪽 구 한 겹(BackSide)에 같은 도메인워프 fbm을 *방향(normalize(positionLocal))* 도메인으로 입히면
// uv 극 핀칭 없이 사방을 감싸는 성운 워시가 된다 — draw call 1개라 싸다(풀 볼류메트릭 3D 성운이 아님).
//
// 색: 선택한 배경(Background) 번들의 fluid 팔레트(backgrounds.ts palette) — 배경마다 몽환감이 다르게.
// 별(기억) mood 색은 불간섭: 이 구는 모든 것 뒤(renderOrder<AmbientNebula)·depthWrite/Test 없음이라
// 별을 가리지도 깊이를 더럽히지도 않는다. 밝기는 낮게(BRIGHTNESS) 묶어 별을 씻어내거나 과하게 bloom되지
// 않게 한다. frozen-time idiom(constitution §3.1): BloomPass가 내장 time을 안 굴리므로 수동 uTime을
// useFrame에서 bump(reduced-motion이면 정지). AmbientNebula(감정색 글로우 풀, spec 25)와 별개 레이어다.
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

// 큰 안쪽 구 — nebula 자유 궤도 최대 거리(1500)에서도 카메라가 항상 안쪽에 있도록(far=2000 이내).
const RADIUS = 1800
// 깊은 우주 워시 — 낮게 묶어 별을 씻어내지 않고, 대부분 bloom threshold(0.1) 아래에 둔다(밝은 결만 은은히 번짐).
const BRIGHTNESS = 0.32

const NOOP_RAYCAST = () => undefined

export function UniverseNebula({ palette = DEFAULT_PALETTE }: { palette?: CosmosPalette }) {
  const reduceMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const built = useMemo(() => {
    const geometry = new THREE.SphereGeometry(RADIUS, 48, 32)
    const material = new MeshBasicNodeMaterial()
    const uTime = uniform(0)
    const t = float(uTime as never)
    const oct = VALUES.cosmos.fluidOctaves

    // 팔레트 6색(선형색 — flat 렌더, 톤매핑 없음; halo.ts 유니폼 Color 관용구).
    const cBase = vec3(uniform(new THREE.Color(palette.base)) as never)
    const cC1 = vec3(uniform(new THREE.Color(palette.c1)) as never)
    const cC2 = vec3(uniform(new THREE.Color(palette.c2)) as never)
    const cC3 = vec3(uniform(new THREE.Color(palette.c3)) as never)
    const cC4 = vec3(uniform(new THREE.Color(palette.c4)) as never)
    const cHi = vec3(uniform(new THREE.Color(palette.hi)) as never)

    // 노이즈 도메인 = 구 표면 방향(uv 극 핀칭 회피). 전체가 느리게 흐르며 워프 필드 자체도 진화 → 무늬가
    // 미끄러지지 않고 *휘젓는다*(fluid-material과 동형, 평면 uv 대신 방향 벡터).
    const dir = normalize(positionLocal)
    const flow = vec3(t.mul(0.006), t.mul(-0.009), t.mul(0.004))
    const p = vec3(dir).mul(1.4).add(flow)
    // Pass 1 — 도메인 워프. 두 fbm 샘플로 좌표 격자를 휜다.
    const wx = mx_fractal_noise_float(p, oct, 2.0, 0.5)
    const wy = mx_fractal_noise_float(p.add(vec3(5.2, 1.3, 2.7)), oct, 2.0, 0.5)
    const warped = p.add(vec3(wx, wy, wx).mul(0.55))
    // Pass 2 — 워프된 좌표에서 다시 샘플. n=주 팔레트 램프, n2(더 미세·오프셋)=밴드를 깨 불규칙하게.
    const n = mx_fractal_noise_float(warped, oct, 2.0, 0.55).mul(0.5).add(0.5)
    const n2 = mx_fractal_noise_float(warped.mul(1.9).add(vec3(11.7, 3.1, 7.3)), oct, 2.0, 0.5)
      .mul(0.5)
      .add(0.5)

    // 팔레트 레이어링: deep base → c1 → c2 → c3 → c4, 각자 노이즈 밴드 위로 smoothstep 페이드(소프트·겹침).
    let col = mix(cBase, cC1, smoothstep(float(0.15), float(0.5), n))
    col = mix(col, cC2, smoothstep(float(0.4), float(0.7), n))
    col = mix(col, cC3, smoothstep(float(0.6), float(0.85), n.mul(n2.mul(0.6).add(0.7))))
    col = mix(col, cC4, smoothstep(float(0.78), float(0.98), n2))
    // 두 필드가 함께 봉우리치는 곳에만 드물게 하이라이트 — 떠도는 밝은 결 몇 가닥(전면 워시 아님).
    const hi = pow(clamp(n.mul(n2), float(0), float(1)), float(3.0))
    const shimmer = sin(t.mul(0.25).add(n.mul(6.28))).mul(0.15).add(0.85)
    col = mix(col, cHi, hi.mul(shimmer).mul(0.5))
    material.colorNode = col.mul(BRIGHTNESS)

    material.side = THREE.BackSide // 안쪽에서 보이게(카메라가 구 안)
    material.depthWrite = false
    material.depthTest = false // 배경 워시: 별을 가리거나 깊이에 끼어들지 않게
    material.toneMapped = false
    const update = (time: number) => {
      uTime.value = time
    }
    return { geometry, material, update }
  }, [palette])

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
  useFrame((state) => {
    updateRef.current?.(reduceMotion ? 0 : state.clock.elapsedTime)
  })

  // 모든 것 뒤(AmbientNebula -10보다 더 뒤), 레이캐스트 없음(별 탭 통과), 컬링 없음(거대 구).
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
