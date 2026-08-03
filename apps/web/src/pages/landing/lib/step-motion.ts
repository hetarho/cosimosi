import { tokens } from '@cosimosi/ui'

import type { Easing, MotionProps } from 'motion/react'

/**
 * The walkthrough's step choreography, read off the design tokens instead of authored here: the
 * durations and the easing curve are the ones every CSS transition in the product already uses, so
 * the steps move at the product's own pace and a token change carries this page with it.
 *
 * Motion counts seconds and takes a bezier as four numbers, which is the only reason the two parsers
 * below exist — the values themselves stay in `tokens.duration` / `tokens.ease`.
 *
 * Reduced motion is NOT handled here. The section wraps itself in `<MotionConfig reducedMotion="user">`,
 * which drops the transforms and keeps the opacity — the whole choreography is a fade plus a small
 * rise, so honouring the preference per-value here would only restate what the config already does.
 */

// '200ms' → 0.2. A token that is not a millisecond number would be a token bug, so the fallback is
// deliberately dull rather than clever: something still moves, and nothing hangs.
function seconds(duration: string): number {
  const value = Number.parseFloat(duration)
  return Number.isFinite(value) ? value / 1000 : 0.2
}

// 'cubic-bezier(0.2, 0, 0, 1)' → [0.2, 0, 0, 1]. The fallback is a NAMED curve rather than a copy of
// the token's numbers, so there is exactly one place the product's standard curve is written down.
function bezier(ease: string): Easing {
  const numbers = ease.match(/-?\d*\.?\d+/g)?.map(Number)
  if (numbers?.length !== 4 || numbers.some((value) => !Number.isFinite(value))) return 'easeOut'
  return [numbers[0], numbers[1], numbers[2], numbers[3]]
}

const EASE = bezier(tokens.ease.standard)
const STAGE_SECONDS = seconds(tokens.duration.base)
const CAPTION_SECONDS = seconds(tokens.duration.fast)

// How far a view travels as it arrives or leaves, in px. Small on purpose: the stage is a fixed box,
// so this is a nudge that gives the swap a direction — not a slide the eye has to follow.
const STAGE_TRAVEL = 16
const CAPTION_TRAVEL = 6

// The gap between one split scene appearing and the next. Half the fastest token duration, so the
// three of them are done arriving inside a single stage swap rather than trailing behind it.
const SCENE_STAGGER = CAPTION_SECONDS / 2

/** One element's whole arrival-and-departure, ready to spread onto a `motion.*` element. */
export type StepMotion = Required<Pick<MotionProps, 'initial' | 'animate' | 'exit' | 'transition'>>

/**
 * The stage's one-at-a-time swap: what is leaving drifts up and out, what arrives rises into place.
 * Paired with `<AnimatePresence mode="wait">` and a key of the stage id, so the diary is gone before
 * the scenes appear — the handoff the step actually describes.
 */
export const STAGE_MOTION: StepMotion = {
  initial: { opacity: 0, y: STAGE_TRAVEL },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -STAGE_TRAVEL },
  transition: { duration: STAGE_SECONDS, ease: EASE },
}

/** The words under the stage — the step's title, and its prompt turning into its result. Quicker and
 *  shorter than the stage, because a caption that took the stage's time would read as a page change. */
export const CAPTION_MOTION: StepMotion = {
  initial: { opacity: 0, y: CAPTION_TRAVEL },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -CAPTION_TRAVEL },
  transition: { duration: CAPTION_SECONDS, ease: EASE },
}

/** One scene of the split arriving, offset by its place in the entry — the day comes apart in order,
 *  the way it was written, rather than three cards appearing as one block. */
export function sceneMotion(index: number): StepMotion {
  return {
    initial: { opacity: 0, y: STAGE_TRAVEL },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0 },
    transition: { duration: STAGE_SECONDS, ease: EASE, delay: index * SCENE_STAGGER },
  }
}

// How long the caption's wipe takes to travel from its first word to its last, on top of each word's
// own fade — the shared base duration, so the whole line turns over inside one stage swap.
const WIPE_SPREAD = STAGE_SECONDS

/** One word of the caption, in reading order — pure opacity, no travel: the old words thin out left
 *  to right and the new ones surface the same way, so the swap reads as the text rewriting itself in
 *  place rather than a block moving. `index` is the word's position across the WHOLE caption (the
 *  mirror ending's definition and result share one sequence), `count` the caption's word total. */
export function wordFadeMotion(index: number, count: number): StepMotion {
  const delay = count > 1 ? (index / (count - 1)) * WIPE_SPREAD : 0
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: CAPTION_SECONDS, ease: EASE, delay },
  }
}
