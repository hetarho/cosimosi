import { useEffect, useMemo, useRef } from 'react'

import { FrameTick, SceneExposure } from '@cosimosi/3d-renderer'
import {
  SPOTLIGHT_FADE_LAMBDA,
  SPOTLIGHT_HOLD_SECONDS,
  SPOTLIGHT_SCENE_DIM,
  useSpotlightStore,
} from '@cosimosi/universe'

/**
 * Holds the rest of the sky back while a spotlight is on, and gives it its light back afterwards.
 *
 * This owns only the easing — how far down the scene's light is right now — and hands that to
 * `SceneExposure`, which is where a renderer is allowed to be touched (§3.4). Taking the light down
 * at the exposure rather than over the finished picture is what makes the dim behave like less
 * light: `StarLayer`'s lift on a spotlit body then composes with it, instead of the two acting on
 * opposite sides of the tone curve.
 *
 * The hold is bounded by this layer's own clock rather than by the camera's arrival, because the
 * navigation rig can force-arrive while chasing a body that is still settling; tying the dark to
 * that would let a timeout strand the universe in it.
 *
 * Reduced motion gets the same darkness with no ramp: the fade is a change of light rather than a
 * movement, and a viewer who asked for less motion still needs to be shown which memories these are.
 */
export function SpotlightDim({ reducedMotion = false }: { readonly reducedMotion?: boolean }) {
  const memoryIds = useSpotlightStore((state) => state.memoryIds)
  const clear = useSpotlightStore((state) => state.clear)
  const active = memoryIds.length > 0
  const elapsed = useRef(0)
  const level = useRef(1)

  // Restart the hold whenever a NEW spotlight is armed, so a second jump gets a full turn rather
  // than the tail of the previous one.
  useEffect(() => {
    elapsed.current = 0
  }, [memoryIds])

  // A spotlight belongs to the arrival it announces, so it does not outlive this layer: leaving the
  // universe mid-hold drops the request rather than saving it up to replay unprompted on a later
  // visit. `SceneExposure` gives the light back on the same unmount.
  useEffect(() => () => useSpotlightStore.getState().clear(), [])

  const onFrame = useMemo(
    () => (delta: number) => {
      if (active) {
        elapsed.current += delta
        if (elapsed.current >= SPOTLIGHT_HOLD_SECONDS) {
          clear()
          return
        }
      } else if (level.current === 1) {
        return
      }
      const target = active ? SPOTLIGHT_SCENE_DIM : 1
      level.current = reducedMotion
        ? target
        : level.current + (target - level.current) * Math.min(1, SPOTLIGHT_FADE_LAMBDA * delta)
      // Settle exactly at rest, so a scene with no spotlight in it stops writing the renderer.
      if (Math.abs(level.current - 1) < 0.001) level.current = 1
    },
    [active, clear, reducedMotion],
  )

  return (
    <>
      <FrameTick onFrame={onFrame} />
      <SceneExposure scaleRef={level} />
    </>
  )
}
