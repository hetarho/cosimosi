import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export interface FocusTrapOptions {
  /** When false the trap is inert (e.g. a closed dialog). */
  active: boolean
  /** Called when Escape is pressed inside the trapped region. */
  onEscape?: () => void
}

/**
 * Trap keyboard focus inside `containerRef` while `active`. On activation it moves
 * focus into the region; on deactivation it restores focus to the element that had
 * it before. This is the modal-surface focus contract (plan/09 A6 keyboard/focus);
 * web-only, since React Native modals manage their own focus.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, { active, onEscape }: FocusTrapOptions): void {
  // Hold the latest onEscape in a ref so an inline callback (a fresh identity each
  // render) doesn't tear down and re-arm the trap — which would re-steal focus.
  const onEscapeRef = useRef(onEscape)
  onEscapeRef.current = onEscape

  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    // Exclude elements pulled out of tab order (e.g. `<button tabindex="-1">`), which
    // the tag-based selector would otherwise match.
    const focusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => el.tabIndex >= 0)

    const initial = focusable()[0] ?? container
    initial.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscapeRef.current?.()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    container.addEventListener('keydown', onKeyDown)
    return () => {
      container.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [active, containerRef])
}
