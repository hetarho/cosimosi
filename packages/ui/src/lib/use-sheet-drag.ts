import { useCallback, useEffect, useState, type CSSProperties, type PointerEvent } from 'react'

/**
 * The width below which a `Dialog` is a bottom sheet rather than a centred modal. It must stay in
 * step with the `md:` switch in dialog.tsx — the gesture only makes sense on the shape that has a
 * bottom edge to go out through, and reading the media query here is what keeps a wide-screen
 * pointer from dragging a modal that has nowhere to go.
 */
const SHEET_VIEWPORT = '(width < 48rem)'
/** Downward travel past which a release dismisses instead of springing back. */
const DISMISS_PX = 96
/**
 * A shorter drag still dismisses if it was thrown rather than nudged — but only past `FLICK_PX`,
 * because the first few pixels of any press cover the shortest distance in the shortest time and
 * would otherwise read as the fastest flick of all.
 */
const FLICK_PX = 24
const FLICK_VELOCITY = 0.5
/** Must match the sheet's leave animation in base.css — the throw and the unmount end together. */
const SETTLE_MS = 200
/** A drag that starts on a control is that control's press, not the sheet's. */
const INTERACTIVE = 'button, a, input, textarea, select, [role="button"], [role="slider"]'

const DRAGGING: CSSProperties = { transition: 'none' }
const THROWN: CSSProperties = {
  transform: 'translate3d(0, 100%, 0)',
  opacity: 0,
  transition: `transform ${SETTLE_MS}ms cubic-bezier(0.64, 0, 0.78, 0), opacity ${SETTLE_MS}ms linear`,
}
const SETTLED: CSSProperties = {
  transform: 'translate3d(0, 0, 0)',
  transition: `transform ${SETTLE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
}

interface Grab {
  readonly y: number
  readonly time: number
}

export interface SheetDrag {
  /** Spread on the grab surface — the handle strip a sheet wears above its title. */
  readonly handleProps: {
    readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void
  }
  /** The panel's transform: the live drag, the spring back, or the throw out. */
  readonly style: CSSProperties | undefined
  /**
   * True once a throw has committed. The caller must withhold its own leave animation while it is:
   * a CSS animation outranks an inline transform, so the leave would yank the sheet back up to rest
   * and slide it out from there, erasing the drag the hand just made.
   */
  readonly flung: boolean
}

/**
 * Swipe-down-to-dismiss for a bottom sheet — the way out a thumb reaches for before it finds the ✕.
 *
 * The gesture is tracked on the window rather than through pointer capture because a finger leaves
 * the handle in the first few pixels, that being the point of a drag; capture would keep the events
 * coming but only for as long as the element it was taken on survives the re-render.
 *
 * There is no reset: the hook is meant to be called from a component that lives only while its sheet
 * is on screen, so a reopen mounts a fresh drag instead of inheriting the throw that closed the last
 * one.
 */
export function useSheetDrag(onDismiss: () => void): SheetDrag {
  // Non-null exactly while a finger is down; `rest` is where the sheet goes once it lifts.
  const [grab, setGrab] = useState<Grab | null>(null)
  const [rest, setRest] = useState<'idle' | 'settling' | 'flung'>('idle')
  const [offset, setOffset] = useState(0)

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0) return
    // `matchMedia` is read at press time rather than subscribed to: the shape only matters for the
    // gesture, so a value one frame stale during a resize costs nothing and a render does.
    const media = typeof window === 'undefined' ? null : window.matchMedia?.(SHEET_VIEWPORT)
    if (!media?.matches) return
    if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return
    setGrab({ y: event.clientY, time: event.timeStamp })
    setOffset(0)
    setRest('idle')
  }, [])

  useEffect(() => {
    if (!grab) return
    // Downward only. An upward pull has nowhere to go, and rubber-banding it would promise a taller
    // sheet than the one that is there.
    const move = (event: globalThis.PointerEvent) => setOffset(Math.max(0, event.clientY - grab.y))
    const release = (event: globalThis.PointerEvent) => {
      const travel = Math.max(0, event.clientY - grab.y)
      const elapsed = Math.max(1, event.timeStamp - grab.time)
      const dismissed =
        travel > DISMISS_PX || (travel > FLICK_PX && travel / elapsed > FLICK_VELOCITY)
      setGrab(null)
      setOffset(0)
      setRest(dismissed ? 'flung' : 'settling')
      if (dismissed) onDismiss()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
    }
  }, [grab, onDismiss])

  // `undefined` at rest, so a sheet nobody has touched is left entirely to its enter/leave animation.
  const style = grab
    ? { ...DRAGGING, transform: `translate3d(0, ${offset}px, 0)` }
    : rest === 'flung'
      ? THROWN
      : rest === 'settling'
        ? SETTLED
        : undefined

  return { handleProps: { onPointerDown }, style, flung: rest === 'flung' }
}
