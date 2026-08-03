import { useMemo, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'

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
  type WalkthroughSceneFacts,
} from '../../model/walkthrough.ts'
import { WALKTHROUGH_STEP_COPY, walkthroughContent } from '../../config/walkthrough-content.ts'
import { CAPTION_MOTION, STAGE_MOTION, sceneMotion } from '../../lib/step-motion.ts'
import { LandingWalkthroughScene } from '../LandingWalkthroughScene.tsx'

/**
 * The page's argument, walked instead of read: one authored diary goes through the product's whole
 * arc — split, launch, the sky taking colour, the fade, the recall, the mirror — on one canvas,
 * each step a caption and a single action in the product's own verbs. Hardcoded and advance-only
 * on purpose: every visitor watches the same story reach the same [M5] ending, and anyone who
 * wants to steer is one click from the demo. Local state only — the page has no session, no
 * transport, and no way to obtain either.
 *
 * The stage is a FIXED box holding exactly one view at a time (`WalkthroughStageId`), and every step
 * change is animated rather than cut: the leaving view fades out before the arriving one rises in, so
 * the diary being consumed by its own split is something the visitor sees happen. Nothing in the card
 * moves as a side effect of the content changing — the stage keeps its height, the words under it keep
 * their room, and the action stays where the pointer left it (bottom right).
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
      {/* One config for the whole run: the preference drops every transform below and keeps the
          fades, so a visitor who asked for less motion still sees each step replace the last. */}
      <MotionConfig reducedMotion="user">
        <Card variant="glass" className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            {/* The title's box is reserved for the longest step title, so the stage below it never
                shifts when a step's words are a line longer than the last one's. */}
            <div className="min-h-12 flex-1 sm:min-h-6">
              <AnimatePresence mode="wait" initial={false}>
                <motion.h3
                  key={state.step}
                  className="text-base font-medium text-text"
                  {...CAPTION_MOTION}
                >
                  {copy.title()}
                </motion.h3>
              </AnimatePresence>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="text-xs tabular-nums text-text-subtle">
                {m.landing_walk_progress({
                  current: WALKTHROUGH_STEPS.indexOf(state.step) + 1,
                  total: WALKTHROUGH_STEPS.length,
                })}
              </span>
              {/* Replaying is secondary chrome, so it sits up here, small, out of the action's way —
                  and it is absent at both ends of the run: nothing to replay at the start, and the
                  ending's own action IS the replay. */}
              {atStart || atEnd ? null : (
                <Button
                  color="neutral"
                  variant="text"
                  size="sm"
                  className="px-2 text-xs"
                  onClick={() => setState(restartWalkthrough())}
                >
                  {m.landing_walk_restart()}
                </Button>
              )}
            </div>
          </div>

          {/* The stage: one fixed box for the whole run. Its height is the same on every step, so the
              action below it never moves — the only thing that changes is what is inside. */}
          <div className="relative h-72 overflow-hidden rounded-xl sm:h-96">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={facts.stage} className="absolute inset-0" {...STAGE_MOTION}>
                <WalkthroughStage content={content} facts={facts} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* The words keep their room too, so the longest caption of the run does not push the action
              down when it arrives. */}
          <div className="min-h-24 sm:min-h-20">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${state.step}:${String(state.acted)}`}
                className="flex flex-col gap-2"
                {...CAPTION_MOTION}
              >
                {/* The [M5] definition, stated where the walkthrough ends — required copy, not
                    decoration: removing its key from the catalogues fails the build, the same
                    guarantee the retired mirror section carried. */}
                {state.step === 'mirror' ? (
                  <p className="text-base font-medium leading-7 text-text">
                    {m.landing_walk_mirror_definition()}
                  </p>
                ) : null}
                <p className="text-sm leading-6 text-text-muted">
                  {state.acted ? copy.result() : copy.prompt()}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* One action, always the same corner. The step's own verb until it is taken, then the way
              onward — and at the ending, the replay. */}
          <div className="flex justify-end">
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
          </div>
        </Card>
      </MotionConfig>
    </section>
  )
}

// Which of the three views the stage is holding. Exhaustive over the stage union, so a fourth stage
// would be a `tsc` failure here rather than a blank box on the page.
function WalkthroughStage({
  content,
  facts,
}: {
  content: WalkthroughContent
  facts: WalkthroughSceneFacts
}) {
  if (facts.stage === 'diary') return <WalkthroughDiary content={content} />
  if (facts.stage === 'scenes') return <WalkthroughSplit content={content} />
  return <WalkthroughUniverse facts={facts} />
}

// The written day, alone on the stage — the one thing the visitor reads before anything happens to it.
function WalkthroughDiary({ content }: { content: WalkthroughContent }) {
  return (
    <div className="flex size-full flex-col justify-center gap-2 overflow-y-auto rounded-xl bg-bg/40 p-5">
      <p className="text-xs text-text-subtle">{m.landing_walk_diary_title()}</p>
      <p className="text-sm leading-7 text-text sm:text-base">{content.diaryText}</p>
    </div>
  )
}

// What the split found in the day, in the order it was written: name, feeling, and the neurons that
// will hold each scene — the same facts the product's own split review shows. The diary is gone by
// the time these are here, because splitting it is what produced them.
function WalkthroughSplit({ content }: { content: WalkthroughContent }) {
  return (
    <ul className="flex size-full flex-col justify-center gap-2 overflow-y-auto">
      {content.splitScenes.map((scene, index) => (
        <motion.li
          key={scene.name}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg/30 px-3 py-2"
          {...sceneMotion(index)}
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
        </motion.li>
      ))}
    </ul>
  )
}

// The universe the scenes launched into. It mounts ONCE for the whole rest of the run — the stage key
// stays `'universe'` from the launch step onward — so the remaining steps update the canvas in place
// instead of restarting the renderer behind a fade.
function WalkthroughUniverse({ facts }: { facts: WalkthroughSceneFacts }) {
  return (
    <div className="relative size-full overflow-hidden rounded-xl">
      <LandingWalkthroughScene
        memories={facts.memories}
        universeTime={facts.universeTime}
        skyStops={facts.skyStops}
      />
      {/* The returned-to memory's reading, crossfaded when it changes — whole, then eroding, then
          back changed. Keyed by the words themselves, which is what actually changed. */}
      <AnimatePresence mode="wait" initial={false}>
        {facts.focusText === null ? null : (
          <motion.p
            key={facts.focusText}
            className="pointer-events-none absolute inset-x-6 bottom-4 text-center text-sm text-text"
            {...CAPTION_MOTION}
          >
            {facts.focusText}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
