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
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import * as THREE from 'three'
import { uniform, float, vec3, uv, fract, smoothstep, clamp } from 'three/tsl'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { createRendererFactory, uniformColorNode } from '@/shared/lib/r3f'
import { VALUES } from '@/shared/config'
import { cn } from '@/shared/lib'
import { BloomPass, GrainOverlay, buildFluidMaterial, buildHalo, type CosmosPalette } from '@/shared/ui'
import { buildStarBody, STAR_FORM_SPIN, decodeStarSelection } from '@/entities/star'
import { buildSelfForm, decodeSelfSelection } from '@/entities/appearance'
import { DEFAULT_SYNAPSE_SELECTION, decodeSynapseSelection } from '@/entities/synapse'

// 투명 캔버스(뒤 페이지/베이스색 비침) — StarCanvas/FluidGradient와 동일한 alpha 강제.
const glFactory = createRendererFactory({ alpha: true })

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
  /** 스킨 선택 — 합성 wire id "<form>+<surface>"(레거시 단일 id도 허용). 내부에서 디코드(spec 52). */
  concept: string
  /** mood/accent hex(의미색). 별 + halo 색. */
  color: string
  /** 정규화 스크린 앵커 [x, y] ∈ [0,1]. (0,0)=좌상, (0.5,0.5)=정중앙. */
  anchor: [number, number]
  /** 별 코어 반지름(월드 단위 — 뷰 높이 [-1,1] 기준). halo는 이 값의 ~3.2배. */
  size: number
  seed?: number
}

/** 자아("나") 앵커 미리보기(plain data) — 플레이그라운드 미니 코스모스(spec 44 A12). 형태=concept,
 *  색=소비처 제공(미인증은 배경 accent placeholder). 위치는 정규화 스크린 앵커. */
export interface SelfVisual {
  /** 자아 스킨 선택 — 합성 wire id(레거시 단일 id도 허용). 내부 디코드(spec 52). */
  concept: string
  color: string
  anchor: [number, number]
  size: number
  seed?: number
}

/** 시냅스 표본(plain data) — 두 앵커를 잇는 한 가닥. 색=양끝 mood 블렌드(소비처 제공), 스타일=synapse 축. */
export interface SynapseVisual {
  a: [number, number]
  b: [number, number]
  colorA: string
  colorB: string
  weight: number
  /** 시냅스 스킨 선택 — 합성 wire id(레거시 단일 id도 허용). 내부 디코드(spec 52). */
  style?: string
}

/** 배경 텍스처/요소 슬롯(plain data — 위젯 decoupled, entity 미import). 소비처(페이지 어댑터)가 배경
 *  번들의 texture를 그대로 넘긴다(spec 44 A9). veilColor 없으면 미적용 → 기존 렌더와 동일. */
export interface BackdropTexture {
  veilColor?: string
  veilOpacity?: number
}

export interface CosmosSceneProps {
  /** 별들(0개면 순수 배경). */
  stars?: StarVisual[]
  /** 자아 "나" 앵커(선택) — 플레이그라운드 미니 코스모스의 4축 중 '나'(spec 44). */
  self?: SelfVisual
  /** 시냅스 표본(선택) — 미니 코스모스의 '시냅스' 축 표본 가닥들(spec 44). */
  synapses?: SynapseVisual[]
  /** 배경 fluid 팔레트(테마별). 미지정 시 기본(vast) 팔레트. */
  palette?: CosmosPalette
  /** 배경 텍스처/요소 번들(선택). 색 베일 한 겹을 fluid 뒤에 깐다(spec 44). */
  texture?: BackdropTexture
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
  const { material, update, setAspect } = useMemo(
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
  // plane이 scale=[aspect,1]로 늘어나므로 셰이더 노이즈 도메인도 같은 aspect로 보정 → 무늬가 화면 비율에
  // 따라 안 늘어난다(리사이즈마다 동기; useLayoutEffect로 첫 페인트 전에 설정해 깜빡임 방지).
  useLayoutEffect(() => {
    setAspect(aspect)
  }, [aspect, setAspect])
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

// ── 배경 텍스처 슬롯(spec 44 A9): 배경 번들에 texture가 있으면 fluid 뒤(z·renderOrder 최하)에 풀스크린 색
//    베일 한 겹. 별 mood 색은 불간섭(별보다 뒤). 텍스처 없으면 null(기존 렌더 동일). 비주얼은 디자인 반복용. ──
function VeilLayer({ texture }: { texture?: BackdropTexture }) {
  const size = useThree((s) => s.size)
  const aspect = size.width / size.height
  const geom = useMemo(() => new THREE.PlaneGeometry(2, 2), [])
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(texture?.veilColor ?? '#000000'),
        transparent: true,
        opacity: texture?.veilOpacity ?? 0.15,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
    [texture?.veilColor, texture?.veilOpacity],
  )
  useEffect(
    () => () => {
      geom.dispose()
      material.dispose()
    },
    [geom, material],
  )
  if (!texture?.veilColor) return null
  return (
    <mesh
      geometry={geom}
      material={material}
      scale={[aspect, 1, 1]}
      position={[0, 0, -1.5]}
      renderOrder={-20}
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
    const timeU = uniform(0)
    // 카메라 월드 위치 uniform(빌트인 cameraPosition 노드는 BloomPass가 동결 — StarField와 동일 회피). 매 프레임 update()가 갱신.
    const camPosU = uniform(new THREE.Vector3())
    // 배경 씬엔 자아-별·그래프가 없다(spec 03 3겹 미적용) — 브랜드 별은 자가발광 full(오늘 룩)에
    // 우상단 평행광(positional=0, 화면-비대칭 없음 = 태양) 반사를 더해 crystal 면/엣지를 드러낸다.
    const dir = VALUES.starLighting.backdropLightDir
    const { form, surface } = decodeStarSelection(star.concept)
    const built = buildStarBody(
      form,
      surface,
      {
        mood: moodU,
        glow: float(1), // 그래프 없음 → 연결성 대신 자가발광 full
        recency: float(1), // 평행광이라 거리 무관 — 반사 full
        seed: float(star.seed ?? 7),
        hueShift: float(0),
        time: timeU,
        cameraPos: camPosU,
        selfLightPos: vec3(dir[0], dir[1], dir[2]), // 우상단 방향(평행광)
        lightPositional: float(0), // 0 = directional
        litMix: float(1),
        focus: float(1),
      },
      {
        intensity: VALUES.starLighting.backdropLightIntensity,
        distance: VALUES.starLighting.selfDistance,
        decay: VALUES.starLighting.selfDecay,
        gain: VALUES.starLighting.litAlbedoGain,
      },
    )
    return {
      geometry: built.geometry,
      material: built.material,
      spin: STAR_FORM_SPIN[form],
      update: (t: number, camera: THREE.Camera) => {
        timeU.value = t
        camera.getWorldPosition(camPosU.value)
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
    body.update(t, s.camera)
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

// ── 자아 "나" 앵커: entity 소유 self-form 빌더(buildSelfForm, StarMesh 미러)를 앵커 위치에 얹는다.
//    색은 소비처 제공(미인증 플레이그라운드는 배경 accent placeholder). ─────────────────────────────
function SelfMesh({ self, aspect, animated }: { self: SelfVisual; aspect: number; animated: boolean }) {
  const built = useMemo(() => {
    const { form, surface } = decodeSelfSelection(self.concept)
    return buildSelfForm(form, surface)
  }, [self.concept])
  useEffect(() => {
    built.setColor(new THREE.Color(self.color))
  }, [built, self.color])
  useEffect(
    () => () => {
      built.geometry.dispose()
      built.material.dispose()
    },
    [built],
  )
  useFrame((s) => {
    built.update(animated ? s.clock.elapsedTime : 0, s.camera)
  })
  const wx = (self.anchor[0] * 2 - 1) * aspect
  const wy = 1 - self.anchor[1] * 2
  return <mesh geometry={built.geometry} material={built.material} position={[wx, wy, 0]} scale={self.size} />
}

// ── 시냅스 표본 가닥: 두 앵커를 잇는 살짝 휜 튜브 한 줄. 색=양끝 mood 블렌드(uv.x 그라디언트), 스타일은
//    선의 표현(흐름/빔/입자)만 바꾼다(SynapseFilaments 불변식과 동형 — 색은 mood 보존). ────────────────
function SampleStrand({ syn, aspect, animated }: { syn: SynapseVisual; aspect: number; animated: boolean }) {
  const built = useMemo(() => {
    // 합성 wire id → form(선 구조)×surface(움직임/질감) 디코드(spec 52, 우주 SynapseFilaments와 동형).
    const { form, surface } = decodeSynapseSelection(syn.style ?? DEFAULT_SYNAPSE_SELECTION)
    const isDotted = form === 'dotted'
    const isBranched = form === 'branched'
    const isBeads = surface === 'beads'
    const A = new THREE.Vector3((syn.a[0] * 2 - 1) * aspect, 1 - syn.a[1] * 2, 0)
    const B = new THREE.Vector3((syn.b[0] * 2 - 1) * aspect, 1 - syn.b[1] * 2, 0)
    const dir = B.clone().sub(A)
    const len = dir.length() || 1
    // form별 형태: dotted=가는 점선, branched=가는 가지 다발, strands=완만한 다발.
    const bowMag = isDotted ? len * 0.08 : len * 0.12
    const bow = new THREE.Vector3(-dir.y, dir.x, 0).normalize().multiplyScalar(bowMag)
    const mid = A.clone().lerp(B, 0.5).add(bow)
    const curve = new THREE.CatmullRomCurve3([A, mid, B])
    const radius = (0.004 + syn.weight * 0.01) * (isDotted ? 0.9 : isBranched ? 0.85 : 1)
    const geometry = new THREE.TubeGeometry(curve, 40, radius, 6, false)

    const material = new MeshBasicNodeMaterial()
    const cA = uniformColorNode(syn.colorA)
    const cB = uniformColorNode(syn.colorB)
    const uTime = uniform(0)
    const along = uv().x
    const around = uv().y
    const color = cA.add(cB.sub(cA).mul(along)) // endpoint mood blend (preserved across skins)
    const speed = VALUES.synapse.flowSpeed * (isBeads ? 1.3 : 1)
    const flow = fract(along.mul(2.0).sub(uTime.mul(speed)))
    const flowGlow = smoothstep(float(0.0), float(0.5), flow).mul(smoothstep(float(1.0), float(0.5), flow))
    let glow
    if (isBeads) {
      // beads: 더 밝은 비드(우주 SynapseFilaments와 동형).
      const cell = fract(along.mul(6.0).sub(uTime.mul(speed)))
      glow = float(0.55).add(smoothstep(float(0.16), float(0.0), cell).mul(1.7))
    } else if (surface === 'steady') {
      // steady: 흐름 없이 어둡게 깔린다(flow와 대비).
      glow = float(0.5)
    } else {
      // flow(기본): 훨씬 밝게 반짝이는 흐르는 packet.
      glow = float(0.7).add(flowGlow.mul(1.1))
    }
    material.colorNode = color.mul(glow)
    const coreBand = smoothstep(float(1.0), float(0.0), around.sub(0.5).abs().mul(2.0))
    const ends = smoothstep(float(0.0), float(0.1), along).mul(smoothstep(float(1.0), float(0.9), along))
    // beads만 점선: 비드 사이를 불투명도로 끊는다(바닥 0.16).
    const opacShape = isBeads
      ? smoothstep(float(0.3), float(0.0), fract(along.mul(6.0).sub(uTime.mul(speed)))).mul(0.84).add(0.16)
      : float(1)
    material.opacityNode = clamp(coreBand.mul(0.6).add(0.4).mul(ends).mul(0.7).mul(opacShape), float(0.0), float(1.0))
    material.transparent = true
    material.depthWrite = false
    material.blending = THREE.AdditiveBlending
    material.toneMapped = false
    material.side = THREE.DoubleSide
    const update = (t: number) => {
      uTime.value = t
    }
    return { geometry, material, update }
  }, [syn.a, syn.b, syn.colorA, syn.colorB, syn.weight, syn.style, aspect])
  useEffect(
    () => () => {
      built.geometry.dispose()
      built.material.dispose()
    },
    [built],
  )
  useFrame((s) => {
    built.update(animated ? s.clock.elapsedTime : 0)
  })
  return <mesh geometry={built.geometry} material={built.material} frustumCulled={false} />
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
  self,
  synapses,
  palette,
  texture,
  twinkleN,
  bloomOn,
  frontOn,
  animated,
}: {
  stars: StarVisual[]
  self?: SelfVisual
  synapses?: SynapseVisual[]
  palette?: CosmosPalette
  texture?: BackdropTexture
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
      <VeilLayer texture={texture} />
      <BackdropLayer kind="back" palette={palette} animated={animated} />
      {twinkleN > 0 && <Twinkle count={twinkleN} animated={animated} />}
      {/* 시냅스 표본은 별 뒤에(연결이 별을 가리지 않게) — StarMesh 앞 렌더. */}
      {synapses?.map((syn, i) => (
        <SampleStrand key={`syn-${i}`} syn={syn} aspect={aspect} animated={animated} />
      ))}
      {stars.map((star, i) => (
        <StarMesh key={i} star={star} aspect={aspect} animated={animated} />
      ))}
      {self && <SelfMesh self={self} aspect={aspect} animated={animated} />}
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
  self,
  synapses,
  palette,
  texture,
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
          self={self}
          synapses={synapses}
          palette={palette}
          texture={texture}
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
