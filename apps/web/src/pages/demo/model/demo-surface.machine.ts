import { assign, setup, type SnapshotFrom } from 'xstate'

// The demo's open surface: the writing sheet, a picked memory's panel, the recall walk that panel
// hands to, the diary the memory was split from, or the decoration sheet — one of them, or none. Each
// declares itself modal and brings its own scrim and focus trap, so two at once would stack; as the
// states of one machine, two at once is not a value the page can hold (ARCH-24).
//
// Each surface closes with its own event, so a stray close from a surface that is not up cannot take
// down the one that is. Opening one replaces whatever was open: that is how each hand-off (memory →
// recall, memory → diary) already read on screen.

export type DemoSurface =
  | { readonly kind: 'none' }
  | { readonly kind: 'writing' }
  | { readonly kind: 'memory'; readonly memoryId: string }
  | { readonly kind: 'recall'; readonly memoryId: string; readonly applied: boolean }
  | { readonly kind: 'reading'; readonly diaryId: string }
  | { readonly kind: 'decorating' }

export type DemoSurfaceEvent =
  | { type: 'OPEN_WRITING' }
  | { type: 'CLOSE_WRITING' }
  | { type: 'SELECT_MEMORY'; memoryId: string }
  | { type: 'CLOSE_MEMORY' }
  | { type: 'REQUEST_RECALL'; memoryId: string }
  | { type: 'RECALL_APPLIED' }
  | { type: 'CLOSE_RECALL' }
  | { type: 'OPEN_DIARY'; diaryId: string }
  | { type: 'CLOSE_DIARY' }
  | { type: 'OPEN_DECORATION' }
  | { type: 'TASTED' }
  | { type: 'CLOSE_DECORATION' }

interface DemoSurfaceContext {
  readonly memoryId: string | null
  readonly applied: boolean
  readonly diaryId: string | null
  /**
   * Whether anything has been tried on in this run. It outlives the decoration sheet: the decorating
   * beat is a round trip, and once something has been tried its way out stays open.
   */
  readonly tasted: boolean
}

export const demoSurfaceMachine = setup({
  types: {
    context: {} as DemoSurfaceContext,
    events: {} as DemoSurfaceEvent,
  },
  actions: {
    pickMemory: assign(({ event }) =>
      event.type === 'SELECT_MEMORY' ? { memoryId: event.memoryId, diaryId: null } : {},
    ),
    startRecall: assign(({ event }) =>
      event.type === 'REQUEST_RECALL' ? { memoryId: event.memoryId, applied: false } : {},
    ),
    openDiary: assign(({ event }) =>
      event.type === 'OPEN_DIARY' ? { memoryId: null, diaryId: event.diaryId } : {},
    ),
    clearTarget: assign({ memoryId: null, applied: false, diaryId: null }),
  },
}).createMachine({
  id: 'demoSurface',
  // The run opens on its first diary, already drawn into the writing sheet.
  initial: 'writing',
  context: { memoryId: null, applied: false, diaryId: null, tasted: false },
  on: {
    OPEN_WRITING: { target: '.writing', actions: 'clearTarget' },
    OPEN_DECORATION: { target: '.decorating', actions: 'clearTarget' },
  },
  states: {
    none: {
      on: { SELECT_MEMORY: { target: 'memory', actions: 'pickMemory' } },
    },
    writing: {
      on: {
        CLOSE_WRITING: { target: 'none' },
        // The recall beat stages its memory even over a sheet left open; the sheet steps down for it.
        SELECT_MEMORY: { target: 'memory', actions: 'pickMemory' },
      },
    },
    memory: {
      on: {
        SELECT_MEMORY: { target: 'memory', actions: 'pickMemory' },
        CLOSE_MEMORY: { target: 'none', actions: 'clearTarget' },
        REQUEST_RECALL: { target: 'recall', actions: 'startRecall' },
        OPEN_DIARY: { target: 'reading', actions: 'openDiary' },
      },
    },
    recall: {
      on: {
        RECALL_APPLIED: { actions: assign({ applied: true }) },
        CLOSE_RECALL: { target: 'none', actions: 'clearTarget' },
      },
    },
    reading: {
      on: {
        CLOSE_DIARY: { target: 'none', actions: 'clearTarget' },
        SELECT_MEMORY: { target: 'memory', actions: 'pickMemory' },
      },
    },
    decorating: {
      on: {
        TASTED: { actions: assign({ tasted: true }) },
        CLOSE_DECORATION: { target: 'none' },
      },
    },
  },
})

/** The one open surface a snapshot holds, with the target it is open on. */
export function demoSurface(snapshot: SnapshotFrom<typeof demoSurfaceMachine>): DemoSurface {
  const { memoryId, applied, diaryId } = snapshot.context
  if (snapshot.matches('writing')) return { kind: 'writing' }
  if (snapshot.matches('memory') && memoryId) return { kind: 'memory', memoryId }
  if (snapshot.matches('recall') && memoryId) return { kind: 'recall', memoryId, applied }
  if (snapshot.matches('reading') && diaryId) return { kind: 'reading', diaryId }
  if (snapshot.matches('decorating')) return { kind: 'decorating' }
  return { kind: 'none' }
}
