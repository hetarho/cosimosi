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
  buildUniverseGraph,
  createUniverseSimBridge,
  generateLatentField,
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
function DemoCanvasHost({ scene, taste }: { scene: DemoScene; taste: DemoTaste }) {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()

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

  // Beat 8: the sky's ramp is filled from the universe's OWN strength-weighted emotions — the honest
  // definition made visible, not an average. Before that beat it stays the bare night, so the moment
  // the colour arrives is the moment the beat says it does.
  const skyStops = useMemo(
    () => (scene.skyFilled ? universeEmotionSlices(scene.memories) : []),
    [scene.memories, scene.skyFilled],
  )

  const neuronCount = graph.neurons.length
  // Bloom and the camera's field of view stay the fixed skin's: the taster sells a background and a
  // body shape, and those two were deliberately left outside the catalog.
  const skyEffect = taste.background ?? undefined
  const bodyShape = taste.bodyShape ?? undefined

  return (
    <UniverseCanvas
      dpr={[1, VALUES.rendering.maxPixelRatio]}
      fov={skin.camera.fov}
      clearColor={skin.sky.night}
    >
      <SkySphere stops={skyStops} effect={skyEffect} reducedMotion={reducedMotion} />
      <StarField reducedMotion={reducedMotion} />
      <NebulaField
        key={`nebula-${paletteVersion()}`}
        positions={bridge.coordinates}
        firstNodeIndex={neuronCount}
      />
      <LatentStarField field={latentField} reducedMotion={reducedMotion} />
      <CellStarLayer positions={bridge.coordinates} />
      <StarLayer
        key={`star-${paletteVersion()}-${bodyShape ?? 'default'}`}
        shape={bodyShape}
        positions={bridge.coordinates}
        firstNodeIndex={neuronCount}
        universeTime={scene.universeTime}
        reducedMotion={reducedMotion}
      />
      <FilamentLayer
        positions={bridge.coordinates}
        neuronIndexById={nodeIndex.neurons ?? EMPTY_NEURON_INDEX}
        universeTime={scene.universeTime}
        reducedMotion={reducedMotion}
      />
      <BandFog
        zMin={VALUES.forceSim.hippocampusZMax}
        zMax={VALUES.forceSim.neocortexZMin}
        radius={VALUES.rendering.latentFieldRadius}
        intensity={VALUES.rendering.gistRiseLayerFog}
      />
      <GistStarLayer
        key={`gist-${paletteVersion()}`}
        positions={bridge.coordinates}
        memoryIndexById={nodeIndex.episodicMemories ?? EMPTY_NEURON_INDEX}
      />
      {/* The awaken's anchors are positions of recently-active neurons on the product canvas. The
          demo hands back none, so the birth point is picked at random from the latent field — which
          is the right choice for a universe whose first launch has no history to grow out of. */}
      <AwakenNeuron
        field={latentField}
        newNeuronIds={scene.newNeuronIds}
        resolveAnchors={noAnchors}
      />
      <CameraControls />
      <FrameTick onFrame={pump} />
      <PostFX bloom={skin.bloom} />
    </UniverseCanvas>
  )
}

export function DemoUniverseScene({ scene, taste }: { scene: DemoScene; taste: DemoTaste }) {
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
      <DemoCanvasHost scene={scene} taste={taste} />
    </SkinProvider>
  )
}
