import { useMemo } from 'react'

import { VALUES } from '@cosimosi/config'
import { SkinProvider, UniverseCanvas, resolveActiveSkin, useSkin } from '@cosimosi/3d-renderer'
import { useReducedMotion } from '@cosimosi/ui'
import {
  UNIVERSE_BACKDROP,
  UniverseSceneLayers,
  useUniverseScene,
  type UniverseNavigationActorRef,
} from '@cosimosi/universe-render'

import { setHoveredMemoryIndex } from '../model/hovered-memory-store.ts'
import { createSimWorkerSpawner } from '../lib/sim-worker-spawner.ts'
import { HoverGlimpse } from './HoverGlimpse.tsx'

// Hoisted so the canvas host sees one stable array identity: an inline `[1, max]` is a new object
// every render, and the host keys effects on this prop.
const CANVAS_DPR: [number, number] = [1, VALUES.rendering.maxPixelRatio]

// The web shell around the shared universe scene. Everything the scene needs is computed by
// `useUniverseScene` — out here, because React context does not cross the R3F reconciler — and this
// file holds only what is genuinely web: the DOM canvas host, the hover/glimpse overlay (touch has
// no hover), and the module-Worker sim spawner.
function UniverseCanvasHost({
  navigationActorRef,
}: {
  navigationActorRef?: UniverseNavigationActorRef
}) {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()
  // Memoized because the bridge is keyed on this identity: a fresh spawner per render would rebuild
  // the sim on every render.
  const simSpawner = useMemo(() => createSimWorkerSpawner(), [])
  const scene = useUniverseScene({
    simSpawner,
    latentStarCount: VALUES.rendering.latentStarCount,
    navigationActorRef,
  })

  return (
    <div className="relative h-full w-full">
      <UniverseCanvas dpr={CANVAS_DPR} fov={skin.camera.fov} clearColor={skin.sky.night}>
        <UniverseSceneLayers
          scene={scene}
          bloom={skin.bloom}
          backdrop={UNIVERSE_BACKDROP.web}
          reducedMotion={reducedMotion}
          onMemoryHover={setHoveredMemoryIndex}
        />
      </UniverseCanvas>
      {/* Shown plainly, no decay warning ([R8a]) — and outside the canvas host so a hover
          never re-renders the scene tree. */}
      <HoverGlimpse universeTime={scene.universeTime} />
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
