// Synapse visualization: each edge becomes a gently CURVED, world-space bundle of thin glow strands that helically
// TWIST around the connecting axis and pinch into each star at both ends — a braided
// "dust vein" rather than a flat screen-space stroke. World-space TubeGeometry (not
// Line2's screen-space width) is what restores volumetric depth, so the universe stops
// reading like a wireframe 3D model and starts reading like the Milky Way: filaments
// fade from one star's mood color to the other's, a packet of light flows A→B, and
// thickness/opacity ripple continuously along the length. The strong scene bloom
// (BloomPass) turns the thin bright strands into a diffuse galactic glow.
//
// WebGPU import path (06 uses WebGPURenderer): MeshBasicNodeMaterial from 'three/webgpu'
// + TSL nodes from 'three/tsl'. Two facts verified against three@0.184 drive the design:
//  • The built-in TSL `time` node is FROZEN here — BloomPass renders via
//    RenderPipeline.render(), which never advances the renderer's nodeFrame. So we drive
//    animation with a manual uniform(0) bumped in useFrame (the SynapseLines/StarField
//    idiom), NOT `time`.
//  • MeshBasicNodeMaterial has NO emissiveNode — for additive glow the colorNode IS the
//    emitted HDR color and bloom (threshold 0.1) picks it up from the scene buffer.
//
// All star positions are static (UniverseCanvas passes no live force-sim buffer), so the
// whole braided geometry is built ONCE in useMemo and only the shader animates — cheap
// even on mobile (one merged indexed BufferGeometry = one draw call). Randomness is
// deterministic (mulberry32 of a hash of the edge id) to keep render pure.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import {
  attribute,
  vec2,
  vec3,
  float,
  uniform,
  uv,
  sin,
  fract,
  smoothstep,
  clamp,
  positionLocal,
} from 'three/tsl'
import { mulberry32 } from '@/shared/lib'
import { WOBBLE_AMP, WOBBLE_FREQ, WOBBLE_PHASE } from '@/entities/star/@x/synapse'
import { visualIntensity, pulseAmp, strandStyle } from '../model/mapping'
import type { SynapseEdge } from '../model/types'

const RADIAL = 6 // tube cross-section segments (round enough under bloom, cheap)
const MAX_EDGES = 300 // hard cap; beyond this keep the strongest edges
const EPS = 1e-4
const TWIST_TURNS = 2.5 // helical turns of the braid over the edge length

/** Deterministic 32-bit FNV-1a hash of a string (pure — no Math.random). */
function hashId(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Orthonormal basis perpendicular to a unit direction (deterministic up choice). */
function perpBasis(dir: THREE.Vector3, out1: THREE.Vector3, out2: THREE.Vector3): void {
  const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
  out1.copy(dir).cross(up).normalize()
  out2.copy(dir).cross(out1).normalize()
}

/** Irregular along-length value (~0..1): multi-frequency sines at incommensurate rates so a
 *  strand's radius wanders (0.3·0.4·0.5·0.4…) along its length instead of staying constant.
 *  The per-strand seed offsets the phase so no two strands match. Pure (Math.sin only). */
function alongNoise(t: number, seed: number): number {
  const s =
    Math.sin(t * 9 + seed * 17) * 0.5 +
    Math.sin(t * 17 + seed * 7.3 + 1) * 0.3 +
    Math.sin(t * 29 + seed * 23 + 5) * 0.2
  return s * 0.5 + 0.5
}

/** Build ONE merged BufferGeometry of every edge's braided strands, with a per-vertex baked
 *  mood gradient (aColor) + per-edge brightness/opacity/pulse attributes the TSL material
 *  reads, and a CPU-baked along-length radius variation. Returns null if nothing renderable. */
function buildFilamentGeometry(
  edges: SynapseEdge[],
  positionOf: (id: string) => [number, number, number] | null,
  colorOf: (id: string) => readonly [number, number, number],
  seedOf: (id: string) => number,
): THREE.BufferGeometry | null {
  // Keep the strongest edges when over the cap (sort copy — never mutate the store array).
  const list =
    edges.length > MAX_EDGES
      ? [...edges].sort((a, b) => visualIntensity(b) - visualIntensity(a)).slice(0, MAX_EDGES)
      : edges

  const tubes: THREE.BufferGeometry[] = []
  const A = new THREE.Vector3()
  const B = new THREE.Vector3()
  const dir = new THREE.Vector3()
  const s1 = new THREE.Vector3()
  const s2 = new THREE.Vector3()
  const off = new THREE.Vector3()

  for (const e of list) {
    const pa = positionOf(e.aId)
    const pb = positionOf(e.bId)
    if (!pa || !pb) continue
    A.set(pa[0], pa[1], pa[2])
    B.set(pb[0], pb[1], pb[2])
    dir.subVectors(B, A)
    const len = dir.length()
    if (len < EPS) continue // coincident endpoints → no direction; skip
    dir.multiplyScalar(1 / len)
    perpBasis(dir, s1, s2)

    const rng = mulberry32(hashId(`${e.aId}|${e.bId}`)) // deterministic per-edge draws
    const h = rng() // 0..1 — bow direction/magnitude + helix radius
    const jBright = rng() // brightness jitter
    const jWidth = rng() // thickness jitter
    const jOpacity = rng() // opacity jitter
    const inten = visualIntensity(e)
    const pulse = pulseAmp(e)
    // 유사도 단계별 스타일(model/mapping STRAND_TIERS — 단일 조절점): 가닥 수·굵기·
    // 밝기·불투명도가 강도 구간으로 정해지고, 방금 강화된 엣지(pulse=reinforcedRecency)는
    // 가닥 +3·굵기 ×1.5로 한 단계 위처럼 읽혀 회상 강화(+0.05)가 즉시 보인다.
    const style = strandStyle(e)
    const strandCount = Math.min(14, style.strands + Math.round(pulse * 3))
    // Per-edge NATURAL variation (deterministic): brightness/opacity/thickness each get an
    // independent jitter so no two filaments read identically.
    const brightVal = Math.min(1, Math.max(0.1, style.bright + (jBright * 2 - 1) * 0.12))
    const opacityVal = Math.min(1, Math.max(0.3, style.opacity + (jOpacity * 2 - 1) * 0.15))
    const widthJitter = 0.7 + jWidth * 0.65 // 0.7..1.35
    const bowMag = len * (0.05 + 0.08 * h)
    const helixR = 0.35 + h * 0.3 + inten * 0.25 + pulse * 0.15
    // Hair-thin strands — they read mostly via bloom, wrapped in the SynapseDust mist.
    const baseR = style.radius * widthJitter * (1 + pulse * 0.5)
    const tubular = Math.min(56, Math.max(20, Math.round(len)))

    // Bowed centre curve: arc the bundle off the straight chord (a dust lane, not a wire).
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
    const centrePts = centre.getPoints(tubular) // tubular + 1 samples

    const colA = colorOf(e.aId)
    const colB = colorOf(e.bId)
    // 양 끝 별의 부유 seed — 정점 셰이더가 StarField와 같은 수식으로 끝점을 움직여
    // 필라멘트가 떠다니는 별의 중앙을 따라간다(아래 positionNode).
    const sA = seedOf(e.aId)
    const sB = seedOf(e.bId)

    for (let s = 0; s < strandCount; s++) {
      const phase = (s / strandCount) * Math.PI * 2
      // Helix offset tapered by sin(πt): 0 at both stars (all strands meet the star) and
      // widest mid-span → a spindle braid that emerges from A and converges into B.
      const pts: THREE.Vector3[] = centrePts.map((p, k) => {
        const t = k / tubular
        const ang = phase + TWIST_TURNS * Math.PI * 2 * t
        const env = Math.sin(Math.PI * t) * helixR
        off
          .copy(s1)
          .multiplyScalar(Math.cos(ang) * env)
          .addScaledVector(s2, Math.sin(ang) * env)
        return p.clone().add(off)
      })
      const strandCurve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5)
      const geo = new THREE.TubeGeometry(strandCurve, tubular, baseR, RADIAL, false)
      const vCount = geo.attributes.position.count
      const ringStride = RADIAL + 1
      const strandSeed = h + s * 0.137 // decorrelate flow/noise phase per strand

      // One pass: (1) THICKNESS varies ALONG the length — displace each ring's vertices
      // outward along the tube normal by a noise-driven fraction of baseR, so the strand
      // bulges and pinches as it runs (0.3·0.4·0.5·0.4…); baked on the CPU so it's robust on
      // every backend. (2) bake per-vertex attrs — aColor is the static A→B mood gradient.
      const posArr = geo.attributes.position.array as Float32Array
      const normArr = geo.attributes.normal.array as Float32Array
      const aColor = new Float32Array(vCount * 3)
      const aSeed = new Float32Array(vCount)
      const aBright = new Float32Array(vCount)
      const aOpac = new Float32Array(vCount)
      const aPul = new Float32Array(vCount)
      // ⚠ WebGPU 정점 버퍼 한도(8) — attribute를 늘릴 때마다 버퍼가 1개씩 든다. 부유
      // seed 두 개는 vec2 하나로 패킹하고, along은 이미 바인딩된 uv.x를 재사용한다.
      const aWob = new Float32Array(vCount * 2)
      for (let v = 0; v < vCount; v++) {
        aWob[v * 2] = sA
        aWob[v * 2 + 1] = sB
      }
      for (let v = 0; v < vCount; v++) {
        const along = Math.floor(v / ringStride) / tubular // 0..1 down the tube
        const d = baseR * (alongNoise(along, strandSeed) - 0.5) * 0.8 // radius ≈ baseR·(1 ± 0.4)
        posArr[v * 3] += normArr[v * 3] * d
        posArr[v * 3 + 1] += normArr[v * 3 + 1] * d
        posArr[v * 3 + 2] += normArr[v * 3 + 2] * d
        aColor[v * 3] = colA[0] + (colB[0] - colA[0]) * along
        aColor[v * 3 + 1] = colA[1] + (colB[1] - colA[1]) * along
        aColor[v * 3 + 2] = colA[2] + (colB[2] - colA[2]) * along
        aSeed[v] = strandSeed
        aBright[v] = brightVal
        aOpac[v] = opacityVal
        aPul[v] = pulse
      }
      geo.setAttribute('aColor', new THREE.BufferAttribute(aColor, 3))
      geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1))
      geo.setAttribute('aBright', new THREE.BufferAttribute(aBright, 1))
      geo.setAttribute('aOpacity', new THREE.BufferAttribute(aOpac, 1))
      geo.setAttribute('aPulse', new THREE.BufferAttribute(aPul, 1))
      geo.setAttribute('aWob', new THREE.BufferAttribute(aWob, 2))
      tubes.push(geo) // identical attr layout across all tubes → merge succeeds
    }
  }

  if (tubes.length === 0) return null
  const merged = BufferGeometryUtils.mergeGeometries(tubes, false)
  tubes.forEach((g) => g.dispose())
  return merged ?? null // mergeGeometries returns null on an attribute mismatch
}

export interface SynapseFilamentsProps {
  edges: SynapseEdge[]
  /** Star coordinate lookup (shared with StarField). Returns null for an unknown id. */
  positionOf: (id: string) => [number, number, number] | null
  /** Star mood color lookup (linear RGB 0..1) — the filament fades between its two ends. */
  colorOf: (id: string) => readonly [number, number, number]
  /** Star wobble seed lookup (0..1) — 끝점이 StarField의 부유를 그대로 따라가게 한다. */
  seedOf: (id: string) => number
  /** Global dim multiplier (0..1): 1 normally, <1 to fade the whole web while a star is focused. */
  dim?: number
}

export function SynapseFilaments({ edges, positionOf, colorOf, seedOf, dim = 1 }: SynapseFilamentsProps) {
  // Built once; rebuilt only when the edge set or the lookups change (all stable from the
  // parent's useMemo). No per-frame CPU work — the shader does all motion via uTime.
  const built = useMemo(() => {
    const geometry = buildFilamentGeometry(edges, positionOf, colorOf, seedOf)
    if (!geometry) return null

    const material = new MeshBasicNodeMaterial()
    // attribute()'s TS type doesn't carry its value type → wrap in vec3()/float() (the
    // StarField idiom) for typed nodes that carry .mul/.add/etc.
    const color = vec3(attribute('aColor', 'vec3') as never)
    const seed = float(attribute('aSeed', 'float') as never)
    const bright = float(attribute('aBright', 'float') as never) // per-edge brightness (±jitter)
    const opac = float(attribute('aOpacity', 'float') as never) // per-edge opacity (±jitter)
    const pulse = float(attribute('aPulse', 'float') as never)
    // 양 끝 별의 부유 seed — vec2 하나로 패킹(WebGPU 정점 버퍼 한도 8 안에 머물기).
    const wobSeed = vec2(attribute('aWob', 'vec2') as never)
    const wobA = float(wobSeed.x)
    const wobB = float(wobSeed.y)
    const uTime = uniform(0) // manual clock — the built-in `time` node is frozen here
    const uDim = uniform(1) // focus spotlight: 1 normally, <1 fades the whole web while focused

    const along = uv().x // 0→1 along the tube length (three's TubeGeometry uv convention)
    const around = uv().y // 0→1 around the cross-section

    // 끝점 부유(spec 19): StarField의 wobble 수식(entities/star model/wobble — 단일 출처)을
    // 정점 셰이더로 재현해, 필라멘트가 양 끝 별의 부유를 aAlong(0→1)으로 보간하며 따라간다.
    // 별이 떠다녀도 연결이 항상 별 중앙에 붙어 있다. reduced-motion이면 StarField와 함께 정지.
    // (uv()·mix 대신 전용 attribute + add/sub/mul — 이 레포에서 검증된 노드 연산만 쓴다.)
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const wobAmp = reduceMotion ? 0 : WOBBLE_AMP
    const wobbleOf = (s: typeof wobA) => {
      const axis = (i: 0 | 1 | 2) =>
        sin(
          uTime
            .mul(s.mul(WOBBLE_FREQ[i][1]).add(WOBBLE_FREQ[i][0]))
            .add(s.mul(Math.PI * 2 * WOBBLE_PHASE[i])),
        )
      return vec3(axis(0), axis(1), axis(2)).mul(wobAmp)
    }
    const wobStart = wobbleOf(wobA)
    const wobDelta = wobbleOf(wobB).sub(wobStart)
    material.positionNode = positionLocal.add(wobStart.add(wobDelta.mul(along)))

    // FLOW: a packet of light slides A→B (energy moving between two memories). The
    // per-strand seed offsets the phase so the braid's strands don't pulse in lockstep.
    const flow = fract(along.mul(2.0).sub(uTime.mul(0.22)).add(seed.mul(6.2831)))
    const flowGlow = smoothstep(float(0.0), float(0.5), flow).mul(
      smoothstep(float(1.0), float(0.5), flow),
    )
    // ALONG-LENGTH variation: an irregular value (~0..1) that wanders down the strand —
    // multi-frequency sines at incommensurate rates so it reads as random (0.3·0.4·0.5·0.4…)
    // rather than a clean wave. The per-strand `seed` phase decorrelates strands; a small
    // uTime `drift` lets the pattern slowly flow along the length (drift 0 = purely spatial).
    const lnoise = (f1: number, f2: number, f3: number, ph: number, drift: number) => {
      const x = along.add(uTime.mul(drift))
      return sin(x.mul(f1).add(seed.mul(17.0)).add(ph))
        .mul(0.5)
        .add(sin(x.mul(f2).add(seed.mul(7.3)).add(ph)).mul(0.3))
        .add(sin(x.mul(f3).add(seed.mul(23.0)).add(ph)).mul(0.2))
        .mul(0.5)
        .add(0.5)
    }
    const nGlow = lnoise(7.0, 15.0, 23.0, 1.7, 0.25) // brightness texture down the length
    const nOpac = lnoise(11.0, 5.0, 19.0, 4.2, 0.05) // opacity texture down the length
    // Reinforced edges breathe (pulseAmp = reinforcedRecency; 0 → static).
    const breath = sin(uTime.mul(2.4)).mul(pulse).mul(0.5).add(1.0)

    // Soft cross-section: bright core band, no fully-dark seam (floor 0.45). Taper the
    // opacity into each star so the open tube ends vanish (no hard caps).
    const coreBand = smoothstep(float(1.0), float(0.0), around.sub(0.5).abs().mul(2.0))
    const widthFade = coreBand.mul(0.55).add(0.45)
    const ends = smoothstep(float(0.0), float(0.1), along).mul(
      smoothstep(float(1.0), float(0.9), along),
    )
    // colorNode = emitted HDR color. Per-edge aBright sets the level + line-to-line spread;
    // flowTerm is the traveling light packet; nGlow adds the irregular along-length texture.
    // Brightness lives in ONE factor (colorNode) so additive blending doesn't square it; the
    // level is kept modest so dense areas don't wash out.
    const flowTerm = float(0.6).add(flowGlow.mul(0.55))
    const glowVar = float(0.55).add(nGlow.mul(0.85)) // ~0.55..1.4 down the strand
    const glow = bright.mul(breath).mul(flowTerm).mul(glowVar).mul(uDim)
    material.colorNode = color.mul(glow)

    // opacityNode = cross-section shape × end-taper × per-edge opacity × the along-length
    // opacity texture (nOpac) — so transparency drifts as the line progresses, not fixed.
    const opacVar = float(0.5).add(nOpac.mul(0.75)) // ~0.5..1.25 down the strand
    material.opacityNode = clamp(
      widthFade.mul(ends).mul(opac).mul(opacVar),
      float(0.0),
      float(1.0),
    )

    material.transparent = true
    material.depthWrite = false
    material.blending = THREE.AdditiveBlending // glowing additive filaments
    material.toneMapped = false // keep HDR for bloom
    material.side = THREE.DoubleSide // see through the thin tubes → fuller glow
    material.vertexColors = false

    const mesh = new THREE.Mesh(geometry, material)
    // Baked bounds are computed from the merged buffer; the bundle spans the universe, so
    // skip culling (same rationale as SynapseLines / StarField).
    mesh.frustumCulled = false
    return { mesh, geometry, material, uTime, uDim }
  }, [edges, positionOf, colorOf, seedOf])

  // Hold the time uniform in a ref so the per-frame write targets a mutable ref (exempt
  // from the hook-immutability lint) rather than the useMemo return value directly — the
  // same escape hatch SynapseLines uses for its per-frame buffer writes.
  const uTimeRef = useRef<{ value: number } | null>(null)
  const uDimRef = useRef<{ value: number } | null>(null)
  useEffect(() => {
    if (!built) return
    uTimeRef.current = built.uTime
    uDimRef.current = built.uDim
    return () => {
      uTimeRef.current = null
      uDimRef.current = null
      built.geometry.dispose()
      built.material.dispose()
    }
  }, [built])

  // One float write per frame (no React state, no geometry rebuild).
  useFrame((state) => {
    const u = uTimeRef.current
    if (u) u.value = state.clock.elapsedTime
    // Focus spotlight: push the latest dim into the shared uniform (through the ref — no rebuild).
    const d = uDimRef.current
    if (d) d.value = dim
  })

  if (!built) return null
  return <primitive object={built.mesh} />
}
