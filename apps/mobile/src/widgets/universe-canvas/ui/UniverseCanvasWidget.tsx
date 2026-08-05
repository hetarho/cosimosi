import { useMemo } from 'react'

import { VALUES } from '@cosimosi/config'
import { SkinProvider, UniverseCanvas, resolveActiveSkin, useSkin } from '@cosimosi/3d-renderer'
import { useReducedMotion } from '@cosimosi/ui'
import {
  UniverseSceneLayers,
  useUniverseScene,
  type UniverseNavigationActorRef,
} from '@cosimosi/universe-render'

import { createSimWorkerSpawner } from '../lib/sim-worker-spawner.ts'

// Hoisted so the canvas host sees one stable array identity: an inline `[1, max]` is a new object
// every render, and the host keys effects on this prop.
const CANVAS_DPR: [number, number] = [1, VALUES.rendering.maxPixelRatio]

// The native shell around the shared universe scene — the mirror of the web widget. What forks here
// is the MVP fidelity budget (fewer latent bodies, a lower-resolution color field) and the sim
// spawner, which returns null so the bridge runs the sim inline on the JS thread. There is no hover
// on touch, so no hover handler and no glimpse overlay.
function UniverseCanvasHost({
  navigationActorRef,
}: {
  navigationActorRef?: UniverseNavigationActorRef
}) {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()
  const simSpawner = useMemo(() => createSimWorkerSpawner(), [])
  const scene = useUniverseScene({
    simSpawner,
    latentStarCount: VALUES.rendering.latentStarCountMobile,
    navigationActorRef,
  })

  return (
    <UniverseCanvas dpr={CANVAS_DPR} fov={skin.camera.fov} clearColor={skin.sky.night}>
      <UniverseSceneLayers
        scene={scene}
        bloom={skin.bloom}
        reducedMotion={reducedMotion}
        nebulaResolution={VALUES.nebula.fieldResolutionMobile}
      />
    </UniverseCanvas>
  )
}

export function UniverseCanvasWidget({
  navigationActorRef,
}: {
  navigationActorRef?: UniverseNavigationActorRef
} = {}) {
  return (
    <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
      <UniverseCanvasHost navigationActorRef={navigationActorRef} />
    </SkinProvider>
  )
}
