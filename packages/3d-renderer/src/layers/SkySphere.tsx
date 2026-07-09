import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { uniform } from 'three/tsl'
import * as THREE from 'three/webgpu'

import {
  buildEmotionGradientTexture,
  updateEmotionGradientTexture,
  type GradientStop,
} from '../assets/sky/emotion-gradient.ts'
import { grainientSkyNode } from '../assets/sky/grainient-sky.ts'

// The emotion sky: a large sphere drawn on its INNER surface (BackSide), enclosing the whole
// universe scene, shaded by a TSL effect. Not a flat screen-space wash — a real body wrapping
// the camera, so the background has depth and the effect wraps around as you look about.
// Emotion palette drives the color (via the ramp texture); the effect motion is host-timed so
// reduced motion freezes it at a developed frame.

export interface SkySphereProps {
  /** The universe's emotions (color + weight); reshapes the palette ramp. */
  readonly stops: readonly GradientStop[]
  /** Freeze the animation to a static frame. */
  readonly reducedMotion?: boolean
  /** Sphere radius — big enough to enclose the scene. */
  readonly radius?: number
}

const FROZEN_TIME = 12

export function SkySphere({ stops, reducedMotion = false, radius = 400 }: SkySphereProps) {
  const gradient = useMemo(() => buildEmotionGradientTexture(stops), [])
  const time = useMemo(() => uniform(0), [])
  const geometry = useMemo(() => new THREE.SphereGeometry(radius, 96, 48), [radius])
  const material = useMemo(() => {
    const mat = new THREE.MeshBasicNodeMaterial()
    mat.side = THREE.BackSide
    mat.depthWrite = false
    mat.colorNode = grainientSkyNode({ gradient, time }) as never
    return mat
  }, [gradient, time])

  // Repaint the ramp when the emotions change (no material rebuild).
  useEffect(() => updateEmotionGradientTexture(gradient, stops), [gradient, stops])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
      gradient.dispose()
    },
    [geometry, material, gradient],
  )

  const frozen = useRef(false)
  useFrame((_, delta) => {
    if (reducedMotion) {
      if (!frozen.current) {
        time.value = FROZEN_TIME
        frozen.current = true
      }
      return
    }
    frozen.current = false
    time.value += delta
  })

  return <mesh geometry={geometry} material={material} frustumCulled={false} />
}
