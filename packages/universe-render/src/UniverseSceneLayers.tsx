import { VALUES } from '@cosimosi/config'
import {
  AdaptiveDprLayer,
  BandFog,
  FrameTick,
  LATENT_FIELD_SEGMENTS,
  NavigationRig,
  PostFX,
  STAR_FIELD_PROFILE,
  SkySphere,
  StarField,
  type BloomParams,
  type StarFieldProfile,
} from '@cosimosi/3d-renderer'
import { UNIVERSE_CAMERA_RIG, advanceSkyRate } from '@cosimosi/universe'

import { AwakenNeuron } from './AwakenNeuron.tsx'
import { CellStarLayer } from './CellStarLayer.tsx'
import { FilamentLayer } from './FilamentLayer.tsx'
import { GistStarLayer } from './GistStarLayer.tsx'
import { LatentStarField } from './LatentStarField.tsx'
import { NebulaField } from './NebulaField.tsx'
import { SpotlightDim } from './SpotlightDim.tsx'
import { StarLayer } from './StarLayer.tsx'
import type { UniverseSceneState } from './use-universe-scene.ts'

const EMPTY_NODE_INDEX: Readonly<Record<string, number>> = {}

/** Everything the two ambient backdrop layers cost, as one platform bundle. */
export interface UniverseBackdropProfile {
  /** Background star count + shell radius — read together, they carry the nesting invariant. */
  readonly starField: StarFieldProfile
  /** Sphere segments per latent mote. */
  readonly latentSegments: number
}

/** The shipped backdrop fidelity per platform. A host states which one it is; there is no default,
 *  because a host that forgets would silently put the web budget on a phone (§3.5). */
export const UNIVERSE_BACKDROP = {
  web: { starField: STAR_FIELD_PROFILE.web, latentSegments: LATENT_FIELD_SEGMENTS.web },
  mobile: { starField: STAR_FIELD_PROFILE.mobile, latentSegments: LATENT_FIELD_SEGMENTS.mobile },
} as const satisfies Record<string, UniverseBackdropProfile>

export interface UniverseSceneLayersProps {
  /** Everything computed outside the canvas by `useUniverseScene`. */
  readonly scene: UniverseSceneState
  /** From the active skin — a scene default, never a purchasable decoration ([V10][I11]). */
  readonly bloom: BloomParams
  /** This platform's ambient backdrop budget — `UNIVERSE_BACKDROP.web` or `.mobile`. */
  readonly backdrop: UniverseBackdropProfile
  readonly reducedMotion: boolean
  /** Lower-fidelity color field for the native MVP; omitted, the field uses its own default. */
  readonly nebulaResolution?: number
  /**
   * Where adaptive quality's pixel-ratio steps land. Required, not optional: both hosts resolve
   * their `dpr` PROP into the R3F store, so a shell that forgot this would silently render at a
   * fixed ratio and the adaptive walk would look like it was working (see `AdaptiveDprLayer`).
   * The shell holds the value in state; must be stable across renders.
   */
  readonly onPixelRatio: (pixelRatio: number) => void
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
  backdrop,
  reducedMotion,
  nebulaResolution,
  onPixelRatio,
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
    pinned,
    getPose,
    getPinnedView,
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
      {/* The enclosing emotion sky is the one shipped backdrop: the universe's own emotions
          drive its palette ramp ([I3], color only), while the canvas clears to the same bare night. */}
      <SkySphere
        stops={skyStops}
        effect={wearing.BACKGROUND}
        reducedMotion={reducedMotion}
        rateRef={advanceSkyRate}
      />
      {/* The backdrop is two worn choices poured together — a mote (form · colour) into a mote
          field (place · density · twinkle) — over this platform's own count and radius, which are a
          budget rather than a taste and so are never for sale. */}
      <StarField
        {...backdrop.starField}
        mote={wearing.MOTE}
        field={wearing.MOTE_FIELD}
        reducedMotion={reducedMotion}
      />
      {/* Emotion color field: additive mood-color blend behind the latent field and bodies
          (renderOrder -2). Memories share the star layer's buffer slots [neuronCount, …). */}
      <NebulaField
        key={`nebula-${paletteVersion}`}
        positions={bridge.coordinates}
        firstNodeIndex={neuronCount}
        resolution={nebulaResolution}
      />
      <LatentStarField
        field={latentField}
        reducedMotion={reducedMotion}
        segments={backdrop.latentSegments}
      />
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
        key={`gist-${paletteVersion}-${wearing.GIST_SHADER}`}
        shape={wearing.GIST_SHADER}
        positions={bridge.coordinates}
        memoryIndexById={nodeIndex?.episodicMemories ?? EMPTY_NODE_INDEX}
        onSelect={selectGist}
      />
      <AwakenNeuron
        field={latentField}
        newNeuronIds={newNeuronIds}
        resolveAnchors={resolveAnchors}
      />
      <NavigationRig
        getPose={getPose}
        getPinnedView={getPinnedView}
        pinned={pinned}
        onArrived={onArrived}
        {...UNIVERSE_CAMERA_RIG}
      />
      <FrameTick onFrame={pump} />
      <AdaptiveDprLayer onPixelRatio={onPixelRatio} />
      {/* The sky holds still for the stars a cross-route action named; `StarLayer` lifts those stars
          past the hold so they are what is left to look at when the jump arrives. */}
      <SpotlightDim reducedMotion={reducedMotion} />
      <PostFX bloom={bloom} />
    </>
  )
}
