// The universe canvas shell (Architecture §3.3): R3F <Canvas> + async WebGPU
// renderer + dark background + ambient star dust + the real StarField (08, driven by
// the memory store / spec 10 data) + Bloom + camera rig. No DOM <Html> in the scene
// (constitution §4 — mobile portability); labels/HUD are a separate 2D widget.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useSelector } from '@xstate/react'
import * as THREE from 'three'
import { type WebGPURenderer } from 'three/webgpu'
import { StarField } from '@/entities/star'
import { SynapseFilaments, SynapseDust, useSynapseStore, edgesWithin } from '@/entities/synapse'
import {
  useMemoryStore,
  starsOfRecord,
  rankedEmotions,
  arousalOf,
  type AmbientStar,
  focusActor,
  selectFocusedStarId,
  selectHighlightedRecordId,
  selectIsStarFocus,
  selectIsDiaryFocus,
} from '@/entities/memory'
import { useAppearance, backgroundMeta, type BackgroundTexture } from '@/entities/appearance'
import { resolveMoodRgb, NEUTRAL_RGB, VALUES } from '@/shared/config'
import { cn, mulberry32, reportUniverseRenderer } from '@/shared/lib'
import { UniverseNebula } from './UniverseNebula'
import { SelfStar } from './SelfStar'
import { navigationInput } from '../model/navigation-input'
import { virtualNowMs } from '@/shared/lib/demo'
import { asWebGPURenderer, createRendererFactory, rendererBackend } from '@/shared/lib/r3f'
import {
  CameraRig,
  NebulaOrbitController,
  CloseGestureController,
  NavController,
  LiveLayoutController,
  FlyToController,
  FrameAllController,
  FocusNavBridge,
  RecallDismissGuard,
  ModeTransitionController,
  ViewOffsetController,
  FocusController,
} from './controllers'
import { BloomPass } from '@/shared/ui'
import type { LayoutMap } from '../model/layout-position'

/** Stable empty highlight set (spec 28) — a module singleton so the default prop identity
 *  never changes (no needless re-memo / effect re-run when nothing is highlighted). */
const EMPTY_ID_SET: ReadonlySet<string> = new Set()

/** Faint ambient point cloud — the "star dust" backdrop (acceptance 1.3). Always
 *  present, independent of the graph, so an empty universe still renders (1.10).
 *  mulberry32 (not Math.random) keeps generation pure during render
 *  (react-hooks/purity) and the layout stable across re-renders. */
// 배경 번들의 텍스처/요소 슬롯(spec 44 A9): 선택된 배경에 texture가 있으면 장면을 감싸는 큰 안쪽 구
// 한 겹으로 은은한 색 베일을 깐다(별보다 멀고 renderOrder<0·depthWrite 없음 → 별 mood 색·깊이 불간섭).
// 텍스처 없는 배경(vast/lively/calm)은 null → 기존 렌더와 동일. 비주얼 디테일은 디자인 반복용 슬롯.
function BackgroundVeil({ texture }: { texture?: BackgroundTexture }) {
  if (!texture?.veilColor) return null
  return (
    <mesh renderOrder={-2}>
      {/* 반경은 nebula 자유 궤도 최대 거리(1500)보다 커야 한다 — 안 그러면 줌아웃 시 카메라가 베일
          구를 빠져나가 BackSide 근접면이 컬링되며 먼 반구가 화면 중앙에 뭉쳐 보인다("백드롭 풀림").
          UniverseNebula(1800)와 같은 안전 반경. */}
      <sphereGeometry args={[1800, 24, 16]} />
      <meshBasicMaterial
        color={texture.veilColor}
        side={THREE.BackSide}
        transparent
        opacity={texture.veilOpacity ?? 0.15}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

function StarDust({ count = 1500 }: { count?: number }) {
  // Dim the ambient dust while a star is focused (spotlight) OR a diary is highlighted
  // (원본 일기 조망, spec 28) so only the foregrounded stars read bright. (focus 머신, spec 39)
  const focused = useSelector(focusActor, selectIsStarFocus)
  const highlighting = useSelector(focusActor, selectIsDiaryFocus)
  const dimmed = focused || highlighting
  const positions = useMemo(() => {
    const rng = mulberry32(0x5eed)
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 35 + rng() * 110
      const theta = rng() * Math.PI * 2
      const phi = Math.acos(2 * rng() - 1)
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      arr[i * 3 + 2] = r * Math.cos(phi)
    }
    return arr
  }, [count])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.7}
        sizeAttenuation
        color="#9fb4ff"
        transparent
        opacity={dimmed ? VALUES.starDust.opacityDimmed : VALUES.starDust.opacityNormal}
        depthWrite={false}
      />
    </points>
  )
}

/** Renders the synapse graph (braided TSL filaments) at the SAME star positions the live
 *  force-sim produces (shared `layout` snapshot), so edges connect the rendered stars; each
 *  filament also fades between its two endpoint stars' mood colors. Edge brightness (incl.
 *  dormant dimming) is already baked into the store by get-universe (12). positionOf + colorOf
 *  are built in one useMemo so both stay stable (the filament geometry rebuilds only when the
 *  star set, colors, or the published layout change — not on every parent render). The layout
 *  is published at build (seed positions) and again on each settle, so filaments render right
 *  away and then reconnect at the relaxed coordinates once the sim settles (spec 22/38). */
function UniverseSynapses({
  layout,
  positionsRef,
  highlightedRecordId = null,
}: {
  layout: LayoutMap
  positionsRef: MutableRefObject<Float32Array | null>
  /** 강조 중인 원본 일기 id(spec 28). null = 강조 없음. 자기 stars 구독으로 집합을 파생한다. */
  highlightedRecordId?: string | null
}) {
  const edges = useSynapseStore((s) => s.edges)
  const stars = useMemoryStore((s) => s.stars)
  const emotionColors = useAppearance((s) => s.emotionColors)
  // 시냅스 스타일(spec 44): 선택값을 그대로 적용(store가 알 수 없는 스타일은 default로 검증·폴백). 소유권은
  // 스위처 선택 시점 + 서버 UpdateSettings(A4)에서 강제 — 렌더 폴백은 공유 우주 방문 시 소유자 선택을
  // 방문자 소유로 가려 회귀하므로 하지 않는다. 색·weight 시각·삭제금지 불변식은 SynapseFilaments가 유지.
  const synapseStyle = useAppearance((s) => s.synapseStyle)
  const selectedId = useSelector(focusActor, selectFocusedStarId)
  // 강조 일기의 별 id 집합 — record_id로 그룹(spec 28). 별 집합/강조 record 변경 시에만 재계산.
  const highlightedIds = useMemo(
    () =>
      highlightedRecordId
        ? new Set(starsOfRecord(stars, highlightedRecordId).map((s) => s.id))
        : EMPTY_ID_SET,
    [highlightedRecordId, stars],
  )
  // 일기 조망 강조(spec 28)는 단일 선택이 없을 때만(선택=근접 포커스 우선, StarField와 동일).
  const highlightActive = !selectedId && highlightedIds.size > 0
  // Spotlight/조망: fade the whole synapse web while a star is focused OR a diary is framed,
  // so the foregrounded connections stand alone. 조망일 땐 그 일기의 일내(intra) 선만 위에 또렷이.
  const dim = selectedId ? VALUES.focus.synapseDimStar : highlightActive ? VALUES.focus.synapseDimDiary : 1
  const { positionOf, colorOf, seedOf } = useMemo(() => {
    const colById = new Map(stars.map((s) => [s.id, resolveMoodRgb(s.memory.mood, emotionColors)] as const))
    const seedById = new Map(stars.map((s) => [s.id, s.memory.seed] as const))
    return {
      positionOf: (id: string): [number, number, number] | null => layout.get(id) ?? null,
      colorOf: (id: string): readonly [number, number, number] => colById.get(id) ?? NEUTRAL_RGB,
      // 부유 seed(StarField와 동일) — 필라멘트 끝이 떠다니는 별 중앙을 따라간다(spec 19).
      seedOf: (id: string): number => seedById.get(id) ?? 0,
    }
  }, [stars, emotionColors, layout])
  // id → live force-sim buffer row (stars order == sim.ids order == buffer order). Lets the
  // filaments follow the live positions per frame so they don't lag the moving stars (spec 24).
  const idIndex = useMemo(() => new Map(stars.map((s, i) => [s.id, i] as const)), [stars])
  // 강조 일기의 일내(within-event) 선 — 두 끝점이 모두 강조 집합에 든 엣지(spec 28, 1.1).
  const withinEdges = useMemo(
    () => (highlightActive ? edgesWithin(edges, highlightedIds) : []),
    [edges, highlightedIds, highlightActive],
  )
  if (edges.length === 0 || stars.length === 0) return null
  return (
    <>
      <SynapseFilaments
        edges={edges}
        positionOf={positionOf}
        colorOf={colorOf}
        seedOf={seedOf}
        positionsRef={positionsRef}
        idIndex={idIndex}
        dim={dim}
        style={synapseStyle}
      />
      <SynapseDust
        edges={edges}
        positionOf={positionOf}
        colorOf={colorOf}
        positionsRef={positionsRef}
        idIndex={idIndex}
        dim={dim}
      />
      {/* 조망 강조: 그 일기의 일내 선만 또렷하게(dim=1) 위에 한 겹 더 — 나머지 웹은 dim. */}
      {withinEdges.length > 0 && (
        <SynapseFilaments
          edges={withinEdges}
          positionOf={positionOf}
          colorOf={colorOf}
          seedOf={seedOf}
          positionsRef={positionsRef}
          idIndex={idIndex}
          dim={1}
          style={synapseStyle}
        />
      )}
    </>
  )
}

/** 우주의 숨(미세 부유): 별·시냅스를 한 그룹으로 묶어 아주 느리게 위아래·좌우로 띄운다 —
 *  입력이 없을 때도 우주가 정지화면처럼 굳지 않는다. 시냅스가 같은 그룹에 있어 연결이
 *  별에서 떨어지지 않고, 진폭(≤0.9)이 작아 fly-to/포커스의 고정 좌표 타깃과의 오차는
 *  체감되지 않는다. 별이 선택(포커스)되면 진폭을 0으로 풀어 조준이 흔들리지 않게 하고,
 *  prefers-reduced-motion이면 아예 움직이지 않는다(정책: motion-accessibility). */
function UniverseDrift({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const amp = useRef(1) // 선택 중 0으로, 해제 후 1로 부드럽게 복귀
  const selected = useSelector(focusActor, selectIsStarFocus)
  const reduce = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  useFrame((state, dt) => {
    const g = ref.current
    if (!g || reduce) return
    amp.current += ((selected ? 0 : 1) - amp.current) * (1 - Math.exp(-dt * 2))
    const t = state.clock.elapsedTime
    g.position.y = Math.sin(t * 0.22) * 0.9 * amp.current
    g.position.x = Math.sin(t * 0.13 + 1.7) * 0.45 * amp.current
  })
  return <group ref={ref}>{children}</group>
}

export function UniverseCanvas() {
  // R3F does NOT dispose a custom WebGPU renderer on unmount (its teardown only
  // calls renderLists?.dispose()/forceContextLoss?.(), neither of which exists on
  // WebGPURenderer), so we dispose it ourselves. This parent-level cleanup runs
  // AFTER the Canvas subtree (incl. BloomPass) unmounts, so the pipeline is
  // disposed first, then the renderer frees the backend device + all GPU textures
  // (acceptance 1.7).
  const glRef = useRef<WebGPURenderer | null>(null)
  const resizeObsRef = useRef<ResizeObserver | null>(null)
  useEffect(
    () => () => {
      resizeObsRef.current?.disconnect()
      glRef.current?.dispose()
    },
    [],
  )

  // Mount the R3F <Canvas> one frame after this widget, never on the same tick. R3F
  // only configures the renderer once it measures the container as non-zero; on a
  // fresh authed load the canvas would otherwise mount mid-layout, get measured as
  // 0×0, and never render (black). Deferring to the next animation frame guarantees
  // the full-viewport container is laid out before R3F measures it.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Keep the renderer + camera synced to the container size: ResizeObserver re-applies
  // it on layout changes and window resizes, so the WebGPU color attachment never
  // diverges from the swapchain (a mismatch rejects every frame → black canvas).
  const syncSize = useCallback((gl: WebGPURenderer, camera: THREE.Camera, el: Element) => {
    const w = el.clientWidth
    const h = el.clientHeight
    if (w === 0 || h === 0) return
    gl.setSize(w, h, true)
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
  }, [])

  // 렌더러 init 실패 표면화: R3F는 async gl 팩토리의 reject를 fire-and-forget
  // 으로 삼킨다(.catch 없는 내부 run()) — 바운더리가 영영 못 받는다. 그래서 실패를
  // state로 받아 "렌더 중 throw"로 바꿔 페이지의 에러 바운더리에 전달한다.
  const [initError, setInitError] = useState<unknown>(null)
  const glFactory = useMemo(
    () =>
      createRendererFactory({
        onError: (e) => setInitError(e),
      }),
    [],
  )
  if (initError != null) throw initError

  // 우주의 배경 = 선택한 배경(Background) 번들(spec 44): 깊은 clear color + 선택적 텍스처(veil) 결.
  // 별(기억) 색은 mood(감정 의미색)라 배경과 무관하게 보존된다(A9 — StarField는 emotionColors/mood만 읽음).
  const background = backgroundMeta(useAppearance((s) => s.theme))
  const bg = background.bg
  // 별(기억) 오브제의 형태 = 선택한 object. StarField가 형태별 지오메트리·재질로 그린다(색은 mood 유지).
  const object = useAppearance((s) => s.object)
  // 감정색 사용자 오버라이드(spec 30) — 별·시냅스 색에 기본 팔레트 대신 우선 적용(빈 맵=기본).
  const emotionColors = useAppearance((s) => s.emotionColors)
  // 중심 "나" 별 형태(spec 38·44) — 우주 중심 앵커. 선택값을 그대로 그린다(store가 알 수 없는 id를 이미
  // 축 기본값으로 폴백·검증). 소유권은 *선택 시점*(스위처)과 서버(UpdateSettings A4)에서 강제한다 —
  // 렌더에서 소유권으로 다시 폴백하면 공유 우주(방문)에서 소유자 선택을 방문자 소유로 가려 깨진다(회귀).
  const selfObject = useAppearance((s) => s.selfObject)
  // 요즘 감정 짜임(spec 07): 로드된 별 + 사용자 감정색 + Bjork R로 감정 순위·전역 생동(arousal)을 파생해
  // 배경 스킨(UniverseNebula)이 직접 짜 넣는다(떠 있던 무드 오브 제거). 매 별/감정색 변경 시에만 재계산.
  const stars = useMemoryStore((s) => s.stars)
  const { ranked, arousal } = useMemo(() => {
    const now = virtualNowMs()
    const ambientStars: AmbientStar[] = stars.map((s) => ({
      mood: s.memory.mood,
      intensity: s.memory.intensity,
      valence: s.memory.valence,
      lastRecalledAt: s.memory.lastRecalledAt,
      recallCount: s.memory.recallCount,
    }))
    return { ranked: rankedEmotions(ambientStars, emotionColors, now), arousal: arousalOf(ambientStars, now) }
  }, [stars, emotionColors])
  // 포커스 상태(focus 머신, spec 39) — 강조 일기 record_id + 선택 별 id. StarField/UniverseSynapses에
  // prop으로 내려 record_id로 자기 별 집합을 파생해 강조/dim하고, 별 탭은 onSelect로 머신에 보낸다.
  const highlightedRecordId = useSelector(focusActor, selectHighlightedRecordId)
  const selectedId = useSelector(focusActor, selectFocusedStarId)

  // The ONE live force-sim positions buffer all four readers share:
  // StarField + FlyTo + Focus read it directly (per-frame / at capture); the synapse renderers
  // bake against the `layout` snapshot published whenever the layout settles.
  const positionsRef = useRef<Float32Array | null>(null)
  // 동적 자아 광원 위치: 근접 탐험 중 NavController가 매 프레임 항행 기준 위치로 갱신하고,
  // 원거리/포커스에선 null로 둬 StarField가 정적 중심 광원(원점)으로 폴백한다. StarField·NavController가 공유.
  const selfLightRef = useRef<readonly [number, number, number] | null>(null)
  const [layout, setLayout] = useState<LayoutMap>(() => new Map())
  const onLayout = useCallback((next: LayoutMap) => setLayout(next), [])
  // Hide the stars/synapses until the FIRST layout settles, then reveal them in place — so
  // the user never sees filaments snapping from seed positions to their relaxed spots (38).
  const [ready, setReady] = useState(false)
  const onReady = useCallback(() => setReady(true), [])
  const onReset = useCallback(() => setReady(false), []) // re-veil on a mid-session source reset
  // Safety net: reveal anyway after a few seconds so a stuck/errored load (stars never
  // arrive, layout never settles) can't trap the user behind the loading veil forever.
  useEffect(() => {
    if (ready) return
    const id = setTimeout(() => setReady(true), 8000)
    return () => clearTimeout(id)
  }, [ready])

  if (!mounted) return null

  return (
    <>
      {/* 첫 레이아웃이 정착할 때까지 별·시냅스를 가리고, 그 동안 별먼지 배경 위에 잔잔한 안내를
          띄운다. 정착하면 부드럽게 사라진다(pointer-events 없음 — HUD는 그대로 조작 가능). */}
      <div
        aria-hidden={ready}
        className={cn(
          'pointer-events-none absolute inset-0 z-10 grid place-items-center transition-opacity duration-700',
          ready ? 'opacity-0' : 'opacity-100',
        )}
      >
        <p className="animate-pulse text-sm tracking-wide text-white/55">
          별들이 제자리를 찾고 있어요…
        </p>
      </div>
      <Canvas
      // gl = async WebGPU factory (WebGL2 auto-fallback) + init 실패 표면화 래퍼.
      gl={glFactory}
      flat
      // 우주 캔버스 표면에만 touch-action:none — 브라우저 스크롤/핀치가 커스텀 제스처
      // (pan·zoom scrub·look·thrust)와 충돌하지 않게. 차단은 이 캔버스에 한정(전역 페이지 제스처 보존).
      style={{ touchAction: 'none' }}
      // far는 성운/베일 구의 *먼 쪽 벽*까지 담아야 한다 — 그 벽은 카메라가 구 안에 있어도 반경+카메라거리
      // 까지 멀어진다. 줌아웃 최대(1500) + 구 반경(1800) = 3300이 화면 중앙(원점 너머)에서 far에 닿으므로,
      // far가 그보다 작으면 중앙이 잘려 배경색이 원형으로 드러난다("백드롭 풀림"). 여유를 둬 4000.
      camera={{ position: [0, 0, 110], fov: 72, near: 0.1, far: 4000 }}
      // 빈 우주를 톡 치면 포커스 해제·복귀(은은한 딤도 함께 사라진다). R3F는 클릭 delta로
      // 드래그(회전)를 걸러 onPointerMissed는 '탭'에만 온다. 우선순위: 선택된 별 → 해제, 아니면 일기
      // 조망 → 강조 해제(페이지가 그 해제를 보고 일기 패널을 닫아 완전히 복귀시킨다). 별 탭은 onClick.
      onPointerMissed={() => {
        // 빈 우주를 톡 치면 포커스를 통째로 비워 복귀한다(focus 머신 DISMISS — 별/일기 한 번에, idle이면
        // 무해). 드래그(회전)는 R3F가 delta로 걸러 여기로 오지 않는다(탭만). 제스처
        // (드래그·두 손가락·pan·zoom scrub)가 active면 dismiss하지 않는다 — gestureActive는 up 후
        // microtask까지 살아 이 동기 콜백을 넘긴다(진짜 탭은 한 번도 set 안 돼 통과).
        if (navigationInput().gestureActive) return
        focusActor.send({ type: 'DISMISS' })
      }}
      onCreated={(state) => {
        const gl = asWebGPURenderer(state.gl)
        glRef.current = gl
        const container = gl.domElement.parentElement ?? gl.domElement
        const ro = new ResizeObserver(() => syncSize(gl, state.camera, container))
        ro.observe(container)
        resizeObsRef.current = ro
        // universe_loaded의 renderer 속성(18, 3.3) — WebGPU/WebGL2 폴백 비율 측정.
        reportUniverseRenderer(rendererBackend(gl))
        if (import.meta.env.DEV) {
          console.log('[universe] renderer backend:', rendererBackend(gl))
        }
      }}
    >
      <color attach="background" args={[bg]} />
      {/* 몽환 성운 워시(spec 44·07): 선택한 배경 스킨(받침색·무늬)으로 사방을 감싸는 도메인워프 오로라 한 겹.
          그 위에 요즘 감정색(상위 emotionSlots개·R-비중)을 짜 넣고, arousal이 전역 생동(밝기·움직임)을 정한다.
          모든 것 뒤(renderOrder -11)·depthWrite/Test 없음 → 별 mood 색·깊이 불간섭. reduced-motion이면 정지. */}
      <UniverseNebula
        palette={background.palette}
        pattern={background.pattern}
        effect={background.effect}
        emotionSlots={background.emotionSlots}
        emotions={ranked}
        arousal={arousal}
      />
      {/* 배경 번들의 텍스처/요소 슬롯(spec 44 A9): 선택적 색 베일 한 겹을 모든 것 뒤(renderOrder<0)에 깐다.
          별 mood 색은 불간섭(별보다 뒤·depthWrite 없음). 텍스처 없는 배경(vast/lively/calm)은 렌더 동일. */}
      <BackgroundVeil texture={background.texture} />
      {/* 어두운 반구 채움광(spec 03). 반사(emissiveNode 내 계산)와 albedo가 이중계상되지 않게
          values 출처의 낮은 ambient fill만 둔다. StarField는 자아-별이 원점이라 selfLightPos 기본으로 충분. */}
      <ambientLight intensity={VALUES.starLighting.ambientFill} />
      {/* spec 07: 떠 있던 무드 오브(AmbientNebula)는 제거 — 요즘 감정은 위 UniverseNebula 배경 텍스처에 녹는다. */}
      <StarDust count={1500} />
      {/* 별과 시냅스는 함께 부유(연결이 떨어지지 않게); StarDust는 밖에 두어 시차가 생긴다.
          자아 별(나)도 같은 그룹에서 부유해 강한 기억과의 거리감이 유지된다(spec 38).
          visible=ready: 첫 레이아웃이 정착하기 전엔 가려, 시냅스가 엉뚱한 자리에서 움직이는
          과정을 숨기고 모두 제자리에 놓인 뒤 드러낸다(38). 컨트롤러는 게이트 밖에서 항상 돈다. */}
      <group visible={ready}>
        <UniverseDrift>
          <SelfStar selfObject={selfObject} anchorRef={selfLightRef} />
          <UniverseSynapses
            layout={layout}
            positionsRef={positionsRef}
            highlightedRecordId={highlightedRecordId}
          />
          <StarField
            object={object}
            emotionColors={emotionColors}
            positionsRef={positionsRef}
            highlightedRecordId={highlightedRecordId}
            selectedId={selectedId}
            onSelect={(id) => focusActor.send({ type: 'SELECT_STAR', id })}
            selfLightRef={selfLightRef}
          />
        </UniverseDrift>
      </group>
      <LiveLayoutController
        positionsRef={positionsRef}
        onLayout={onLayout}
        onReady={onReady}
        onReset={onReset}
      />
      <CameraRig />
      <NebulaOrbitController />
      <CloseGestureController />
      <NavController selfLightRef={selfLightRef} />
      <FlyToController positionsRef={positionsRef} />
      <FocusController positionsRef={positionsRef} />
      <FrameAllController positionsRef={positionsRef} />
      <FocusNavBridge />
      <RecallDismissGuard />
      <ModeTransitionController />
      <ViewOffsetController />
      <BloomPass />
      </Canvas>
    </>
  )
}
