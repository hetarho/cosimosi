import { useCallback, useEffect, useMemo } from 'react'
import type { ActorRefFrom } from 'xstate'

import { VALUES } from '@cosimosi/config'
import type { NavigationPose, PinnedView } from '@cosimosi/3d-renderer'
import { forceSimCoordinateOffset } from '@cosimosi/force-sim'
import { useActorRef } from '@cosimosi/state-machine/react'
import type { OrnamentKind } from '@cosimosi/store'
import { useWornOrnaments } from '@cosimosi/store/react'
import {
  gistNodeId,
  recentlyActiveNeuronIds,
  universeNavigationMachine,
  useSpotlightStore,
  type AwakenAnchor,
  type UniverseNavigationMode,
} from '@cosimosi/universe/scene'
import {
  useAdvanceSweepStore,
  useEpisodicMemoryStore,
  useLaunchedNeuronsStore,
  useNeuronStore,
  usePendingFlyTargetStore,
  useUniverseViewStore,
} from '@cosimosi/universe'
import { useUniverse } from '@cosimosi/universe/react'

import { createLayoutCentroid, measureLayoutCentroid } from './layout-centroid.ts'
import {
  useSceneAssembly,
  type SceneAssembly,
  type SceneAssemblyInputs,
} from './use-scene-assembly.ts'

export type UniverseNavigationActorRef = ActorRefFrom<typeof universeNavigationMachine>

const IDLE_POSE: NavigationPose = { mode: 'idle', target: null, targetId: null }

export interface UniverseSceneOptions extends Omit<SceneAssemblyInputs, 'universe'> {
  /**
   * Lifted from the composing page/screen so a sibling widget (the star-detail panel) subscribes to
   * the SAME selection — the canvas machine stays the single selection owner (§3.2). Mounted without
   * one (test pages), the scene owns its own.
   */
  readonly navigationActorRef?: UniverseNavigationActorRef
}

export interface UniverseSceneState extends SceneAssembly {
  readonly newNeuronIds: readonly string[]
  /** What this universe wears ([P4]) — the resolved registry key per kind, preview-aware. Every
   *  kind, not a hand-picked subset: a kind the store publishes and this scene has no layer for is
   *  the store's problem to answer for, and narrowing here would hide it until a panel row did
   *  nothing. */
  readonly wearing: Readonly<Record<OrnamentKind, string>>
  /** The clock the SCENE projects at (see below) — not necessarily the committed read clock. */
  readonly sceneTime: string | null
  /** Whether the universe is held flat right now ([U3]'s two ways of holding it). */
  readonly pinned: boolean
  readonly getPose: () => NavigationPose
  readonly getPinnedView: () => PinnedView
  readonly onArrived: () => void
  readonly focusNeuron: (index: number) => void
  readonly flyToNeuron: (index: number) => void
  readonly focusMemory: (index: number) => void
  readonly flyToMemory: (index: number) => void
  readonly selectGist: (memoryId: string) => void
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
 * Web and native differ only in the three `UniverseSceneOptions` inputs and in the host they wrap
 * this with — a DOM canvas host on one side, a native surface on the other. Everything else is
 * shared, because a fork of this hook is a fork that drifts.
 */
export function useUniverseScene({
  simSpawner,
  latentStarCount,
  navigationActorRef,
}: UniverseSceneOptions): UniverseSceneState {
  const { universe } = useUniverse()
  const assembly = useSceneAssembly({ universe, simSpawner, latentStarCount })
  const { bridge, nodeIndex } = assembly

  const ownActorRef = useActorRef(universeNavigationMachine)
  const actorRef = navigationActorRef ?? ownActorRef

  // Camera hand-off from a cross-route action (the diary jump): a parked fly target is consumed
  // once the graph carries the node, gliding to the recovered memory's body, then cleared. The
  // request stays parked while the node is still missing — the refetch that carries it is already in
  // flight, and consuming a target the graph cannot resolve would drop the hand-off for good, since
  // the slot holds one request and nothing re-sends it.
  const flyTargetNodeId = usePendingFlyTargetStore((state) => state.nodeId)
  const clearFlyTarget = usePendingFlyTargetStore((state) => state.clear)
  useEffect(() => {
    if (!flyTargetNodeId || !nodeIndex) return
    const index = nodeIndex.neurons[flyTargetNodeId] ?? nodeIndex.episodicMemories[flyTargetNodeId]
    if (index === undefined) return
    actorRef.send({ type: 'FLY', nodeId: flyTargetNodeId })
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

  // Which shape the universe is held in. A viewer's own choice, so subscribing to it costs one
  // render per press — the rig reads the flag as a prop because the two modes wear different
  // controls, and only WHERE the flat camera is orbiting is polled per frame.
  const pinned = useUniverseViewStore((state) => state.mode) === 'pinned'
  const pinnedView = useMemo(
    () => ({ center: [0, 0, 0] as [number, number, number], held: false }),
    [],
  )
  const centroid = useMemo(() => createLayoutCentroid(), [])
  const getPinnedView = useCallback((): PinnedView => {
    const buffer = bridge.coordinates.current
    const snapshot = actorRef.getSnapshot()
    // What holds the frame, in the order a viewer would expect: the star being travelled to, then
    // the one whose panel is open, then the memories a cross-route jump is spotlighting — the sky is
    // holding still for those, so the camera holds with it rather than sliding home mid-arrival.
    const heldId =
      snapshot.context.travelNodeId ??
      snapshot.context.selectedNodeId ??
      useSpotlightStore.getState().memoryIds[0] ??
      null
    const heldIndex =
      heldId && nodeIndex
        ? (nodeIndex.neurons[heldId] ?? nodeIndex.episodicMemories[heldId])
        : undefined
    if (buffer && heldIndex !== undefined) {
      const offset = forceSimCoordinateOffset(heldIndex)
      pinnedView.center[0] = buffer[offset] ?? 0
      pinnedView.center[1] = buffer[offset + 1] ?? 0
      pinnedView.center[2] = buffer[offset + 2] ?? 0
      pinnedView.held = true
      return pinnedView
    }
    pinnedView.held = false
    // The middle of the stars is the centre of mass of the live layout, measured only when the
    // presented coordinates moved.
    measureLayoutCentroid(centroid, buffer, bridge.coordinates.version)
    pinnedView.center[0] = centroid.center[0]
    pinnedView.center[1] = centroid.center[1]
    pinnedView.center[2] = centroid.center[2]
    return pinnedView
  }, [actorRef, bridge, centroid, nodeIndex, pinnedView])

  const onArrived = useCallback(() => actorRef.send({ type: 'ARRIVED' }), [actorRef])
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
    (memoryId: string) => actorRef.send({ type: 'SELECT', nodeId: gistNodeId(memoryId) }),
    [actorRef],
  )

  // The clock the SCENE projects at. While a time acceleration plays it is the sweep's sampled date,
  // so brightness walks down in front of the viewer instead of being found already down; otherwise
  // it is the committed read clock. It changes at most once per sampled step, never per frame, so
  // subscribing here costs a handful of renders per acceleration.
  const sweepTime = useAdvanceSweepStore((state) => state.sampledTime)
  const universeTime = universe?.universeTime ?? null
  const sceneTime = sweepTime ?? universeTime

  // Decoration ids reach rendering vocabulary through `useWornOrnaments` (§3.4), which resolves the
  // preview-versus-confirmed precedence for every surface that draws a decorated thing — this scene
  // and the star-detail panel's own preview alike. `widgets/decoration-panel` never imports the
  // renderer: it installs a preview, and that hook reads it. The skin keeps the scene defaults that
  // are never for sale — bloom, camera, the bare night ([V10][I11]).
  const wearing = useWornOrnaments()

  // The launch flow announces genuinely-created neuron ids here; the awaken plays for the fresh
  // ones (idempotent via the awaken registry). Empty until the first launch of this session.
  const newNeuronIds = useLaunchedNeuronsStore((state) => state.newNeuronIds)

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
    ...assembly,
    newNeuronIds,
    wearing,
    sceneTime,
    pinned,
    getPose,
    getPinnedView,
    onArrived,
    focusNeuron,
    flyToNeuron,
    focusMemory,
    flyToMemory,
    selectGist,
    resolveAnchors,
  }
}
