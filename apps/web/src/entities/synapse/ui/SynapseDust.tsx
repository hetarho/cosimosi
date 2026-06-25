// A "mist" of tiny star-like dots scattered AROUND each synapse filament — the dust that
// makes the connections read like a real Milky-Way lane rather than bare threads. Built as
// ONE InstancedMesh of a tiny icosahedron (the exact proven pattern of StarField: instance
// matrices for position/scale + per-instance attributes read in a TSL node material), so it
// is one draw call and shares no risky code with the bloom pipeline. Dots hug the SAME bowed
// centre curve the filaments use (same edge-id hash → same bow), denser near the line and
// pinching into each star, fading between the two endpoint moods. Positions are static; only
// a per-dot twinkle animates (manual uTime uniform — the built-in `time` node is frozen here).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { uniform, sin } from 'three/tsl'
import { attributeFloatNode, attributeVec3Node } from '@/shared/lib/r3f'
import { mulberry32 } from '@/shared/lib'
import { hashId } from '../lib/hash'
import { visualIntensity } from '../model/mapping'
import type { SynapseEdge } from '../model/types'

const MAX_EDGES = 300 // match SynapseFilaments
const MAX_DUST = 14000 // hard cap on total motes (one InstancedMesh)
const EPS = 1e-4

function perpBasis(dir: THREE.Vector3, out1: THREE.Vector3, out2: THREE.Vector3): void {
  const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
  out1.copy(dir).cross(up).normalize()
  out2.copy(dir).cross(out1).normalize()
}

/** Per-edge endpoints the dust was BAKED at, so the per-frame live-follow can translate each
 *  mote to track the moving stars (spec 24 — same as the filaments). */
interface DustEdge {
  aId: string
  bId: string
  bakedA: [number, number, number]
  bakedB: [number, number, number]
}

export interface SynapseDustProps {
  edges: SynapseEdge[]
  positionOf: (id: string) => [number, number, number] | null
  colorOf: (id: string) => readonly [number, number, number]
  /** Live force-sim positions buffer + id→row map: when present, motes follow the live star
   *  positions every frame (no lag behind the filaments during a re-kick relaxation, spec 24). */
  positionsRef?: { readonly current: Float32Array | null }
  idIndex?: Map<string, number>
  /** Global dim multiplier (0..1): 1 normally, <1 to fade the mist while a star is focused. */
  dim?: number
}

export function SynapseDust({ edges, positionOf, colorOf, positionsRef, idIndex, dim = 1 }: SynapseDustProps) {
  const built = useMemo(() => {
    const list =
      edges.length > MAX_EDGES
        ? [...edges].sort((a, b) => visualIntensity(b) - visualIntensity(a)).slice(0, MAX_EDGES)
        : edges

    // Collect per-instance data (count unknown up front → push, then size typed arrays).
    const px: number[] = []
    const py: number[] = []
    const pz: number[] = []
    const scl: number[] = []
    const cols: number[] = []
    const seeds: number[] = []
    const brights: number[] = []
    // Live-follow bookkeeping (spec 24): which edge each mote belongs to + its along-curve t,
    // and each edge's baked endpoints, so per frame we translate motes by lerp(driftA,driftB,t).
    const dustEdges: DustEdge[] = []
    const motEdge: number[] = []
    const motT: number[] = []

    const A = new THREE.Vector3()
    const B = new THREE.Vector3()
    const dir = new THREE.Vector3()
    const s1 = new THREE.Vector3()
    const s2 = new THREE.Vector3()
    let total = 0

    for (const e of list) {
      if (total >= MAX_DUST) break
      const pa = positionOf(e.aId)
      const pb = positionOf(e.bId)
      if (!pa || !pb) continue
      A.set(pa[0], pa[1], pa[2])
      B.set(pb[0], pb[1], pb[2])
      dir.subVectors(B, A)
      const len = dir.length()
      if (len < EPS) continue
      dir.multiplyScalar(1 / len)
      perpBasis(dir, s1, s2)

      const rng = mulberry32(hashId(`${e.aId}|${e.bId}`))
      const h = rng() // first draw == filaments' h → identical bow
      const inten = visualIntensity(e)
      const bowMag = len * (0.05 + 0.08 * h)
      const bowAng = h * Math.PI * 2
      const bowDir = s1.clone().multiplyScalar(Math.cos(bowAng)).addScaledVector(s2, Math.sin(bowAng))
      const centre = new THREE.CatmullRomCurve3(
        [
          A.clone(),
          A.clone().lerp(B, 0.25).addScaledVector(bowDir, bowMag * 0.7),
          A.clone().lerp(B, 0.5).addScaledVector(bowDir, bowMag),
          A.clone().lerp(B, 0.75).addScaledVector(bowDir, bowMag * 0.7),
          B.clone(),
        ],
        false,
        'centripetal',
        0.5,
      )
      const helixR = 0.35 + h * 0.3 + inten * 0.2
      const mistR = helixR * 2.2 + 0.25 // fog reaches a bit past the braid
      const colA = colorOf(e.aId)
      const colB = colorOf(e.bId)
      const nDust = Math.min(
        MAX_DUST - total,
        Math.max(90, Math.round(len * 6.0 * (0.6 + inten * 0.7))),
      )

      const eMetaIdx = dustEdges.length
      dustEdges.push({ aId: e.aId, bId: e.bId, bakedA: [A.x, A.y, A.z], bakedB: [B.x, B.y, B.z] })
      for (let i = 0; i < nDust; i++) {
        const t = rng() // along the curve
        const p = centre.getPoint(t)
        // Radial scatter: pow(.,1.6) biases toward the core (dense near the line, wispy out);
        // the sin(πt) envelope pinches the cloud into each star.
        const env = 0.25 + 0.75 * Math.sin(Math.PI * t)
        const rr = mistR * Math.pow(rng(), 1.6) * env
        const ang = rng() * Math.PI * 2
        px.push(p.x + (Math.cos(ang) * s1.x + Math.sin(ang) * s2.x) * rr)
        py.push(p.y + (Math.cos(ang) * s1.y + Math.sin(ang) * s2.y) * rr)
        pz.push(p.z + (Math.cos(ang) * s1.z + Math.sin(ang) * s2.z) * rr)
        scl.push(0.012 + rng() * 0.04) // finer motes → smoother mist when dense
        cols.push(
          colA[0] + (colB[0] - colA[0]) * t,
          colA[1] + (colB[1] - colA[1]) * t,
          colA[2] + (colB[2] - colA[2]) * t,
        )
        seeds.push(rng())
        brights.push(0.12 + rng() * 0.3) // faint individually → mist en masse
        motEdge.push(eMetaIdx)
        motT.push(t)
        total++
        if (total >= MAX_DUST) break
      }
    }

    if (total === 0) return null

    const geometry = new THREE.IcosahedronGeometry(1, 0)
    const material = new MeshBasicNodeMaterial()
    const color = attributeVec3Node('aColor')
    const seed = attributeFloatNode('aSeed')
    const bright = attributeFloatNode('aBright')
    const uTime = uniform(0)
    const uDim = uniform(1) // focus spotlight: 1 normally, <1 fades the mist while a star is focused
    const twinkle = sin(uTime.mul(1.6).add(seed.mul(6.2831))).mul(0.4).add(0.7) // 0.3..1.1
    material.colorNode = color.mul(bright).mul(twinkle).mul(uDim)
    material.transparent = true
    material.depthWrite = false
    material.blending = THREE.AdditiveBlending
    material.toneMapped = false

    const mesh = new THREE.InstancedMesh(geometry, material, total)
    const obj = new THREE.Object3D()
    for (let i = 0; i < total; i++) {
      obj.position.set(px[i], py[i], pz[i])
      obj.scale.setScalar(scl[i])
      obj.updateMatrix()
      mesh.setMatrixAt(i, obj.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(cols), 3))
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(seeds), 1))
    geometry.setAttribute('aBright', new THREE.InstancedBufferAttribute(new Float32Array(brights), 1))
    mesh.frustumCulled = false
    return {
      mesh,
      geometry,
      material,
      uTime,
      uDim,
      dustEdges,
      motEdge: new Uint16Array(motEdge),
      motT: new Float32Array(motT),
      bakedPx: new Float32Array(px),
      bakedPy: new Float32Array(py),
      bakedPz: new Float32Array(pz),
      scl: new Float32Array(scl),
    }
  }, [edges, positionOf, colorOf])

  const uTimeRef = useRef<{ value: number } | null>(null)
  const uDimRef = useRef<{ value: number } | null>(null)
  // Live-follow handle in a ref (escape hatch — don't mutate the useMemo return directly).
  const followRef = useRef<{
    mesh: THREE.InstancedMesh
    dustEdges: DustEdge[]
    motEdge: Uint16Array
    motT: Float32Array
    bakedPx: Float32Array
    bakedPy: Float32Array
    bakedPz: Float32Array
    scl: Float32Array
  } | null>(null)
  useEffect(() => {
    if (!built) return
    uTimeRef.current = built.uTime
    uDimRef.current = built.uDim
    followRef.current = {
      mesh: built.mesh,
      dustEdges: built.dustEdges,
      motEdge: built.motEdge,
      motT: built.motT,
      bakedPx: built.bakedPx,
      bakedPy: built.bakedPy,
      bakedPz: built.bakedPz,
      scl: built.scl,
    }
    return () => {
      uTimeRef.current = null
      uDimRef.current = null
      followRef.current = null
      built.geometry.dispose()
      built.material.dispose()
    }
  }, [built])

  // Scratch reused across frames (no per-frame allocation).
  const driftScratch = useRef<Float32Array>(new Float32Array(0))
  const obj = useMemo(() => new THREE.Object3D(), [])
  const DRIFT_EPS = 1e-3
  useFrame((state) => {
    const u = uTimeRef.current
    if (u) u.value = state.clock.elapsedTime
    // Focus spotlight: push the latest dim into the shared uniform (through the ref — no rebuild).
    const d = uDimRef.current
    if (d) d.value = dim

    // Live-follow (spec 24): translate each mote by lerp(driftA, driftB, t) so the mist tracks
    // the moving stars instead of lagging the filaments. drift = live − baked per edge; skipped
    // entirely when nothing drifted (settled). Same approach as SynapseFilaments.
    const b = followRef.current
    const buf = positionsRef?.current
    if (!b || !buf || !idIndex) return
    let drifts = driftScratch.current
    if (drifts.length !== b.dustEdges.length * 6) {
      drifts = new Float32Array(b.dustEdges.length * 6)
      driftScratch.current = drifts
    }
    let anyDrift = false
    for (let e = 0; e < b.dustEdges.length; e++) {
      const m = b.dustEdges[e]
      const ia = idIndex.get(m.aId)
      const ib = idIndex.get(m.bId)
      const o = e * 6
      if (ia == null || ib == null || buf.length < (ia + 1) * 3 || buf.length < (ib + 1) * 3) {
        drifts[o] = drifts[o + 1] = drifts[o + 2] = 0
        drifts[o + 3] = drifts[o + 4] = drifts[o + 5] = 0
        continue
      }
      const dax = buf[ia * 3] - m.bakedA[0]
      const day = buf[ia * 3 + 1] - m.bakedA[1]
      const daz = buf[ia * 3 + 2] - m.bakedA[2]
      const dbx = buf[ib * 3] - m.bakedB[0]
      const dby = buf[ib * 3 + 1] - m.bakedB[1]
      const dbz = buf[ib * 3 + 2] - m.bakedB[2]
      drifts[o] = dax
      drifts[o + 1] = day
      drifts[o + 2] = daz
      drifts[o + 3] = dbx
      drifts[o + 4] = dby
      drifts[o + 5] = dbz
      if (
        Math.abs(dax) > DRIFT_EPS || Math.abs(day) > DRIFT_EPS || Math.abs(daz) > DRIFT_EPS ||
        Math.abs(dbx) > DRIFT_EPS || Math.abs(dby) > DRIFT_EPS || Math.abs(dbz) > DRIFT_EPS
      ) {
        anyDrift = true
      }
    }
    if (!anyDrift) return
    const count = b.motEdge.length
    for (let i = 0; i < count; i++) {
      const o = b.motEdge[i] * 6
      const t = b.motT[i]
      obj.position.set(
        b.bakedPx[i] + drifts[o] + (drifts[o + 3] - drifts[o]) * t,
        b.bakedPy[i] + drifts[o + 1] + (drifts[o + 4] - drifts[o + 1]) * t,
        b.bakedPz[i] + drifts[o + 2] + (drifts[o + 5] - drifts[o + 2]) * t,
      )
      obj.scale.setScalar(b.scl[i])
      obj.updateMatrix()
      b.mesh.setMatrixAt(i, obj.matrix)
    }
    b.mesh.instanceMatrix.needsUpdate = true
  })

  if (!built) return null
  return <primitive object={built.mesh} />
}
