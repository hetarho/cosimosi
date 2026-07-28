import { useMemo, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import {
  PostFX,
  SKY_EFFECTS,
  SkinProvider,
  SkySphere,
  StarField,
  UniverseCanvas,
  resolveActiveSkin,
  resolveSkyEffect,
  useSkin,
  type SkyEffectKey,
} from '@cosimosi/3d-renderer'
import { MAX_SHOWCASE_EMOTIONS, showcaseEmotions } from '@cosimosi/emotion'
import { cx, useReducedMotion } from '@cosimosi/ui'

import { NebulaDemoPanel } from './nebula-panel.tsx'
import { StatesPanel } from './states-panel.tsx'
import { Section } from './showcase-shell.tsx'
import { StarShapePanel } from './star-forms-panel.tsx'
import { T } from './showcase-copy.ts'

/**
 * The 3D half of the design language, on the same page as the chrome.
 *
 * The rubric asks whether the chrome and the scene look like one product — whether the glass is lit by
 * the sky it floats on — and that question cannot be answered from two separate surfaces. So the bodies,
 * the skies and the colour field are reviewed here, a scroll away from the buttons and the panels they
 * have to live with, against the real renderer rather than an approximation of it.
 */
export function UniversePanel() {
  return (
    <>
      <Section id="star-forms" title={T.starFormsTitle} blurb={T.starFormsBlurb}>
        <StarShapePanel />
      </Section>

      <Section id="sky" title={T.skyTitle} blurb={T.skyBlurb}>
        <SkySection />
      </Section>

      <Section id="nebula" title={T.nebulaTitle} blurb={T.nebulaBlurb}>
        <NebulaDemoPanel />
      </Section>

      <Section id="states-3d" title={T.statesTitle3D} blurb={T.statesBlurb3D}>
        <StatesPanel />
      </Section>
    </>
  )
}

/** The count the section opens on — a review convenience, not a property of any sky. */
const OPENING_EMOTIONS = 5
const EMOTION_COUNTS = Array.from({ length: MAX_SHOWCASE_EMOTIONS }, (_, i) => i + 1)

/**
 * One sky at a time, over the shared starfield, with the skin's own camera and bloom.
 *
 * The count is free of the sky: every recipe divides itself by the weights it is handed, so a sky given
 * thirteen feelings shows thirteen smaller territories rather than a muddier version of five. Switching
 * skies therefore keeps whatever count is set — what changes is how that same set of feelings is
 * arranged.
 */
function SkySection() {
  return (
    <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
      <SkyStage />
    </SkinProvider>
  )
}

function SkyStage() {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()
  const [effectKey, setEffectKey] = useState<SkyEffectKey>(skin.sky.effect)
  const [count, setCount] = useState(OPENING_EMOTIONS)
  const active = resolveSkyEffect(effectKey)
  const emotions = useMemo(() => showcaseEmotions(count), [count])

  return (
    <div className="flex flex-col gap-4">
      <div className="h-96 overflow-hidden rounded-2xl border border-border">
        <UniverseCanvas
          dpr={[1, VALUES.rendering.maxPixelRatio]}
          fov={skin.camera.fov}
          clearColor={skin.sky.night}
        >
          <SkySphere stops={emotions} effect={effectKey} reducedMotion={reducedMotion} />
          <StarField reducedMotion={reducedMotion} />
          <PostFX bloom={skin.bloom} />
        </UniverseCanvas>
      </div>

      <div className="flex flex-wrap gap-2">
        {SKY_EFFECTS.map((entry) => {
          const selected = entry.key === effectKey
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => setEffectKey(entry.key)}
              aria-pressed={selected}
              title={entry.blurb}
              className={cx(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                selected
                  ? 'border-primary text-text'
                  : 'border-border text-text-subtle hover:border-text-subtle hover:text-text',
              )}
            >
              {entry.label}
            </button>
          )
        })}
      </div>
      <p className="text-sm text-text-muted">{active.blurb}</p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-text-subtle">
          {T.skyEmotionCount}
        </span>
        {EMOTION_COUNTS.map((n) => {
          const selected = n === count
          return (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              aria-pressed={selected}
              className={cx(
                'inline-flex size-7 items-center justify-center rounded-full border text-xs font-medium tabular-nums transition-colors',
                selected
                  ? 'border-primary text-text'
                  : 'border-border text-text-subtle hover:border-text-subtle hover:text-text',
              )}
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}
