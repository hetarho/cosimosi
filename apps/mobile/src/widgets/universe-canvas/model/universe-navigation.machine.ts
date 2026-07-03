import {assign, setup} from 'xstate';

export type UniverseNavigationMode = 'idle' | 'focusing' | 'flying';

// Context rule (§3.2): ids only. The graph, coordinate buffers, and caches live in
// stores/refs and are looked up by these ids.
export interface UniverseNavigationContext {
  selectedNodeId: string | null;
  /** Node a focus/fly glide is traveling toward; null while idle. */
  travelNodeId: string | null;
}

export type UniverseNavigationEvent =
  | {type: 'SELECT'; nodeId: string}
  | {type: 'CLEAR_SELECTION'}
  | {type: 'FOCUS'; nodeId: string}
  | {type: 'FLY'; nodeId: string}
  | {type: 'ARRIVED'}
  | {type: 'CANCEL'};

// Camera/navigation control state [U3][V0]: idle (free zoom · rotate · pan) → focusing
// (frame a node) | flying (glide to a node) → idle. The rig polls this machine per frame
// via getSnapshot() and reports ARRIVED; selection rides along as an id and only feeds
// focus/fly (and later detail panels).
export const universeNavigationMachine = setup({
  types: {
    context: {} as UniverseNavigationContext,
    events: {} as UniverseNavigationEvent,
  },
  actions: {
    setSelection: assign(({event}) => (event.type === 'SELECT' ? {selectedNodeId: event.nodeId} : {})),
    clearSelection: assign({selectedNodeId: null}),
    setTravelTarget: assign(({event}) =>
      event.type === 'FOCUS' || event.type === 'FLY' ? {travelNodeId: event.nodeId} : {},
    ),
    clearTravelTarget: assign({travelNodeId: null}),
  },
}).createMachine({
  id: 'universe-navigation',
  context: {selectedNodeId: null, travelNodeId: null},
  initial: 'idle',
  on: {
    SELECT: {actions: 'setSelection'},
    CLEAR_SELECTION: {actions: 'clearSelection'},
  },
  states: {
    idle: {
      on: {
        FOCUS: {target: 'focusing', actions: 'setTravelTarget'},
        FLY: {target: 'flying', actions: 'setTravelTarget'},
      },
    },
    focusing: {
      on: {
        ARRIVED: {target: 'idle', actions: 'clearTravelTarget'},
        CANCEL: {target: 'idle', actions: 'clearTravelTarget'},
        FOCUS: {target: 'focusing', actions: 'setTravelTarget', reenter: true},
        FLY: {target: 'flying', actions: 'setTravelTarget'},
      },
    },
    flying: {
      on: {
        ARRIVED: {target: 'idle', actions: 'clearTravelTarget'},
        CANCEL: {target: 'idle', actions: 'clearTravelTarget'},
        FOCUS: {target: 'focusing', actions: 'setTravelTarget'},
        FLY: {target: 'flying', actions: 'setTravelTarget', reenter: true},
      },
    },
  },
});
