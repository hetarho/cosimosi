import { create } from 'zustand'

import type { SequenceRect } from './select.ts'

/**
 * How a pure engine points at a control it does not own and never imports.
 *
 * `measure()` returns a PROMISE because that is the only shape one seam can have on both platforms:
 * web reads `getBoundingClientRect()` synchronously, but RN's `measureInWindow` is callback-based.
 * The rect is in logical (density-independent) pixels relative to the app window, so the two
 * platforms hand back comparable numbers.
 *
 * Rects are re-measured on step change, on resize/orientation change and on registry change — never
 * per frame. A highlight that chased layout every frame would be a scroll-jank source for an
 * affordance that is decorative by design.
 */
export interface SequenceAnchorHandle {
  measure: () => Promise<SequenceRect | null>
}

export interface SequenceAnchorRegistryState {
  readonly anchors: ReadonlyMap<string, SequenceAnchorHandle>
  register: (anchorId: string, handle: SequenceAnchorHandle) => void
  unregister: (anchorId: string) => void
  reset: () => void
}

export const useSequenceAnchorRegistry = create<SequenceAnchorRegistryState>()((set) => ({
  anchors: new Map<string, SequenceAnchorHandle>(),
  register: (anchorId, handle) =>
    set((state) => {
      const next = new Map(state.anchors)
      next.set(anchorId, handle)
      return { anchors: next }
    }),
  unregister: (anchorId) =>
    set((state) => {
      if (!state.anchors.has(anchorId)) return state
      const next = new Map(state.anchors)
      next.delete(anchorId)
      return { anchors: next }
    }),
  reset: () => set({ anchors: new Map<string, SequenceAnchorHandle>() }),
}))

/**
 * An unresolved anchor is NOT an error: the control may not have mounted yet, or the host may have
 * mislabeled it. Either way the caption and the skip stay, the step still advances on its signal,
 * and the run stays completable — so there is deliberately no timeout, no retry and no error
 * surface. The caption is the guaranteed channel; the highlight is an enhancement.
 */
export async function measureAnchor(anchorId: string | undefined): Promise<SequenceRect | null> {
  if (!anchorId) return null
  const handle = useSequenceAnchorRegistry.getState().anchors.get(anchorId)
  if (!handle) return null
  try {
    return await handle.measure()
  } catch {
    return null
  }
}
