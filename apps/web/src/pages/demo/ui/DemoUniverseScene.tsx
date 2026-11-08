import { useCallback, useEffect, useMemo, useRef } from 'react'

import { VALUES } from '@cosimosi/config'
import {
  BandFog,
  CameraControls,
  FrameTick,
  FocusPulse,
  PostFX,
  SkinProvider,
  SkySphere,
  StarField,
  UniverseCanvas,
  resolveActiveSkin,
  useSkin,
} from '@cosimosi/3d-renderer'
import {
  UNIVERSE_ARRIVAL_CAMERA_POSITION,
  UNIVERSE_CAMERA_ENVELOPE,
  gistStageOffset,
} from '@cosimosi/universe/scene'
import {
  advanceSkyRate,
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
  UniverseFraming,
  useSceneAssembly,
} from '@cosimosi/universe-render'
import type { CaptionSlotKind } from '@cosimosi/sequence'
import { useReducedMotion } from '@cosimosi/ui'

import { framingTopInset } from '../model/framing-insets.ts'
import type { DemoScene, DemoTaste } from '../model/use-demo-run.ts'

const EMPTY_NEURON_INDEX: Readonly<Record<string, number>> = {}
const noAnchors = () => []

// pages/demo ui: the demo's OWN canvas host, following the product widget's layer composition rather
// than the `/test` bench — the demo's entire value is that the visitor sees the real universe, so it
// mounts the real layers over the real force sim.
//
// One deliberate divergence from the product: `CameraControls` (free fly-around) replaces
// `NavigationRig`: the guided overview frames both memory bands and hands its pose to free navigation. The product
// widget itself is never mounted here — its `useUniverse()` throws without a session, and the demo
// has none.
//
// Positions, sky and latent field come from `useSceneAssembly`, the product canvas's own assembly.
function DemoCanvasHost({
  scene,
  taste,
  displayTime,
  cameraFree,
  rightInset,
  bottomInset,
  viewportHeight,
  captionRoom,
  captionBandHeight,
  onSelectMemory,
  recallFocusId,
  recallPulsing,
  onRecallFocusReady,
  onRecallComplete,
  decorationFocusId,
}: {
  scene: DemoScene
  taste: DemoTaste
  displayTime: string
  cameraFree: boolean
  rightInset: number
  bottomInset: number
  viewportHeight: number
  captionRoom: CaptionSlotKind | null
  captionBandHeight: number
  onSelectMemory: (memoryId: string) => void
  recallFocusId: string | null
  recallPulsing: boolean
  onRecallFocusReady: () => void
  onRecallComplete: () => void
  decorationFocusId: string | null
}) {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()
  const focusId = recallFocusId ?? decorationFocusId
  const targetRef = useRef<[number, number, number]>([0, 0, 0])
  const getInitialTarget = useCallback(() => targetRef.current, [])
  // The overview starts below a phone's eyeline caption, so the line never lies across the memories
  // it describes; a recall focus keeps its own frame.
  const insets = useMemo(
    () => ({
      left: 24,
      top: recallFocusId
        ? 96
        : framingTopInset({
            top: 96,
            viewportHeight,
            captionRoom,
            captionBandHeight,
          }),
      right: rightInset + 24,
      bottom: recallFocusId ? 96 : bottomInset + 128,
    }),
    [rightInset, bottomInset, recallFocusId, viewportHeight, captionRoom, captionBandHeight],
  )

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

  // The product's own assembly over the demo's fixtures: the same graph, layout and sky. The INLINE
  // main-thread bridge (no spawner): a public trailer that spawns a worker to lay out eighteen nodes
  // buys latency, not smoothness.
  const { bridge, nodeIndex, neuronCount, latentField, skyStops, pump, paletteVersion } =
    useSceneAssembly({
      universe: snapshot,
      simSpawner: null,
      latentStarCount: VALUES.rendering.latentStarCount,
    })

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
        paletteVersion={paletteVersion}
        positions={bridge.coordinates}
        firstNodeIndex={neuronCount}
      />
      <LatentStarField field={latentField} reducedMotion={reducedMotion} />
      <CellStarLayer positions={bridge.coordinates} />
      {/* The layers project at the DISPLAYED clock — while a time jump plays, the page hands in
          the sweep's sampled date, so forgetting is watched happening rather than found after. */}
      <StarLayer
        paletteVersion={paletteVersion}
        arrivalPaused={displayTime < scene.universeTime}
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
        neuronIndexById={nodeIndex?.neurons ?? EMPTY_NEURON_INDEX}
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
        paletteVersion={paletteVersion}
        shape={summaryShape}
        positions={bridge.coordinates}
        memoryIndexById={nodeIndex?.episodicMemories ?? EMPTY_NEURON_INDEX}
        onSelect={selectGist}
        reducedMotion={reducedMotion}
      />
      {/* The awaken's anchors are positions of recently-active neurons on the product canvas. The
          demo hands back none, so the birth point is picked at random from the latent field — which
          is the right choice for a universe whose first launch has no history to grow out of. */}
      <AwakenNeuron
        field={latentField}
        newNeuronIds={displayTime < scene.universeTime ? [] : scene.newNeuronIds}
        resolveAnchors={noAnchors}
        positions={bridge.coordinates}
        neuronIndexById={nodeIndex?.neurons ?? EMPTY_NEURON_INDEX}
        reducedMotion={reducedMotion}
      />
      {/* Free navigation is free play's (and the sky beat's spectators'): while the tour runs, a
          dragged-away camera would point the ring and the mask hole at a scene the caption is not
          describing, so the controls simply do not mount until the run is over. */}
      <UniverseFraming
        positions={bridge.coordinates}
        memoryIndexById={nodeIndex?.episodicMemories ?? EMPTY_NEURON_INDEX}
        insets={insets}
        enabled={!cameraFree || !!focusId}
        reducedMotion={reducedMotion}
        targetRef={targetRef}
        focusMemoryId={focusId}
        onFocusReady={recallFocusId ? onRecallFocusReady : undefined}
      />
      {recallPulsing &&
        recallFocusId &&
        nodeIndex?.episodicMemories[recallFocusId] !== undefined && (
          <FocusPulse
            positions={bridge.coordinates}
            nodeIndex={nodeIndex.episodicMemories[recallFocusId]!}
            radius={VALUES.rendering.starSizeMax * 1.25}
            reducedMotion={reducedMotion}
            onComplete={onRecallComplete}
          />
        )}
      {cameraFree && !focusId && (
        <CameraControls {...UNIVERSE_CAMERA_ENVELOPE} getInitialTarget={getInitialTarget} />
      )}
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
  rightInset = 0,
  bottomInset = 0,
  viewportHeight = 0,
  captionRoom = null,
  captionBandHeight = 0,
  onSelectMemory,
  recallFocusId,
  recallPulsing,
  onRecallFocusReady,
  onRecallComplete,
  decorationFocusId,
}: {
  scene: DemoScene
  taste: DemoTaste
  /** The clock the layers project at — the sweep's sampled date while a jump plays, else the
   *  committed demo clock. */
  displayTime: string
  /** Free-play only: drag/zoom navigation stays unmounted while the tour runs. */
  cameraFree: boolean
  rightInset?: number
  bottomInset?: number
  /** The tracked window height the caption band's position is measured against. */
  viewportHeight?: number
  /** Where the tutorial caption sits on this screen; `null` while none shows. */
  captionRoom?: CaptionSlotKind | null
  /** The caption band's rendered height, which an eyeline caption makes the frame clear. */
  captionBandHeight?: number
  /** A star (or gist body) was picked on the canvas. */
  onSelectMemory: (memoryId: string) => void
  recallFocusId: string | null
  recallPulsing: boolean
  onRecallFocusReady: () => void
  onRecallComplete: () => void
  decorationFocusId: string | null
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
        rightInset={rightInset}
        bottomInset={bottomInset}
        viewportHeight={viewportHeight}
        captionRoom={captionRoom}
        captionBandHeight={captionBandHeight}
        onSelectMemory={onSelectMemory}
        recallFocusId={recallFocusId}
        recallPulsing={recallPulsing}
        onRecallFocusReady={onRecallFocusReady}
        onRecallComplete={onRecallComplete}
        decorationFocusId={decorationFocusId}
      />
    </SkinProvider>
  )
}
