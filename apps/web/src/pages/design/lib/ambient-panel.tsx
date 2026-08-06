import { useMemo, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import {
  CameraControls,
  FatLineLayer,
  InstancedNodeLayer,
  PostFX,
  SkinProvider,
  SkySphere,
  StarField,
  UniverseCanvas,
  createCellStarBodySource,
  createFilamentBodySource,
  resolveActiveSkin,
  useSkin,
  type CoordinateBufferRef,
} from '@cosimosi/3d-renderer'
import { showcaseEmotions } from '@cosimosi/emotion'
import { LatentStarField } from '@cosimosi/universe-render'
import {
  UNIVERSE_CAMERA_ENVELOPE,
  ambientShowcaseScene,
  cellStarChannels,
  type AmbientShowcaseScene,
} from '@cosimosi/universe'
import { Switch, useReducedMotion } from '@cosimosi/ui'

import { T } from './showcase-copy.ts'
import { Specimen } from './showcase-shell.tsx'

/**
 * The three bodies a universe is mostly made of, read together: neurons, the synapses between them,
 * and the latent dust behind. They share one frame because each is defined against the others — a
 * neuron reads as a body holding something only next to dust that is not holding anything yet, and a
 * strand reads as a connection only because both its ends are somewhere.
 *
 * None of the three carries an emotion, which is the point: colour here is the one thing that is NOT
 * a variable. What differs is form, width and life.
 */

/**
 * Bench magnification. Production sizes are tuned for a universe seen from its own distance; this
 * specimen is read at arm's length, so the two bodies whose size is a fixed scalar are enlarged
 * together — their RATIO (a neuron reads larger than a mote) is what the rubric scores.
 */
const NEURON_MAGNIFICATION = 8
const STRAND_MAGNIFICATION = 6
const DUST_MAGNIFICATION = 7

/** One quiet feeling behind it all — the sky is context here, not the subject. */
const AMBIENT_SKY_EMOTIONS = 1

/** A bench shows all of its dust: consumption belongs to the universe's own field, not this one. */
const NO_CONSUMED_MOTES: ReadonlySet<number> = new Set()

export function AmbientPanel() {
  const [animate, setAnimate] = useState(true)
  const scene = useMemo(ambientShowcaseScene, [])

  return (
    <Specimen label={T.ambientLabel} note={T.ambientNote}>
      <div className="flex flex-col gap-3">
        <Switch checked={animate} onCheckedChange={setAnimate} label={T.statesMotionLabel} />
        <div className="h-96 overflow-hidden rounded-2xl border border-border">
          <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
            <AmbientCanvas scene={scene} animate={animate} />
          </SkinProvider>
        </div>
        <dl className="grid gap-2 text-xs text-text-subtle sm:grid-cols-3">
          {T.ambientLegend.map(({ term, detail }) => (
            <div key={term}>
              <dt className="text-text-muted">{term}</dt>
              <dd>{detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Specimen>
  )
}

function AmbientCanvas({ scene, animate }: { scene: AmbientShowcaseScene; animate: boolean }) {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()
  const moving = animate && !reducedMotion
  const positions = useMemo<CoordinateBufferRef>(() => ({ current: scene.positions }), [scene])
  const skyStops = useMemo(() => showcaseEmotions(AMBIENT_SKY_EMOTIONS), [])
  const cellStarSource = useMemo(() => createCellStarBodySource(), [])
  const filamentSource = useMemo(() => createFilamentBodySource({ animate: moving }), [moving])
  // The projected half-widths, magnified as one set so the strengths stay in proportion.
  const widths = useMemo(
    () => Float32Array.from(scene.filaments.widths, (width) => width * STRAND_MAGNIFICATION),
    [scene],
  )

  return (
    <UniverseCanvas
      dpr={[1, VALUES.rendering.maxPixelRatio]}
      fov={skin.camera.fov}
      clearColor={skin.sky.night}
    >
      <SkySphere stops={skyStops} effect={skin.sky.effect} reducedMotion={!moving} />
      <StarField reducedMotion={!moving} />
      <LatentStarField
        field={scene.latent}
        reducedMotion={!moving}
        sizeScale={DUST_MAGNIFICATION}
        consumed={NO_CONSUMED_MOTES}
      />
      <InstancedNodeLayer
        source={cellStarSource}
        bodyId="cell-star"
        kind="primitive"
        count={scene.neuronCount}
        positions={positions}
        scale={cellStarChannels().size * NEURON_MAGNIFICATION}
      />
      <FatLineLayer
        source={filamentSource}
        bodyId="filament"
        kind="shader"
        endpointPairs={scene.filaments.endpointPairs}
        count={scene.filaments.count}
        positions={positions}
        widths={widths}
        colors={scene.filaments.colors}
      />
      <CameraControls {...UNIVERSE_CAMERA_ENVELOPE} />
      <PostFX bloom={skin.bloom} />
    </UniverseCanvas>
  )
}
