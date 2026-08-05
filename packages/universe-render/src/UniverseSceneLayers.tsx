import { VALUES } from '@cosimosi/config'
import {
  BandFog,
  FrameTick,
  NavigationRig,
  PostFX,
  SkySphere,
  StarField,
  type BloomParams,
} from '@cosimosi/3d-renderer'
import { UNIVERSE_CAMERA_RIG, advanceSkyRate } from '@cosimosi/universe'

import { AwakenNeuron } from './AwakenNeuron.tsx'
import { CellStarLayer } from './CellStarLayer.tsx'
import { FilamentLayer } from './FilamentLayer.tsx'
import { GistStarLayer } from './GistStarLayer.tsx'
import { LatentStarField } from './LatentStarField.tsx'
import { NebulaField } from './NebulaField.tsx'
import { StarLayer } from './StarLayer.tsx'
import type { UniverseSceneState } from './use-universe-scene.ts'

const EMPTY_NODE_INDEX: Readonly<Record<string, number>> = {}

export interface UniverseSceneLayersProps {
  /** Everything computed outside the canvas by `useUniverseScene`. */
  readonly scene: UniverseSceneState
  /** From the active skin — a scene default, never a purchasable decoration ([V10][I11]). */
  readonly bloom: BloomParams
  readonly reducedMotion: boolean
  /** Lower-fidelity color field for the native MVP; omitted, the field uses its own default. */
  readonly nebulaResolution?: number
  /** Pointer hover — web only. Touch has no hover, so native passes nothing. */
  readonly onMemoryHover?: (index: number | null) => void
}

/**
 * The universe scene itself: every layer, in the one order that works, for both platforms.
 *
 * It renders INSIDE the canvas host, which is why it takes everything as props — React context does
 * not cross the R3F reconciler, so nothing in here may reach for app context. `useUniverseScene`
 * runs outside and hands its result down.
 *
 * Layer order is load-bearing, not stylistic: the sky encloses everything, the color field sits
 * behind the latent field and the bodies, the band fog separates the two z-bands into depth rather
 * than a wall, and `PostFX` must come last because it takes over the render loop.
 */
export function UniverseSceneLayers({
  scene,
  bloom,
  reducedMotion,
  nebulaResolution,
  onMemoryHover,
}: UniverseSceneLayersProps) {
  const {
    bridge,
    nodeIndex,
    neuronCount,
    latentField,
    newNeuronIds,
    paletteVersion,
    skyStops,
    wearing,
    sceneTime,
    getPose,
    onArrived,
    pump,
    focusNeuron,
    flyToNeuron,
    focusMemory,
    flyToMemory,
    selectGist,
    resolveAnchors,
  } = scene

  return (
    <>
      {/* The enclosing emotion sky ([57]) is the one shipped backdrop: the universe's own emotions
          drive its palette ramp ([I3], color only), while the canvas clears to the same bare night. */}
      <SkySphere
        stops={skyStops}
        effect={wearing.BACKGROUND}
        reducedMotion={reducedMotion}
        rateRef={advanceSkyRate}
      />
      <StarField reducedMotion={reducedMotion} />
      {/* Emotion color field: additive mood-color blend behind the latent field and bodies
          (renderOrder -2). Memories share the star layer's buffer slots [neuronCount, …). */}
      <NebulaField
        key={`nebula-${paletteVersion}`}
        positions={bridge.coordinates}
        firstNodeIndex={neuronCount}
        resolution={nebulaResolution}
      />
      <LatentStarField field={latentField} reducedMotion={reducedMotion} />
      <CellStarLayer positions={bridge.coordinates} onFocus={focusNeuron} onFly={flyToNeuron} />
      <StarLayer
        key={`star-${paletteVersion}-${wearing.STAR_SHADER}`}
        shape={wearing.STAR_SHADER}
        positions={bridge.coordinates}
        firstNodeIndex={neuronCount}
        universeTime={sceneTime}
        reducedMotion={reducedMotion}
        onFocus={focusMemory}
        onFly={flyToMemory}
        onHover={onMemoryHover}
      />
      <FilamentLayer
        positions={bridge.coordinates}
        neuronIndexById={nodeIndex?.neurons ?? EMPTY_NODE_INDEX}
        universeTime={sceneTime}
        reducedMotion={reducedMotion}
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
        memoryIndexById={nodeIndex?.episodicMemories ?? EMPTY_NODE_INDEX}
        onSelect={selectGist}
      />
      <AwakenNeuron
        field={latentField}
        newNeuronIds={newNeuronIds}
        resolveAnchors={resolveAnchors}
      />
      <NavigationRig getPose={getPose} onArrived={onArrived} {...UNIVERSE_CAMERA_RIG} />
      <FrameTick onFrame={pump} />
      <PostFX bloom={bloom} />
    </>
  )
}
