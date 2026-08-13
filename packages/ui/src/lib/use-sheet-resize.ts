import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
} from 'react'

import { SHEET_VIEWPORT, isSheetShape, startsOnControl } from './sheet-shape.ts'

/**
 * How tall the sheet may be made, as a fraction of the viewport. The tall end matches the `max-h`
 * the surface already refuses to grow past — the handle gives the height back, it does not raise the
 * ceiling — and the short end keeps the title, the handle and the footer on screen, so a collapsed
 * sheet is still a sheet rather than a stub.
 */
const TALLEST = 0.7
const SHORTEST = 0.3
/** Pull past the short end this far and a release lets the sheet go entirely. */
const DISMISS_PX = 72
/**
 * A shorter pull past the short end still lets go if it was thrown rather than nudged — but only past
 * `FLICK_PX`, because the first few pixels of any press cover the shortest distance in the shortest
 * time and would otherwise read as the fastest flick of all.
 *
 * Speed alone is deliberately NOT enough here, unlike on a sheet whose only gesture is dismissal: a
 * quick pull that stops at a legal height is someone making the sheet shorter in a hurry, and taking
 * it away from them would punish the hurry rather than read it.
 */
const FLICK_PX = 24
const FLICK_VELOCITY = 0.5
/** Travel under which the gesture was a tap on the handle, not a drag of it. */
const TAP_PX = 6
/** Must match the sheet's leave animation in base.css — the throw and the unmount end together. */
const SETTLE_MS = 200

const THROWN: CSSProperties = {
  transform: 'translate3d(0, 100%, 0)',
  opacity: 0,
  transition: `transform ${SETTLE_MS}ms cubic-bezier(0.64, 0, 0.78, 0), opacity ${SETTLE_MS}ms linear`,
}

interface Grab {
  readonly y: number
  readonly time: number
  /** The height the sheet had when the finger landed — every move is measured from here. */
  readonly height: number
}

export interface SheetResize {
  /** Spread on the grab surface — the handle strip and the title row above the sheet's body. */
  readonly handleProps: {
    readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void
  }
  /** The panel's chosen height and, while a throw is in flight, its way out. */
  readonly style: CSSProperties | undefined
  /**
   * True once a throw has committed. The caller must withhold its own leave animation while it is:
   * a CSS animation outranks an inline transform, so the leave would yank the sheet back up to rest
   * and slide it out from there, erasing the drag the hand just made.
   */
  readonly flung: boolean
}

/**
 * Drag-to-resize (and drag-away-to-dismiss) for a bottom sheet.
 *
 * The scrim-less sheet exists so the thing it is about stays visible beside it, and on a phone the
 * sheet is the wider half of that argument: it covers the universe it is meant to let you watch. So
 * the handle above its title is not only a way out — pulling it down gives height back to the scene
 * and pulling it up takes the height back, and only a pull that carries on past the short end lets
 * the sheet go.
 *
 * The height is authored as a custom PROPERTY rather than as `height` itself, because the wide-screen
 * shape has no business wearing a height a thumb chose on a phone: a class can be switched off at a
 * breakpoint and an inline `height` cannot — it would outrank the `md:` rule that tried to.
 *
 * A TAP on the handle collapses the sheet and taps it back. That is the point of it: a function that
 * can only be reached by dragging is a function some hands cannot reach (WCAG 2.5.7), and the same
 * press that starts a drag can carry the discrete version of it. Nothing in the sheet is only
 * reachable through either — the height is a way to peek at what is behind, and every control stays
 * where it was.
 *
 * The gesture is tracked on the window rather than through pointer capture because a finger leaves
 * the handle in the first few pixels, that being the point of a drag; capture would keep the events
 * coming but only for as long as the element it was taken on survives the re-render.
 *
 * The panel's ref is the CALLER's and comes in as an argument: a drag has to know the height it is
 * starting from, and a ref handed back out through the return value would make every read of that
 * value a ref read during render.
 */
export function useSheetResize(
  panelRef: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  dismissable = true,
): SheetResize {
  // Non-null exactly while a finger is down.
  const [grab, setGrab] = useState<Grab | null>(null)
  // The height the viewer has chosen, in px; null while they have chosen nothing and the sheet is
  // still whatever its content and its own cap make it.
  const [height, setHeight] = useState<number | null>(null)
  // How far a pull has carried on PAST the short end. The sheet cannot get shorter, so it travels
  // instead — which is what makes letting go from there read as having already left.
  const [overshoot, setOvershoot] = useState(0)
  const [flung, setFlung] = useState(false)

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!event.isPrimary || event.button !== 0) return
      if (!isSheetShape()) return
      if (startsOnControl(event.target)) return
      const measured = panelRef.current?.getBoundingClientRect().height
      if (!measured) return
      setGrab({ y: event.clientY, time: event.timeStamp, height: measured })
      setOvershoot(0)
    },
    [panelRef],
  )

  useEffect(() => {
    if (!grab) return
    // The floor is the SHORT END or the sheet's own height, whichever is less: a sheet whose content
    // never filled the short end has no height to give back, and clamping up to the bound would grow
    // it under a hand that is pulling down. Below the floor the sheet travels instead of shrinking.
    const bounds = () => ({
      tallest: window.innerHeight * TALLEST,
      floor: Math.min(window.innerHeight * SHORTEST, grab.height),
    })
    const move = (event: globalThis.PointerEvent) => {
      const { tallest, floor } = bounds()
      // Down shortens and up lengthens, because the edge being dragged is the sheet's own top.
      const wanted = grab.height - (event.clientY - grab.y)
      setHeight(Math.min(tallest, Math.max(floor, wanted)))
      setOvershoot(Math.max(0, floor - wanted))
    }
    const release = (event: globalThis.PointerEvent) => {
      const { floor } = bounds()
      const travel = event.clientY - grab.y
      const elapsed = Math.max(1, event.timeStamp - grab.time)
      const past = Math.max(0, floor - (grab.height - travel))
      // A host that is mid-commit refuses to close, and the throw has to refuse with it: an exit
      // animation the host will not follow would leave the surface invisible and still there.
      const dismissed =
        dismissable && (past > DISMISS_PX || (past > FLICK_PX && travel / elapsed > FLICK_VELOCITY))
      setGrab(null)
      setOvershoot(0)
      if (dismissed) {
        setFlung(true)
        onDismiss()
        return
      }
      // A press that went nowhere is the discrete version of the same gesture: down to the floor, and
      // back to the height the sheet had on its own — never UP into empty glass, which is what
      // growing a sheet its content never filled would be. The decision is read from the height the
      // gesture STARTED at, not from the state, because a tap usually carries a pointermove of its
      // own and that move has already written this frame's height.
      if (Math.abs(travel) <= TAP_PX) {
        setHeight(grab.height > floor + 1 ? floor : null)
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
    }
  }, [grab, onDismiss, dismissable])

  // A height chosen on a phone is forgotten the moment the surface is not a phone's any more: the
  // wide-screen sheet takes the whole right edge, and the `md:` rule that says so can only win
  // against a custom property that is no longer set.
  useEffect(() => {
    if (height === null || typeof window === 'undefined') return
    const media = window.matchMedia?.(SHEET_VIEWPORT)
    // A host without change notifications keeps the height it was given; there is nothing to shed it
    // on, and a sheet stuck at a chosen height is a smaller failure than a crash on mount.
    if (typeof media?.addEventListener !== 'function') return
    const shed = () => {
      if (!media.matches) setHeight(null)
    }
    media.addEventListener('change', shed)
    return () => media.removeEventListener('change', shed)
  }, [height])

  // `undefined` until a hand has touched it, so a sheet nobody has resized is left entirely to its
  // own layout and its enter/leave animation.
  const style =
    flung || height !== null
      ? ({
          ...(height === null ? null : { ['--sheet-height']: `${Math.round(height)}px` }),
          ...(flung
            ? THROWN
            : grab
              ? { transform: `translate3d(0, ${overshoot}px, 0)`, transition: 'none' }
              : {
                  transform: 'translate3d(0, 0, 0)',
                  transition: `transform ${SETTLE_MS}ms cubic-bezier(0.22, 1, 0.36, 1), height ${SETTLE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
                }),
        } as CSSProperties)
      : undefined

  return { handleProps: { onPointerDown }, style, flung }
}
