// @cosimosi/universe/scene — the scene projection both apps' canvases and the demo assemble: the
// domain→force-sim graph, the sim-host bridge, the camera rig and navigation machine, the
// domain→visual channel projections (one-way, §3.4), the latent field, the awaken pick and the
// spotlight. Pure — the R3F bindings that draw it live in @cosimosi/universe-render.
export { buildUniverseGraph } from './build-graph.ts'
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
export {
  UNIVERSE_ARRIVAL_CAMERA_POSITION,
  UNIVERSE_CAMERA_ENVELOPE,
  UNIVERSE_CAMERA_RIG,
} from './camera-rig.ts'
export {
  SPOTLIGHT_FADE_LAMBDA,
  SPOTLIGHT_HOLD_SECONDS,
  SPOTLIGHT_SCENE_DIM,
  SPOTLIGHT_STAR_LIFT,
  useSpotlightStore,
  type SpotlightState,
} from './spotlight-store.ts'
export {
  pickAwakenSeeds,
  recentlyActiveNeuronIds,
  type AwakenAnchor,
  type AwakenSeedInput,
  type RecentlyActiveInput,
  type RecentMemory,
} from './pick-awaken-seed.ts'
export { generateLatentField, type LatentField, type LatentFieldParams } from './latent-field.ts'
export {
  starBrightnessChannel,
  starChannels,
  starStaticChannels,
  type StarChannels,
  type StarStaticChannels,
} from './star-channels.ts'
export {
  gistNodeId,
  gistStageOffset,
  gistStarInstances,
  parseGistNodeId,
  type GistStarInstance,
} from './gist-star-channels.ts'
export { cellStarChannels, type CellStarChannels } from './cell-star-channels.ts'
export { projectFilaments, type FilamentChannels, type FilamentBatch } from './filament-channels.ts'
export {
  buildContributors,
  type NebulaContributors,
  type ContributorParams,
} from './contributors.ts'
export { universeEmotionSlices } from './universe-emotion-slices.ts'
