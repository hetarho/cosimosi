import { useMemo } from 'react'

import {
  DEFAULT_STAR_SHAPE,
  InstancedNodeLayer,
  STAR_INSTANCE_BRIGHTNESS,
  STAR_INSTANCE_SCALE,
  STAR_INSTANCE_SEED,
  STAR_INSTANCE_TINT,
  createStarShapeBodySource,
  type CoordinateBufferRef,
  type InstanceChannels,
} from '@cosimosi/3d-renderer'
import { VALUES } from '@cosimosi/config'
import { MOODS, type Color, type Mood } from '@cosimosi/emotion'
import { generateLatentField, hexToLinearRgb } from '@cosimosi/universe'

export interface MoodStarLayerProps {
  readonly colors: Readonly<Record<Mood, Color>>
  readonly reducedMotion?: boolean
  readonly onSelect?: (mood: Mood) => void
}

// A presentation-only thirteen-star bench for choosing emotion colors. It uses the shipped star
// body and the shared deterministic field generator; no coordinate or alternate rendering recipe
// is authored by either app screen.
export function MoodStarLayer({ colors, reducedMotion = false, onSelect }: MoodStarLayerProps) {
  const source = useMemo(
    () => createStarShapeBodySource(DEFAULT_STAR_SHAPE, { animate: !reducedMotion }),
    [reducedMotion],
  )
  const positions = useMemo<CoordinateBufferRef>(() => {
    const field = generateLatentField({
      seed: VALUES.forceSim.seed,
      count: MOODS.length,
      zMin: VALUES.forceSim.hippocampusZMin,
      zMax: VALUES.forceSim.hippocampusZMax,
      radius: VALUES.palette.onboardingFieldRadius,
    })
    // Generated once and never mutated, so its version never moves either — which is what tells the
    // layer this bench is a clean frame and its matrices can stay as composed.
    return { current: field.positions, version: 1 }
  }, [])
  const channels = useMemo<InstanceChannels>(() => {
    const scales = new Float32Array(MOODS.length)
    const tint = new Float32Array(MOODS.length * 3)
    const brightness = new Float32Array(MOODS.length)
    const seed = new Float32Array(MOODS.length)
    for (let index = 0; index < MOODS.length; index += 1) {
      const rgb = hexToLinearRgb(colors[MOODS[index]])
      scales[index] = VALUES.rendering.starSizeMax
      tint[index * 3] = rgb[0]
      tint[index * 3 + 1] = rgb[1]
      tint[index * 3 + 2] = rgb[2]
      brightness[index] = VALUES.rendering.starBrightnessMax
      seed[index] = index / MOODS.length
    }
    return {
      scales,
      attributes: [
        { name: STAR_INSTANCE_TINT, array: tint, itemSize: 3 },
        { name: STAR_INSTANCE_BRIGHTNESS, array: brightness, itemSize: 1 },
        { name: STAR_INSTANCE_SEED, array: seed, itemSize: 1 },
      ],
      vertexScaleAttribute: STAR_INSTANCE_SCALE,
    }
  }, [colors])

  return (
    <InstancedNodeLayer
      source={source}
      bodyId="mood-star"
      kind="shader"
      count={MOODS.length}
      positions={positions}
      channels={channels}
      onNodeClick={(index) => onSelect?.(MOODS[index])}
    />
  )
}
