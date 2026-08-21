import { useMemo, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import {
  ADAPTIVE_DPR_FLOOR,
  SkinProvider,
  UniverseCanvas,
  resolveActiveSkin,
  useSkin,
} from '@cosimosi/3d-renderer'
import { useObservabilityFacade } from '@cosimosi/observability/react'
import { useReducedMotion } from '@cosimosi/ui'
import { UNIVERSE_ARRIVAL_CAMERA_POSITION } from '@cosimosi/universe'
import {
  UNIVERSE_BACKDROP,
  UniverseSceneLayers,
  useUniverseScene,
  type UniverseNavigationActorRef,
} from '@cosimosi/universe-render'

import { diagnosticsSurfaceFlag } from '../../../shared/config/index.ts'
import { createSimWorkerSpawner } from '../lib/sim-worker-spawner.ts'
import { PERF_HUD_AVAILABLE, UniversePerfHud } from './UniversePerfHud.tsx'

// The web shell around the shared universe scene. Everything the scene needs is computed by
// `useUniverseScene` — out here, because React context does not cross the R3F reconciler — and this
// file holds only what is genuinely web: the DOM canvas host and the module-Worker sim spawner.
function UniverseCanvasHost({
  navigationActorRef,
}: {
  navigationActorRef?: UniverseNavigationActorRef
}) {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()
  const observability = useObservabilityFacade()
  // Memoized because the bridge is keyed on this identity: a fresh spawner per render would rebuild
  // the sim on every render.
  const simSpawner = useMemo(() => createSimWorkerSpawner(), [])
  const scene = useUniverseScene({
    simSpawner,
    latentStarCount: VALUES.rendering.latentStarCount,
    navigationActorRef,
  })
  // Read out here, not in the HUD: the flag lives in app context, and React context does not cross
  // the R3F reconciler.
  const perfHudEnabled =
    PERF_HUD_AVAILABLE && (observability.getFeatureFlag(diagnosticsSurfaceFlag) ?? false)

  // The shell's half of the adaptive-DPR bridge, identical to mobile's. It has to live out here:
  // R3F re-runs `configure` on every `<Canvas>` render and resets the store whenever `viewport.dpr`
  // disagrees with what this prop resolves to, so a `setDpr` from inside the scene would be undone
  // by the next host re-render. Only a closed sustained-fps window lands here (§3.2).
  const [pixelRatioCap, setPixelRatioCap] = useState<number>(VALUES.rendering.maxPixelRatio)
  // One stable array identity per cap: an inline `[1, max]` is a new object every render, and both
  // hosts key effects on this prop.
  const dpr = useMemo<[number, number]>(() => [ADAPTIVE_DPR_FLOOR, pixelRatioCap], [pixelRatioCap])

  return (
    <div className="relative h-full w-full">
      <UniverseCanvas
        dpr={dpr}
        fov={skin.camera.fov}
        clearColor={skin.sky.night}
        cameraPosition={UNIVERSE_ARRIVAL_CAMERA_POSITION}
      >
        <UniverseSceneLayers
          scene={scene}
          bloom={skin.bloom}
          backdrop={UNIVERSE_BACKDROP.web}
          reducedMotion={reducedMotion}
          onPixelRatio={setPixelRatioCap}
        />
        {perfHudEnabled && <UniversePerfHud />}
      </UniverseCanvas>
    </div>
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
