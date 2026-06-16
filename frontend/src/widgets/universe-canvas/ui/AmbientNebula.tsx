// Ambient mood nebula (spec 25): the recent-emotion "요즘 상태" painted as a handful of
// wide, soft additive light pools scattered far behind the star cloud — NOT a single flat
// backdrop. Each dominant mood (top-K via ambientLights) becomes one pool whose color =
// moodRgb valence-corrected, whose brightness = arousal; pools overlap (additive) into an
// irregular gradient. Positions are mulberry32-seeded on a large sphere so they sit at the
// same places every time and gain 3D parallax as the camera flies (the landing CalmBackground/
// VastBackground blur-orb technique, moved into the 3D scene — no screen-fixed DOM orb).
//
// frozen-time idiom (constitution §3.1): BloomPass renders via RenderPipeline, which does NOT
// advance three's TSL `time` node — so this drives ALL animation from MANUAL uniforms bumped in
// useFrame (uMix for the 0.8s color crossfade, uPhase for the slow drift/shimmer), exactly like
// StarField.update / Synapse uTime. prefers-reduced-motion freezes drift+shimmer, keeps color.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AMBIENT_LIGHTS_K, ambientLights, useMemoryStore, type AmbientLight } from '@/entities/memory'
import { mulberry32 } from '@/shared/lib'
import { virtualNowMs } from '@/shared/lib/demo'
import { VALUES } from '@/shared/config'

// Pools sit far outside the star shell (~46) so they read as a deep background and parallax.
const RADIUS_MIN = 120
const RADIUS_MAX = 200
// Billboard size (world units) — big, soft glows; scaled per pool by its relative weight.
const SCALE_MIN = 60
const SCALE_MAX = 120
// Color magnitude (additive) = BASE + AROUSAL·arousal, kept low so a vivid "요즘" glows without
// washing out the stars; a calm/empty one fades to almost nothing.
const BASE_BRIGHT = VALUES.ambientNebula.baseBright
const AROUSAL_BRIGHT = VALUES.ambientNebula.arousalBright
const CROSSFADE_S = VALUES.ambientNebula.crossfadeS // ambient change → 0.8s color/size crossfade (acceptance 1.7)
const DRIFT_SPEED = VALUES.ambientNebula.driftSpeed // very slow position/scale drift (phase units per second)
const DRIFT_AMP = VALUES.ambientNebula.driftAmp // world-unit wobble of each pool's center
const SHIMMER = VALUES.ambientNebula.shimmer // ±6% size pulse

/** A soft radial glow sprite (no hard ring) — the pool's falloff. Module singleton. */
let glowTexture: THREE.CanvasTexture | null = null
function getGlowTexture(): THREE.CanvasTexture | null {
  if (glowTexture || typeof document === 'undefined') return glowTexture
  const size = 256
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  if (!g) return null
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255,255,255,0.85)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.32)')
  grad.addColorStop(0.7, 'rgba(255,255,255,0.07)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  glowTexture = new THREE.CanvasTexture(c)
  return glowTexture
}

/** One fixed pool slot: a deterministic base position on the far sphere + per-slot drift
 *  frequencies/phases. The mood/color that occupies the slot changes; the place does not. */
interface SlotSeed {
  base: THREE.Vector3
  freq: [number, number, number]
  phase: [number, number, number]
  shimmerPhase: number
}

function buildSlots(): SlotSeed[] {
  const rng = mulberry32(0xa3b1e)
  const slots: SlotSeed[] = []
  for (let i = 0; i < AMBIENT_LIGHTS_K; i++) {
    const theta = rng() * Math.PI * 2
    const phi = Math.acos(2 * rng() - 1)
    const r = RADIUS_MIN + rng() * (RADIUS_MAX - RADIUS_MIN)
    slots.push({
      base: new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      ),
      freq: [0.7 + rng(), 0.7 + rng(), 0.7 + rng()],
      phase: [rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2],
      shimmerPhase: rng() * Math.PI * 2,
    })
  }
  return slots
}

/** Per-slot target color (RGB·magnitude) + scale for the current pools/arousal. Slot i = the
 *  i-th dominant pool; empty slots stay black (invisible under additive). Sorted desc by weight,
 *  so slot 0 is the brightest pool — its weight normalizes the rest. */
function targetsFor(
  lights: readonly AmbientLight[],
  arousal: number,
  outCol: Float32Array,
  outScale: Float32Array,
): void {
  outCol.fill(0)
  outScale.fill(SCALE_MIN)
  const maxW = lights.length > 0 ? lights[0].weight : 1
  const vivid = BASE_BRIGHT + AROUSAL_BRIGHT * arousal
  for (let i = 0; i < lights.length && i < AMBIENT_LIGHTS_K; i++) {
    const l = lights[i]
    const wn = maxW > 0 ? l.weight / maxW : 1
    const mag = vivid * (0.55 + 0.45 * wn)
    outCol[i * 3] = l.rgb[0] * mag
    outCol[i * 3 + 1] = l.rgb[1] * mag
    outCol[i * 3 + 2] = l.rgb[2] * mag
    outScale[i] = SCALE_MIN + (SCALE_MAX - SCALE_MIN) * wn
  }
}

/** Element-wise equality of two equal-length Float32Arrays. */
function eqf(a: Float32Array, b: Float32Array): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/** StarNode[] → the affect-only shape ambientLights reads. */
function ambientStars(stars: { memory: { mood: string; intensity: number; valence: number; lastRecalledAt: number } }[]) {
  return stars.map((s) => ({
    mood: s.memory.mood,
    intensity: s.memory.intensity,
    valence: s.memory.valence,
    lastRecalledAt: s.memory.lastRecalledAt,
  }))
}

export function AmbientNebula() {
  const stars = useMemoryStore((s) => s.stars)
  const ambient = useMemoryStore((s) => s.ambient)
  const meshRef = useRef<THREE.InstancedMesh>(null)

  const slots = useMemo(() => buildSlots(), [])
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: getGlowTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false, // background glow: never occlude / be clipped by the closer stars
      }),
    [],
  )
  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  // The dominant pools, recomputed when the star set changes (the demo time-skip replaces the
  // array, so decay is captured with a fresh virtual now). Server `ambient` summary drives the
  // overall arousal/valence brightness; the color DISTRIBUTION is always client-derived (§3).
  const lights = useMemo(() => ambientLights(ambientStars(stars), virtualNowMs()), [stars])
  const arousal = ambient?.arousal ?? 0

  // Crossfade state (manual uniforms): from→to per-slot color + scale, mixed by uMix over 0.8s.
  const fromCol = useRef(new Float32Array(AMBIENT_LIGHTS_K * 3))
  const toCol = useRef(new Float32Array(AMBIENT_LIGHTS_K * 3))
  const fromScale = useRef(new Float32Array(AMBIENT_LIGHTS_K))
  const toScale = useRef(new Float32Array(AMBIENT_LIGHTS_K))
  const mix = useRef(1)
  const phase = useRef(0)
  const reduceMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const nextCol = useRef(new Float32Array(AMBIENT_LIGHTS_K * 3))
  const nextScale = useRef(new Float32Array(AMBIENT_LIGHTS_K))

  // On a pools/arousal change: snapshot the CURRENT displayed color/scale (lerp at the live mix)
  // as the new `from`, set the new targets as `to`, and restart the crossfade. A disappearing
  // pool's target is black/min-scale → it fades out; an appearing one fades in from black (1.7).
  // Idempotent: if the new targets equal the current ones we return without restarting the fade —
  // so a StrictMode double-invoke (dev) or two store commits in one load can't double-fade.
  useEffect(() => {
    targetsFor(lights, arousal, nextCol.current, nextScale.current)
    if (eqf(nextCol.current, toCol.current) && eqf(nextScale.current, toScale.current)) return
    const m = mix.current
    for (let i = 0; i < AMBIENT_LIGHTS_K; i++) {
      fromScale.current[i] = fromScale.current[i] + (toScale.current[i] - fromScale.current[i]) * m
      for (let k = 0; k < 3; k++) {
        const j = i * 3 + k
        fromCol.current[j] = fromCol.current[j] + (toCol.current[j] - fromCol.current[j]) * m
      }
    }
    toCol.current.set(nextCol.current)
    toScale.current.set(nextScale.current)
    mix.current = reduceMotion ? 1 : 0 // reduced motion: snap to the new color, no animation
  }, [lights, arousal, reduceMotion])

  const scratch = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])

  useFrame((state, dt) => {
    const mesh = meshRef.current
    if (!mesh) return
    // MANUAL uniform bump — NOT three's built-in `time` node (frozen by BloomPass). uMix advances
    // the crossfade; uPhase advances the slow drift/shimmer (frozen under reduced motion).
    if (mix.current < 1) mix.current = Math.min(1, mix.current + dt / CROSSFADE_S)
    if (!reduceMotion) phase.current += dt * DRIFT_SPEED
    const p = phase.current
    const m = mix.current

    const wob = reduceMotion ? 0 : DRIFT_AMP // drift frozen under reduced motion
    for (let i = 0; i < AMBIENT_LIGHTS_K; i++) {
      const s = slots[i]
      const scale =
        (fromScale.current[i] + (toScale.current[i] - fromScale.current[i]) * m) *
        (reduceMotion ? 1 : 1 + SHIMMER * Math.sin(p * 5 + s.shimmerPhase))
      scratch.position.set(
        s.base.x + wob * Math.sin(p * s.freq[0] + s.phase[0]),
        s.base.y + wob * Math.sin(p * s.freq[1] + s.phase[1]),
        s.base.z + wob * Math.sin(p * s.freq[2] + s.phase[2]),
      )
      scratch.quaternion.copy(state.camera.quaternion) // billboard toward the camera
      scratch.scale.setScalar(scale)
      scratch.updateMatrix()
      mesh.setMatrixAt(i, scratch.matrix)
      color.setRGB(
        fromCol.current[i * 3] + (toCol.current[i * 3] - fromCol.current[i * 3]) * m,
        fromCol.current[i * 3 + 1] + (toCol.current[i * 3 + 1] - fromCol.current[i * 3 + 1]) * m,
        fromCol.current[i * 3 + 2] + (toCol.current[i * 3 + 2] - fromCol.current[i * 3 + 2]) * m,
      )
      mesh.setColorAt(i, color)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  // Always K instances (empty pools are black → invisible under additive); behind everything
  // (renderOrder<0) and non-raycastable so star clicks pass through. frustumCulled off — the
  // billboards are huge and their matrices update every frame.
  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, AMBIENT_LIGHTS_K]}
      dispose={null}
      renderOrder={-10}
      frustumCulled={false}
      raycast={() => undefined}
    />
  )
}
