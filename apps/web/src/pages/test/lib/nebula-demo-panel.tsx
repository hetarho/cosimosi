import { useMemo, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import { MOODS, createEmotion } from '@cosimosi/emotion'
import type { EpisodicMemory } from '@cosimosi/memory'
import {
  Background,
  CameraControls,
  ColorField,
  PostFX,
  SkinProvider,
  StarField,
  UniverseCanvas,
  resolveActiveSkin,
  resolveBackgroundNode,
  useSkin,
} from '@cosimosi/3d-renderer'
import { Button } from '@cosimosi/ui'

import { buildContributors } from '@cosimosi/universe'
import { m } from '../../../shared/i18n/index.ts'

// Placeholder memories — one per mood, assorted base strengths — scattered around the origin.
// The field is driven through the real palette + contributor path (buildContributors → moodColor),
// so blend/bleed/strength-weighted radius and the emergent tone are verifiable by eye without
// live domain data. Positions live in a static coordinate buffer (the demo has no force-sim; the
// field reads it exactly like production).
function buildDemoScene() {
  const count = MOODS.length
  const positions = new Float32Array(count * 3)
  const memories: EpisodicMemory[] = MOODS.map((mood, i) => {
    const angle = (i / count) * Math.PI * 2
    const ring = 8 + (i % 3) * 4
    positions[i * 3] = Math.cos(angle) * ring
    positions[i * 3 + 1] = Math.sin(angle) * ring
    positions[i * 3 + 2] = ((i % 5) - 2) * 2
    return {
      id: `demo-${i}`,
      name: mood,
      emotion: createEmotion(mood),
      // Spread base strengths across the arousal-set range so bleed radius visibly varies.
      baseStrength: 0.35 + (i % 5) * 0.1,
      recallCount: 0,
      createdUniverseTime: '2026-01-01',
      lastRecalledUniverseTime: null,
      seed: null,
      activations: [],
    }
  })
  return { positions, contributors: buildContributors(memories, { firstNodeIndex: 0 }) }
}

function NebulaDemoScene({ forceWebGL }: { forceWebGL: boolean }) {
  const { skin } = useSkin()
  const backgroundNode = useMemo(() => resolveBackgroundNode(skin.background), [skin.background])
  const scene = useMemo(() => buildDemoScene(), [])
  const positions = useMemo(() => ({ current: scene.positions }), [scene])
  return (
    <UniverseCanvas
      dpr={[1, VALUES.rendering.maxPixelRatio]}
      fov={skin.camera.fov}
      forceWebGL={forceWebGL}
    >
      <Background node={backgroundNode} />
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
