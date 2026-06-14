import { create } from 'zustand'

/**
 * Which overlay is up over the persistent universe canvas, or null. The list/explore overlays
 * `dormant`/`diary` are deep-linkable via `?panel=` (HomePage syncs the search param). `evolution`
 * (별 변천사, spec 24) is reserved here as a registry value — it's opened from the recall panel
 * keyed by a star id, so it isn't URL-deep-linkable and stays driven by features/evolution; it
 * shares this overlay layer/z-index (spec 31 §정합).
 */
export type Panel = 'dormant' | 'diary' | 'evolution' | null

interface ShellStore {
  /** The overlay currently open, or null. */
  panel: Panel
  /** Collapsed to a handle after an item was chosen — the universe flies to it behind it
   *  (1.2). Pull the handle back up (setPeek(false)) and the list returns. */
  peek: boolean
  openPanel: (panel: Panel) => void
  closePanel: () => void
  setPeek: (peek: boolean) => void
}

/**
 * The universe shell's panel state (spec 31) — the single registry of which list/explore
 * overlay is open + whether it's peeked. PURE (zustand only — no three/React/DOM, 헌법4): the
 * page reads it to render the OverlayHost, and to mirror `panel` into the `?panel=` search
 * param so deep-links and the back button work without adding a route. `openPanel` resets
 * `peek` (a freshly opened list starts expanded).
 */
export const useShellStore = create<ShellStore>((set) => ({
  panel: null,
  peek: false,
  openPanel: (panel) => set({ panel, peek: false }),
  closePanel: () => set({ panel: null, peek: false }),
  setPeek: (peek) => set({ peek }),
}))
