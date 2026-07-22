import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ActorRefFrom } from 'xstate'

import { VALUES } from '@cosimosi/config'
import {
  Background,
  BandFog,
  FrameTick,
  NavigationRig,
  PostFX,
  SkinProvider,
  SkySphere,
  StarField,
  UniverseCanvas,
  resolveActiveSkin,
  resolveBackgroundNode,
  useSkin,
  type NavigationPose,
} from '@cosimosi/3d-renderer'
import { createForceSimNodeIndex, forceSimCoordinateOffset } from '@cosimosi/force-sim'
import {
  UNIVERSE_CAMERA_RIG,
  buildUniverseGraph,
  createUniverseSimBridge,
  currentDecayText,
  generateLatentField,
  gistNodeId,
  recentlyActiveNeuronIds,
  universeEmotionSlices,
  universeNavigationMachine,
  useEpisodicMemoryStore,
  usePendingFlyTargetStore,
  type AwakenAnchor,
  type UniverseNavigationMode,
} from '@cosimosi/universe'
import { useReducedMotion } from '@cosimosi/ui'
import {
  AwakenNeuron,
  CellStarLayer,
  FilamentLayer,
  GistStarLayer,
  LatentStarField,
  NebulaField,
  StarLayer,
} from '@cosimosi/universe-render'

import { usePaletteVersion } from '../../../features/change-palette/index.ts'
import { useLaunchedNeuronsStore } from '../../../features/launch-stars/index.ts'
import { useActorRef } from '../../../shared/model/index.ts'
import { useUniverse } from '@cosimosi/universe/react'
import { createSimWorkerSpawner } from '../lib/sim-worker-spawner.ts'

const EMPTY_NEURON_INDEX: Readonly<Record<string, number>> = {}
const IDLE_POSE: NavigationPose = { mode: 'idle', target: null, targetId: null }

type NavigationActorRef = ActorRefFrom<typeof universeNavigationMachine>

// The universe scene block: mounts the @cosimosi/3d-renderer canvas host + skin/post
// pipeline unchanged (no renderer lifecycle, no skin system, no post pipeline of its own)
// and composes the projected graph inside it. All hooks that need app context run OUT
// HERE — React context does not cross the R3F reconciler, so canvas children get data
// via props only. Per-frame flow: the worker bridge swaps the coordinate buffer ref, the
// package layers read it in useFrame, and the rig polls the machine via getSnapshot() —
// no 60 fps React state and no per-frame store reads.
function UniverseCanvasHost({ navigationActorRef }: { navigationActorRef?: NavigationActorRef }) {
  const { skin } = useSkin()
  const backgroundNode = useMemo(() => resolveBackgroundNode(skin.background), [skin.background])
  const { universe } = useUniverse()
  const graph = useMemo(() => (universe ? buildUniverseGraph(universe) : null), [universe])
  const nodeIndex = useMemo(() => (graph ? createForceSimNodeIndex(graph) : null), [graph])

  const bridge = useMemo(() => createUniverseSimBridge(createSimWorkerSpawner()), [])
  useEffect(() => () => bridge.dispose(), [bridge])
  useEffect(() => {
    if (graph) bridge.start(graph)
  }, [bridge, graph])

  // The selection/navigation actor is lifted to the composing page so a sibling widget (the
  // star-detail panel) subscribes to the SAME selection — the canvas machine stays the single
  // selection owner (§3.2). When mounted without a lifted ref (test pages), it owns its own.
  const ownActorRef = useActorRef(universeNavigationMachine)
  const actorRef = navigationActorRef ?? ownActorRef

  // Camera hand-off from a cross-route action (the diary jump): a parked fly target is consumed
  // once the graph carries the node, gliding to the recovered star, then cleared. The reinforced
  // star already exists in the universe, so the node resolves as soon as the read loads.
  const flyTargetNodeId = usePendingFlyTargetStore((state) => state.nodeId)
  const clearFlyTarget = usePendingFlyTargetStore((state) => state.clear)
  useEffect(() => {
    if (!flyTargetNodeId || !nodeIndex) return
    const index = nodeIndex.neurons[flyTargetNodeId] ?? nodeIndex.episodicMemories[flyTargetNodeId]
    if (index !== undefined) actorRef.send({ type: 'FLY', nodeId: flyTargetNodeId })
    clearFlyTarget()
  }, [flyTargetNodeId, nodeIndex, actorRef, clearFlyTarget])

  const pose = useMemo(
    () => ({
      mode: 'idle' as UniverseNavigationMode,
      target: [0, 0, 0] as [number, number, number],
      targetId: null as string | null,
    }),
    [],
  )
  const getPose = useCallback((): NavigationPose => {
    const snapshot = actorRef.getSnapshot()
    const mode = snapshot.value as UniverseNavigationMode
    const nodeId = snapshot.context.travelNodeId
    const buffer = bridge.coordinates.current
    if (mode === 'idle' || !nodeId || !nodeIndex || !buffer) return IDLE_POSE
    const index = nodeIndex.neurons[nodeId] ?? nodeIndex.episodicMemories[nodeId]
    if (index === undefined) return IDLE_POSE
    // Polled per glide frame — read the buffer in place, no per-frame allocation.
    const offset = forceSimCoordinateOffset(index)
    pose.mode = mode
    pose.targetId = nodeId
    pose.target[0] = buffer[offset] ?? 0
    pose.target[1] = buffer[offset + 1] ?? 0
    pose.target[2] = buffer[offset + 2] ?? 0
    return pose
  }, [actorRef, bridge, nodeIndex, pose])

  const handleArrived = useCallback(() => actorRef.send({ type: 'ARRIVED' }), [actorRef])
  const pump = useCallback((dt: number) => bridge.pump(dt), [bridge])
  const sendNodeCommand = useCallback(
    (nodeId: string | undefined, command: 'focus' | 'fly') => {
      if (!nodeId) return
      if (command === 'focus') {
        actorRef.send({ type: 'SELECT', nodeId })
        actorRef.send({ type: 'FOCUS', nodeId })
      } else {
        actorRef.send({ type: 'FLY', nodeId })
      }
    },
    [actorRef],
  )
  const focusNeuron = useCallback(
    (index: number) => sendNodeCommand(graph?.neurons[index]?.id, 'focus'),
    [graph, sendNodeCommand],
  )
  const flyToNeuron = useCallback(
    (index: number) => sendNodeCommand(graph?.neurons[index]?.id, 'fly'),
    [graph, sendNodeCommand],
  )
  const focusMemory = useCallback(
    (index: number) => sendNodeCommand(graph?.episodicMemories[index]?.id, 'focus'),
    [graph, sendNodeCommand],
  )
  const flyToMemory = useCallback(
    (index: number) => sendNodeCommand(graph?.episodicMemories[index]?.id, 'fly'),
    [graph, sendNodeCommand],
  )
  // A gist pick is a SELECT only (read-only routing to the paid view, [R8]) — gist bodies are
  // not sim nodes, so there is no coordinate for the camera to glide to.
  const selectGist = useCallback(
    (memoryId: string, stage: number) =>
      actorRef.send({ type: 'SELECT', nodeId: gistNodeId(memoryId, stage) }),
    [actorRef],
  )

  // Hover glimpse: a truncated current decay-stage text so the eroded memory reads as eroded before
  // the panel opens ([F1][R8a]). The label is the preview, the panel is the full read. Keyed by id so
  // pointer-moves within one star don't re-render; the full text + word-loss recovery live in the panel.
  const episodicIds = useEpisodicMemoryStore((state) => state.ids)
  const [hoveredMemoryId, setHoveredMemoryId] = useState<string | null>(null)
  const handleMemoryHover = useCallback(
    (index: number | null) => {
      // Resolve against the SAME episodic-store ids StarLayer indexes its instances by — not the
      // graph's memory list, which lags the store by the optimistic-launch tail (would mis-map or
      // drop a just-launched star's glimpse).
      const id = index === null ? null : (episodicIds[index] ?? null)
      setHoveredMemoryId((previous) => (previous === id ? previous : id))
    },
    [episodicIds],
  )

  const neuronCount = graph?.neurons.length ?? 0
  const episodicById = useEpisodicMemoryStore((state) => state.byId)

  // The emotion-colored layers memoize each memory's mood color into instanced buffers, so a live
  // palette swap (module-level setMoodPalette) is invisible to their memos. Remounting them on the
  // palette version recomputes the buffers through the unchanged moodColor seam — a live re-color
  // with no rendering-package edit and no GetUniverse refetch. Only the color-bearing layers key on
  // it; neuron/synapse layers carry no emotion color and stay mounted.
  const paletteVersion = usePaletteVersion()

  // The enclosing emotion sky ([57]): mounted when the active skin declares the `sky` background —
  // the universe's own emotions drive the sphere's palette ramp ([I3], color only). Slices depend
  // on the palette version so a live palette swap re-colors through the unchanged moodColor seam
  // (the sphere repaints its ramp in place; the material rebuilds only if the emotion count moves).
  const skyEffect = skin.background.type === 'sky' ? skin.background.props.effect : null
  const reducedMotion = useReducedMotion()
  const skyStops = useMemo(() => {
    // The version is a genuine input: moodColor reads the module-level palette it stamps.
    void paletteVersion
    return skyEffect && universe ? universeEmotionSlices(universe.memories) : []
  }, [skyEffect, universe, paletteVersion])

  // The launch flow announces genuinely-created neuron ids here; the awaken plays for the fresh
  // ones (idempotent via the awaken registry). Empty until the first launch of this session.
  const newNeuronIds = useLaunchedNeuronsStore((state) => state.newNeuronIds)

  // The gray latent field is generated once from the shared seed (web↔mobile agree) and is NOT a
  // sim node — decorative, static, never attracting real nodes [E7a][I5]. Mobile lowers the count.
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

  // The awaken's anchor set: positions of recently-active neurons (a client heuristic over the
  // visible graph, [L4] window used conceptually), read from the live coordinate buffer at trigger
  // time. Empty → the pick is random. Purely presentation; nothing is sent to the server.
  const resolveAnchors = useCallback(
    (excludeIds: ReadonlySet<string>): readonly AwakenAnchor[] => {
      const buffer = bridge.coordinates.current
      if (!buffer || !nodeIndex || !universe) return []
      const ids = recentlyActiveNeuronIds({
        memories: universe.memories,
        universeTime: universe.universeTime,
        windowDays: VALUES.synapse.temporalWindowDays,
        excludeIds,
      })
      const anchors: AwakenAnchor[] = []
      for (const id of ids) {
        const index = nodeIndex.neurons[id]
        if (index === undefined) continue
        const offset = forceSimCoordinateOffset(index)
        anchors.push([buffer[offset] ?? 0, buffer[offset + 1] ?? 0, buffer[offset + 2] ?? 0])
      }
      return anchors
    },
    [bridge, nodeIndex, universe],
  )

  const hoveredMemory = hoveredMemoryId ? episodicById[hoveredMemoryId] : undefined
  const glimpseText = hoveredMemory
    ? truncateGlimpse(currentDecayText(hoveredMemory, universe?.universeTime ?? null))
    : ''

  return (
    <div className="relative h-full w-full">
      <UniverseCanvas dpr={[1, VALUES.rendering.maxPixelRatio]} fov={skin.camera.fov}>
        <Background node={backgroundNode} />
        {skyEffect && (
          <SkySphere stops={skyStops} effect={skyEffect} reducedMotion={reducedMotion} />
        )}
        <StarField />
        {/* Emotion color field: additive mood-color blend behind the latent field and bodies
            (renderOrder -2). Memories share the star layer's buffer slots [neuronCount, …). */}
        <NebulaField
          key={`nebula-${paletteVersion}`}
          positions={bridge.coordinates}
          firstNodeIndex={neuronCount}
        />
        <LatentStarField field={latentField} />
        <CellStarLayer positions={bridge.coordinates} onFocus={focusNeuron} onFly={flyToNeuron} />
        <StarLayer
          key={`star-${paletteVersion}`}
          positions={bridge.coordinates}
          firstNodeIndex={neuronCount}
          universeTime={universe?.universeTime ?? null}
          onFocus={focusMemory}
          onFly={flyToMemory}
          onHover={handleMemoryHover}
        />
        <FilamentLayer
          positions={bridge.coordinates}
          neuronIndexById={nodeIndex?.neurons ?? EMPTY_NEURON_INDEX}
          universeTime={universe?.universeTime ?? null}
        />
        {/* The neocortex band ([V9]): gist bodies at the memories' copied x,y, risen z — plus
            the restrained gap haze that makes the two bands read as depth, never a wall. */}
        <BandFog
          zMin={VALUES.forceSim.hippocampusZMax}
          zMax={VALUES.forceSim.neocortexZMin}
          radius={VALUES.rendering.latentFieldRadius}
          intensity={VALUES.rendering.gistRiseLayerFog}
        />
        <GistStarLayer
          key={`gist-${paletteVersion}`}
          positions={bridge.coordinates}
          memoryIndexById={nodeIndex?.episodicMemories ?? EMPTY_NEURON_INDEX}
          onSelect={selectGist}
        />
        <AwakenNeuron
          field={latentField}
          newNeuronIds={newNeuronIds}
          resolveAnchors={resolveAnchors}
        />
        <NavigationRig getPose={getPose} onArrived={handleArrived} {...UNIVERSE_CAMERA_RIG} />
        <FrameTick onFrame={pump} />
        <PostFX bloom={skin.bloom} />
      </UniverseCanvas>
      {/* Hover glimpse of the eroded memory — shown plainly, no decay warning ([R8a]). The full
          forgotten text + recovery live in the star-detail panel. */}
      {glimpseText && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
          <p className="max-w-[min(90vw,40rem)] truncate rounded-full border border-border bg-surface/80 px-4 py-1.5 text-sm text-text-muted backdrop-blur">
            {glimpseText}
          </p>
        </div>
      )}
    </div>
  )
}

// The hover label is a glimpse, not the read (the panel holds the full text) — keep it to one line.
function truncateGlimpse(text: string): string {
  const trimmed = text.trim()
  const limit = 60
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}…` : trimmed
}

export function UniverseCanvasWidget({
  navigationActorRef,
}: {
  navigationActorRef?: NavigationActorRef
} = {}) {
  return (
    <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
      <UniverseCanvasHost navigationActorRef={navigationActorRef} />
    </SkinProvider>
  )
}
