import { useCallback, useEffect, useMemo } from 'react'
import type { ActorRefFrom } from 'xstate'

import { VALUES } from '@cosimosi/config'
import type { NavigationPose } from '@cosimosi/3d-renderer'
import {
  createForceSimNodeIndex,
  forceSimCoordinateOffset,
  type ForceSimGraph,
  type ForceSimNodeIndex,
} from '@cosimosi/force-sim'
import { usePaletteVersion } from '@cosimosi/emotion/react'
import { useActorRef } from '@cosimosi/state-machine/react'
import { ornamentRegistryKey, useOrnamentPreviewStore, type OrnamentKind } from '@cosimosi/store'
import { useAppliedOrnaments } from '@cosimosi/store/react'
import {
  buildUniverseGraph,
  createUniverseSimBridge,
  generateLatentField,
  gistNodeId,
  recentlyActiveNeuronIds,
  universeEmotionSlices,
  universeNavigationMachine,
  useAdvanceSweepStore,
  useEpisodicMemoryStore,
  useLaunchedNeuronsStore,
  useNeuronStore,
  usePendingFlyTargetStore,
  type AwakenAnchor,
  type LatentField,
  type SimWorkerSpawner,
  type UniverseNavigationMode,
  type UniverseSimBridge,
} from '@cosimosi/universe'
import { useUniverse } from '@cosimosi/universe/react'

export type UniverseNavigationActorRef = ActorRefFrom<typeof universeNavigationMachine>

const IDLE_POSE: NavigationPose = { mode: 'idle', target: null, targetId: null }

export interface UniverseSceneOptions {
  /**
   * The web app returns a module-Worker spawner; React Native has no standard Worker primitive and
   * returns null, which runs the sim inline on the JS thread behind the same bridge seam.
   */
  readonly simSpawner: SimWorkerSpawner | null
  /** How many latent bodies to scatter — the MVP native scene carries fewer. */
  readonly latentStarCount: number
  /**
   * Lifted from the composing page/screen so a sibling widget (the star-detail panel) subscribes to
   * the SAME selection — the canvas machine stays the single selection owner (§3.2). Mounted without
   * one (test pages), the scene owns its own.
   */
  readonly navigationActorRef?: UniverseNavigationActorRef
}

export interface UniverseSceneState {
  readonly bridge: UniverseSimBridge
  readonly graph: ForceSimGraph | null
  readonly nodeIndex: ForceSimNodeIndex | null
  /** Memories share the star layer's buffer slots starting here; neurons occupy [0, neuronCount). */
  readonly neuronCount: number
  readonly latentField: LatentField
  readonly newNeuronIds: readonly string[]
  readonly paletteVersion: number
  readonly skyStops: ReturnType<typeof universeEmotionSlices>
  /** What this universe wears ([P4]) — the resolved decoration ids, preview-aware. */
  readonly wearing: Readonly<Record<Extract<OrnamentKind, 'BACKGROUND' | 'STAR_SHADER'>, string>>
  /** The clock the SCENE projects at (see below) — not necessarily the committed read clock. */
  readonly sceneTime: string | null
  readonly universeTime: string | null
  readonly getPose: () => NavigationPose
  readonly onArrived: () => void
  readonly pump: (dt: number) => void
  readonly focusNeuron: (index: number) => void
  readonly flyToNeuron: (index: number) => void
  readonly focusMemory: (index: number) => void
  readonly flyToMemory: (index: number) => void
  readonly selectGist: (memoryId: string, stage: number) => void
  readonly resolveAnchors: (excludeIds: ReadonlySet<string>) => readonly AwakenAnchor[]
}

/**
 * Everything the universe scene needs, computed once for both apps.
 *
 * All of it runs OUT HERE, outside the canvas: React context does not cross the R3F reconciler, so
 * canvas children get data via props only. Per-frame flow stays outside React entirely — the sim
 * bridge swaps the coordinate buffer ref, the layers read it in `useFrame`, and the navigation rig
 * polls the machine through `getSnapshot()`. No 60 fps React state, no per-frame store reads.
 *
 * Web and native differ only in the three `UniverseSceneOptions` inputs and in what they wrap this
 * with (a DOM canvas host and a hover overlay vs a native surface) — everything else was a
 * duplicated fork that had already drifted twice.
 */
export function useUniverseScene({
  simSpawner,
  latentStarCount,
  navigationActorRef,
}: UniverseSceneOptions): UniverseSceneState {
  const { universe } = useUniverse()
  const graph = useMemo(() => (universe ? buildUniverseGraph(universe) : null), [universe])
  const nodeIndex = useMemo(() => (graph ? createForceSimNodeIndex(graph) : null), [graph])

  const bridge = useMemo(() => createUniverseSimBridge(simSpawner), [simSpawner])
  useEffect(() => () => bridge.dispose(), [bridge])
  useEffect(() => {
    if (graph) bridge.start(graph)
  }, [bridge, graph])

  const ownActorRef = useActorRef(universeNavigationMachine)
  const actorRef = navigationActorRef ?? ownActorRef

  // Camera hand-off from a cross-route action (the diary jump): a parked fly target is consumed
  // once the graph carries the node, gliding to the recovered memory's body, then cleared. The
  // reinforced memory already exists in the universe, so the node resolves as soon as the read loads.
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

  const onArrived = useCallback(() => actorRef.send({ type: 'ARRIVED' }), [actorRef])
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

  // A pick arrives as an INSTANCE index, so it resolves against the same id list the layer indexed
  // its instances by — the entity stores (CellStarLayer/StarLayer both count off them), never the
  // graph's lists. The two diverge by design: the episodic store is server truth PLUS the
  // optimistic-launch tail (universe/react), so a just-launched memory sits at an index the graph
  // does not carry, and resolving through the graph drops that pick entirely — leaving the newest
  // body in the universe the one that cannot be opened, which is the one a person reaches for right
  // after writing.
  const episodicIds = useEpisodicMemoryStore((state) => state.ids)
  const neuronIds = useNeuronStore((state) => state.ids)
  const focusNeuron = useCallback(
    (index: number) => sendNodeCommand(neuronIds[index], 'focus'),
    [neuronIds, sendNodeCommand],
  )
  const flyToNeuron = useCallback(
    (index: number) => sendNodeCommand(neuronIds[index], 'fly'),
    [neuronIds, sendNodeCommand],
  )
  const focusMemory = useCallback(
    (index: number) => sendNodeCommand(episodicIds[index], 'focus'),
    [episodicIds, sendNodeCommand],
  )
  const flyToMemory = useCallback(
    (index: number) => sendNodeCommand(episodicIds[index], 'fly'),
    [episodicIds, sendNodeCommand],
  )
  // A gist pick is a SELECT only (read-only routing to the paid view, [R8]) — gist bodies are
  // not sim nodes, so there is no coordinate for the camera to glide to.
  const selectGist = useCallback(
    (memoryId: string, stage: number) =>
      actorRef.send({ type: 'SELECT', nodeId: gistNodeId(memoryId, stage) }),
    [actorRef],
  )

  // The emotion-colored layers memoize each memory's mood color into instanced buffers, so a live
  // palette swap (module-level setMoodPalette) is invisible to their memos. Remounting them on the
  // palette version recomputes the buffers through the unchanged moodColor seam — a live re-color
  // with no rendering-package edit and no GetUniverse refetch. Only the color-bearing layers key on
  // it; neuron/synapse layers carry no emotion color and stay mounted.
  const paletteVersion = usePaletteVersion()

  // The clock the SCENE projects at. While a time acceleration plays it is the sweep's sampled date,
  // so brightness walks down in front of the viewer instead of being found already down; otherwise
  // it is the committed read clock. It changes at most once per sampled step, never per frame, so
  // subscribing here costs a handful of renders per acceleration.
  const sweepTime = useAdvanceSweepStore((state) => state.sampledTime)
  const universeTime = universe?.universeTime ?? null
  const sceneTime = sweepTime ?? universeTime

  // The ONE translation point from decoration ids into rendering vocabulary (§3.4): while a panel is
  // open the previewed ids win, otherwise the confirmed read does. `widgets/decoration-panel` never
  // imports the renderer — it installs a preview, and this reads it. The skin keeps the scene
  // defaults that are never for sale — bloom, camera, the bare night ([V10][I11]).
  const applied = useAppliedOrnaments()
  const previewActive = useOrnamentPreviewStore((state) => state.previewActive)
  const previewed = useOrnamentPreviewStore((state) => state.previewed)
  const wearing = previewActive
    ? {
        BACKGROUND: ornamentRegistryKey('BACKGROUND', previewed.BACKGROUND) ?? applied.BACKGROUND,
        STAR_SHADER:
          ornamentRegistryKey('STAR_SHADER', previewed.STAR_SHADER) ?? applied.STAR_SHADER,
      }
    : applied

  const skyStops = useMemo(() => {
    // The version is a genuine input: moodColor reads the module-level palette it stamps.
    void paletteVersion
    // Every feeling the universe holds goes to the sky. The emotion axis divides the sphere by
    // weight, so more feelings means smaller territories, never a muddier wash.
    return universe ? universeEmotionSlices(universe.memories) : []
  }, [universe, paletteVersion])

  // The launch flow announces genuinely-created neuron ids here; the awaken plays for the fresh
  // ones (idempotent via the awaken registry). Empty until the first launch of this session.
  const newNeuronIds = useLaunchedNeuronsStore((state) => state.newNeuronIds)

  // The gray latent field is generated once from the shared seed (web↔native agree on the seed, not
  // on the count) and is NOT a sim node — decorative, static, never attracting real nodes [E7a][I5].
  const latentField = useMemo(
    () =>
      generateLatentField({
        seed: VALUES.forceSim.seed,
        count: latentStarCount,
        zMin: VALUES.forceSim.hippocampusZMin,
        zMax: VALUES.forceSim.hippocampusZMax,
        radius: VALUES.rendering.latentFieldRadius,
      }),
    [latentStarCount],
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

  return {
    bridge,
    graph,
    nodeIndex,
    neuronCount: graph?.neurons.length ?? 0,
    latentField,
    newNeuronIds,
    paletteVersion,
    skyStops,
    wearing,
    sceneTime,
    universeTime,
    getPose,
    onArrived,
    pump,
    focusNeuron,
    flyToNeuron,
    focusMemory,
    flyToMemory,
    selectGist,
    resolveAnchors,
  }
}
