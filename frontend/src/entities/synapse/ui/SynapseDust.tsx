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
import { attribute, vec3, float, uniform, sin } from 'three/tsl'
import { mulberry32 } from '@/shared/lib'
import { visualIntensity } from '../model/mapping'
import type { SynapseEdge } from '../model/types'

const MAX_EDGES = 300 // match SynapseFilaments
const MAX_DUST = 14000 // hard cap on total motes (one InstancedMesh)
const EPS = 1e-4

/** Deterministic 32-bit FNV-1a hash (same as SynapseFilaments, so dust shares the bow). */
function hashId(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function perpBasis(dir: THREE.Vector3, out1: THREE.Vector3, out2: THREE.Vector3): void {
  const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
  out1.copy(dir).cross(up).normalize()
  out2.copy(dir).cross(out1).normalize()
}

export interface SynapseDustProps {
  edges: SynapseEdge[]
  positionOf: (id: string) => [number, number, number] | null
  colorOf: (id: string) => readonly [number, number, number]
}

export function SynapseDust({ edges, positionOf, colorOf }: SynapseDustProps) {
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
        total++
        if (total >= MAX_DUST) break
      }
    }

    if (total === 0) return null

    const geometry = new THREE.IcosahedronGeometry(1, 0)
    const material = new MeshBasicNodeMaterial()
    const color = vec3(attribute('aColor', 'vec3') as never)
    const seed = float(attribute('aSeed', 'float') as never)
    const bright = float(attribute('aBright', 'float') as never)
    const uTime = uniform(0)
    const twinkle = sin(uTime.mul(1.6).add(seed.mul(6.2831))).mul(0.4).add(0.7) // 0.3..1.1
    material.colorNode = color.mul(bright).mul(twinkle)
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
    return { mesh, geometry, material, uTime }
  }, [edges, positionOf, colorOf])

  const uTimeRef = useRef<{ value: number } | null>(null)
  useEffect(() => {
    if (!built) return
    uTimeRef.current = built.uTime
    return () => {
      uTimeRef.current = null
      built.geometry.dispose()
      built.material.dispose()
    }
  }, [built])

  useFrame((state) => {
    const u = uTimeRef.current
    if (u) u.value = state.clock.elapsedTime
  })

  if (!built) return null
  return <primitive object={built.mesh} />
}
