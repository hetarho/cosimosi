// CosmosScene (spec 43) — 공유 WebGL 배경 합성. 우주 셸의 "한 R3F 캔버스" 패턴을, 별과 배경이 한 씬에
// 사는 재사용 widget으로 떼어낸 것. 깊이순: [fluid 뒤(dim nebula)] → [트윙클 별먼지] → [별(buildStarBody,
// plan 42) + halo] → [어두운 구름(별 앞을 안개처럼 가림)]. 명도를 낮춰 "배경답고 깊은 우주" 느낌을 주고,
// 별은 halo로 또렷한 글로우를 낸다(bloom은 기본 끔 — 과한 글로우로 별이 묻히지 않게; 옵션으로 켤 수 있음).
//
// 디커플드: appearance 스토어·FSM·전송 계층을 import하지 않고 prop(별 데이터·팔레트·품질)만 받는다 →
// 소비처가 어댑터로 자기 상태를 주입(테마→palette는 paletteForTheme). 라이브러리 추출 토대(헌법 §4: widget).
//
// 성능: frameloop='demand' + 스로틀 rAF로 fps 상한(VALUES.cosmos.fpsCap). dpr는 [1, sceneDpr] 클램프.
// reduced-motion이면 정적 한 장(rAF 없음). quality='low'(또는 기기 등급)이면 앞 구름·트윙클 축소·dpr 1.
import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react'
import { Canvas, useFrame, useThree, type GLProps } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import * as THREE from 'three'
import { uniform, float } from 'three/tsl'
import { createRenderer } from '@/shared/lib/r3f'
import { VALUES } from '@/shared/config'
import { cn } from '@/shared/lib'
import { BloomPass, GrainOverlay, buildFluidMaterial, buildHalo, type CosmosPalette } from '@/shared/ui'
import { buildStarBody, STAR_FORM_SPIN, type StarObject } from '@/entities/star'

// 투명 캔버스(뒤 페이지/베이스색 비침) — StarCanvas/FluidGradient와 동일한 alpha 강제.
const glFactory = ((props: Parameters<typeof createRenderer>[0]) =>
  createRenderer({ ...props, alpha: true })) as unknown as GLProps

export type CosmosQuality = 'high' | 'low'

/** 기기 등급 자동 판정 — WebGPU 미지원(WebGL2 폴백) 또는 저코어면 low. prop으로 명시하면 그게 우선. */
function autoQuality(): CosmosQuality {
  if (typeof navigator === 'undefined') return 'high'
  const cores = navigator.hardwareConcurrency ?? 8
  const noWebGPU = !('gpu' in navigator)
  return noWebGPU || cores <= VALUES.cosmos.qualityLowMaxCores ? 'low' : 'high'
}

/** 장식용 별 하나 — 우주의 StarNode와 별개의 단순 prop 모델(위치는 정규화 스크린 앵커). */
export interface StarVisual {
  /** 형태(deepfield/aurora/liquid/ember). */
  concept: StarObject
  /** mood/accent hex(의미색). 별 + halo 색. */
  color: string
  /** 정규화 스크린 앵커 [x, y] ∈ [0,1]. (0,0)=좌상, (0.5,0.5)=정중앙. */
  anchor: [number, number]
  /** 별 코어 반지름(월드 단위 — 뷰 높이 [-1,1] 기준). halo는 이 값의 ~3.2배. */
  size: number
  seed?: number
}

export interface CosmosSceneProps {
  /** 별들(0개면 순수 배경). */
  stars?: StarVisual[]
  /** 배경 fluid 팔레트(테마별). 미지정 시 기본(vast) 팔레트. */
  palette?: CosmosPalette
  /** 트윙클 별먼지 개수(기본 VALUES.cosmos.twinkleCount). */
  twinkle?: number
  /** 별 앞 어두운 구름(안개) 표시(기본 true; quality='low'면 자동 off). */
  frontClouds?: boolean
  /** bloom 글로우(기본 false — 별 글로우는 halo가; 과한 글로우 방지). 켜면 quality='low'에선 무시. */
  bloom?: boolean
  /** 필름 그레인 오버레이(기본 true). */
  grain?: boolean
  /** 품질 — 미지정 시 기기 등급 자동 판정. */
  quality?: CosmosQuality
  className?: string
}

// ── 트윙클 별먼지: additive 빌보드 인스턴스(검증된 StarField burst/ring 패턴). ortho 카메라가 -z를
//    바라보므로 xy 평면 쿼드는 이미 카메라를 향함 → 빌보드 회전 불필요. 트윙클은 매 프레임 instanceColor
//    알파만 갱신(수십 개라 무비용). ──────────────────────────────────────────────────────────────────
let dotTexture: THREE.CanvasTexture | null = null
function getDotTexture(): THREE.CanvasTexture | null {
  if (dotTexture || typeof document === 'undefined') return dotTexture
  const size = 64
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  if (!g) return null
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  dotTexture = new THREE.CanvasTexture(c)
  return dotTexture
}

interface Dust {
  x: number
  y: number
  z: number
  r: number
  baseA: number
  amp: number
  ph: number
}

function Twinkle({ count, animated }: { count: number; animated: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const geom = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: getDotTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      }),
    [],
  )
  // index 기반 의사난수로 분포(마운트마다 동일).
  const dust = useMemo<Dust[]>(() => {
    const out: Dust[] = []
    for (let i = 0; i < count; i++) {
      const h = (n: number) => {
        const s = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453
        return s - Math.floor(s)
      }
      out.push({
        x: (h(1) * 2 - 1) * 2.0,
        y: h(2) * 2 - 1,
        z: -0.5 - h(3) * 1.5,
        r: 0.003 + h(4) * 0.01,
        baseA: 0.2 + h(5) * 0.3,
        amp: 0.12 + h(6) * 0.25,
        ph: h(7) * Math.PI * 2,
      })
    }
    return out
  }, [count])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const o = new THREE.Object3D()
    for (let i = 0; i < dust.length; i++) {
      const d = dust[i]
      o.position.set(d.x, d.y, d.z)
      o.scale.setScalar(d.r)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
      mesh.setColorAt(i, new THREE.Color(d.baseA, d.baseA, d.baseA))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [dust])

  useEffect(() => () => {
    geom.dispose()
    material.dispose()
  }, [geom, material])

  const col = useMemo(() => new THREE.Color(), [])
  useFrame((s) => {
    const mesh = meshRef.current
    if (!mesh || !animated) return
    const t = s.clock.elapsedTime
    for (let i = 0; i < dust.length; i++) {
      const d = dust[i]
      const a = Math.max(0, d.baseA + Math.sin(t + d.ph) * d.amp)
      col.setRGB(a, a, a)
      mesh.setColorAt(i, col)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geom, material, count]}
      renderOrder={-5}
      frustumCulled={false}
      dispose={null}
    />
  )
}

// ── fluid 배경 한 겹. back=dim nebula(별 뒤), front=어두운 구름(별 앞, 안개처럼 가림). 풀스크린 카메라에
//    맞춰 plane을 [2*aspect, 2]로 채운다. ──────────────────────────────────────────────────────────────
function BackdropLayer({
  kind,
  palette,
  animated,
}: {
  kind: 'back' | 'front'
  palette?: CosmosPalette
  animated: boolean
}) {
  const front = kind === 'front'
  const size = useThree((s) => s.size)
  const aspect = size.width / size.height
  const { material, update } = useMemo(
    () =>
      buildFluidMaterial(
        front
          ? { dark: true, palette, octaves: VALUES.cosmos.fluidOctaves }
          : // 뒤 nebula: radial 페이드 없이 **풀블리드**(화면 전체 고루) + 어둡게(딥스페이스). radial을 쓰면
            // 별필드 배경과 fluid 사이에 원형 경계가 생긴다(박스 한정에서만 radial을 쓴다).
            { palette, brightness: VALUES.cosmos.backBrightness, octaves: VALUES.cosmos.fluidOctaves },
      ),
    [front, palette],
  )
  const geom = useMemo(() => new THREE.PlaneGeometry(2, 2), [])
  useEffect(() => () => {
    geom.dispose()
    material.dispose()
  }, [geom, material])
  useFrame((s) => {
    if (animated) update(s.clock.elapsedTime)
  })
  return (
    <mesh
      geometry={geom}
      material={material}
      scale={[aspect, 1, 1]}
      position={[0, 0, front ? 0.5 : -1]}
      renderOrder={front ? 10 : -10}
      frustumCulled={false}
    />
  )
}

// ── 별 한 개: buildStarBody(uniform 바인딩) + halo(또렷한 소프트 글로우)를 앵커 위치에 얹는다. 위치·자전·
//    시간은 여기서 주입(프리미티브 밖). ────────────────────────────────────────────────────────────────
function StarMesh({ star, aspect, animated }: { star: StarVisual; aspect: number; animated: boolean }) {
  const spinRef = useRef<THREE.Group>(null)
  const body = useMemo(() => {
    const moodU = uniform(new THREE.Color(star.color))
    const brightU = uniform(1)
    const timeU = uniform(0)
    const built = buildStarBody(star.concept, {
      mood: moodU,
      brightness: brightU,
      seed: float(star.seed ?? 7),
      hueShift: float(0),
      time: timeU,
    })
    return {
      geometry: built.geometry,
      material: built.material,
      spin: STAR_FORM_SPIN[star.concept],
      update: (t: number) => {
        timeU.value = t
      },
    }
  }, [star.concept, star.color, star.seed])
  const halo = useMemo(() => buildHalo(star.color, 1), [star.color])
  useEffect(() => () => {
    body.geometry.dispose()
    body.material.dispose()
    halo.geometry.dispose()
    halo.material.dispose()
  }, [body, halo])

  useFrame((s) => {
    const t = animated ? s.clock.elapsedTime : 0
    body.update(t)
    halo.update(1)
    const g = spinRef.current
    if (g && animated) g.rotation.y = t * body.spin
  })

  const wx = (star.anchor[0] * 2 - 1) * aspect
  const wy = 1 - star.anchor[1] * 2
  return (
    <group position={[wx, wy, 0]} scale={star.size}>
      {/* 글로우 헤일로 — 별 뒤, 자전 안 함. 별 코어의 ~3.2배(예전 ThemedStar 비례). */}
      <mesh geometry={halo.geometry} material={halo.material} position={[0, 0, -0.02]} scale={3.2} renderOrder={-1} />
      <group ref={spinRef}>
        <mesh geometry={body.geometry} material={body.material} />
      </group>
    </group>
  )
}

/** 풀스크린 fit ortho 카메라 — 뷰를 [-aspect,aspect]×[-1,1]로 매핑(별 왜곡 없음, 배경 풀블리드).
 *  manual=true로 R3F의 리사이즈 frustum 덮어쓰기를 막고, size 변화에 직접 재설정한다. */
function FullscreenCamera() {
  const set = useThree((s) => s.set)
  const size = useThree((s) => s.size)
  const camRef = useRef<THREE.OrthographicCamera | null>(null)
  if (camRef.current === null) {
    const c = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100)
    c.position.set(0, 0, 10)
    ;(c as THREE.OrthographicCamera & { manual: boolean }).manual = true
    camRef.current = c
  }
  useLayoutEffect(() => {
    const cam = camRef.current
    if (!cam) return
    const aspect = size.width / size.height
    cam.left = -aspect
    cam.right = aspect
    cam.top = 1
    cam.bottom = -1
    cam.updateProjectionMatrix()
    set({ camera: cam })
  }, [set, size.width, size.height])
  return null
}

/** 스로틀 rAF — frameloop='demand'를 직접 ~fpsCap으로 invalidate(셰이더 평가 절감). 탭 숨으면 멈춤. */
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

function Scene({
  stars,
  palette,
  twinkleN,
  bloomOn,
  frontOn,
  animated,
}: {
  stars: StarVisual[]
  palette?: CosmosPalette
  twinkleN: number
  bloomOn: boolean
  frontOn: boolean
  animated: boolean
}) {
  const size = useThree((s) => s.size)
  const aspect = size.width / size.height
  return (
    <>
      <FullscreenCamera />
      {animated && <FrameDriver fps={VALUES.cosmos.fpsCap} />}
      <BackdropLayer kind="back" palette={palette} animated={animated} />
      {twinkleN > 0 && <Twinkle count={twinkleN} animated={animated} />}
      {stars.map((star, i) => (
        <StarMesh key={i} star={star} aspect={aspect} animated={animated} />
      ))}
      {frontOn && <BackdropLayer kind="front" palette={palette} animated={animated} />}
      {bloomOn && <BloomPass />}
    </>
  )
}

/**
 * 공유 우주 씬. 기본은 부모를 채우는 절대배치(`absolute inset-0`) — 소비처가 fixed 배경으로 쓰려면
 * className으로 감싼다. aria-hidden, pointer-events none.
 */
export function CosmosScene({
  stars = [],
  palette,
  twinkle,
  frontClouds = true,
  bloom = false,
  grain = true,
  quality,
  className,
}: CosmosSceneProps) {
  const reduced = !!useReducedMotion()
  const q = useMemo(() => quality ?? autoQuality(), [quality])
  const low = q === 'low'
  const animated = !reduced
  const twinkleN = twinkle ?? VALUES.cosmos.twinkleCount
  const resolvedTwinkle = low ? Math.round(twinkleN / 2) : twinkleN
  const bloomOn = bloom && !low
  const frontOn = frontClouds && !low
  const dpr = low ? 1 : ([1, VALUES.cosmos.sceneDpr] as [number, number])

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      // WebGPU 초기화 전 깜빡임 폴백 베이스색(씬이 뜨면 그 위를 덮는다).
      style={{ background: 'radial-gradient(120% 120% at 50% -10%, #12122a 0%, #08081a 50%, #040410 100%)' } as CSSProperties}
    >
      <Canvas
        gl={glFactory}
        flat
        dpr={dpr}
        frameloop="demand"
        onCreated={(state) => {
          // async WebGPU init 이후 한 프레임 보장(demand 모드 첫 프레임 누락 방지 — StarCanvas 관용구).
          state.invalidate()
        }}
      >
        <Scene
          stars={stars}
          palette={palette}
          twinkleN={resolvedTwinkle}
          bloomOn={bloomOn}
          frontOn={frontOn}
          animated={animated}
        />
      </Canvas>
      {grain && <GrainOverlay />}
    </div>
  )
}
