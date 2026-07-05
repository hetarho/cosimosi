// @cosimosi/universe — the pure, cross-app core of the universe scene: the
// domain→force-sim graph projection, the sim-host bridge, the camera/selection XState
// machine, and the camera-rig constants. Free of three/DOM/native by rule; web and mobile
// widgets import it verbatim and keep only their platform forks (worker spawner, UI host).
export { buildUniverseGraph, buildSynapseEndpointIndexPairs } from './build-graph.ts'
export {
  createUniverseSimBridge,
  type UniverseSimBridge,
  type MutableCoordinateBufferRef,
  type SimWorkerLike,
  type SimWorkerSpawner,
  type SimWorkerRequest,
  type SimWorkerResponse,
} from './sim-bridge.ts'
export {
  universeNavigationMachine,
  type UniverseNavigationContext,
  type UniverseNavigationEvent,
  type UniverseNavigationMode,
} from './universe-navigation.machine.ts'
export { UNIVERSE_CAMERA_RIG } from './camera-rig.ts'
