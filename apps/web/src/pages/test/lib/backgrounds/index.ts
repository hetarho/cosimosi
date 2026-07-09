import { AuroraFlow } from './aurora-flow.tsx'
import type { BackgroundCandidate } from './emotion-field.ts'
import { GradientMesh } from './gradient-mesh.tsx'
import { ParticleField } from './particle-field.tsx'
import { PlasmaConic } from './plasma-conic.tsx'
import { StrataWaves } from './strata-waves.tsx'

// The selectable emotion-driven backdrops for the universe showcase. Each takes the universe's
// emotions (1..13, primary-first, normalized weights) and paints them proportionally — the more
// emotions a universe holds, the more finely the field divides among them. Presentation-only.
export const BACKGROUND_CANDIDATES: readonly BackgroundCandidate[] = [
  {
    key: 'aurora-flow',
    label: 'Aurora',
    blurb: 'Drifting curtains — band width ∝ each emotion’s share.',
    Component: AuroraFlow,
  },
  {
    key: 'gradient-mesh',
    label: 'Mesh',
    blurb: 'Soft blobs, one per emotion — blob area ∝ share.',
    Component: GradientMesh,
  },
  {
    key: 'plasma-conic',
    label: 'Plasma',
    blurb: 'A slow wheel — arc sweep ∝ share.',
    Component: PlasmaConic,
  },
  {
    key: 'particle-field',
    label: 'Dust',
    blurb: 'Particle dust — count per emotion ∝ share.',
    Component: ParticleField,
  },
  {
    key: 'strata-waves',
    label: 'Strata',
    blurb: 'Stacked strata — band height ∝ share.',
    Component: StrataWaves,
  },
]

export type {
  BackgroundCandidate,
  EmotionBackground,
  EmotionBackgroundProps,
  EmotionSlice,
} from './emotion-field.ts'
