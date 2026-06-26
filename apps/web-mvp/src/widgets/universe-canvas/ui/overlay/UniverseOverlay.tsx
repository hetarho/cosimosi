// Two universes overlaid (spec 37): my universe and a friend's public universe in ONE scene,
// offset apart (two skies), each with its own force-sim (constitution §3), joined ONLY by the
// resonance bridges (spec 36). A self-contained <Canvas> — separate from UniverseCanvas — because
// two universes can't share the single-universe singletons; the visit page mounts THIS in place of
// UniverseCanvas while navigation is in `overlay` (a pure read-only view — no write RPC, 3.1).
//
// Mirrors UniverseCanvas's renderer lifecycle (async WebGPU factory + WebGL2 fallback, deferred
// mount, ResizeObserver, init-error surfacing). Stars/synapses are the reused prop-driven entities;
// the bridge is the only cross-universe element.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { type WebGPURenderer } from 'three/webgpu'
import type { SynapseEdge } from '@/entities/synapse'
import type { StarNode } from '@/entities/memory'
import { mulberry32, reportUniverseRenderer } from '@/shared/lib'
import { asWebGPURenderer, createRendererFactory, rendererBackend } from '@/shared/lib/r3f'
import { VALUES } from '@/shared/config'
import { BloomPass } from '@/shared/ui'
import { OverlayUniverse } from './OverlayUniverse'
import { ResonanceBridges, type Bridge } from './ResonanceBridges'
import { OverlayCamera } from './OverlayCamera'
import type { OverlayHandle } from './types'

// The two skies sit this far apart on the vertical axis — a clear gap above the ~46-radius clouds,
// so they read as two distinct universes with the bridges arcing between (spec 37 이격 배치).
const OVERLAY_OFFSET = VALUES.overlay.skyOffset

export interface OverlaySide {
  stars: StarNode[]
  edges: SynapseEdge[]
  /** 전역 기본 별 룩(change 29). 레거시 단일 id도 허용(StarField가 폴백). */
  object?: string
  /** 감정별 별 룩 오버라이드(mood→look, change 30). */
  starFormByEmotion?: Record<string, string>
  emotionColors?: Record<string, string>
}

export interface UniverseOverlayProps {
  /** the logged-in viewer's own universe (below). */
  mine: OverlaySide
  /** the friend's public universe (above) — content-zero landscape (spec 35). */
  theirs: OverlaySide
  /** caller↔owner resonance bridges (spec 37 GetResonanceBridges). */
  bridges: Bridge[]
  /** background color (the viewer's theme base). */
  bg?: string
}

/** Faint ambient dust so the void has depth (independent of either graph). */
function OverlayDust({ count = 1400 }: { count?: number }) {
  const positions = useMemo(() => {
    const rng = mulberry32(0x0ddba11)
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 60 + rng() * 220
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
      <pointsMaterial size={0.7} sizeAttenuation color="#9fb4ff" transparent opacity={0.4} depthWrite={false} />
    </points>
  )
}

export function UniverseOverlay({ mine, theirs, bridges, bg = '#05060d' }: UniverseOverlayProps) {
  const glRef = useRef<WebGPURenderer | null>(null)
  const resizeObsRef = useRef<ResizeObserver | null>(null)
  useEffect(
    () => () => {
      resizeObsRef.current?.disconnect()
      glRef.current?.dispose()
    },
    [],
  )

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

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

  const [initError, setInitError] = useState<unknown>(null)
  const glFactory = useMemo(
    () =>
      createRendererFactory({
        onError: (e) => setInitError(e),
      }),
    [],
  )
  if (initError != null) throw initError

  // Each universe writes its live buffer + index + offset here so the bridge can span them.
  const mineHandle = useRef<OverlayHandle | null>(null)
  const theirsHandle = useRef<OverlayHandle | null>(null)

  if (!mounted) return null

  return (
    <Canvas
      gl={glFactory}
      flat
      camera={{ position: [0, 0, 250], fov: 60, near: 0.1, far: 3000 }}
      onCreated={(state) => {
        const gl = asWebGPURenderer(state.gl)
        glRef.current = gl
        const container = gl.domElement.parentElement ?? gl.domElement
        const ro = new ResizeObserver(() => syncSize(gl, state.camera, container))
        ro.observe(container)
        resizeObsRef.current = ro
        reportUniverseRenderer(rendererBackend(gl))
      }}
    >
      <color attach="background" args={[bg]} />
      <ambientLight intensity={VALUES.starLighting.ambientFill} />
      <OverlayDust />
      {/* 내 우주(아래) — 내 시각 설정·따뜻한 기운. */}
      <OverlayUniverse
        stars={mine.stars}
        edges={mine.edges}
        offset={[0, -OVERLAY_OFFSET, 0]}
        object={mine.object}
        starFormByEmotion={mine.starFormByEmotion}
        emotionColors={mine.emotionColors}
        atmosphere="#3a2f5a"
        handleRef={mineHandle}
      />
      {/* 친구 우주(위) — 친구의 시각 설정 유지 + 차가운 공통 틴트로 "남의 하늘" 느낌(spec 37). */}
      <OverlayUniverse
        stars={theirs.stars}
        edges={theirs.edges}
        offset={[0, OVERLAY_OFFSET, 0]}
        object={theirs.object}
        starFormByEmotion={theirs.starFormByEmotion}
        emotionColors={theirs.emotionColors}
        atmosphere="#23406a"
        handleRef={theirsHandle}
      />
      {/* 공명 다리 — 두 우주를 가로지르는 유일한 선(spec 36 공명). */}
      <ResonanceBridges mineRef={mineHandle} theirsRef={theirsHandle} bridges={bridges} />
      <OverlayCamera mineRef={mineHandle} theirsRef={theirsHandle} />
      <BloomPass />
    </Canvas>
  )
}
