import { useMemo } from 'react'
import { Background } from '../layers/Background.tsx'
import { StarField } from '../layers/StarField.tsx'
import { PostFX } from '../layers/PostFX.tsx'
import { CameraControls } from '../layers/CameraControls.tsx'
import { resolveBackgroundNode } from './backgrounds/registry.ts'
import type { UniverseSkin } from './skins/presets.ts'

// The concrete universe composition: resolves the skin's background node (registry dispatch
// on type) and wires the generic layers — background + floating stars + bloom. Consumers
// mount this inside <UniverseCanvas>, so the rendering vocabulary (nebula/star/bloom) stays
// inside the package rather than leaking into pages/screens. Memoized on skin.background so
// the node rebuilds only on skin change, not on every render.
export function UniverseScene({ skin }: { skin: UniverseSkin }) {
  const backgroundNode = useMemo(() => resolveBackgroundNode(skin.background), [skin.background])
  return (
    <>
      <Background node={backgroundNode} />
      <StarField />
      <CameraControls />
      <PostFX bloom={skin.bloom} />
    </>
  )
}
