import { useMemo, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import {
  CameraControls,
  ColorField,
  PostFX,
  SkinProvider,
  StarField,
  UniverseCanvas,
  resolveActiveSkin,
  useSkin,
} from '@cosimosi/3d-renderer'
import { Button } from '@cosimosi/ui'

import { moodRingShowcaseScene } from '@cosimosi/universe'
import { m } from '../../../shared/i18n/index.ts'

function NebulaDemoScene({ forceWebGL }: { forceWebGL: boolean }) {
  const { skin } = useSkin()
  const scene = useMemo(moodRingShowcaseScene, [])
  const positions = useMemo(() => ({ current: scene.positions }), [scene])
  return (
    <UniverseCanvas
      dpr={[1, VALUES.rendering.maxPixelRatio]}
      fov={skin.camera.fov}
      clearColor={skin.sky.night}
      forceWebGL={forceWebGL}
    >
      <StarField />
      <ColorField
        positions={positions}
        count={scene.contributors.count}
        nodeIndices={scene.contributors.nodeIndices}
        tints={scene.contributors.tints}
        radii={scene.contributors.radii}
        falloffExponent={VALUES.nebula.falloffExponent}
        baseIntensity={VALUES.nebula.baseIntensity}
        resolution={VALUES.nebula.fieldResolutionWeb}
      />
      <CameraControls />
      <PostFX bloom={skin.bloom} />
    </UniverseCanvas>
  )
}

export function NebulaDemoPanel() {
  const [forceWebGL, setForceWebGL] = useState(false)
  return (
    <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
      <div className="flex flex-col gap-3">
        <Button
          color="neutral"
          className="self-start"
          onClick={() => setForceWebGL((value) => !value)}
        >
          {forceWebGL ? m.test_harness_nebula_use_webgpu() : m.test_harness_nebula_force_webgl()}
        </Button>
        {/* Remount the renderer when the backend flips so the WebGPU→WebGL2 fallback is exercised. */}
        <div className="h-96 overflow-hidden rounded-lg bg-background">
          <NebulaDemoScene key={forceWebGL ? 'gl' : 'gpu'} forceWebGL={forceWebGL} />
        </div>
      </div>
    </SkinProvider>
  )
}
