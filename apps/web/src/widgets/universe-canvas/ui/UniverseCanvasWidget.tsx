import { useCallback, useEffect, useMemo } from 'react'

import { VALUES } from '@cosimosi/config'
import {
  Background,
  FrameTick,
  NavigationRig,
  PostFX,
  SkinProvider,
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
  universeNavigationMachine,
  type UniverseNavigationMode,
} from '@cosimosi/universe'

import { AwakenNeuron, recentlyActiveNeuronIds, type AwakenAnchor } from '../../../features/awaken-neuron/index.ts'
import { useLaunchedNeuronsStore } from '../../../features/launch-stars/index.ts'
import { CellStarLayer } from '../../../entities/cell-star/index.ts'
import { FilamentLayer } from '../../../entities/filament/index.ts'
import { LatentStarField, generateLatentField } from '../../../entities/latent-star/index.ts'
import { NebulaField } from '../../../entities/nebula/index.ts'
import { StarLayer } from '../../../entities/star/index.ts'
import { useActorRef } from '../../../shared/model/index.ts'
import { useUniverse } from '../api/use-universe.ts'
import { createSimWorkerSpawner } from '../lib/sim-worker-spawner.ts'

const EMPTY_NEURON_INDEX: Readonly<Record<string, number>> = {}
const IDLE_POSE: NavigationPose = { mode: 'idle', target: null, targetId: null }

// The universe scene block: mounts the @cosimosi/3d-renderer canvas host + skin/post
// pipeline unchanged (no renderer lifecycle, no skin system, no post pipeline of its own)
// and composes the projected graph inside it. All hooks that need app context run OUT
// HERE — React context does not cross the R3F reconciler, so canvas children get data
// via props only. Per-frame flow: the worker bridge swaps the coordinate buffer ref, the
// package layers read it in useFrame, and the rig polls the machine via getSnapshot() —
// no 60 fps React state and no per-frame store reads.
function UniverseCanvasHost() {
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

  const actorRef = useActorRef(universeNavigationMachine)
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

  const neuronCount = graph?.neurons.length ?? 0

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

  return (
    <UniverseCanvas dpr={[1, VALUES.rendering.maxPixelRatio]} fov={skin.camera.fov}>
      <Background node={backgroundNode} />
      <StarField />
      {/* Emotion color field: additive mood-color blend behind the latent field and bodies
          (renderOrder -2). Memories share the star layer's buffer slots [neuronCount, …). */}
      <NebulaField positions={bridge.coordinates} firstNodeIndex={neuronCount} />
      <LatentStarField field={latentField} />
      <CellStarLayer positions={bridge.coordinates} onFocus={focusNeuron} onFly={flyToNeuron} />
      <StarLayer
        positions={bridge.coordinates}
        firstNodeIndex={neuronCount}
        universeTime={universe?.universeTime ?? null}
        onFocus={focusMemory}
        onFly={flyToMemory}
      />
      <FilamentLayer
        positions={bridge.coordinates}
        neuronIndexById={nodeIndex?.neurons ?? EMPTY_NEURON_INDEX}
        universeTime={universe?.universeTime ?? null}
      />
      <AwakenNeuron field={latentField} newNeuronIds={newNeuronIds} resolveAnchors={resolveAnchors} />
      <NavigationRig getPose={getPose} onArrived={handleArrived} {...UNIVERSE_CAMERA_RIG} />
      <FrameTick onFrame={pump} />
      <PostFX bloom={skin.bloom} />
    </UniverseCanvas>
  )
}

export function UniverseCanvasWidget() {
  return (
    <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
      <UniverseCanvasHost />
    </SkinProvider>
  )
}
