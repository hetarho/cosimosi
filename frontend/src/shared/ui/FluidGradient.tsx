// Fullscreen fluid mesh-gradient backdrop (R3F + WebGPU/TSL). A single clip-space quad whose
// MeshBasicNodeMaterial.colorNode is a domain-warped fbm "aurora": one fbm warps the uv, a second
// fbm sampled at the warped coordinate mixes the palette into soft, irregular flowing bands (no
// visible circles — the blur-orb DOM technique replaced by procedural noise). Soft magenta/pink/
// violet/lavender over a deep-violet base, with a sparse warm-cream highlight.
//
// frozen-time idiom (constitution §3.1 / project memory): BloomPass renders other scenes via a
// RenderPipeline that does NOT advance three's built-in TSL `time` node — so ALL motion here is
// driven by a MANUAL `uTime` uniform bumped in useFrame (the StarField.update / forms.ts pattern).
// prefers-reduced-motion → time never advances (a frozen, still gradient) and frameloop drops to
// 'demand' so the GPU idles. Mounts with the same createRenderer + <Canvas flat dpr=[1,2]> path
// StarCanvas uses; fullscreen (absolute inset-0), aria-hidden, pointer-events none.
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree, type GLProps } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import {
  vec2,
  vec3,
  float,
  uniform,
  uv,
  mix,
  smoothstep,
  clamp,
  pow,
  sin,
  mx_fractal_noise_float,
} from 'three/tsl'
import { createRenderer } from '@/shared/lib/r3f'

// Transparent canvas so the deep-violet base color behind it (CosmosBackdrop) shows through any
// soft alpha — same alpha:true forcing StarCanvas uses (R3F awaits the returned promise).
const glFactory = ((props: Parameters<typeof createRenderer>[0]) =>
  createRenderer({ ...props, alpha: true })) as unknown as GLProps

// Palette — deep violet base, soft magenta/pink/violet/lavender mid-tones, warm cream highlight.
// Kept in sync with PALETTE export below (hex → linear THREE.Color for the shader).
const BASE = '#0b0b1c' // deep violet-black base
const VIOLET = '#3a2b6b' // dusk violet
const MAGENTA = '#8d5bd6' // soft magenta
const PINK = '#d479c6' // pink
const LAVENDER = '#b9a7ef' // lavender
const CREAM = '#f3e6d0' // warm cream highlight

/** The TSL aurora plane. A 2x2 clip-space quad (filled by an ortho cam below) whose color is a
 *  two-pass domain-warped fbm: warp uv with fbm #1, sample fbm #2 at the warped uv, then layer the
 *  palette by noise thresholds. Returns the material + a manual-time `update(t)` (frozen-time idiom). */
function buildFluidMaterial() {
  const uTime = uniform(0)
  const t = float(uTime as never)
  const update = (time: number) => {
    uTime.value = time
  }

  // Palette as linear-space colors (flat renderer → no tone mapping; mirrors halo.ts uniform Color).
  const cBase = vec3(uniform(new THREE.Color(BASE)) as never)
  const cViolet = vec3(uniform(new THREE.Color(VIOLET)) as never)
  const cMagenta = vec3(uniform(new THREE.Color(MAGENTA)) as never)
  const cPink = vec3(uniform(new THREE.Color(PINK)) as never)
  const cLavender = vec3(uniform(new THREE.Color(LAVENDER)) as never)
  const cCream = vec3(uniform(new THREE.Color(CREAM)) as never)

  // uv() is 0..1 across the quad. Bias toward landscape so the bands read horizontally; the exact
  // aspect doesn't matter for an organic cloud, so a fixed stretch keeps it resolution-independent.
  const p = vec2(uv().x.mul(1.6), uv().y.mul(1.0))

  // Slow flow — the whole field drifts up/right while the warp field itself evolves, so the pattern
  // churns instead of merely sliding (the forms.ts aurora trick).
  const flow = vec2(t.mul(0.012), t.mul(-0.02))

  // Pass 1 — domain warp. Two fbm samples form a 2D offset that bends the coordinate grid.
  const wx = mx_fractal_noise_float(vec3(p.add(flow), t.mul(0.03)), 4, 2.0, 0.5)
  const wy = mx_fractal_noise_float(vec3(p.add(flow).add(vec2(5.2, 1.3)), t.mul(0.04)), 4, 2.0, 0.5)
  const warped = p.add(vec2(wx, wy).mul(0.6))

  // Pass 2 — sample the field at the warped coordinate. n drives the main palette ramp; n2 (finer,
  // offset) breaks up the bands so blends stay irregular. Both remapped from [-1,1] to [0,1].
  const n = mx_fractal_noise_float(vec3(warped, t.mul(0.02)), 5, 2.0, 0.55).mul(0.5).add(0.5)
  const n2 = mx_fractal_noise_float(vec3(warped.mul(1.9).add(vec2(11.7, 3.1)), t.mul(0.05)), 4, 2.0, 0.5)
    .mul(0.5)
    .add(0.5)

  // Layer the palette: deep base → violet → magenta → pink → lavender, each fading in over a noise
  // band via smoothstep so boundaries are soft and overlapping (a mesh-gradient look).
  let col = mix(cBase, cViolet, smoothstep(float(0.15), float(0.5), n))
  col = mix(col, cMagenta, smoothstep(float(0.4), float(0.7), n))
  col = mix(col, cPink, smoothstep(float(0.6), float(0.85), n.mul(n2.mul(0.6).add(0.7))))
  col = mix(col, cLavender, smoothstep(float(0.78), float(0.98), n2))

  // Sparse warm-cream highlight only where both fields peak — a few drifting bright wisps, not a wash.
  const hi = pow(clamp(n.mul(n2), float(0), float(1)), float(3.0))
  const shimmer = sin(t.mul(0.4).add(n.mul(6.28))).mul(0.15).add(0.85)
  col = mix(col, cCream, hi.mul(shimmer).mul(0.5))

  const m = new MeshBasicNodeMaterial()
  m.colorNode = col
  m.toneMapped = false
  m.depthWrite = false
  m.depthTest = false
  return { material: m, update }
}

/** The clip-space quad + manual ortho camera that makes one 2x2 plane exactly fill the viewport at
 *  any aspect (no resize math — the 2x2 plane spans NDC -1..1). Drives uTime in useFrame. */
function FluidPlane({ animate }: { animate: boolean }) {
  const set = useThree((s) => s.set)
  const { material, update } = useMemo(() => buildFluidMaterial(), [])
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), [])

  // A camera at z=1 looking at the origin: the 2x2 plane in the z=0 plane fills clip space exactly.
  const cam = useMemo(() => {
    const c = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    c.position.set(0, 0, 1)
    return c
  }, [])
  // Install our camera (StarCanvas FitCamera pattern) — in a layout effect, NOT during render
  // (set() mutates R3F state; doing it in render warns/races).
  useLayoutEffect(() => {
    set({ camera: cam })
  }, [set, cam])

  // Dispose GPU resources on unmount.
  useLayoutEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame((state) => {
    if (animate) update(state.clock.elapsedTime)
  })

  return <mesh geometry={geometry} material={material} frustumCulled={false} />
}

export interface FluidGradientProps {
  className?: string
}

/**
 * Fullscreen procedural fluid mesh-gradient. Drop behind content as the cosmos backdrop's color
 * field (CosmosBackdrop layers StarFieldCanvas + GrainOverlay on top, and keeps its CSS base
 * gradient as the fallback color while WebGPU inits). reduced-motion → static (no time advance,
 * demand frameloop). aria-hidden, pointer-events none.
 */
export function FluidGradient({ className }: FluidGradientProps) {
  const reduced = !!useReducedMotion()
  // R3F doesn't dispose a custom WebGPU renderer on unmount (StarCanvas note) — keep + dispose it
  // so a StrictMode double-mount / route change can't orphan an in-flight renderer.
  const glRef = useRef<{ dispose?: () => void } | null>(null)

  return (
    <div aria-hidden className={className ?? 'pointer-events-none absolute inset-0 h-full w-full'}>
      <Canvas
        gl={glFactory}
        flat
        dpr={[1, 1.5]}
        frameloop={reduced ? 'demand' : 'always'}
        onCreated={(state) => {
          glRef.current = state.gl as unknown as { dispose?: () => void }
          // Guarantee one frame after async WebGPU init — in 'demand' (reduced motion) a mount-time
          // invalidate can finish before init and drop the first frame (StarCanvas note).
          state.invalidate()
        }}
      >
        <FluidPlane animate={!reduced} />
      </Canvas>
    </div>
  )
}
