import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'
let reducedMotionQuery: MediaQueryList | null | undefined

function subscribe(onChange: () => void): () => void {
  const mql = getReducedMotionQuery()
  if (!mql) return () => {}
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function getSnapshot(): boolean {
  return getReducedMotionQuery()?.matches ?? false
}

function getReducedMotionQuery(): MediaQueryList | null {
  if (reducedMotionQuery !== undefined) return reducedMotionQuery
  reducedMotionQuery =
    typeof window === 'undefined' || !window.matchMedia ? null : window.matchMedia(QUERY)
  return reducedMotionQuery
}

/**
 * Whether the user prefers reduced motion (web). The shared base.css already
 * neutralizes CSS transitions/animations under this preference; this hook lets a
 * component additionally skip JS-driven motion (e.g. an auto-dismiss timer's
 * animation).
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
