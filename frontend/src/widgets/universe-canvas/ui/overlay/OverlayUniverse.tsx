// One universe inside the spec-37 overlay: a self-contained force-sim + the reused (prop-driven)
// StarField + SynapseFilaments, rendered in a <group> offset to its half of the sky. This does
// NOT touch the singleton memory/synapse stores — two universes can't share one store — so it
// feeds StarField/SynapseFilaments via PROPS (StarField's spec-37 external source). Coordinates
// emerge from this universe's own sim (constitution §3); the parent reads the live buffer through
// `handleRef` to draw the cross-universe resonance bridge.
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { StarField } from '@/entities/star'
import { SynapseFilaments, type SynapseEdge } from '@/entities/synapse'
import { activation, A_MIN, type StarNode } from '@/entities/memory'
import type { StarObject } from '@/entities/star'
import { resolveMoodRgb, NEUTRAL_RGB } from '@/shared/config'
import {
  fibonacciStarPosition,
  scatterDirection,
  strength as memoryStrength,
  targetRadius,
} from '@/shared/lib'
import {
  createSim,
  isSettled,
  positions as simPositions,
  tick,
  type SimEdge,
  type SimNode,
  type SimState,
} from '@/shared/lib/force-sim'
import { virtualNowMs } from '@/shared/lib/demo'
import type { OverlayHandle } from './types'

/** id → settled coord snapshot (what the filaments bake against). */
type LayoutMap = Map<string, [number, number, number]>

const TICKS_PER_FRAME = 2
const EMPTY_LAYOUT: LayoutMap = new Map() // stable identity for the empty publish

/** Distance from this universe's centre by strength (spec 38 radadial shell) — strong/fresh near,
 *  faded outer. Activation floored at A_MIN so the most dormant don't all collapse onto one shell. */
function radiusOf(mem: { lastRecalledAt: number; intensity: number }, now: number): number {
  return targetRadius(memoryStrength(Math.max(A_MIN, activation(mem.lastRecalledAt, now)), mem.intensity))
}

/** Scale a seed direction onto a target-radius shell, keeping its direction. */
function atRadius(pos: readonly [number, number, number], r: number): [number, number, number] {
  const len = Math.hypot(pos[0], pos[1], pos[2])
  if (len < 1e-3) return [r, 0, 0]
  const k = r / len
  return [pos[0] * k, pos[1] * k, pos[2] * k]
}

export interface OverlayUniverseProps {
  stars: StarNode[]
  edges: SynapseEdge[]
  /** world-space offset for this universe's <group> (the two skies sit apart). */
  offset: [number, number, number]
  object?: StarObject
  emotionColors?: Record<string, string>
  /** faint enclosing atmosphere color (hex) — gives the friend's sky a "남의 하늘" wash without
   *  recoloring its stars (spec 37 친구 틴트: keep the owner's spec-30 colors, add a common tint). */
  atmosphere?: string
  /** the parent populates this so the resonance bridge can read this universe's live coords. */
  handleRef: MutableRefObject<OverlayHandle | null>
}

export function OverlayUniverse({
  stars,
  edges,
  offset,
  object,
  emotionColors,
  atmosphere,
  handleRef,
}: OverlayUniverseProps) {
  const positionsRef = useRef<Float32Array | null>(null)
  const simRef = useRef<SimState | null>(null)
  const settledRef = useRef(true)
  // 빌드 effect는 sim만 세팅하고, 레이아웃 발행(setState)은 useFrame이 맡는다('seed' 첫 발행 / 'empty'
  // 비우기) — effect 내 동기 setState 금지 규칙 회피(LiveLayoutController가 onLayout을 useFrame에서
  // 부르는 것과 같은 결). useFrame은 React effect가 아니라 발행이 허용된다.
  const pendingRef = useRef<'seed' | 'empty' | null>(null)
  const [layout, setLayout] = useState<LayoutMap>(() => new Map())

  // id → buffer row (stars order == sim.ids order == buffer order) — shared with the bridge.
  const idIndex = useMemo(() => new Map(stars.map((s, i) => [s.id, i] as const)), [stars])

  // 현 sim의 좌표를 layout 스냅샷으로 발행(filaments가 bake) + 라이브 버퍼 갱신.
  const publishLayout = (sim: SimState) => {
    const buf = simPositions(sim)
    positionsRef.current = buf
    const next: LayoutMap = new Map()
    sim.ids.forEach((id, i) => next.set(id, [buf[i * 3], buf[i * 3 + 1], buf[i * 3 + 2]]))
    setLayout(next)
  }

  // Publish this universe's handle (live buffer + index + offset) so the bridge can span it.
  useEffect(() => {
    handleRef.current = { positionsRef, idIndex, offset }
    return () => {
      handleRef.current = null
    }
  }, [handleRef, idIndex, offset])

  // Build / rebuild the sim when the star or edge set changes (overlay data loads once per slug,
  // so this is rare). Seeded on strength shells (spec 38) so the cloud reads like the live universe.
  useEffect(() => {
    if (stars.length === 0) {
      simRef.current = null
      positionsRef.current = null
      pendingRef.current = 'empty' // useFrame이 layout을 비운다(effect 내 setState 회피)
      return
    }
    const now = virtualNowMs()
    const neighbors = new Map<string, number>()
    for (const e of edges) {
      neighbors.set(e.aId, (neighbors.get(e.aId) ?? 0) + 1)
      neighbors.set(e.bId, (neighbors.get(e.bId) ?? 0) + 1)
    }
    const nodes: SimNode[] = stars.map((s, i) => {
      const r = radiusOf(s.memory, now)
      const [x, y, z] = atRadius(
        fibonacciStarPosition(i, stars.length, s.memory.seed),
        r,
      )
      // Lone stars scatter per-seed rather than tracing the fibonacci spiral (spec 40 spirit).
      if (!neighbors.has(s.id)) {
        const [sx, sy, sz] = atRadius(scatterDirection(s.memory.seed), r)
        return { id: s.id, pinned: false, x: sx, y: sy, z: sz, radius: r }
      }
      return { id: s.id, pinned: false, x, y, z, radius: r }
    })
    const simEdges: SimEdge[] = edges.map((e) => ({ source: e.aId, target: e.bId, weight: e.weight }))
    const sim = createSim(
      { nodes, edges: simEdges },
      { repulsion: -18, linkDistance: 14, radialStrength: 0.1 },
      { seedNewNodes: false },
    )
    simRef.current = sim
    positionsRef.current = simPositions(sim)
    settledRef.current = false // 다음 프레임에 seed 레이아웃 발행
    pendingRef.current = 'seed'
  }, [stars, edges])

  // Pump the sim each frame until it settles; publish the layout (seed → 매 settle) so the filaments
  // reconnect at the emergent coordinates (the overlay is a static view — no per-frame re-kick).
  // setState는 effect가 아니라 여기(useFrame)서만 — LiveLayoutController의 onLayout 패턴과 동형.
  useFrame(() => {
    const pending = pendingRef.current
    if (pending === 'empty') {
      pendingRef.current = null
      setLayout(EMPTY_LAYOUT)
      return
    }
    const sim = simRef.current
    if (!sim) return
    if (pending === 'seed') {
      pendingRef.current = null
      publishLayout(sim)
      settledRef.current = isSettled(sim)
      if (settledRef.current) return
    }
    if (isSettled(sim)) {
      if (!settledRef.current) {
        settledRef.current = true
        publishLayout(sim)
      }
      return
    }
    settledRef.current = false
    positionsRef.current = tick(sim, TICKS_PER_FRAME)
  })

  // Filament lookups (mirror UniverseSynapses): coords from the published layout, colors/seeds
  // from the stars. positionsRef + idIndex let the filaments follow the live sim per frame.
  const { positionOf, colorOf, seedOf } = useMemo(() => {
    const colById = new Map(stars.map((s) => [s.id, resolveMoodRgb(s.memory.mood, emotionColors)] as const))
    const seedById = new Map(stars.map((s) => [s.id, s.memory.seed] as const))
    return {
      positionOf: (id: string): [number, number, number] | null => layout.get(id) ?? null,
      colorOf: (id: string): readonly [number, number, number] => colById.get(id) ?? NEUTRAL_RGB,
      seedOf: (id: string): number => seedById.get(id) ?? 0,
    }
  }, [stars, emotionColors, layout])

  return (
    <group position={offset}>
      {atmosphere && (
        <mesh raycast={() => undefined}>
          <sphereGeometry args={[58, 24, 16]} />
          <meshBasicMaterial
            color={atmosphere}
            transparent
            opacity={0.06}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
      {edges.length > 0 && stars.length > 0 && (
        <SynapseFilaments
          edges={edges}
          positionOf={positionOf}
          colorOf={colorOf}
          seedOf={seedOf}
          positionsRef={positionsRef}
          idIndex={idIndex}
        />
      )}
      <StarField
        object={object}
        emotionColors={emotionColors}
        positionsRef={positionsRef}
        stars={stars}
        edges={edges}
      />
    </group>
  )
}
