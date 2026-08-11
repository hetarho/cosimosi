import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

/**
 * Shared R3F layer: scales the renderer's exposure — the multiplier the tone curve reads BEFORE it
 * maps accumulated light onto the display.
 *
 * That is the one place a scene-wide dim behaves like less light instead of like a grey sheet:
 * everything the frame holds descends together, hues hold as they descend, and anything a body
 * brightens itself by composes with it multiplicatively rather than fighting a curve that has
 * already run. Scaling the composited output would do neither — the curve would never see the
 * darkness, and the alpha would go with it.
 *
 * The scale arrives as a ref because it is written per frame (§3.2 forbids React state there), and
 * the base is read once at mount so whatever exposure the host chose is what a scale of 1 restores.
 * A scale that has not moved writes nothing, so a scene that never dims never touches the renderer.
 */
export function SceneExposure({ scaleRef }: { readonly scaleRef: { current: number } }) {
  const renderer = useThree((state) => state.gl)
  const base = useRef(renderer.toneMappingExposure)
  const applied = useRef(1)

  useEffect(() => {
    const restore = base.current
    return () => {
      renderer.toneMappingExposure = restore
    }
  }, [renderer])

  useFrame(() => {
    if (scaleRef.current === applied.current) return
    applied.current = scaleRef.current
    renderer.toneMappingExposure = base.current * scaleRef.current
  })

  return null
}
