import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useMemoryStore } from '@/entities/memory'
import { useSynapseStore, degreeNormById, weightedDegreeById } from '@/entities/synapse'
import { VALUES } from '@/shared/config'
import { scatterDirection, applyAngularDrift } from '@/shared/lib'
import {
  createSim,
  advance,
  isSettled,
  positions as simPositions,
  tick,
  seedNearCluster,
  type SeedNeighbor,
  type SimEdge,
  type SimNode,
  type SimState,
} from '@/shared/lib/force-sim'
import { virtualNowMs, isDemoMode } from '@/shared/lib/demo'
import { radiusOf, atRadius, RADIAL_SIM_PARAMS } from '../../model/radial-layout'
import { useViewport } from '../../model/use-viewport'
import {
  DAY_MS,
  HOT_TAU_MS,
  LAYOUT_TICKS_PER_FRAME,
  REKICK_ALPHA,
  REKICK_THRESHOLD,
} from '../../model/nav-tuning'
import type { LayoutMap } from '../../model/layout-position'

/** The live force-sim pump (spec 22 + 38). Builds ONE weighted graph from the star set and
 *  synapse edges and advances it each frame into a single positions buffer every coordinate
 *  reader shares (acceptance 1.7) — star coordinates EMERGE from the graph (constitution §3).
 *
 *  spec 38 — distance is strength, angle is connection: ALL memory stars are free and pulled
 *  toward a shell of radius = f(strength) (radial-shell force); the graph springs + repulsion
 *  place the ANGLE, biased toward the hottest cluster a new fragment links into (seedNearCluster,
 *  spec 22). Angular continuity across rebuilds comes from resuming each star at its prior live
 *  position. Recall (activation↑ → radius↓) glides a star inward, time decay glides it outward —
 *  the per-frame loop recomputes target radii and re-kicks the sim when they drift past a
 *  threshold. Tightened sim params (less repulsion, shorter links, firmer radial spring) keep
 *  the cloud compact rather than sprawling. `onReady` fires once the FIRST layout settles (or
 *  immediately for a genuinely-empty universe) so the shell can reveal the placed stars. */
export function LiveLayoutController({
  positionsRef,
  onLayout,
  onReady,
  onReset,
}: {
  positionsRef: MutableRefObject<Float32Array | null>
  onLayout: (layout: LayoutMap) => void
  onReady: () => void
  /** Re-hide the universe when the star set empties WITHOUT being a genuine empty universe —
   *  a mid-session source reset (demo "처음으로") clears stars without remounting, so the next
   *  batch must settle behind the veil again instead of animating in from seeds (spec 38). */
  onReset: () => void
}) {
  const stars = useMemoryStore((s) => s.stars)
  const edges = useSynapseStore((s) => s.edges)
  const loadedEmpty = useMemoryStore((s) => s.loadedEmpty)
  const quietSettleSeq = useViewport((s) => s.quietSettleSeq)
  const simRef = useRef<SimState | null>(null)
  const settledRef = useRef(true)
  const readyRef = useRef(false) // fire onReady exactly once
  const quietSeqRef = useRef(quietSettleSeq)
  // Last graph topology (star ids + edge pairs) the sim was built for — so a stars/edges
  // array-ref change that DIDN'T change the graph (the demo skip's refreshActivation replaces
  // both arrays ~12×/tween just to recompute brightness) does NOT rebuild the sim.
  const topoRef = useRef('')
  // Reused scratch for the per-frame target radii (avoids a per-frame allocation).
  const targetScratchRef = useRef<Float32Array>(new Float32Array(0))
  // Last night index (floor(virtualNow/DAY_MS)) a representational-drift step was applied for
  // (spec 40). null = not yet established for the current sim → the next frame sets the baseline
  // without drifting. Survives sim rebuilds (drift accumulates across them); reset on empty.
  const nightRef = useRef<number | null>(null)
  // Memory facts by id (lastRecalledAt + intensity) for the per-frame radius recompute —
  // memoized so it's not rebuilt every frame, only when the star set changes.
  const memoryById = useMemo(
    () => new Map(stars.map((s) => [s.id, s.memory] as const)),
    [stars],
  )
  // Connectivity per star (degree count + Σweight, median-normalized) → feeds radiusOf so
  // well-connected stars drift out more slowly (spec 38 change 18). Rebuilt only when edges
  // change (the radius re-kick below reads the current closure each frame).
  const degreeNorm = useMemo(() => degreeNormById(edges), [edges])
  const weightedDegreeNorm = useMemo(() => weightedDegreeById(edges), [edges])
  const connOf = useCallback(
    (id: string): [number, number] => [degreeNorm.get(id) ?? 0, weightedDegreeNorm.get(id) ?? 0],
    [degreeNorm, weightedDegreeNorm],
  )

  // Publish a positions snapshot (id → coord) for the synapse renderers to bake against.
  const publish = useCallback(
    (sim: SimState, buf: Float32Array) => {
      const layout: LayoutMap = new Map()
      sim.ids.forEach((id, i) => layout.set(id, [buf[i * 3], buf[i * 3 + 1], buf[i * 3 + 2]]))
      onLayout(layout)
    },
    [onLayout],
  )

  // Reveal the universe once the FIRST layout has settled (fires exactly once).
  const markReady = useCallback(() => {
    if (readyRef.current) return
    readyRef.current = true
    onReady()
  }, [onReady])

  useEffect(() => {
    if (stars.length === 0) {
      simRef.current = null
      positionsRef.current = null
      topoRef.current = ''
      nightRef.current = null // re-arm drift baseline so the next universe doesn't jump-drift
      onLayout(new Map())
      // A genuinely-empty universe has nothing to place — reveal immediately. Otherwise it's
      // "not loaded yet" (initial pending) OR a mid-session reset: re-arm the veil so the next
      // batch settles hidden (readyRef reset → markReady can fire again on the next settle).
      if (loadedEmpty) markReady()
      else {
        readyRef.current = false
        onReset()
      }
      return
    }
    // Rebuild the sim only when the graph TOPOLOGY changes (a star or edge added/removed) —
    // NOT on every stars/edges array-ref change. Demo time-skip refreshes activation for the
    // same topology; without this guard that refresh rebuilt the sim from seed and re-kicked,
    // producing star churn + stretched synapses. Elapsed-time radius drift is handled by the
    // per-frame re-kick below, so a same-topology refresh keeps the live sim continuity.
    const topo =
      stars.map((s) => s.id).join(',') + '|' + edges.map((e) => `${e.aId}~${e.bId}`).join(',')
    if (topo === topoRef.current && simRef.current) return
    topoRef.current = topo

    const now = virtualNowMs()

    // The OUTGOING sim's live positions by id — so a star still moving when this rebuild
    // fires resumes from where it currently is (angular continuity, no jump). spec 38: all
    // stars are free (they breathe radially with strength); the radial-shell force places
    // distance, the graph springs + repulsion place angle.
    const prevPos = new Map<string, [number, number, number]>()
    const prevSim = simRef.current
    const prevBuf = positionsRef.current
    if (prevSim && prevBuf && prevBuf.length >= prevSim.ids.length * 3) {
      prevSim.ids.forEach((id, i) =>
        prevPos.set(id, [prevBuf[i * 3], prevBuf[i * 3 + 1], prevBuf[i * 3 + 2]]),
      )
    }

    // Heat (recency 0..1) per star — exp decay over ~6h, mirroring the server's excitability
    // window so the new-fragment seed leans toward the recently-active cluster (spec 22).
    const heatById = new Map<string, number>()
    for (const s of stars) {
      const ageMs = Math.max(0, now - s.memory.lastRecalledAt)
      heatById.set(s.id, Math.exp(-ageMs / HOT_TAU_MS))
    }
    const neighborsById = new Map<string, string[]>()
    const addNeighbor = (from: string, to: string) => {
      const list = neighborsById.get(from)
      if (list) list.push(to)
      else neighborsById.set(from, [to])
    }
    for (const e of edges) {
      addNeighbor(e.aId, e.bId)
      addNeighbor(e.bId, e.aId)
    }
    const prevPosOf = (id: string): readonly [number, number, number] | null => prevPos.get(id) ?? null

    const nodes: SimNode[] = stars.map((s) => {
      const [dn, wdn] = connOf(s.id)
      const r = radiusOf(s.memory, now, dn, wdn)
      // Angular continuity: resume from the live position if it was already placed.
      const resume = prevPos.get(s.id)
      if (resume) return { id: s.id, pinned: false, x: resume[0], y: resume[1], z: resume[2], radius: r }
      // New (or first load): rise at the hottest cluster's ANGLE (seedNearCluster), but at
      // the strength's DISTANCE (fresh memory → strong → near the centre). spec 38 1.5/1.6.
      const seedNbrs: SeedNeighbor[] = (neighborsById.get(s.id) ?? []).map((nid) => ({
        id: nid,
        heat: heatById.get(nid) ?? 0,
      }))
      // No placed neighbor → a per-id SCATTERED direction on the strength shell, NOT the
      // golden-angle-by-index fibonacci spiral (adding stars one by one used to trace a spiral
      // arc — spec 40 1.4). atRadius pins the final distance to the strength shell either way.
      const fallback = atRadius(scatterDirection(s.memory.seed), r)
      const seeded = seedNearCluster(s.id, seedNbrs, prevPosOf, fallback)
      const [x, y, z] = atRadius(seeded, r)
      return { id: s.id, pinned: false, x, y, z, radius: r }
    })
    const simEdges: SimEdge[] = edges.map((e) => ({ source: e.aId, target: e.bId, weight: e.weight }))

    // Tightened params (spec 38) keep the cloud compact: weaker repulsion + a SHORT link rest
    // length so connected stars pull into tight constellations (not a sprawling line), and a
    // firmer radial spring so each still hugs its strength-shell (distance = strength).
    // seedNewNodes:false → keep the resume / dir·radius placement instead of a neighbor average.
    const sim = createSim({ nodes, edges: simEdges }, RADIAL_SIM_PARAMS, { seedNewNodes: false })
    simRef.current = sim
    const buf = simPositions(sim)
    positionsRef.current = buf
    settledRef.current = isSettled(sim)
    publish(sim, buf) // synapses get the seed layout now; they reconnect on each settle
    if (isSettled(sim)) markReady() // already settled (e.g. a single star) → reveal now
    // edges are part of the graph; rebuilding on an edge change keeps the springs current.
  }, [stars, edges, connOf, positionsRef, onLayout, publish, loadedEmpty, markReady, onReset])

  useFrame(() => {
    const sim = simRef.current
    if (!sim) return

    // Recompute each star's target radius from the CURRENT time so it glides outward as it
    // fades / inward when recalled (spec 38 1.3/1.4). `sim.radius` holds the shells the sim
    // last relaxed to; we compare the fresh targets against THAT (not against last frame's
    // value) so slow sub-threshold decay ACCUMULATES and eventually crosses the threshold —
    // otherwise a per-frame overwrite would reset the baseline and the drift would never fire.
    // When it crosses, apply all targets at once and re-kick the whole sim (radial + links +
    // repulsion relax together to a new balance); otherwise stay settled. Synapses publish on
    // settle, so they reconnect at the relaxed coordinates — never mid-relaxation.
    const now = virtualNowMs()

    // Representational drift (spec 40): each NIGHT the clock crosses, every star's DIRECTION rotates
    // one step about its fixed per-seed axis — |p| (= strength) preserved, nothing moves between
    // boundaries (no real-time motion). DEMO-ONLY: the time machine ("하루/한 달 지나기") is where
    // time visibly passes, so this is the showcase of drift; in production coordinates re-emerge
    // fresh each session (헌법3 — not persisted) so there's nothing to animate mid-session, and the
    // user shouldn't see the layout lurch while watching. The axis is fixed (layout.applyAngularDrift)
    // so the rotations compose — a multi-day skip lands the same whether the clock jumps or tweens.
    // The re-kick lets links partly restore well-connected clusters → isolated stars drift more.
    if (isDemoMode()) {
      const night = Math.floor(now / DAY_MS)
      if (nightRef.current === null || night < nightRef.current) {
        nightRef.current = night // establish, or on a clock rewind re-establish, the baseline (no drift)
      } else if (night > nightRef.current) {
        const dn = night - nightRef.current
        nightRef.current = night
        const px = sim.px
        const vx = sim.vx
        for (let i = 0; i < sim.n; i++) {
          if (!sim.free[i]) continue
          const seed = memoryById.get(sim.ids[i])?.seed ?? 0
          const xi = i * 3
          const [dx, dy, dz] = applyAngularDrift([px[xi], px[xi + 1], px[xi + 2]], seed, dn)
          px[xi] = dx
          px[xi + 1] = dy
          px[xi + 2] = dz
          // Discrete reorientation → old velocity now aims wrong; clear it so a mid-relaxation
          // skip doesn't carry stale momentum into the rotated frame.
          vx[xi] = 0
          vx[xi + 1] = 0
          vx[xi + 2] = 0
        }
        if (sim.alpha < REKICK_ALPHA) sim.alpha = REKICK_ALPHA
        settledRef.current = false
      }
    }

    let targets = targetScratchRef.current
    if (targets.length !== sim.n) {
      targets = new Float32Array(sim.n)
      targetScratchRef.current = targets
    }
    let maxDelta = 0
    for (let i = 0; i < sim.n; i++) {
      const mem = memoryById.get(sim.ids[i])
      const [dn, wdn] = connOf(sim.ids[i])
      const r = mem ? radiusOf(mem, now, dn, wdn) : sim.radius[i]
      targets[i] = r
      const d = Math.abs(r - sim.radius[i])
      if (d > maxDelta) maxDelta = d
    }
    if (maxDelta > REKICK_THRESHOLD) {
      sim.radius.set(targets) // commit the new shells (recall pull-in / accumulated decay)
      if (sim.alpha < REKICK_ALPHA) sim.alpha = REKICK_ALPHA
      settledRef.current = false
    }

    // 체험 우주 시간 이동은 데이터 배치를 한 번에 끝낸 뒤 최종 좌표만 보여준다. 좌표는 여전히
    // 클라이언트 force-sim에서 창발하지만, 중간 tick을 화면에 내보내지 않아 별이 튀어 보이지 않는다.
    if (quietSettleSeq !== quietSeqRef.current) {
      quietSeqRef.current = quietSettleSeq
      if (!isSettled(sim)) {
        if (sim.alpha < REKICK_ALPHA) sim.alpha = REKICK_ALPHA
        advance(sim, VALUES.forceSim.alphaDecayTicks)
      }
      sim.vx.fill(0)
      const buf = simPositions(sim)
      positionsRef.current = buf
      publish(sim, buf)
      settledRef.current = true
      markReady()
      return
    }

    if (isSettled(sim)) {
      if (!settledRef.current) {
        settledRef.current = true
        const buf = simPositions(sim)
        positionsRef.current = buf
        publish(sim, buf) // filaments reconnect at the emergent coordinates
        markReady() // first settle → reveal the placed universe (idempotent)
      }
      return
    }
    settledRef.current = false
    positionsRef.current = tick(sim, LAYOUT_TICKS_PER_FRAME)
  })

  return null
}
