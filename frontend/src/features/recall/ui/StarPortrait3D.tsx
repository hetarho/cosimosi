// 회상 별 포트레이트(change 32) — 회상 패널 상단에서 클릭한 별을 단일 3D로 크게 다시 그린다. 메인 우주
// UniverseCanvas와 별개의 **전용 미니 R3F Canvas**(한 페이지 한 캔버스 원칙의 명시적 예외 — tech/architecture.md):
// 패널이 열렸을 때만 마운트하고 frameloop='demand' + 스로틀 rAF로 셰이더 평가 비용을 가둔다.
//
// 별의 정체성을 그대로 재현한다 — look(전역/감정 오버라이드) × 추상화 단계(요지화될수록 단순 실루엣) × 형태
// 시드 × 감정색. 우주와 같은 렌더 경로(buildStarBody)만 쓰고 VizStar 시그니처는 안 건드린다(헌법8). 조명은
// 위에서 쏘는 평행광(상단 스포트라이트, positional=0)으로 예술작품 같은 명암을 준다 — 세기·방향·카메라·헤일로는
// VALUES.starPortrait.*(하드코딩 금지). 헤일로는 CosmosScene buildHalo 본보기.
import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import * as THREE from 'three'
import { float, uniform, vec3 } from 'three/tsl'
import { createRendererFactory } from '@/shared/lib/r3f'
import { VALUES } from '@/shared/config'
import { buildHalo } from '@/shared/ui'
import {
  buildStarBody,
  formParamsFor,
  STAR_LOOK_SPIN,
  stageBucket,
  type StarLook,
} from '@/entities/star'

// 투명 캔버스(패널 배경 비침) — CosmosScene과 동일 alpha 강제.
const glFactory = createRendererFactory({ alpha: true })

export interface StarPortrait3DProps {
  /** 이 별의 형태(룩) — 감정 오버라이드 또는 전역 기본을 소비처가 이미 해석해 넘긴다(parseStarLook 결과). */
  look: StarLook
  /** 감정색 hex(#RRGGBB) — 별 + 헤일로 색. */
  colorHex: string
  /** 추상화 단계(0..STAGE_MAX) — 요지화될수록 단순 실루엣. 미수신 0 폴백은 소비처 몫. */
  stage: number
  /** 형태(geometry) 고유성 1축 시드(seedFromId) — surface 무늬·자전. */
  seed: number
  /** 형태 고유성 3축 시드(seedComponents) — 같은 단계 내 별 실루엣 차이. */
  shapeSeed: readonly [number, number, number]
}

/** 별 한 개 + 상단 스포트라이트 반사 + 헤일로. StarMesh(CosmosScene) 미러 — 단계별 지오메트리를 빌드타임에
 *  고르고(stageBucket), 매 프레임 time·cameraPos uniform만 갱신한다(BloomPass 동결 회피, star-body 계약). */
function PortraitStar({ look, colorHex, stage, seed, shapeSeed, animated }: StarPortrait3DProps & { animated: boolean }) {
  const spinRef = useRef<THREE.Group>(null)
  const p = VALUES.starPortrait
  const bucket = stageBucket(stage)
  const body = useMemo(() => {
    const moodU = uniform(new THREE.Color(colorHex))
    const timeU = uniform(0)
    // 카메라 월드 위치 uniform(빌트인 cameraPosition 노드는 BloomPass가 동결 — StarField·StarMesh와 동일 회피).
    const camPosU = uniform(new THREE.Vector3())
    const dir = p.lightDir
    // 강한 스포트라이트면 반사 cap(gain)도 함께 올려 면/엣지 대비를 살린다(StarMesh 본보기 — self-glow를 못 이기게 묶던 기본 cap 해제).
    const gain = Math.max(VALUES.starLighting.litAlbedoGain, p.lightIntensity * 0.55)
    const built = buildStarBody(
      look,
      bucket,
      {
        mood: moodU,
        glow: float(p.selfEmission), // 자가발광(낮춰 스포트라이트 반사가 면/엣지를 드러내게)
        recency: float(1), // 포트레이트는 항상 또렷하게(밝기 감쇠 무관 — 단계가 흐림을 형태로 표현)
        seed: float(seed),
        shape: vec3(shapeSeed[0], shapeSeed[1], shapeSeed[2]),
        hueShift: float(0),
        time: timeU,
        cameraPos: camPosU,
        selfLightPos: vec3(dir[0], dir[1], dir[2]), // 상단 방향(평행광)
        lightPositional: float(0), // 0 = directional(상단 스포트라이트)
        litMix: float(1),
        focus: float(1),
      },
      {
        intensity: p.lightIntensity,
        distance: VALUES.starLighting.selfDistance,
        decay: VALUES.starLighting.selfDecay,
        gain,
      },
      formParamsFor(bucket),
    )
    return {
      geometry: built.geometry,
      material: built.material,
      spin: STAR_LOOK_SPIN[look],
      update: (t: number, camera: THREE.Camera) => {
        timeU.value = t
        camera.getWorldPosition(camPosU.value)
      },
    }
  }, [look, colorHex, bucket, seed, shapeSeed, p.lightDir, p.lightIntensity, p.selfEmission])
  const halo = useMemo(() => buildHalo(colorHex, 1), [colorHex])
  useEffect(
    () => () => {
      body.geometry.dispose()
      body.material.dispose()
      halo.geometry.dispose()
      halo.material.dispose()
    },
    [body, halo],
  )

  useFrame((s) => {
    const t = animated ? s.clock.elapsedTime : 0
    body.update(t, s.camera)
    halo.update(1)
    const g = spinRef.current
    if (g && animated) g.rotation.y = t * body.spin
  })

  return (
    <group>
      {/* 글로우 헤일로 — 별 뒤, 자전 안 함(CosmosScene 본보기). */}
      <mesh
        geometry={halo.geometry}
        material={halo.material}
        position={[0, 0, -0.05]}
        scale={p.haloScale}
        renderOrder={-1}
      />
      <group ref={spinRef}>
        <mesh geometry={body.geometry} material={body.material} />
      </group>
    </group>
  )
}

/** 스로틀 rAF — frameloop='demand'를 ~fpsCap으로 직접 invalidate(전용 캔버스 셰이더 평가 절감, CosmosScene 본보기). */
function FrameDriver({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let acc = 0
    const frameMs = 1000 / fps
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(now - last, 100)
      last = now
      if (document.visibilityState !== 'visible') return
      acc += dt
      if (acc < frameMs) return
      acc -= frameMs
      invalidate()
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [invalidate, fps])
  return null
}

/** 회상 패널 상단 별 포트레이트. 정사각 미니 캔버스. reduced-motion이면 정적 한 장(rAF 없음). */
export function StarPortrait3D(props: StarPortrait3DProps) {
  const reduced = !!useReducedMotion()
  const animated = !reduced
  const p = VALUES.starPortrait
  return (
    <div className="mx-auto aspect-square w-40 sm:w-48">
      <Canvas
        gl={glFactory}
        flat
        frameloop="demand"
        camera={{ position: [0, 0, p.cameraDistance], fov: p.cameraFov, near: 0.1, far: 100 }}
        onCreated={(state) => {
          // async WebGPU init 이후 한 프레임 보장(demand 모드 첫 프레임 누락 방지 — CosmosScene 관용구).
          state.invalidate()
        }}
      >
        {animated && <FrameDriver fps={p.fpsCap} />}
        <PortraitStar {...props} animated={animated} />
      </Canvas>
    </div>
  )
}
