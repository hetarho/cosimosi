// shared/lib: reading an element's position on a screen whose surfaces ARRIVE.
//
// `getBoundingClientRect()` answers for where a box is right now, and one frame into a bottom
// sheet's 240ms slide that is a panel-height below where the sheet will come to rest — the transform
// is on an ancestor, so every control inside the panel reads wrong together. Anything that paints a
// fixed box from a measured rect (a guided run's highlight ring, the caption that has to clear a
// panel) must therefore wait out the arrival, or it draws where the surface was rather than where it
// is going. On a wide screen the same animation moves the panel eight pixels and the error hides; on
// a phone it puts the ring off the bottom of the screen entirely.
//
// The wait runs on the Web Animations API rather than on a delay matched to a CSS duration: it ends
// exactly when the animations do, and there is no second copy of the timing to keep in step. Only
// animations that end by themselves are awaited — a looping one (a pulse, a shimmer) would never
// resolve, and an element wearing one is not travelling anywhere.

/** A viewport-relative box in CSS pixels. Structural on purpose: it is whatever the caller's own
 *  rect type is, so this module owes nothing to the chrome that reads it. */
export interface MeasuredBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * The longest arrival worth waiting for. A surface settles in a few hundred milliseconds; anything
 * claiming longer is a decorative animation that happens to be finite, and a measurement held
 * behind it would leave the chrome pointing at nothing for as long as it ran.
 */
const ARRIVAL_CEILING_MS = 1000

/** Resolves once nothing on the element's ancestry is still moving it into place. */
export async function awaitArrival(node: Element): Promise<void> {
  const arriving = arrivingAnimations(node)
  if (arriving.length === 0) return
  // A cancelled animation rejects `finished`. A cancelled arrival still leaves the element at rest,
  // so the rejection is an answer here and not a failure.
  await Promise.all(arriving.map((animation) => animation.finished.catch(() => undefined)))
}

/** The element's box, or `null` when it has none to give — an unmounted or zero-size node. */
export function measuredBox(node: Element): MeasuredBox | null {
  const box = node.getBoundingClientRect()
  if (box.width === 0 && box.height === 0) return null
  return { x: box.x, y: box.y, width: box.width, height: box.height }
}

// Every finite animation on the element and on each of its ancestors. Ancestors are the point: the
// element itself is usually still, and it is the panel around it that is sliding.
function arrivingAnimations(node: Element): readonly Animation[] {
  const arriving: Animation[] = []
  for (let element: Element | null = node; element; element = element.parentElement) {
    if (typeof element.getAnimations !== 'function') continue
    for (const animation of element.getAnimations()) {
      if (endsSoonOnItsOwn(animation)) arriving.push(animation)
    }
  }
  return arriving
}

function endsSoonOnItsOwn(animation: Animation): boolean {
  // `endTime` is `CSSNumberish`; a unit-carrying value reads as NaN, which fails the finite test and
  // leaves the animation unwaited — the same safe side as an infinite one.
  const endTime = Number(animation.effect?.getComputedTiming().endTime)
  return Number.isFinite(endTime) && endTime <= ARRIVAL_CEILING_MS
}
