import { useMemo, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import {
  ADAPTIVE_DPR_FLOOR,
  SkinProvider,
  UniverseCanvas,
  resolveActiveSkin,
  useSkin,
} from '@cosimosi/3d-renderer'
import { useReducedMotion } from '@cosimosi/ui'
import { UNIVERSE_ARRIVAL_CAMERA_POSITION } from '@cosimosi/universe'
import {
  UNIVERSE_BACKDROP,
  UniverseSceneLayers,
  useUniverseScene,
  type UniverseNavigationActorRef,
} from '@cosimosi/universe-render'

import { createSimWorkerSpawner } from '../lib/sim-worker-spawner.ts'

// The native shell around the shared universe scene — the mirror of the web widget. What forks here
// is the MVP fidelity budget (fewer latent bodies, a lower-resolution color field) and the sim
// spawner, which returns null so the bridge runs the sim inline on the JS thread.
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

  // The native half of the adaptive-DPR bridge. The host owns the backing store through this prop,
  // so a step from inside the scene has to come back out here and re-enter as a prop — writing the
  // R3F store directly from the scene would be undone by the host's next live-config pass. Only a
  // closed sustained-fps window lands here; per-frame samples never leave the layer's ref (§3.2).
  const [pixelRatioCap, setPixelRatioCap] = useState<number>(VALUES.rendering.maxPixelRatio)
  // A fresh array literal would re-run the host's live-config effect on every render; this one
  // changes identity exactly when the cap moves.
  const dpr = useMemo<[number, number]>(() => [ADAPTIVE_DPR_FLOOR, pixelRatioCap], [pixelRatioCap])

  return (
    <UniverseCanvas
      dpr={dpr}
      fov={skin.camera.fov}
      clearColor={skin.sky.night}
      cameraPosition={UNIVERSE_ARRIVAL_CAMERA_POSITION}
    >
      <UniverseSceneLayers
        scene={scene}
        bloom={skin.bloom}
        backdrop={UNIVERSE_BACKDROP.mobile}
        reducedMotion={reducedMotion}
        nebulaResolution={VALUES.nebula.fieldResolutionMobile}
        onPixelRatio={setPixelRatioCap}
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
