// The central "나" star (spec 38) — the universe's anchor. It is NOT a memory: it never
// joins the graph (no edges/KNN/synapses), sits fixed at the origin, and the radial layout
// pulls strong memories close to it and lets faded ones drift outward. One mesh, three
// selectable forms (appearance.selfObject), each a self-emissive TSL glow the BloomPass
// blooms (no scene directional light → emissive only, the StarField/forms idiom). Color is
// the theme accent for now (ambient mood hue arrives with spec 25). raycast off (no
// interaction yet); reduced-motion freezes the internal flow.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import {
  float,
  vec3,
  uniform,
  positionWorld,
  normalWorld,
  cameraPosition,
  normalize,
  dot,
  sub,
  max,
  clamp,
  pow,
  sin,
  mx_noise_float,
} from 'three/tsl'
import { useAppearance, themeAccent, type SelfObject } from '@/entities/appearance'
import { VALUES } from '@/shared/config'

// Sits just inside the strongest memory shell (R_MIN=6, shared/lib/layout) so the closest
// memories ring it without being swallowed.
const SELF_RADIUS = VALUES.selfStar.radius

/** Build the self star's geometry + TSL material for the chosen form + color. One mesh, so
 *  cost is trivial; the variety is all in the emissive colorNode/opacityNode. */
function buildSelfForm(form: SelfObject, color: THREE.Color): {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  update: (time: number) => void
} {
  const geometry = new THREE.IcosahedronGeometry(1, 6)
  const material = new MeshBasicNodeMaterial()
  const uTime = uniform(0) // manual clock — the built-in `time` node is frozen under BloomPass
  const update = (time: number) => {
    uTime.value = time
  }
  const t = float(uTime as never)
  const base = vec3(color.r, color.g, color.b)

  // View-facing fresnel rim: 0 facing the camera, 1 at the silhouette.
  const viewDir = normalize(sub(cameraPosition, positionWorld))
  const facing = clamp(dot(normalize(normalWorld), viewDir), float(0), float(1))
  const rim = sub(float(1), facing) // 0 centre → 1 rim

  if (form === 'core') {
    // 핵: a bright, near-solid sun — hot centre, slightly brighter rim. Gentle breathing.
    const breath = sin(t.mul(0.8)).mul(0.08).add(1)
    material.colorNode = base.mul(float(1.15).add(rim.mul(0.6)).mul(breath))
    material.opacityNode = clamp(facing.mul(0.85).add(0.15), float(0), float(1))
  } else if (form === 'well') {
    // 중력 우물: dark centre, light bent into a bright rim ring.
    const ring = pow(rim, float(2.2)).mul(1.6)
    material.colorNode = base.mul(ring)
    material.opacityNode = clamp(ring.add(0.04), float(0), float(1))
  } else {
    // 성운 심장(기본): a formless swirl of light — drifting noise glow, soft volumetric edge.
    const p = positionWorld.mul(0.6)
    const flow = float(
      mx_noise_float(vec3(p.add(vec3(t.mul(0.15), t.mul(-0.1), t.mul(0.12))) as never) as never) as never,
    )
      .mul(0.5)
      .add(0.5) // 0..1 drifting
    const glow = float(0.55).add(flow.mul(0.6)).add(rim.mul(0.7))
    material.colorNode = base.mul(glow)
    material.opacityNode = clamp(max(rim.mul(0.6), float(0.3)).mul(flow.mul(0.5).add(0.6)), float(0), float(1))
  }

  material.transparent = true
  material.depthWrite = false
  material.blending = THREE.AdditiveBlending // emissive glow → bloom
  material.toneMapped = false // keep HDR for bloom
  material.side = THREE.DoubleSide
  return { geometry, material, update }
}

const NOOP_RAYCAST = () => undefined

export function SelfStar({ selfObject }: { selfObject: SelfObject }) {
  const theme = useAppearance((s) => s.theme)
  const color = useMemo(() => new THREE.Color(themeAccent(theme)).convertSRGBToLinear(), [theme])
  const built = useMemo(() => buildSelfForm(selfObject, color), [selfObject, color])
  // Dispose GPU resources when the form/color changes (avoid a leak on re-build).
  useEffect(
    () => () => {
      built.geometry.dispose()
      built.material.dispose()
    },
    [built],
  )

  const updateRef = useRef<((t: number) => void) | null>(null)
  useEffect(() => {
    updateRef.current = built.update
    return () => {
      updateRef.current = null
    }
  }, [built])

  const reduceMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  useFrame((state) => {
    // Freeze the internal flow under reduced-motion (still rendered, just static).
    updateRef.current?.(reduceMotion ? 0 : state.clock.elapsedTime)
  })

  return (
    <mesh
      geometry={built.geometry}
      material={built.material}
      scale={SELF_RADIUS}
      dispose={null}
      raycast={NOOP_RAYCAST}
      frustumCulled={false}
    />
  )
}
