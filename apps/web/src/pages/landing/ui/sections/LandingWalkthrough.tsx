import { useMemo, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'

import { moodColor } from '@cosimosi/emotion'
import { Badge, Button, ObscuredText } from '@cosimosi/ui'

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
import type { LandingSectionProps } from '../../model/sections.ts'
import { LandingScrollCue } from '../LandingScrollCue.tsx'
import { LandingWalkthroughScene } from '../LandingWalkthroughScene.tsx'
import { WalkthroughDemoCta } from './LandingCtas.tsx'

/**
 * The page's argument, walked instead of read: one authored diary goes through the product's whole
 * arc — split, launch, the sky taking colour, the fade, the recall, the mirror — on one canvas, each
 * step a caption and the change it describes. Hardcoded on purpose: the story is one fixed sequence,
 * walkable a state at a time in either direction with back/next and nothing else, and anyone who
 * wants to actually steer is one click from the demo. Local state only — the page has no session,
 * no transport, and no way to obtain either.
 *
 * The stage is a FIXED box holding exactly one view at a time (`WalkthroughStageId`), and every step
 * change is animated rather than cut: the leaving view fades out before the arriving one rises in, so
 * the diary being consumed by its own split is something the visitor sees happen.
 *
 * It owns a whole screen and carries NO panel of its own. The page reads as three rooms — a screen of
 * bare sky, a screen of this, then everything after — and what tells the visitor they are in this one
 * is the backdrop: the veil is at full blur across exactly this stretch (LandingBackdrop), so the
 * blurred night IS the surface the controls sit on. A glass card here would be a second surface drawn
 * on top of a surface, and the room would stop reading as a room.
 */
export function LandingWalkthrough({ onTryDemo }: LandingSectionProps) {
  const locale = useActiveLocale()
  const [state, setState] = useState(INITIAL_WALKTHROUGH_STATE)

  const content = useMemo(() => walkthroughContent(locale), [locale])
  const facts = useMemo(() => walkthroughSceneFacts(content, state), [content, state])

  const atStart = state.step === WALKTHROUGH_STEPS[0] && !state.acted
  const atEnd = isLastWalkthroughStep(state) && state.acted

  return (
    // The column takes the SLACK of the screen evenly rather than all of it below. `pt-14`/`pb-24`
    // are the minimum insets (the bottom one clears the scroll cue), and whatever the screen has left
    // over is split above and below by `justify-center` — measured, the column is ~565 of 844 CSS px
    // on a phone, so anchoring it to the top left a ~190px hole under the invitation and put the
    // screen's whole mass in its upper half. `min-h-dvh` (not a fixed height) is what makes the
    // centring safe: where the column is taller than the screen there is no free space to split, so
    // it falls back to the top anchor and the run is never clipped or pushed under the fold.
    <section className="relative mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-6 pb-24 pt-14 sm:pt-20">
      {/* One config for the whole run: the preference drops every transform below and keeps the
          fades, so a visitor who asked for less motion still sees each step replace the last. */}
      <MotionConfig reducedMotion="user">
        <div className="flex flex-col gap-4 sm:gap-5">
          {/* Chrome only, no title — the stage speaks for itself. Replay on the left, small and out
              of the action's way, hidden (not removed, so nothing reflows) at both ends of the run:
              nothing to replay at the start, and the ending's own action IS the replay. The row sits
              straight on the veiled sky, which is the only surface this section has. */}
          <div className="flex h-8 items-center justify-between gap-3">
            <Button
              color="neutral"
              variant="text"
              size="sm"
              className={atStart || atEnd ? 'invisible' : undefined}
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
              action below it never moves — the only thing that changes is what is inside. Taller than
              the words and actions need, because the section is a screen and the stage is what the
              screen is for. */}
          <div className="relative h-80 overflow-hidden rounded-xl sm:h-104">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={facts.stage} className="absolute inset-0" {...STAGE_MOTION}>
                <WalkthroughStage content={content} facts={facts} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* The words, sized by what they say — the column breathes a little between steps, which is
              the trade for not reserving room. The swap is a pure-opacity word wipe (the spans below
              carry it); this wrapper is only the presence boundary. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`${state.step}:${String(state.acted)}`}>
              <WalkthroughWords step={state.step} acted={state.acted} />
            </motion.div>
          </AnimatePresence>

          {/* The actions, always the same corner: back, and the way onward. Two text buttons and
              nothing else — the run has ONE control, and `next` is it. Each step is two presses (the
              change, then the move on), so a visitor walks the whole arc without ever choosing what
              to do; a per-step verb button would offer a choice the story does not have and read as
              an app the visitor is now operating.

              `next` is the secondary colour with a trailing arrow — the direction is the meaning, and
              the page's primary filled colour is spent on the two real asks (the demo below, the
              signup at the foot), which must not have to compete with a slideshow's pager. Back is
              hidden (not removed) at the start so `next` never moves.

              The row shares the invitation's centre line on a phone and only takes the column's right
              edge from `sm` up. A 390px column that ran the caption left, the pager right and the
              invitation centred had three alignment edges in a space too narrow to read them as
              deliberate (ui-principles §2 — fewer edges, harder commitment to each). */}
          <div className="flex items-center justify-center gap-1 sm:justify-end">
            <Button
              color="neutral"
              variant="text"
              className={atStart ? 'invisible' : undefined}
              leadingIcon={<StepArrow towards="back" />}
              onClick={() => setState(retreatWalkthrough)}
            >
              {m.landing_walk_prev()}
            </Button>
            {atEnd ? (
              <Button
                color="secondary"
                variant="text"
                onClick={() => setState(restartWalkthrough())}
              >
                {m.landing_walk_restart()}
              </Button>
            ) : (
              <Button
                color="secondary"
                variant="text"
                trailingIcon={<StepArrow towards="onward" />}
                onClick={() => setState(state.acted ? advanceWalkthrough : actOnWalkthroughStep)}
              >
                {m.landing_walk_next()}
              </Button>
            )}
          </div>

          {/* The invitation, closing the screen the argument was just made on. It reads as the answer
              to what the visitor has been watching rather than as a banner, which is the whole reason
              it is here instead of in a section of its own. */}
          <div className="flex justify-center pt-3">
            <WalkthroughDemoCta onTryDemo={onTryDemo} />
          </div>
        </div>
      </MotionConfig>
      <LandingScrollCue />
    </section>
  )
}

// One (step, acted) state's words — the mirror ending carries the [M5] definition on top of its
// result. The captions are authored to comparable lengths so the column barely moves between steps.
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
    // Reading size, not caption size. These two sentences are the only place the argument is stated
    // in words — the stage shows what happens, the caption says what it means — so they are set a
    // step above the page's body copy rather than below it.
    <div className="flex flex-col gap-2">
      {definition === null ? null : (
        <p className="max-w-measure break-keep text-base font-medium leading-7 text-text sm:text-lg sm:leading-8">
          <WipedWords words={definitionWords} offset={0} total={total} />
        </p>
      )}
      <p className="max-w-measure break-keep text-base leading-7 text-text-muted sm:text-lg sm:leading-8">
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
// top, and the entry in reading-size type.
//
// The PANEL is sized by the entry, not by the stage. The stage's box stays the same height on every
// step (that is what keeps the controls below from moving), but a panel stretched to fill it would
// draw a wide empty ground around a short entry and read as a layout accident rather than a page.
// So the panel takes the height its words need, up to the whole box, and sits centred in whatever is
// left; `overflow-y-auto` is what a long entry on a narrow phone lands in.
function WalkthroughDiary({ content }: { content: WalkthroughContent }) {
  return (
    <div className="flex size-full items-center">
      <div className="flex max-h-full w-full flex-col gap-3 overflow-y-auto rounded-xl bg-bg/40 p-6 sm:gap-4 sm:px-12 sm:py-8">
        <p className="text-xs text-text-subtle">{m.landing_walk_diary_title()}</p>
        <p className="text-sm leading-6 text-text sm:text-lg sm:leading-9">{content.diaryText}</p>
      </div>
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
          {/* The same primitive the product's own split review renders neuron names with
              (entities/episodic-memory NeuronChips) — the stage claims to show the shipped facts,
              so the chips must be the shipped chip. */}
          <div className="flex flex-wrap gap-1.5">
            {scene.neurons.map((neuron) => (
              <Badge key={neuron} variant="neutral">
                {neuron}
              </Badge>
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
        {facts.focusText === null || facts.focusSpans === null ? null : (
          <motion.div
            key={facts.focusText}
            // drop-shadow-md is the ground: a label directly on the live scene takes its legibility
            // from a dark halo, not from weight — the same treatment the on-scene HUDs carry.
            className="pointer-events-none absolute inset-x-6 bottom-4 text-center drop-shadow-md"
            {...CAPTION_MOTION}
          >
            <ObscuredText
              className="break-keep text-center"
              spans={facts.focusSpans.map((span) => ({ text: span.text, obscured: span.lost }))}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// The arrow on each of the two step controls — the direction the press moves the run, drawn rather
// than named. It is the scroll cue's chevron turned onto its side, so the page's three navigation
// affordances are visibly one family, and it is `aria-hidden`: the button's own word already says it.
function StepArrow({ towards }: { towards: 'back' | 'onward' }) {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path
        d={towards === 'onward' ? 'M6 3l5 5-5 5' : 'M10 3L5 8l5 5'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
