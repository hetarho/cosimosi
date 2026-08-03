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
  retreatWalkthrough,
  walkthroughSceneFacts,
  type WalkthroughContent,
  type WalkthroughSceneFacts,
  type WalkthroughStepId,
} from '../../model/walkthrough.ts'
import { WALKTHROUGH_STEP_COPY, walkthroughContent } from '../../config/walkthrough-content.ts'
import { CAPTION_MOTION, STAGE_MOTION, sceneMotion, wordFadeMotion } from '../../lib/step-motion.ts'
import { LandingWalkthroughScene } from '../LandingWalkthroughScene.tsx'

/**
 * The page's argument, walked instead of read: one authored diary goes through the product's whole
 * arc — split, launch, the sky taking colour, the fade, the recall, the mirror — on one canvas,
 * each step a caption and a single action in the product's own verbs. Hardcoded on purpose: the
 * story is one fixed sequence, walkable a state at a time in either direction, and anyone who
 * wants to actually steer is one click from the demo. Local state only — the page has no session,
 * no transport, and no way to obtain either.
 *
 * The stage is a FIXED box holding exactly one view at a time (`WalkthroughStageId`), and every step
 * change is animated rather than cut: the leaving view fades out before the arriving one rises in, so
 * the diary being consumed by its own split is something the visitor sees happen.
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
    <section className="mx-auto flex w-full max-w-3xl flex-col px-6 py-16">
      {/* One config for the whole run: the preference drops every transform below and keeps the
          fades, so a visitor who asked for less motion still sees each step replace the last. */}
      <MotionConfig reducedMotion="user">
        <Card variant="glass" className="flex flex-col gap-5 p-5 sm:p-6">
          {/* Chrome only, no title — the stage speaks for itself. Replay on the left, small and out
              of the action's way, hidden (not removed, so nothing reflows) at both ends of the run:
              nothing to replay at the start, and the ending's own action IS the replay. */}
          <div className="flex h-8 items-center justify-between gap-3">
            <Button
              color="neutral"
              variant="text"
              size="sm"
              className={`px-2 text-xs${atStart || atEnd ? ' invisible' : ''}`}
              onClick={() => setState(restartWalkthrough())}
            >
              {m.landing_walk_restart()}
            </Button>
            <span className="text-xs tabular-nums text-text-subtle">
              {m.landing_walk_progress({
                current: WALKTHROUGH_STEPS.indexOf(state.step) + 1,
                total: WALKTHROUGH_STEPS.length,
              })}
            </span>
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

          {/* The words, sized by what they say — the card breathes a little between steps, which is
              the trade for not reserving room. The swap is a pure-opacity word wipe (the spans below
              carry it); this wrapper is only the presence boundary. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`${state.step}:${String(state.acted)}`}>
              <WalkthroughWords step={state.step} acted={state.acted} />
            </motion.div>
          </AnimatePresence>

          {/* The actions, always the same corner: a step back, and beside it the step's own verb
              until it is taken, then the way onward — and at the ending, the replay. Back is hidden
              (not removed) at the start so the primary never moves. */}
          <div className="flex items-center justify-end gap-2">
            <Button
              color="neutral"
              variant="text"
              className={atStart ? 'invisible' : undefined}
              onClick={() => setState(retreatWalkthrough)}
            >
              {m.landing_walk_prev()}
            </Button>
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

// One (step, acted) state's words — the mirror ending carries the [M5] definition on top of its
// result. The captions are authored to comparable lengths so the card barely moves between steps.
// Every word is its own opacity-only motion span, delayed by reading order, so a caption leaves from
// its first word and the next one arrives the same way — a wipe, not a slide.
function WalkthroughWords({ step, acted }: { step: WalkthroughStepId; acted: boolean }) {
  const copy = WALKTHROUGH_STEP_COPY[step]
  // The [M5] definition, stated where the walkthrough ends — required copy, not decoration: removing
  // its key from the catalogues fails the build, the same guarantee the retired mirror section carried.
  const definition = step === 'mirror' && acted ? m.landing_walk_mirror_definition() : null
  const body = acted ? copy.result() : copy.prompt()
  const definitionWords = definition === null ? [] : definition.split(' ')
  const bodyWords = body.split(' ')
  const total = definitionWords.length + bodyWords.length
  return (
    <div className="flex flex-col gap-1.5">
      {definition === null ? null : (
        <p className="text-sm font-medium leading-6 text-text sm:text-base sm:leading-7">
          <WipedWords words={definitionWords} offset={0} total={total} />
        </p>
      )}
      <p className="text-sm leading-6 text-text-muted sm:text-base sm:leading-7">
        <WipedWords words={bodyWords} offset={definitionWords.length} total={total} />
      </p>
    </div>
  )
}

// The caption's words as motion spans. Keyed by position — two states sharing a word at the same slot
// would otherwise reuse the element and skip its fade, breaking the wipe's left-to-right line.
function WipedWords({
  words,
  offset,
  total,
}: {
  words: readonly string[]
  offset: number
  total: number
}) {
  return words.map((word, index) => (
    <motion.span
      key={`${String(offset + index)}:${word}`}
      {...wordFadeMotion(offset + index, total)}
    >
      {word}{' '}
    </motion.span>
  ))
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

// The written day, alone on the stage — the one thing the visitor reads before anything happens to
// it. It is the stage's whole content, so it is set like a page rather than a note: the label at the
// top, and the entry in reading-size type centred in the room the stage gives it.
function WalkthroughDiary({ content }: { content: WalkthroughContent }) {
  return (
    <div className="flex size-full flex-col justify-center gap-3 overflow-y-auto rounded-xl bg-bg/40 p-6 sm:gap-4 sm:px-12">
      <p className="text-xs text-text-subtle">{m.landing_walk_diary_title()}</p>
      <p className="text-sm leading-6 text-text sm:text-lg sm:leading-9">{content.diaryText}</p>
    </div>
  )
}

// What the split found in the day, in the order it was written: name, feeling, and the neurons that
// will hold each scene — the same facts the product's own split review shows. The diary is gone by
// the time these are here, because splitting it is what produced them.
// Each scene's card takes an equal third of the stage rather than a thin row in the middle of it,
// and carries the scene's own sentence (from `sm` up, clamped to two lines) between the name and the
// neurons — the stage is full because the split genuinely produced this much.
function WalkthroughSplit({ content }: { content: WalkthroughContent }) {
  return (
    <ul className="flex size-full flex-col gap-2">
      {content.splitScenes.map((scene, index) => (
        <motion.li
          key={scene.name}
          className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 rounded-xl border border-border bg-bg/30 px-4 py-2.5 sm:px-5"
          {...sceneMotion(index)}
        >
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: moodColor(scene.mood) }}
            />
            <span className="truncate text-sm font-medium text-text sm:text-base">
              {scene.name}
            </span>
            <span className="ml-auto shrink-0 text-xs text-text-muted">
              {moodLabel(scene.mood)}
            </span>
          </div>
          <p className="hidden text-sm leading-6 text-text-muted sm:line-clamp-2">{scene.text}</p>
          <div className="flex flex-wrap gap-1.5">
            {scene.neurons.map((neuron) => (
              <span
                key={neuron}
                className="rounded-full bg-bg/50 px-2 py-0.5 text-xs text-text-subtle"
              >
                {neuron}
              </span>
            ))}
          </div>
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
