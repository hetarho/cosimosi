import {useCallback, useEffect, useMemo} from 'react';

import {VALUES} from '@cosimosi/config';
import {
  Background,
  EdgeLineLayer,
  FrameTick,
  InstancedNodeLayer,
  NavigationRig,
  PostFX,
  SkinProvider,
  StarField,
  UniverseCanvas,
  createPrimitiveBodySource,
  resolveActiveSkin,
  resolveBackgroundNode,
  useSkin,
  type NavigationPose,
} from '@cosimosi/3d-renderer';
import {createForceSimNodeIndex, forceSimCoordinateOffset} from '@cosimosi/force-sim';

import {useActorRef} from '../../../shared/model/index.ts';
import {useUniverse} from '../api/use-universe.ts';
import {UNIVERSE_CAMERA_RIG} from '../config/camera-rig.ts';
import {UNIVERSE_SCENE_STYLE} from '../config/scene-style.ts';
import {buildSynapseEndpointIndexPairs, buildUniverseGraph} from '../lib/build-graph.ts';
import {createUniverseSimBridge} from '../lib/sim-bridge.ts';
import {createSimWorkerSpawner} from '../lib/sim-worker-spawner.ts';
import {
  universeNavigationMachine,
  type UniverseNavigationMode,
} from '../model/universe-navigation.machine.ts';

const EMPTY_ENDPOINT_PAIRS = new Uint32Array(0);
const IDLE_POSE: NavigationPose = {mode: 'idle', target: null};

// The universe scene block: mounts the @cosimosi/3d-renderer canvas host + skin/post
// pipeline unchanged (no renderer lifecycle, no skin system, no post pipeline of its own)
// and composes the projected graph inside it. All hooks that need app context run OUT
// HERE — React context does not cross the R3F reconciler, so canvas children get data
// via props only. Per-frame flow: the sim bridge swaps the coordinate buffer ref, the
// package layers read it in useFrame, and the rig polls the machine via getSnapshot() —
// no 60 fps React state and no per-frame store reads.
function UniverseCanvasHost() {
  const {skin} = useSkin();
  const backgroundNode = useMemo(() => resolveBackgroundNode(skin.background), [skin.background]);
  const {universe} = useUniverse();
  const graph = useMemo(() => (universe ? buildUniverseGraph(universe) : null), [universe]);
  const nodeIndex = useMemo(() => (graph ? createForceSimNodeIndex(graph) : null), [graph]);
  const endpointPairs = useMemo(
    () => (graph && nodeIndex ? buildSynapseEndpointIndexPairs(graph, nodeIndex) : EMPTY_ENDPOINT_PAIRS),
    [graph, nodeIndex],
  );
  const bodySource = useMemo(
    () =>
      createPrimitiveBodySource({
        'universe-node-neuron': UNIVERSE_SCENE_STYLE.neuronBody,
        'universe-node-memory': UNIVERSE_SCENE_STYLE.memoryBody,
      }),
    [],
  );

  const bridge = useMemo(() => createUniverseSimBridge(createSimWorkerSpawner()), []);
  useEffect(() => () => bridge.dispose(), [bridge]);
  useEffect(() => {
    if (graph) {
      bridge.start(graph);
    }
  }, [bridge, graph]);

  const actorRef = useActorRef(universeNavigationMachine);
  const pose = useMemo(
    () => ({mode: 'idle' as UniverseNavigationMode, target: [0, 0, 0] as [number, number, number]}),
    [],
  );
  const getPose = useCallback((): NavigationPose => {
    const snapshot = actorRef.getSnapshot();
    const mode = snapshot.value as UniverseNavigationMode;
    const nodeId = snapshot.context.travelNodeId;
    const buffer = bridge.coordinates.current;
    if (mode === 'idle' || !nodeId || !nodeIndex || !buffer) {
      return IDLE_POSE;
    }
    const index = nodeIndex.neurons[nodeId] ?? nodeIndex.episodicMemories[nodeId];
    if (index === undefined) {
      return IDLE_POSE;
    }
    // Polled per glide frame — read the buffer in place, no per-frame allocation.
    const offset = forceSimCoordinateOffset(index);
    pose.mode = mode;
    pose.target[0] = buffer[offset] ?? 0;
    pose.target[1] = buffer[offset + 1] ?? 0;
    pose.target[2] = buffer[offset + 2] ?? 0;
    return pose;
  }, [actorRef, bridge, nodeIndex, pose]);

  const handleArrived = useCallback(() => actorRef.send({type: 'ARRIVED'}), [actorRef]);
  const pump = useCallback((dt: number) => bridge.pump(dt), [bridge]);
  const sendNodeCommand = useCallback(
    (nodeId: string | undefined, command: 'focus' | 'fly') => {
      if (!nodeId) {
        return;
      }
      if (command === 'focus') {
        actorRef.send({type: 'SELECT', nodeId});
        actorRef.send({type: 'FOCUS', nodeId});
      } else {
        actorRef.send({type: 'FLY', nodeId});
      }
    },
    [actorRef],
  );
  const focusNeuron = useCallback(
    (index: number) => sendNodeCommand(graph?.neurons[index]?.id, 'focus'),
    [graph, sendNodeCommand],
  );
  const flyToNeuron = useCallback(
    (index: number) => sendNodeCommand(graph?.neurons[index]?.id, 'fly'),
    [graph, sendNodeCommand],
  );
  const focusMemory = useCallback(
    (index: number) => sendNodeCommand(graph?.episodicMemories[index]?.id, 'focus'),
    [graph, sendNodeCommand],
  );
  const flyToMemory = useCallback(
    (index: number) => sendNodeCommand(graph?.episodicMemories[index]?.id, 'fly'),
    [graph, sendNodeCommand],
  );

  const neuronCount = graph?.neurons.length ?? 0;
  const memoryCount = graph?.episodicMemories.length ?? 0;

  return (
    <UniverseCanvas dpr={[1, VALUES.rendering.maxPixelRatio]} fov={skin.camera.fov}>
      <Background node={backgroundNode} />
      <StarField />
      <InstancedNodeLayer
        source={bodySource}
        bodyId="universe-node-neuron"
        count={neuronCount}
        positions={bridge.coordinates}
        onNodePointerDown={focusNeuron}
        onNodeDoubleClick={flyToNeuron}
      />
      <InstancedNodeLayer
        source={bodySource}
        bodyId="universe-node-memory"
        count={memoryCount}
        positions={bridge.coordinates}
        firstNodeIndex={neuronCount}
        onNodePointerDown={focusMemory}
        onNodeDoubleClick={flyToMemory}
      />
      <EdgeLineLayer
        endpointPairs={endpointPairs}
        count={endpointPairs.length / 2}
        positions={bridge.coordinates}
        color={UNIVERSE_SCENE_STYLE.edgeColor}
      />
      <NavigationRig getPose={getPose} onArrived={handleArrived} {...UNIVERSE_CAMERA_RIG} />
      <FrameTick onFrame={pump} />
      <PostFX bloom={skin.bloom} />
    </UniverseCanvas>
  );
}

export function UniverseCanvasWidget() {
  return (
    <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
      <UniverseCanvasHost />
    </SkinProvider>
  );
}
