// The resonance bridges (spec 37): the ONLY line that crosses between the two universes. Each
// bridge connects MY star ↔ the partner's star (a spec-36 resonance) with a luminous arc of light
// that a slow packet flows along. Both endpoints live in DIFFERENT universes (different sims, each
// in its own offset <group>), so we resolve WORLD coords every frame = local buffer coord + that
// universe's group offset (constitution §3 — two sims, never a shared coordinate). A click on a
// bridge sends FRAME_PAIR (camera frames the two stars) + SELECT_PAIR (the compare panel).
//
// WebGPU path: LineSegments2 + Line2NodeMaterial (same bright-line idiom as synapse rendering). The built-in TSL `time`
// node is frozen under BloomPass, so the flowing packet is baked into per-vertex colors each frame
// from a manual time accumulator (NOT `time`). Bloom turns the thin bright arc into a glowing bridge.
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LineSegments2 } from 'three/addons/lines/webgpu/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { Line2NodeMaterial } from 'three/webgpu'
import { focusActor, selectPairFocus } from '@/entities/memory'
import { VALUES } from '@/shared/config'
import { navigationActor } from '../../model/navigation.machine'
import type { OverlayHandle } from './types'

/** One resonance bridge: my own star id + the partner star's id, each within its own universe's
 *  StarNode set. The public visit case resolves the partner to `shared-N` (the snapshot index
 *  convention) BEFORE passing it here; the demo passes persona star ids directly — so this stays
 *  a pure two-id pair (no snapshot-index coupling). */
export interface Bridge {
  myId: string
  theirId: string
}

const SEG = 22 // segments per bridge → a smooth arc the flow packet can travel along
const FLOW_SPEED = VALUES.resonanceBridge.flowSpeed // packets/sec along the bridge (slow — "느린 빛 흐름")
const BASE_GLOW = VALUES.resonanceBridge.baseGlow
const PEAK_GLOW = VALUES.resonanceBridge.peakGlow // extra brightness at the travelling packet
const FOCUS_BOOST = VALUES.resonanceBridge.focusBoost // the selected pair's bridge burns brighter
const LINE_WIDTH_PX = VALUES.resonanceBridge.lineWidthPx
const RESONANCE_RGB: readonly [number, number, number] = [1.0, 0.86, 0.62] // warm gold — shared light
const HANDLE_RADIUS = 1.6 // clickable node at each bridge midpoint

/** Smoothstep packet (0..1) at along-position s with phase moved by time. */
function flowPacket(s: number, t: number): number {
  const phase = s - t * FLOW_SPEED
  const frac = phase - Math.floor(phase)
  // 봉우리꼴: 0→0.5 상승, 0.5→1 하강. three의 smoothstep(x,min,max)은 min>max 역방향을 지원하지
  // 않고 x<=min이면 0을 돌려주므로(예전 smoothstep(frac,1,0.5)는 frac<1이라 항상 0 → 흐름 정지),
  // 하강은 정방향 smoothstep(frac,0.5,1)을 1에서 빼서 만든다.
  const up = THREE.MathUtils.smoothstep(frac, 0, 0.5)
  const down = 1 - THREE.MathUtils.smoothstep(frac, 0.5, 1)
  return up * down
}

export interface ResonanceBridgesProps {
  mineRef: MutableRefObject<OverlayHandle | null>
  theirsRef: MutableRefObject<OverlayHandle | null>
  bridges: Bridge[]
}

export function ResonanceBridges({ mineRef, theirsRef, bridges }: ResonanceBridgesProps) {
  const n = bridges.length
  const lineRef = useRef<LineSegments2>(null)
  const handlesRef = useRef<(THREE.Mesh | null)[]>([])

  const { line, geometry, material } = useMemo(() => {
    const segs = Math.max(1, n) * SEG
    const pos = new Float32Array(segs * 6)
    const col = new Float32Array(segs * 6)
    const geo = new LineSegmentsGeometry()
    geo.setPositions(pos)
    geo.setColors(col)
    const mat = new Line2NodeMaterial()
    mat.vertexColors = true
    mat.linewidth = LINE_WIDTH_PX
    mat.worldUnits = false
    mat.transparent = true
    mat.depthWrite = false
    mat.blending = THREE.AdditiveBlending
    mat.toneMapped = false
    const ls = new LineSegments2(geo, mat)
    ls.frustumCulled = false // endpoints span the whole overlay; the initial bounds are origin/0
    ls.raycast = () => undefined // clicks go to the midpoint handles + stars, never the line
    return { line: ls, geometry: geo, material: mat }
  }, [n])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  // Resolve a star's WORLD coord from a universe handle: local buffer row + that universe's offset.
  const worldOf = (
    handle: OverlayHandle | null,
    id: string,
    out: THREE.Vector3,
  ): boolean => {
    if (!handle) return false
    const row = handle.idIndex.get(id)
    const buf = handle.positionsRef.current
    if (row == null || !buf || buf.length < (row + 1) * 3) return false
    out.set(
      buf[row * 3] + handle.offset[0],
      buf[row * 3 + 1] + handle.offset[1],
      buf[row * 3 + 2] + handle.offset[2],
    )
    return true
  }

  const tRef = useRef(0)
  const A = useMemo(() => new THREE.Vector3(), [])
  const B = useMemo(() => new THREE.Vector3(), [])
  const P = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, dt) => {
    tRef.current += dt
    const t = tRef.current
    const ls = lineRef.current
    if (!ls || n === 0) return
    const geo = ls.geometry as LineSegmentsGeometry
    const posAttr = geo.attributes.instanceStart as THREE.InterleavedBufferAttribute | undefined
    const colAttr = geo.attributes.instanceColorStart as THREE.InterleavedBufferAttribute | undefined
    if (!posAttr || !colAttr) return
    const positions = posAttr.data.array as Float32Array
    const colors = colAttr.data.array as Float32Array
    const mine = mineRef.current
    const theirs = theirsRef.current
    const pf = selectPairFocus(focusActor.getSnapshot())

    for (let j = 0; j < n; j++) {
      const b = bridges[j]
      const okA = worldOf(mine, b.myId, A)
      const okB = worldOf(theirs, b.theirId, B)
      const base = j * SEG * 6
      if (!okA || !okB) {
        // Endpoint not ready → collapse this bridge's segments (zero-length, invisible).
        for (let k = 0; k < SEG * 6; k++) positions[base + k] = 0
        for (let k = 0; k < SEG * 6; k++) colors[base + k] = 0
        const h = handlesRef.current[j]
        if (h) h.visible = false
        continue
      }
      const focused = pf != null && pf.myId === b.myId && pf.theirId === b.theirId
      const boost = focused ? FOCUS_BOOST : 1
      for (let k = 0; k < SEG; k++) {
        const s0 = k / SEG
        const s1 = (k + 1) / SEG
        P.lerpVectors(A, B, s0)
        const o = base + k * 6
        positions[o] = P.x
        positions[o + 1] = P.y
        positions[o + 2] = P.z
        P.lerpVectors(A, B, s1)
        positions[o + 3] = P.x
        positions[o + 4] = P.y
        positions[o + 5] = P.z
        const m0 = (BASE_GLOW + PEAK_GLOW * flowPacket(s0, t)) * boost
        const m1 = (BASE_GLOW + PEAK_GLOW * flowPacket(s1, t)) * boost
        colors[o] = RESONANCE_RGB[0] * m0
        colors[o + 1] = RESONANCE_RGB[1] * m0
        colors[o + 2] = RESONANCE_RGB[2] * m0
        colors[o + 3] = RESONANCE_RGB[0] * m1
        colors[o + 4] = RESONANCE_RGB[1] * m1
        colors[o + 5] = RESONANCE_RGB[2] * m1
      }
      const h = handlesRef.current[j]
      if (h) {
        h.visible = true
        h.position.copy(A).add(B).multiplyScalar(0.5)
      }
    }
    posAttr.data.needsUpdate = true
    colAttr.data.needsUpdate = true
  })

  if (n === 0) return null
  return (
    <>
      <primitive object={line} ref={lineRef} />
      {/* Clickable resonance node at each bridge's midpoint → frame the pair + open the compare
          panel. Kept tiny + faintly lit (additive) so it reads as a glint, not a planet. */}
      {bridges.map((b, j) => (
        <mesh
          key={`${b.myId}~${b.theirId}`}
          ref={(m) => {
            handlesRef.current[j] = m
          }}
          visible={false}
          onClick={(e) => {
            e.stopPropagation()
            focusActor.send({ type: 'SELECT_PAIR', myId: b.myId, theirId: b.theirId })
            navigationActor.send({ type: 'FRAME_PAIR', myId: b.myId, theirId: b.theirId })
          }}
        >
          <sphereGeometry args={[HANDLE_RADIUS, 12, 12]} />
          <meshBasicMaterial
            color={'#fff0d0'}
            transparent
            opacity={0.55}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  )
}
