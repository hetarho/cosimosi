import { useCallback, useEffect, useMemo } from 'react'

import { VALUES } from '@cosimosi/config'
import { usePaletteVersion } from '@cosimosi/emotion/react'
import {
  createForceSimNodeIndex,
  type ForceSimGraph,
  type ForceSimNodeIndex,
} from '@cosimosi/force-sim'
import type { UniverseSnapshot } from '@cosimosi/memory'
import {
  buildUniverseGraph,
  createUniverseSimBridge,
  generateLatentField,
  universeEmotionSlices,
  type LatentField,
  type SimWorkerSpawner,
  type UniverseSimBridge,
} from '@cosimosi/universe/scene'

export interface SceneAssemblyInputs {
  /** The universe to lay out — the product's GetUniverse read, or a sandbox's own fixtures. */
  readonly universe: UniverseSnapshot | null
  /**
   * The web app returns a module-Worker spawner; React Native has no standard Worker primitive and
   * returns null, which runs the sim inline on the JS thread behind the same bridge seam.
   */
  readonly simSpawner: SimWorkerSpawner | null
  /** How many latent bodies to scatter — the MVP native scene carries fewer. */
  readonly latentStarCount: number
}

export interface SceneAssembly {
  readonly bridge: UniverseSimBridge
  readonly graph: ForceSimGraph | null
  readonly nodeIndex: ForceSimNodeIndex | null
  /** Memories share the star layer's buffer slots starting here; neurons occupy [0, neuronCount). */
  readonly neuronCount: number
  readonly latentField: LatentField
  readonly paletteVersion: number
  readonly skyStops: ReturnType<typeof universeEmotionSlices>
  readonly pump: (dt: number) => void
}

/**
 * The scene's assembly from its inputs alone: the graph and its node index, the sim bridge laying it
 * out, the sky's emotion stops and the latent field. Whoever mounts a universe — the product canvas
 * or the demo's sandbox — assembles it here, so a change to how a scene is put together lands in one
 * place. Navigation, selection and decoration are the product binding's (`useUniverseScene`).
 */
export function useSceneAssembly({
  universe,
  simSpawner,
  latentStarCount,
}: SceneAssemblyInputs): SceneAssembly {
  const graph = useMemo(() => (universe ? buildUniverseGraph(universe) : null), [universe])
  const nodeIndex = useMemo(() => (graph ? createForceSimNodeIndex(graph) : null), [graph])

  const bridge = useMemo(() => createUniverseSimBridge(simSpawner), [simSpawner])
  useEffect(() => () => bridge.dispose(), [bridge])
  useEffect(() => {
    if (graph) bridge.start(graph)
  }, [bridge, graph])
  const pump = useCallback((dt: number) => bridge.pump(dt), [bridge])

  // The emotion-colored layers memoize each memory's mood color into instanced buffers, so a live
  // palette swap (module-level setMoodPalette) is invisible to their memos. Remounting them on the
  // palette version recomputes the buffers through the unchanged moodColor seam — a live re-color
  // with no rendering-package edit and no refetch. Only the color-bearing layers key on it.
  const paletteVersion = usePaletteVersion()

  const memories = universe?.memories
  const skyStops = useMemo(() => {
    // The version is a genuine input: moodColor reads the module-level palette it stamps.
    void paletteVersion
    // Every feeling the universe holds goes to the sky. The emotion axis divides the sphere by
    // weight, so more feelings means smaller territories, never a muddier wash.
    return memories ? universeEmotionSlices(memories) : []
  }, [memories, paletteVersion])

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

  return {
    bridge,
    graph,
    nodeIndex,
    neuronCount: graph?.neurons.length ?? 0,
    latentField,
    paletteVersion,
    skyStops,
    pump,
  }
}
