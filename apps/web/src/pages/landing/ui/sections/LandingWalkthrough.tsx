import { useMemo, useState } from 'react'

import { moodColor } from '@cosimosi/emotion'
import { Button, Card } from '@cosimosi/ui'

import { m, moodLabel, useActiveLocale } from '../../../../shared/i18n/index.ts'
import {
  WALKTHROUGH_STEPS,
  INITIAL_WALKTHROUGH_STATE,
  actOnWalkthroughStep,
  advanceWalkthrough,
  isLastWalkthroughStep,
  restartWalkthrough,
  walkthroughSceneFacts,
  type WalkthroughContent,
} from '../../model/walkthrough.ts'
import { WALKTHROUGH_STEP_COPY, walkthroughContent } from '../../config/walkthrough-content.ts'
import { LandingWalkthroughScene } from '../LandingWalkthroughScene.tsx'

/**
 * The page's argument, walked instead of read: one authored diary goes through the product's whole
 * arc — split, launch, the sky taking colour, the fade, the recall, the mirror — on one canvas,
 * each step a caption and a single action in the product's own verbs. Hardcoded and advance-only
 * on purpose: every visitor watches the same story reach the same [M5] ending, and anyone who
 * wants to steer is one click from the demo. Local state only — the page has no session, no
 * transport, and no way to obtain either.
 */
export function LandingWalkthrough() {
  const locale = useActiveLocale()
  const [state, setState] = useState(INITIAL_WALKTHROUGH_STATE)

  const content = useMemo(() => walkthroughContent(locale), [locale])
  const facts = useMemo(() => walkthroughSceneFacts(content, state), [content, state])

  const copy = WALKTHROUGH_STEP_COPY[state.step]
  const atStart = state.step === WALKTHROUGH_STEPS[0] && !state.acted
  const atEnd = isLastWalkthroughStep(state) && state.acted

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
      <h2 className="text-xl font-medium text-text">{m.landing_walk_title()}</h2>
      <Card variant="glass" className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-base font-medium text-text">{copy.title()}</h3>
          <span className="shrink-0 text-xs tabular-nums text-text-subtle">
            {m.landing_walk_progress({
              current: WALKTHROUGH_STEPS.indexOf(state.step) + 1,
              total: WALKTHROUGH_STEPS.length,
            })}
          </span>
        </div>

        {facts.memories.length === 0 ? (
          <WalkthroughDiary content={content} splitRevealed={facts.splitRevealed} />
        ) : (
          <div className="relative aspect-4/3 overflow-hidden rounded-xl sm:aspect-video">
            <LandingWalkthroughScene
              memories={facts.memories}
              universeTime={facts.universeTime}
              skyStops={facts.skyStops}
            />
            {facts.focusText === null ? null : (
              <p className="pointer-events-none absolute inset-x-6 bottom-4 text-center text-sm text-text">
                {facts.focusText}
              </p>
            )}
          </div>
        )}

        {/* The [M5] definition, stated where the walkthrough ends — required copy, not decoration:
            removing its key from the catalogues fails the build, the same guarantee the retired
            mirror section carried. */}
        {state.step === 'mirror' ? (
          <p className="text-base font-medium leading-7 text-text">
            {m.landing_walk_mirror_definition()}
          </p>
        ) : null}

        <p className="min-h-10 text-sm leading-6 text-text-muted">
          {state.acted ? copy.result() : copy.prompt()}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {!state.acted ? (
            <Button color="primary" onClick={() => setState(actOnWalkthroughStep)}>
              {copy.action()}
            </Button>
          ) : atEnd ? (
            <Button color="primary" onClick={() => setState(restartWalkthrough())}>
              {m.landing_walk_restart()}
            </Button>
          ) : (
            <Button color="primary" onClick={() => setState(advanceWalkthrough)}>
              {m.landing_walk_next()}
            </Button>
          )}
          {atStart || atEnd ? null : (
            <Button color="neutral" variant="text" onClick={() => setState(restartWalkthrough())}>
              {m.landing_walk_restart()}
            </Button>
          )}
        </div>
      </Card>
    </section>
  )
}

// The written day, and — once split — the scenes it came apart into: name, feeling, and the neurons
// that will hold each one, the same facts the product's own split review shows.
function WalkthroughDiary({
  content,
  splitRevealed,
}: {
  content: WalkthroughContent
  splitRevealed: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-xl bg-bg/40 p-4">
        <p className="text-xs text-text-subtle">{m.landing_walk_diary_title()}</p>
        <p className="text-sm leading-6 text-text">{content.diaryText}</p>
      </div>
      {splitRevealed ? (
        <ul className="flex flex-col gap-2">
          {content.splitScenes.map((scene) => (
            <li
              key={scene.name}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2"
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: moodColor(scene.mood) }}
              />
              <span className="text-sm text-text">{scene.name}</span>
              <span className="text-xs text-text-muted">{moodLabel(scene.mood)}</span>
              <span className="ml-auto flex flex-wrap gap-1.5">
                {scene.neurons.map((neuron) => (
                  <span
                    key={neuron}
                    className="rounded-full bg-bg/50 px-2 py-0.5 text-xs text-text-subtle"
                  >
                    {neuron}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
