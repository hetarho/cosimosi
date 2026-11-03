import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, Vector3 } from 'three/webgpu'
import {
  createSceneFrame,
  fitSceneBounds,
  type SceneBounds,
  type FrameInsets,
} from './scene-framing.ts'

export interface SceneFramingProps {
  readonly getBounds: () => SceneBounds | null
  readonly direction: readonly [number, number, number]
  readonly insets: FrameInsets
  readonly minDistance: number
  readonly maxDistance: number
  readonly enabled: boolean
  readonly reducedMotion: boolean
  readonly targetRef: { current: [number, number, number] }
  readonly settleKey?: string | null
  readonly onSettled?: () => void
}

/** Camera-only presentation: the simulation and its coordinates never move to fit the screen. */
export function SceneFraming({
  getBounds,
  direction,
  insets,
  minDistance,
  maxDistance,
  enabled,
  reducedMotion,
  targetRef,
  settleKey,
  onSettled,
}: SceneFramingProps) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const look = useMemo(() => new Vector3(), [])
  const initialized = useRef(false)
  const frame = useMemo(() => createSceneFrame(), [])
  const reported = useRef(false)
  useEffect(() => {
    reported.current = false
  }, [settleKey])
  useFrame((_, dt) => {
    if (!enabled || !(camera instanceof PerspectiveCamera) || size.width <= 0 || size.height <= 0)
      return
    const bounds = getBounds()
    if (!bounds) return
    const fit = fitSceneBounds(
      bounds,
      size.width,
      size.height,
      camera.getEffectiveFOV(),
      direction,
      insets,
      minDistance,
      maxDistance,
      frame,
    )
    const alpha = !initialized.current || reducedMotion ? 1 : 1 - Math.exp(-4 * Math.min(dt, 0.1))
    if (!initialized.current) look.copy(fit.target)
    else look.lerp(fit.target, alpha)
    camera.position.lerp(fit.position, alpha)
    camera.up.set(0, 0, 1)
    camera.lookAt(look)
    camera.updateMatrixWorld()
    targetRef.current[0] = look.x
    targetRef.current[1] = look.y
    targetRef.current[2] = look.z
    initialized.current = true
    if (
      !reported.current &&
      onSettled &&
      camera.position.distanceTo(fit.position) < Math.max(0.1, fit.distance * 0.025) &&
      look.distanceTo(fit.target) < 0.25
    ) {
      reported.current = true
      onSettled()
    }
  })
  return null
}
