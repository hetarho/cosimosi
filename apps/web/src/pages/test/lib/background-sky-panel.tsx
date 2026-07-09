import { useMemo, useState } from 'react'

import { CameraControls, PostFX, SkySphere, StarField, UniverseCanvas } from '@cosimosi/3d-renderer'
import { VALUES } from '@cosimosi/config'
import { Badge, Button } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'
import { showcaseEmotions } from './backgrounds/showcase-emotions.ts'
import { useReducedMotion } from './backgrounds/use-reduced-motion.ts'

const COUNTS = [1, 3, 5, 7] as const

// The emotion sky as a real 3D body: a BackSide sphere enclosing the star scene, shaded by a
// TSL effect that samples the universe's emotion palette. Drag to look around inside it; switch
// the emotion count to see the palette (and the effect's structure) reshape.
export function BackgroundSkyPanel() {
  const reducedMotion = useReducedMotion()
  const [count, setCount] = useState<number>(3)
  const emotions = useMemo(() => showcaseEmotions(count), [count])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {COUNTS.map((value) => (
          <Button
            key={value}
            onClick={() => setCount(value)}
            color={value === count ? 'primary' : 'neutral'}
            aria-pressed={value === count}
          >
            {value}
          </Button>
        ))}
        <span className="ml-1 flex items-center gap-1.5">
          {emotions.map((slice) => (
            <span
              key={slice.mood}
              title={slice.mood}
              className="h-3.5 w-3.5 rounded-full ring-1 ring-white/30"
              style={{ backgroundColor: slice.color }}
            />
          ))}
        </span>
        {reducedMotion ? (
          <Badge variant="warning">{m.test_harness_background_showcase_reduced_motion()}</Badge>
        ) : null}
      </div>

      <div className="h-[30rem] overflow-hidden rounded-2xl bg-background">
        <UniverseCanvas dpr={[1, VALUES.rendering.maxPixelRatio]} fov={60}>
          <SkySphere stops={emotions} reducedMotion={reducedMotion} />
          <StarField />
          <CameraControls />
          <PostFX bloom={{ strength: 0.6, radius: 0.6, threshold: 0.3 }} />
        </UniverseCanvas>
      </div>
    </div>
  )
}
