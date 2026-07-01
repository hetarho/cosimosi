import {Background} from './Background.tsx'
import {StarField} from './StarField.tsx'
import {PostFX} from './PostFX.tsx'
import type {UniverseSkin} from '../skin/presets.ts'

// Composite scene for a skin: background + stars + bloom. Consumers mount this inside
// <UniverseCanvas>, so the rendering vocabulary (star/nebula) stays inside this package
// rather than leaking into pages/screens (the ubiquitous-language anti-corruption rule).
export function UniverseScene({skin}: {skin: UniverseSkin}) {
  return (
    <>
      <Background skin={skin} />
      <StarField />
      <PostFX skin={skin} />
    </>
  )
}
