import { create } from 'zustand'

import {
  DEFAULT_ORNAMENT_IDS,
  ORNAMENT_KINDS,
  type OrnamentKind,
  type OrnamentSelection,
} from './ornament.ts'

// The preview: what the universe is wearing right now versus what the user has actually saved.
//
// It survives nothing, and that is the design ([P6][P8]). There is no `persist` middleware, no URL
// parameter and no server write anywhere in this path, so a reload, a route change, a crash or a
// sign-out all restore the confirmed selection by construction rather than by a handler someone has
// to remember to write. The only durable write in the whole epic is Decorate.

export type OrnamentIDsByKind = Readonly<Record<OrnamentKind, string>>

export interface OrnamentPreviewState {
  /** True only while a panel is open. Outside that, preview() does nothing at all. */
  readonly previewActive: boolean
  /** What the universe shows now — the previewed ids while active, otherwise the confirmed ones. */
  readonly previewed: OrnamentIDsByKind
  /** What the user has actually saved, as the server last confirmed it. */
  readonly confirmed: OrnamentIDsByKind
  /** Adopt the server's confirmed selection (the boot read, and every successful save). */
  adopt: (selections: readonly OrnamentSelection[]) => void
  open: () => void
  /** Show one kind's ornament. Inert while no panel is open, so nothing else can install a preview. */
  preview: (kind: OrnamentKind, ornamentId: string) => void
  /** Leave without saving: the universe goes back to what was saved. */
  revert: () => void
  /** A save landed: what was previewed becomes what is confirmed, from the RESPONSE's selection. */
  commit: (selections: readonly OrnamentSelection[]) => void
  resetStoreUserState: () => void
}

const DEFAULTS: OrnamentIDsByKind = Object.freeze(
  Object.fromEntries(ORNAMENT_KINDS.map((kind) => [kind, DEFAULT_ORNAMENT_IDS[kind]])) as Record<
    OrnamentKind,
    string
  >,
)

function byKind(selections: readonly OrnamentSelection[]): OrnamentIDsByKind {
  const resolved = { ...DEFAULTS } as Record<OrnamentKind, string>
  for (const selection of selections) {
    if (selection.ornamentId) resolved[selection.kind] = selection.ornamentId
  }
  return Object.freeze(resolved)
}

export const useOrnamentPreviewStore = create<OrnamentPreviewState>()((set) => ({
  previewActive: false,
  previewed: DEFAULTS,
  confirmed: DEFAULTS,
  adopt: (selections) => {
    const confirmed = byKind(selections)
    // A boot read must not overwrite a live preview — the user is looking at it.
    set((state) => (state.previewActive ? { confirmed } : { confirmed, previewed: confirmed }))
  },
  open: () => set((state) => ({ previewActive: true, previewed: state.confirmed })),
  preview: (kind, ornamentId) =>
    set((state) =>
      state.previewActive
        ? { previewed: Object.freeze({ ...state.previewed, [kind]: ornamentId }) }
        : state,
    ),
  revert: () => set((state) => ({ previewActive: false, previewed: state.confirmed })),
  commit: (selections) => {
    const confirmed = byKind(selections)
    set({ previewActive: false, previewed: confirmed, confirmed })
  },
  // A scope change leaves nothing of the previous account on the render seam: the incoming universe
  // must not open wearing someone else's sky for a frame.
  resetStoreUserState: () =>
    set({ previewActive: false, previewed: DEFAULTS, confirmed: DEFAULTS }),
}))
