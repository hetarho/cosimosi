// Synapse visualization (spec 09, Architecture §3.3): all weighted edges batched
// into ONE LineSegments2 (few draw calls — 1.1). WebGPU import path (06 uses
// WebGPURenderer; the default lines/ GLSL path would break): LineSegments2 from the
// webgpu addon, Line2NodeMaterial from three/webgpu.
//
// Strength (weight·brightness) is shown via per-edge color magnitude + a per-edge
// pulse, carried by vertexColors. Line2NodeMaterial exposes no clean per-edge
// attribute to a TSL pulse node, so we bake intensity AND the sin-pulse into the
// instance colors on the CPU each frame (positions update each frame too) — the
// observable result matches the spec's emissive/alpha/pulse mapping. Per-edge
// thickness is unsupported (global scalar), so it's not the strength channel.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LineSegments2 } from 'three/addons/lines/webgpu/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { Line2NodeMaterial } from 'three/webgpu'
import { alpha as edgeAlpha, pulseAmp } from '../model/mapping'
import type { SynapseEdge } from '../model/types'

// Cool blue-white base; per-edge magnitude scales it (dark space bg + additive →
// weak edges faint, strong edges bright).
const SYNAPSE_RGB: readonly [number, number, number] = [0.55, 0.7, 1.0]
const PULSE_FREQ = 3.0
const LINE_WIDTH_PX = 2

export interface SynapseLinesProps {
  edges: SynapseEdge[]
  /** Star coordinate lookup (08/force-sim). Returns null for an unknown id (1.6). */
  positionOf: (id: string) => [number, number, number] | null
}

export function SynapseLines({ edges, positionOf }: SynapseLinesProps) {
  const count = edges.length
  const lineRef = useRef<LineSegments2>(null)

  const { line, geometry, material } = useMemo(() => {
    const pos = new Float32Array(count * 6) // [ax,ay,az, bx,by,bz] per edge
    const col = new Float32Array(count * 6)
    const geo = new LineSegmentsGeometry()
    geo.setPositions(pos) // geo now owns these instance buffers (mutated in useFrame)
    geo.setColors(col)
    const mat = new Line2NodeMaterial()
    mat.vertexColors = true
    mat.linewidth = LINE_WIDTH_PX // global px; per-edge width unsupported
    mat.worldUnits = false
    mat.transparent = true
    mat.depthWrite = false
    mat.blending = THREE.AdditiveBlending // glowing additive lines
    mat.toneMapped = false
    const ls = new LineSegments2(geo, mat)
    // Positions are rewritten every frame (force-sim), but setPositions computed the
    // bounding sphere from the initial all-zero buffer (origin, radius 0). Without
    // disabling culling, the whole batch would be frustum-culled whenever the origin
    // leaves the view. Coords are bounded by the universe, so skip culling.
    ls.frustumCulled = false
    return { line: ls, geometry: geo, material: mat }
  }, [count])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  // Per-frame: rewrite positions (from positionOf) + colors (intensity·pulse). No
  // React state → no re-render (1.5). Missing coords → zero-length segment (1.6).
  // We mutate the geometry-owned interleaved arrays (stride 6: [start xyz, end xyz]
  // per segment) directly — not a hook return — so it's a legit imperative buffer
  // update.
  useFrame((state) => {
    const line = lineRef.current
    if (!line || count === 0) return
    // Read buffers via the ref (not the useMemo value) so these imperative per-frame
    // array writes are exempt from the hook-immutability lint (refs are mutable).
    const geo = line.geometry as LineSegmentsGeometry
    const posAttr = geo.attributes.instanceStart as THREE.InterleavedBufferAttribute | undefined
    const colAttr = geo.attributes.instanceColorStart as THREE.InterleavedBufferAttribute | undefined
    if (!posAttr || !colAttr) return
    const positions = posAttr.data.array as Float32Array
    const colors = colAttr.data.array as Float32Array
    const t = state.clock.elapsedTime
    for (let i = 0; i < count; i++) {
      const e = edges[i]
      const a = positionOf(e.aId)
      const b = positionOf(e.bId)
      const o = i * 6
      if (!a || !b) {
        for (let k = 0; k < 6; k++) {
          positions[o + k] = 0
          colors[o + k] = 0
        }
        continue
      }
      positions[o] = a[0]
      positions[o + 1] = a[1]
      positions[o + 2] = a[2]
      positions[o + 3] = b[0]
      positions[o + 4] = b[1]
      positions[o + 5] = b[2]
      // magnitude = floored intensity (alpha) · pulse; floor keeps dormant edges
      // visible (1.4), reinforcedRecency=0 ⇒ pulse factor 1 ⇒ static (1.3).
      const mag = edgeAlpha(e) * (1 + Math.sin(t * PULSE_FREQ) * pulseAmp(e))
      const r = SYNAPSE_RGB[0] * mag
      const g = SYNAPSE_RGB[1] * mag
      const bl = SYNAPSE_RGB[2] * mag
      colors[o] = r
      colors[o + 1] = g
      colors[o + 2] = bl
      colors[o + 3] = r
      colors[o + 4] = g
      colors[o + 5] = bl
    }
    // bump the interleaved buffers' needsUpdate → re-upload start+end.
    posAttr.data.needsUpdate = true
    colAttr.data.needsUpdate = true
  })

  if (count === 0) return null
  return <primitive object={line} ref={lineRef} />
}
