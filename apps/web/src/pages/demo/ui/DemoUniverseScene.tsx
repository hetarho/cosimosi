import { useCallback, useEffect, useMemo } from 'react'

import { VALUES } from '@cosimosi/config'
import {
  BandFog,
  CameraControls,
  FrameTick,
  PostFX,
  SkinProvider,
  SkySphere,
  StarField,
  UniverseCanvas,
  resolveActiveSkin,
  useSkin,
} from '@cosimosi/3d-renderer'
import { createForceSimNodeIndex } from '@cosimosi/force-sim'
import { paletteVersion } from '@cosimosi/emotion'
import {
  UNIVERSE_ARRIVAL_CAMERA_POSITION,
  UNIVERSE_CAMERA_ENVELOPE,
  advanceSkyRate,
  buildUniverseGraph,
  createUniverseSimBridge,
  generateLatentField,
  gistStageOffset,
  universeEmotionSlices,
  useEpisodicMemoryStore,
  useNeuronStore,
  useSynapseStore,
} from '@cosimosi/universe'
import {
  AwakenNeuron,
  CellStarLayer,
  FilamentLayer,
  GistStarLayer,
  LatentStarField,
  NebulaField,
  StarLayer,
} from '@cosimosi/universe-render'
import { useReducedMotion } from '@cosimosi/ui'

import type { DemoScene, DemoTaste } from '../model/use-demo-run.ts'

const EMPTY_NEURON_INDEX: Readonly<Record<string, number>> = {}
const noAnchors = () => []

// pages/demo ui: the demo's OWN canvas host, following the product widget's layer composition rather
// than the `/test` bench — the demo's entire value is that the visitor sees the real universe, so it
// mounts the real layers over the real force sim.
//
// One deliberate divergence from the product: `CameraControls` (free fly-around) replaces
// `NavigationRig`, because the demo promises free navigation and no camera choreography. The product
// widget itself is never mounted here — its `useUniverse()` throws without a session, and the demo
// has none.
//
// Positions come from `createUniverseSimBridge(null)`: the INLINE main-thread bridge, no worker. A
// public trailer that spawns a worker to lay out eighteen nodes buys latency, not smoothness.
function DemoCanvasHost({
  scene,
  taste,
  displayTime,
  cameraFree,
  onSelectMemory,
}: {
  scene: DemoScene
  taste: DemoTaste
  displayTime: string
  cameraFree: boolean
  onSelectMemory: (memoryId: string) => void
}) {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()

  // A picked star opens its entry, the demo's one reading surface. The layers hand back instance
  // indexes counted off the memory store (the product widget's own mapping); the demo has no
  // navigation rig, so focus and fly both land on the same read — free navigation is the camera
  // story here, not choreography.
  const episodicIds = useEpisodicMemoryStore((state) => state.ids)
  const selectMemoryAt = useCallback(
    (index: number) => {
      const memoryId = episodicIds[index]
      if (memoryId) onSelectMemory(memoryId)
    },
    [episodicIds, onSelectMemory],
  )
  const selectGist = useCallback((memoryId: string) => onSelectMemory(memoryId), [onSelectMemory])

  const snapshot = useMemo(
    () => ({
      memories: scene.memories,
      neurons: scene.neurons,
      synapses: scene.synapses,
      universeTime: scene.universeTime,
    }),
    [scene],
  )

  const graph = useMemo(() => buildUniverseGraph(snapshot), [snapshot])
  const nodeIndex = useMemo(() => createForceSimNodeIndex(graph), [graph])

  const bridge = useMemo(() => createUniverseSimBridge(null), [])
  useEffect(() => () => bridge.dispose(), [bridge])
  useEffect(() => {
    bridge.start(graph)
  }, [bridge, graph])

  const pump = useCallback((delta: number) => bridge.pump(delta), [bridge])

  const latentField = useMemo(
    () =>
      generateLatentField({
        seed: VALUES.forceSim.seed,
        count: VALUES.rendering.latentStarCount,
        zMin: VALUES.forceSim.hippocampusZMin,
        zMax: VALUES.forceSim.hippocampusZMax,
        radius: VALUES.rendering.latentFieldRadius,
      }),
    [],
  )

  // The sky's ramp is filled from the universe's OWN emotions — the honest definition made visible,
  // not an average. It follows the launched memories directly: an empty universe opens on the bare
  // night, and the first star to go up is what puts colour in the sky, which is the same rule the
  // product surface renders under.
  const skyStops = useMemo(() => universeEmotionSlices(scene.memories), [scene.memories])

  const neuronCount = graph.neurons.length
  // Bloom and the camera's field of view stay the fixed skin's: the taster offers every kind the
  // catalog has, and those two were deliberately left outside it.
  const skyEffect = taste.background ?? undefined
  const bodyShape = taste.bodyShape ?? undefined
  const summaryShape = taste.summaryShape ?? undefined
  const mote = taste.mote ?? undefined
  const moteField = taste.moteField ?? undefined

  return (
    <UniverseCanvas
      dpr={[1, VALUES.rendering.maxPixelRatio]}
      fov={skin.camera.fov}
      clearColor={skin.sky.night}
      cameraPosition={UNIVERSE_ARRIVAL_CAMERA_POSITION}
    >
      {/* `rateRef` is the shared sky-rate ref the demo's time presentation writes per frame while a
          jump plays, so the backdrop flows and eases back — the product widget's own wiring. */}
      <SkySphere
        stops={skyStops}
        effect={skyEffect}
        reducedMotion={reducedMotion}
        rateRef={advanceSkyRate}
      />
      <StarField mote={mote} field={moteField} reducedMotion={reducedMotion} />
      <NebulaField
        key={`nebula-${paletteVersion()}`}
        positions={bridge.coordinates}
        firstNodeIndex={neuronCount}
      />
      <LatentStarField field={latentField} reducedMotion={reducedMotion} />
      <CellStarLayer positions={bridge.coordinates} />
      {/* The layers project at the DISPLAYED clock — while a time jump plays, the page hands in
          the sweep's sampled date, so forgetting is watched happening rather than found after. */}
      <StarLayer
        key={`star-${paletteVersion()}-${bodyShape ?? 'default'}`}
        shape={bodyShape}
        positions={bridge.coordinates}
        firstNodeIndex={neuronCount}
        universeTime={displayTime}
        reducedMotion={reducedMotion}
        onFocus={selectMemoryAt}
        onFly={selectMemoryAt}
      />
      <FilamentLayer
        positions={bridge.coordinates}
        neuronIndexById={nodeIndex.neurons ?? EMPTY_NEURON_INDEX}
        universeTime={displayTime}
        reducedMotion={reducedMotion}
      />
      <BandFog
        zMin={VALUES.forceSim.hippocampusZMax}
        zMax={VALUES.forceSim.hippocampusZMin + gistStageOffset(1)}
        radius={VALUES.rendering.latentFieldRadius}
        intensity={VALUES.rendering.gistRiseLayerFog}
      />
      <GistStarLayer
        key={`gist-${paletteVersion()}-${summaryShape ?? 'default'}`}
        shape={summaryShape}
        positions={bridge.coordinates}
        memoryIndexById={nodeIndex.episodicMemories ?? EMPTY_NEURON_INDEX}
        onSelect={selectGist}
      />
      {/* The awaken's anchors are positions of recently-active neurons on the product canvas. The
          demo hands back none, so the birth point is picked at random from the latent field — which
          is the right choice for a universe whose first launch has no history to grow out of. */}
      <AwakenNeuron
        field={latentField}
        newNeuronIds={scene.newNeuronIds}
        resolveAnchors={noAnchors}
      />
      {/* Free navigation is free play's (and the sky beat's spectators'): while the tour runs, a
          dragged-away camera would point the ring and the mask hole at a scene the caption is not
          describing, so the controls simply do not mount until the run is over. */}
      {cameraFree && <CameraControls {...UNIVERSE_CAMERA_ENVELOPE} />}
      <FrameTick onFrame={pump} />
      <PostFX bloom={skin.bloom} />
    </UniverseCanvas>
  )
}

export function DemoUniverseScene({
  scene,
  taste,
  displayTime,
  cameraFree,
  onSelectMemory,
}: {
  scene: DemoScene
  taste: DemoTaste
  /** The clock the layers project at — the sweep's sampled date while a jump plays, else the
   *  committed demo clock. */
  displayTime: string
  /** Free-play only: drag/zoom navigation stays unmounted while the tour runs. */
  cameraFree: boolean
  /** A star (or gist body) was picked on the canvas. */
  onSelectMemory: (memoryId: string) => void
}) {
  // The three read-model singletons are owned for as long as this scene is mounted. They are the same
  // stores the product fills from `GetUniverse`; the demo writes DOMAIN shapes straight in, skipping
  // the proto/DTO mappers, so no `bigint`↔`int64` handling and no api-client type is involved.
  const setMemories = useEpisodicMemoryStore((state) => state.setAll)
  const setNeurons = useNeuronStore((state) => state.setAll)
  const setSynapses = useSynapseStore((state) => state.setAll)

  useEffect(() => {
    setMemories(scene.memories)
    setNeurons(scene.neurons)
    setSynapses(scene.synapses)
  }, [scene, setMemories, setNeurons, setSynapses])

  return (
    <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
      <DemoCanvasHost
        scene={scene}
        taste={taste}
        displayTime={displayTime}
        cameraFree={cameraFree}
        onSelectMemory={onSelectMemory}
      />
    </SkinProvider>
  )
}
