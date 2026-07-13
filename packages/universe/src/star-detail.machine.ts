import { setup } from 'xstate'

import type { EpisodicMemory, Neuron } from '@cosimosi/memory'

/**
 * The star-detail panel's own control-state (§3.2): which view is showing. Selection
 * ownership stays with the universe-navigation machine (the single source of the
 * selected id); this machine only tracks the panel view phase and derives open/closed
 * from that selection via OPEN/CLOSE the composing widget sends when the canvas
 * selection appears/clears. The selected id and the fetched provenance live in the
 * canvas machine / Query, never in this context.
 */
export type StarDetailPhase = 'closed' | 'meta' | 'provenance'

export type StarDetailEvent =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'SHOW_PROVENANCE' }
  | { type: 'BACK' }
  | { type: 'RECALL' }
  | { type: 'OPEN_DIARY' }

// closed → meta (canvas selection non-nil) → provenance (변천사 보기) and back; a
// deselect/close returns to closed from either view. RECALL / OPEN_DIARY are emitted
// intents consumed by the composing page (recall flow / router) — they leave the panel
// phase intact, so they are self-handled no-ops here (the widget fires the side effect).
export const starDetailMachine = setup({
  types: {
    events: {} as StarDetailEvent,
  },
}).createMachine({
  id: 'starDetail',
  initial: 'closed',
  states: {
    closed: {
      on: { OPEN: 'meta' },
    },
    meta: {
      on: {
        SHOW_PROVENANCE: 'provenance',
        CLOSE: 'closed',
        // Re-selecting a different star re-enters meta (drops a stale provenance view).
        OPEN: { target: 'meta', reenter: true },
        RECALL: {},
        OPEN_DIARY: {},
      },
    },
    provenance: {
      on: {
        BACK: 'meta',
        CLOSE: 'closed',
        OPEN: { target: 'meta', reenter: true },
      },
    },
  },
})

/**
 * A selected node resolved to the domain star the panel renders. Episodic stars get the
 * full meta + free current-text + buttons; neurons get info-only meta (no emotion,
 * no episodic actions, [D1][I3]); a gist (요지) body routes to the paid gist-view surface
 * ([R8]) instead of this panel; nothing selected / an unknown id is `none`.
 */
export type ResolvedSelection =
  | { kind: 'episodic'; memory: EpisodicMemory }
  | { kind: 'neuron'; neuron: Neuron }
  | { kind: 'gist'; episodicMemoryId: string; stage: number }
  | { kind: 'none' }

export interface SelectionStores {
  episodicById: Readonly<Record<string, EpisodicMemory>>
  neuronById: Readonly<Record<string, Neuron>>
  /**
   * Recognizes a gist-body node id (the z-raised 신피질 gist star [V9]) and returns the
   * `(memory, stage)` ViewSemantic selection it names ([R8]). The panel injects the
   * recognizer (the gist layer's parseGistNodeId), so this resolver never knows the
   * gist-body id format; without one, every selection is episodic/neuron/none.
   */
  resolveGist?: (nodeId: string) => { episodicMemoryId: string; stage: number } | null
}

// Pure selector (§3.2): the canvas machine's selected id → the domain star, looked up in
// the GetUniverse read-model mirrors. Gist bodies are checked first (they route away from
// this panel), then episodic, then neuron.
export function resolveSelection(
  selectedNodeId: string | null,
  stores: SelectionStores,
): ResolvedSelection {
  if (!selectedNodeId) return { kind: 'none' }
  const gist = stores.resolveGist?.(selectedNodeId) ?? null
  if (gist) return { kind: 'gist', episodicMemoryId: gist.episodicMemoryId, stage: gist.stage }
  const memory = stores.episodicById[selectedNodeId]
  if (memory) return { kind: 'episodic', memory }
  const neuron = stores.neuronById[selectedNodeId]
  if (neuron) return { kind: 'neuron', neuron }
  return { kind: 'none' }
}
